// The gen lane's host tests (Phase 3 slice 1): the spec's sanity, the seed contract and the
// package's shape against the streamer's CellPackage — all pure, no streamer mocks, no three.
// What is NOT covered here: a rendered frame. The layer registers through the same
// registerChunks path the blocks and far tier stream through, and that path has its own
// coverage (cells/cell-stream.walk.test.ts); a visual pass belongs to the flag-on review.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CELL, cellKey, cellNum } from '../cells/cell-rules.ts';
import { WORLD_PRESETS, type WorldPresetName } from '../../perf/tier-presets.ts';
import {
  GEN_SEED, buildGenIndex, genSeedFor, genSpecForCell,
  type GenDataset,
} from './spec.ts';
import { emitGenCell, genCellBoxes, GEN_TRIS_PER_BOX, GEN_VERTS_PER_BOX } from './buildings.ts';
import { genCellPackage, genCellPackages, GEN_REACH_M } from './layer.ts';

const flat = (pts: readonly (readonly [number, number])[]) => pts.flat();

const schoolBlock = (): GenDataset => ({
  buildings: [],
  areas: [{ kind: 'school', ring: flat([[8, 8], [120, 8], [120, 120], [8, 120]]) }],
  roads: [],
});

const emptyBlock = (): GenDataset => ({ buildings: [], areas: [], roads: [] });

test('genSeedFor is stable, u32 and cell-keyed', () => {
  const a = genSeedFor('3_-2'), b = genSeedFor('3_-2'), c = genSeedFor('3_-3');
  assert.equal(a, b);
  assert.equal(a >>> 0, a);
  assert.notEqual(a, c);
  // GEN_SEED rides in the key: reseeding the constant reseeds every cell.
  assert.notEqual(genSeedFor('0_0'), genSeedFor(`${GEN_SEED}:0_0`));
});

test('a marked school area produces a school lot', () => {
  const index = buildGenIndex(schoolBlock());
  const spec = genSpecForCell(0, 0, { index });
  const school = spec.lots.find((l) => l.use === 'school');
  assert.ok(school, 'no school lot on a school area');
  assert.equal(school.class, 'civic');
  assert.equal(school.styleId, 8 /* CIVIC_STONE */);
  assert.ok(school.floors >= 3 && school.floors <= 5, `floors ${school.floors}`);
  // interior candidates inside the area ring are rejected, so the school is the only lot
  assert.equal(spec.lots.length, 1);
});

test('a pitch gets a low stadium stand, a park area only a marker', () => {
  const index = buildGenIndex({
    buildings: [],
    areas: [
      { kind: 'pitch', ring: flat([[CELL + 8, 8], [CELL + 120, 8], [CELL + 120, 60], [CELL + 8, 60]]) },
      { kind: 'park', ring: flat([[8, CELL + 8], [120, CELL + 8], [120, CELL + 120], [8, CELL + 120]]) },
    ],
    roads: [],
  });
  const stadium = genSpecForCell(1, 0, { index }).lots.find((l) => l.use === 'stadium');
  assert.ok(stadium, 'no stadium lot on a pitch');
  assert.ok(stadium.floors <= 2, `a grandstand at ${stadium.floors} floors`);
  // the stand hugs an edge, it does not pave the pitch: well under half the clipped area
  const rectArea = (stadium.rect[2] - stadium.rect[0]) * (stadium.rect[3] - stadium.rect[1]);
  assert.ok(rectArea < 0.4 * 112 * 52, `stand covers ${rectArea} m2 of the pitch`);
  const marker = genSpecForCell(0, 1, { index }).lots.find((l) => l.use === 'park');
  assert.ok(marker, 'no park marker on a park area');
  assert.equal(marker.floors, 0, 'the marker carries no massing');
});

test('interior fill keeps clear of record footprints and road corridors', () => {
  // a record building covering the whole cell: nothing generates inside it
  const covered = genSpecForCell(0, 0, {
    index: buildGenIndex({
      buildings: [{ ring: flat([[-8, -8], [136, -8], [136, 136], [-8, 136]]) }],
      areas: [], roads: [],
    }),
  });
  assert.equal(covered.lots.filter((l) => l.floors > 0).length, 0);

  // a road through the cell centre: every surviving lot centre clears its corridor
  const points = flat([[64, -16], [64, 144]]);
  const index = buildGenIndex({
    buildings: [],
    areas: [],
    roads: [{ widthMeters: 12, sidewalkMeters: 4, points }],
  });
  const spec = genSpecForCell(0, 0, { index });
  assert.ok(spec.lots.length > 0, 'the road should not starve the whole cell');
  const corridor = 12 / 2 + 4 + 4;
  // a lot survives when its rect, inflated by the corridor, does not reach the centreline x = 64
  for (const lot of spec.lots) {
    assert.ok(lot.rect[2] + corridor <= 64 || lot.rect[0] - corridor >= 64, `lot rect ${lot.rect} inside the corridor`);
  }
});

test('spec derivation is deterministic per cell and differs across cells', () => {
  const index = buildGenIndex(schoolBlock());
  const a = genSpecForCell(0, 0, { index });
  const b = genSpecForCell(0, 0, { index });
  assert.deepEqual(a, b);
  const next = genSpecForCell(1, 0, { index });
  assert.notDeepEqual(next.lots, a.lots);
  assert.equal(a.key, cellKey(0, 0));
  assert.equal(a.num, cellNum(0, 0));
});

test('emission is byte-identical run to run, on spec and on package', async () => {
  const spec = genSpecForCell(2, -1, { index: buildGenIndex(emptyBlock()) });
  const boxes = genCellBoxes(spec, () => 0);
  assert.ok(boxes.length > 0, 'an empty block should fill some interior lots');
  const a = emitGenCell(spec, boxes);
  const b = emitGenCell(spec, genCellBoxes(spec, () => 0));
  assert.deepEqual(a.position, b.position);
  assert.deepEqual(a.color, b.color);
  assert.deepEqual(a.emissive, b.emissive);
  assert.deepEqual(a.index, b.index);

  // and through the streamer package's own lazy path: prefetch -> ready -> arrays
  const pkg = genCellPackage(spec, () => 0);
  assert.ok(pkg);
  assert.equal(pkg.ready?.(), false);
  await pkg.prefetch?.();
  assert.equal(pkg.ready?.(), true);
  const again = pkg.attributes;
  pkg.release?.();
  assert.equal(pkg.ready?.(), false);
  const rebuilt = pkg.attributes;
  assert.deepEqual(again.position!.array, rebuilt.position!.array);
  assert.deepEqual(again.index, rebuilt.index);
});

test('the package emits the near layout the blocks material binds', async () => {
  const spec = genSpecForCell(2, -1, { index: buildGenIndex(emptyBlock()) });
  const pkg = genCellPackage(spec, () => 0);
  assert.ok(pkg);
  await pkg.prefetch?.();
  const attrs = pkg.attributes;
  for (const name of ['position', 'color', 'emissive', 'uv'] as const) assert.ok(attrs[name], `missing ${name}`);
  assert.equal(attrs.position!.itemSize, 3);
  assert.equal(attrs.position!.normalized, false);
  assert.ok(attrs.position!.array instanceof Float32Array);
  for (const name of ['color', 'emissive'] as const) {
    assert.equal(attrs[name]!.itemSize, 4);
    assert.equal(attrs[name]!.normalized, true);
    assert.ok(attrs[name]!.array instanceof Uint8Array);
    assert.equal(attrs[name]!.array.length, pkg.vertexCount * 4);
  }
  assert.equal(attrs.uv!.itemSize, 2);
  assert.equal(attrs.uv!.array.length, pkg.vertexCount * 2);
  // counts consistent: index inside the vertex range, counts matching the box arithmetic
  assert.equal(pkg.vertexCount, attrs.position!.array.length / 3);
  assert.ok(pkg.index, 'indexed');
  assert.equal(pkg.index!.length, pkg.triangles! * 3);
  let max = 0;
  for (const i of pkg.index!) if (i > max) max = i;
  assert.ok(max < pkg.vertexCount, `index ${max} past ${pkg.vertexCount} verts`);
  assert.equal(pkg.triangles! % GEN_TRIS_PER_BOX, 0);
  assert.equal(pkg.vertexCount % GEN_VERTS_PER_BOX, 0);
  // the frame: cell-local positions around the cell centre, scene-space bounds
  const [ox, , oz] = pkg.positionFrame!.origin;
  assert.equal(ox, spec.cx * CELL + CELL / 2);
  assert.equal(oz, spec.cz * CELL + CELL / 2);
  const pos = attrs.position!.array as Float32Array;
  for (let i = 0; i < pkg.vertexCount; i++) {
    const x = pos[i * 3]! + ox, y = pos[i * 3 + 1]!, z = pos[i * 3 + 2]! + oz;
    assert.ok(x >= pkg.bounds[0]! - 1e-6 && x <= pkg.bounds[3]! + 1e-6, `x ${x} outside bounds`);
    assert.ok(y >= pkg.bounds[1]! - 1e-6 && y <= pkg.bounds[4]! + 1e-6, `y ${y} outside bounds`);
    assert.ok(z >= pkg.bounds[2]! - 1e-6 && z <= pkg.bounds[5]! + 1e-6, `z ${z} outside bounds`);
  }
  // the near encoding: a wall vertex carries the glow (emissive alpha = night share), a roof
  // vertex carries none — verts 16..19 of the first box are its roof quad
  const emissive = attrs.emissive!.array as Uint8Array;
  assert.ok(emissive[3]! > 0, 'a wall emits at night');
  assert.equal(emissive[16 * 4 + 3], 0, 'the roof does not glow');
});

test('a generated cell stays under every preset gen row', async () => {
  // the densest cell the lane can make: every interior lot taken (fillShare 1)
  const index = buildGenIndex(emptyBlock());
  const spec = genSpecForCell(-4, 5, { index, fillShare: 1 });
  const pkg = genCellPackage(spec, () => 0);
  assert.ok(pkg);
  await pkg.prefetch?.();
  assert.ok(pkg.vertexCount < 65536, `the u16 index covers ${pkg.vertexCount} verts`);
  for (const name of ['ipad-a12x', 'phone', 'high'] as const satisfies readonly WorldPresetName[]) {
    const gen = WORLD_PRESETS[name].vdPort.gen;
    assert.ok(gen.cellDraws >= 1, `${name} draws`);
    assert.ok(pkg.bytes <= gen.geometryBytes, `${name}: cell ${pkg.bytes} B over ${gen.geometryBytes} B`);
    assert.ok(pkg.triangles! <= gen.triangles, `${name}: cell ${pkg.triangles} tris over ${gen.triangles}`);
  }
  // the reach must sit inside the small presets' resident radius or wanted cells get refused
  assert.ok(GEN_REACH_M <= WORLD_PRESETS['ipad-a12x'].residentRadiusM);
  assert.ok(GEN_REACH_M <= WORLD_PRESETS.phone.residentRadiusM);
});

test('genCellPackages enumerates the extent lazily and the inside predicate gates records lots', () => {
  // the deferred contract (slice 4): a package per enumerated cell, spec uncomputed until the
  // streamer nears it — a two-cell-extent toy registers 4x4
  const dataset = { ...emptyBlock(), extentMeters: CELL };
  const packages = genCellPackages(dataset, () => 0, () => true, { extentCells: 2 });
  assert.equal(packages.length, 16);
  for (const pkg of packages) {
    assert.equal(pkg.num, cellNum(pkg.cx, pkg.cz));
    assert.equal(pkg.size, CELL);
    // the conservative bound covers the cell box: registration never reads a spec
    assert.ok(pkg.bounds[0]! <= pkg.cx * CELL && pkg.bounds[3]! >= (pkg.cx + 1) * CELL, 'bounds cover the cell in x');
    assert.ok(pkg.bounds[2]! <= pkg.cz * CELL && pkg.bounds[5]! >= (pkg.cz + 1) * CELL, 'bounds cover the cell in z');
    assert.ok(pkg.bounds[0]! >= -CELL * 2 && pkg.bounds[3]! <= CELL * 2, 'inside the extent');
    assert.equal(pkg.ready?.(), false, 'a deferred package starts unready');
  }
  // record-covered cells outside the dataset square stay unregistered
  assert.equal(genCellPackages(dataset, () => 0, () => true, { extentCells: 2, recordCell: () => true }).length, 0);
  // the inside predicate gates interior lots (spec level: the lot centre is what is tested)
  const index = buildGenIndex(emptyBlock());
  for (const [cx, cz] of [[0, 0], [-1, -1], [3, -4]] as const) {
    const spec = genSpecForCell(cx, cz, { index, inside: (x, z) => x >= 0 && z >= 0 });
    for (const lot of spec.lots) {
      const lx = (lot.rect[0] + lot.rect[2]) / 2, lz = (lot.rect[1] + lot.rect[3]) / 2;
      assert.ok(lx >= 0 && lz >= 0, `lot centre ${lx},${lz} outside bounds in cell ${cx},${cz}`);
    }
  }
});
