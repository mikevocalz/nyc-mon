// N9 (docs/plans/harlem-v3-valdrada-prompt.md §9): the mesh consumes v3 facts
// where they exist and runs the v2 hash rules byte-for-byte where they do not.
// Draw calls stay flat — one mesh per material, facts only change what is
// written into the shared buffers.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { parseCityDataset } from '../city-dataset.ts';
import { buildCityMeshes } from './city-mesh.ts';
import { hasFireEscape, hasStoop, hasWaterTower } from './facade-detail.ts';
import { hashUnit } from './geometry.ts';
import { createPbrCityMaterials } from './pbr-materials.ts';
import { syntheticTileV2, syntheticTileV3 } from './synthetic-tile.ts';
import { createStreetClearance } from './walkability.ts';
import { WINDOW_GRID } from './windows.ts';

const SUN_AWAY: [number, number] = [0.5, -0.5];

function build(dataset: ReturnType<typeof parseCityDataset>) {
  const materials = createPbrCityMaterials(THREE, { sunDirection: [0.5, -0.5, 0.7] });
  const built = buildCityMeshes(THREE, dataset, materials, SUN_AWAY, createStreetClearance(dataset));
  return { built, dispose: () => { built.dispose(); materials.dispose(); } };
}

const attr = (built: ReturnType<typeof build>['built'], name: string, attribute: string) => {
  const mesh = built.meshes.find((m) => m.name === name);
  assert.ok(mesh, `${name} mesh`);
  return mesh.geometry.getAttribute(attribute).array as Float32Array;
};

const SOURCE = { url: 'https://www.openstreetmap.org/copyright', attribution: 'Test only', license: 'ODbL-1.0', retrievedAt: '2026-10-15T00:00:00Z' };
const v3Tile = (over: Record<string, unknown>) =>
  parseCityDataset({
    version: 3, id: 'v3-facts', origin: [-73.95, 40.81], extentMeters: 200,
    sources: [SOURCE], notes: [],
    buildings: [{ id: 'f:1', p: [0, 0, 20, 0, 20, -15, 0, -15], h: 14, c: 'brick', e: 31, ...over }],
    roads: [
      // South of edge 0 and east of edge 1, so both faces are street faces.
      { id: 'r:s', c: 'residential', w: 9, s: 4.5, p: [-40, 10, 60, 10] },
      { id: 'r:e', c: 'residential', w: 9, s: 4.5, p: [30, 10, 30, -40] },
    ],
    areas: [], trees: { census: [], fill: [] }, landmarks: [],
    transit: { subway: [], shelters: [] }, furniture: { hydrant: [], linknyc: [], bikeRack: [] },
  });

test('draw calls do not grow on v3: mesh count per material equals the v2 fixture', () => {
  const v2 = build(parseCityDataset(syntheticTileV2()));
  const v3 = build(parseCityDataset(syntheticTileV3()));
  const names = (built: typeof v2.built) => built.meshes.map((m) => m.name).sort();
  assert.deepEqual(names(v3.built), names(v2.built));
  assert.equal(v3.built.stats.drawCalls, v2.built.stats.drawCalls);
  // On the real Valdrada tile the same hold: 12 drawables, one per material (v2 rules measured 12).
  const real = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const city = build(real);
  assert.equal(city.built.stats.drawCalls, 12);
  assert.equal(city.built.meshes.length, 12);
  v2.dispose(); v3.dispose(); city.dispose();
});

test('a v3 building without facts emits byte-for-byte the v2 geometry', () => {
  // Strip every v3 field: the renderer must see a v2 building.
  const tile = syntheticTileV3();
  const bare = { ...tile, buildings: tile.buildings.map((b) => ({ id: b.id, p: b.p, h: b.h, c: b.c, e: 0, ...(b.n ? { n: b.n } : {}) })) };
  const v2 = build(parseCityDataset(syntheticTileV2()));
  const v3 = build(parseCityDataset(bare));
  const v3ByName = new Map(v3.built.meshes.map((m) => [m.name, m]));
  for (const mesh of v2.built.meshes) {
    const other = v3ByName.get(mesh.name);
    assert.ok(other, `${mesh.name} exists in the stripped v3 build`);
    for (const name of ['position', 'normal', 'color', 'uv']) {
      assert.deepEqual(
        [...(other.geometry.getAttribute(name).array as Float32Array)],
        [...(mesh.geometry.getAttribute(name).array as Float32Array)],
        `${mesh.name} ${name} matches the v2 bytes`,
      );
    }
  }
  v2.dispose(); v3.dispose();
});

test('floors and floor height set the window rows; window width sets the bays', () => {
  const { built, dispose } = build(v3Tile({ f: 4, fh: 3.5, ww: 1.8, d: 0 }));
  const uv = attr(built, 'city:walls-masonry', 'uv');
  // Detail parts write uv -10; the wall maxima carry the scaled grid.
  let maxU = 0; let maxV = 0;
  for (let i = 0; i < uv.length; i += 2) {
    if (uv[i]! > maxU) maxU = uv[i]!;
    if (uv[i + 1]! > maxV) maxV = uv[i + 1]!;
  }
  const perimeter = 20 + 15 + 20 + 15;
  assert.ok(Math.abs(maxU - (perimeter * WINDOW_GRID.masonry.bay) / 1.8) < 1e-4, `bay pitch ${maxU}`);
  assert.ok(Math.abs(maxV - (14 * WINDOW_GRID.masonry.floor) / 3.5) < 1e-4, `floor pitch ${maxV}`);
  // The shader reads floor(v / 3.2): 14 m at 3.5 m floors is four rows = f.
  assert.equal(Math.round(maxV / WINDOW_GRID.masonry.floor), 4);
  dispose();

  // The same tile with the fields stripped keeps the fixed 3.2 m / 3.0 m grid.
  const bare = build(v3Tile({}));
  const uv2 = attr(bare.built, 'city:walls-masonry', 'uv');
  let maxU2 = 0; let maxV2 = 0;
  for (let i = 0; i < uv2.length; i += 2) {
    if (uv2[i]! > maxU2) maxU2 = uv2[i]!;
    if (uv2[i + 1]! > maxV2) maxV2 = uv2[i + 1]!;
  }
  assert.equal(maxU2, perimeter);
  assert.equal(maxV2, 14);
  bare.dispose();
});

test('the detail bitset replaces every share hash', () => {
  // All of cornice, escape, stoop and tower from the bits: `f:1` is brick, but
  // the bits — not the class or hash — carry each feature.
  const on = build(v3Tile({ f: 4, fh: 3.5, d: 15, fi: 0 }));
  assert.equal(on.built.stats.cornices, 2, 'cornice bit on both street faces');
  assert.equal(on.built.stats.stoops, 1, 'stoop on the recorded front');
  assert.equal(on.built.stats.fireEscapes, 1, 'one escape on the recorded front');
  assert.equal(on.built.stats.waterTowers, 1);
  on.dispose();

  // The same tile with d:0 emits none of it — the bits gate, the hash never runs.
  const off = build(v3Tile({ d: 0 }));
  assert.equal(off.built.stats.cornices, 0);
  assert.equal(off.built.stats.stoops, 0);
  assert.equal(off.built.stats.fireEscapes, 0);
  assert.equal(off.built.stats.waterTowers, 0);
  off.dispose();

  // And without `d` the hash rules predict the counts, exactly as v2.
  const hash = build(v3Tile({}));
  assert.equal(hash.built.stats.cornices, 2, 'brick under 45 m, both street faces');
  assert.equal(hash.built.stats.stoops, hasStoop('f:1') ? 1 : 0);
  let escapes = 0;
  for (const i of [0, 1]) if (hasFireEscape('f:1', i, 14, 'brick')) escapes++;
  assert.equal(hash.built.stats.fireEscapes, escapes);
  assert.equal(hash.built.stats.waterTowers, hasWaterTower('f:1', 14, 'brick') ? 1 : 0);
  hash.dispose();
});

test('the front edge index picks the face for single-face details', () => {
  const pos = (built: ReturnType<typeof build>['built']) => attr(built, 'city:street-detail', 'position');
  // fi:0 — stoop and escape on the south face: detail reaches toward z = +3.
  const south = build(v3Tile({ d: 6, fi: 0 }));
  const sp = pos(south.built);
  let sMaxZ = -Infinity; let sMaxX = -Infinity;
  for (let i = 0; i < sp.length; i += 3) {
    if (sp[i + 2]! > sMaxZ) sMaxZ = sp[i + 2]!;
    if (sp[i]! > sMaxX) sMaxX = sp[i]!;
  }
  assert.ok(sMaxZ > 2.5 && sMaxX <= 20.1, `front edge 0: detail at z=${sMaxZ.toFixed(2)}, x=${sMaxX.toFixed(2)}`);
  south.dispose();

  // fi:1 — the same details move to the east face (x = 20, reaching toward x = 23).
  const east = build(v3Tile({ d: 6, fi: 1 }));
  const ep = pos(east.built);
  let eMaxX = -Infinity; let eMaxZ = -Infinity;
  for (let i = 0; i < ep.length; i += 3) {
    if (ep[i]! > eMaxX) eMaxX = ep[i]!;
    if (ep[i + 2]! > eMaxZ) eMaxZ = ep[i + 2]!;
  }
  assert.ok(eMaxX > 22 && eMaxZ <= 0.1, `front edge 1: detail at x=${eMaxX.toFixed(2)}, z=${eMaxZ.toFixed(2)}`);
  east.dispose();

  // A stored clockwise ring: fi indexes the stored order, so edge 3 is the
  // same south face the ccw loop visits as edge 3 after the reversal.
  const cw = parseCityDataset({
    version: 3, id: 'v3-cw', origin: [-73.95, 40.81], extentMeters: 200,
    sources: [SOURCE], notes: [],
    buildings: [{ id: 'f:2', p: [0, 0, 0, -15, 20, -15, 20, 0], h: 14, c: 'brick', e: 31, d: 6, fi: 3 }],
    roads: [{ id: 'r:s', c: 'residential', w: 9, s: 4.5, p: [-40, 10, 60, 10] }],
    areas: [], trees: { census: [], fill: [] }, landmarks: [],
    transit: { subway: [], shelters: [] }, furniture: { hydrant: [], linknyc: [], bikeRack: [] },
  });
  const flipped = build(cw);
  const fp = pos(flipped.built);
  let fMaxZ = -Infinity;
  for (let i = 0; i < fp.length; i += 3) if (fp[i + 2]! > fMaxZ) fMaxZ = fp[i + 2]!;
  assert.ok(fMaxZ > 2.5, `clockwise ring: recorded front at z=${fMaxZ.toFixed(2)}`);
  flipped.dispose();
});

test('the storefront bit gates the shop front; sh sets its band and ww its bays', () => {
  const shopTile = (over: Record<string, unknown>) =>
    parseCityDataset({
      version: 3, id: 'v3-shop', origin: [-73.95, 40.81], extentMeters: 200,
      sources: [SOURCE], notes: [],
      buildings: [{ id: 's:1', p: [0, 0, 20, 0, 20, -15, 0, -15], h: 12, c: 'brick', e: 31, ...over }],
      roads: [{ id: 'r:1', c: 'primary', w: 10, s: 4, p: [-40, 10, 60, 10] }],
      areas: [], trees: { census: [], fill: [] }, landmarks: [],
      transit: { subway: [], shelters: [] }, furniture: { hydrant: [], linknyc: [], bikeRack: [] },
    });

  // Bit clear: the avenue face stays bare even though it is commercial frontage.
  const off = build(shopTile({ d: 0 }));
  assert.equal(off.built.stats.storefronts, 0);
  assert.equal(off.built.stats.awnings, 0);
  assert.equal(off.built.stats.shopSigns, 0);
  off.dispose();

  // Bit set: awnings on the recorded 1.8 m bay module — on the shader's own
  // column lattice (gates and panes share it), centred per column, not on
  // edge-centred bays. The avenue sits within 14 m of edges 0 (south, 20 m),
  // 1 (east, 15 m) and 3 (west, 15 m); only the rear edge stays bare.
  const on = build(shopTile({ d: 16, sh: 4.5, ww: 1.8 }));
  const pitch = 1.8;
  const inset = 0.6;
  // Ring edges in order: (start-u, length) pairs accumulating like emitWalls.
  const edgeStarts = [0, 20, 35, 55];
  const edgeLengths = [20, 15, 20, 15];
  const expectedAwnings = [0, 1, 3].reduce((sum, i) => {
    const u0 = edgeStarts[i]!;
    const len = edgeLengths[i]!;
    let count = 0;
    for (let cIdx = Math.ceil((u0 + inset) / pitch - 0.5); cIdx <= Math.floor((u0 + len - inset) / pitch - 0.5); cIdx++) {
      if (hashUnit(`s:1:${i}:${cIdx}:awning`) <= 0.55) count++;
    }
    return sum + count;
  }, 0);
  assert.equal(on.built.stats.awnings, expectedAwnings);
  assert.ok(expectedAwnings > 0);
  // The shop band caps at the recorded storefront height, not 3.45/4.05.
  const neonY = attr(on.built, 'city:neon', 'position');
  let shopBandTop = 0;
  for (let i = 1; i < neonY.length; i += 3) if (neonY[i]! < 6 && neonY[i]! > shopBandTop) shopBandTop = neonY[i]!;
  assert.ok(Math.abs(shopBandTop - 4.5) < 1e-4, `shop band top ${shopBandTop}`);
  on.dispose();

  // Without sh the band keeps the v2 height.
  const fixed = build(shopTile({ d: 16 }));
  const ny = attr(fixed.built, 'city:neon', 'position');
  let fixedTop = 0;
  for (let i = 1; i < ny.length; i += 3) if (ny[i]! < 6 && ny[i]! > fixedTop) fixedTop = ny[i]!;
  assert.ok(fixedTop <= 4.05 + 1e-4, `fixed band top ${fixedTop}`);
  fixed.dispose();
});

test('a landmark marquee follows the recorded front edge, not the guessed street face', () => {
  const markTile = (fi?: number) =>
    parseCityDataset({
      version: 3, id: 'v3-mark', origin: [-73.95, 40.81], extentMeters: 200,
      sources: [SOURCE], notes: [],
      buildings: [{ id: 'm:1', p: [0, 0, 20, 0, 20, -15, 0, -15], h: 14, c: 'civic', e: 1, ...(fi !== undefined ? { fi } : {}) }],
      roads: [{ id: 'r:1', c: 'residential', w: 9, s: 4.5, p: [-40, 10, 60, 10] }],
      areas: [], trees: { census: [], fill: [] },
      landmarks: [{ key: 'apollo-theater', name: 'Apollo Theater', buildingId: 'm:1', x: 10, z: -7.5 }],
      transit: { subway: [], shelters: [] }, furniture: { hydrant: [], linknyc: [], bikeRack: [] },
    });
  const minX = (built: ReturnType<typeof build>['built']) => {
    const p = attr(built, 'city:landmarks', 'position');
    let min = Infinity;
    for (let i = 0; i < p.length; i += 3) if (p[i]! < min) min = p[i]!;
    return min;
  };
  // The guessed face is the road side (edge 0); fi:3 records the west edge.
  const guessed = build(markTile());
  assert.ok(minX(guessed.built) > 1, `street-face marquee min x ${minX(guessed.built)}`);
  guessed.dispose();
  const recorded = build(markTile(3));
  assert.ok(minX(recorded.built) < 0, `recorded-edge marquee min x ${minX(recorded.built)}`);
  recorded.dispose();
});
