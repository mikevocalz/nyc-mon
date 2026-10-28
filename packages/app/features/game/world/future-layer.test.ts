// The future layer: deterministic placements, NYCHA-only selection and the
// AdSurface registry contract (future-layer.ts). Style matches
// facade-detail.test.ts / city-mesh-v3.test.ts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { parseCityDataset, projectCityPoint } from '../city-dataset.ts';
import { buildCityMeshes, MAX_BILLBOARDS } from './city-mesh.ts';
import {
  adEligibility, adSurface, adSurfaceId, hasNychaBalcony, isNychaTower, longestEdgeDir, MAX_PIECES_PER_ROOF,
  roofscapePlan, scaledRing, unprojectCityPoint,
} from './future-layer.ts';
import { createPbrCityMaterials } from './pbr-materials.ts';
import { createStreetClearance } from './walkability.ts';

const SUN_AWAY: [number, number] = [0.5, -0.5];
const SOURCE = { url: 'https://www.openstreetmap.org/copyright', attribution: 'Test only', license: 'ODbL-1.0', retrievedAt: '2026-10-17T00:00:00Z' };

function build(dataset: ReturnType<typeof parseCityDataset>, future: boolean) {
  const materials = createPbrCityMaterials(THREE, { sunDirection: [0.5, -0.5, 0.7] });
  const built = buildCityMeshes(THREE, dataset, materials, SUN_AWAY, createStreetClearance(dataset), future);
  return { built, dispose: () => { built.dispose(); materials.dispose(); } };
}

/** A small v3 tile: one NYCHA-plan tower beside a brick walk-up, streets on two sides. */
function nychaTile() {
  return parseCityDataset({
    version: 3, id: 'future-test', origin: [-73.95, 40.81], extentMeters: 200,
    sources: [SOURCE], notes: [],
    buildings: [
      { id: 'ny:1', p: [0, 0, 30, 0, 30, -20, 0, -20], h: 50, c: 'nycha', e: 5, f: 16, fh: 3.2, vs: 12, fi: 0 },
      { id: 'br:1', p: [60, 0, 80, 0, 80, -15, 60, -15], h: 14, c: 'brick', e: 5, f: 4, fh: 3.4, vs: 0, fi: 0 },
    ],
    roads: [
      { id: 'r:s', c: 'residential', w: 9, s: 4.5, p: [-40, 10, 120, 10] },
      { id: 'r:e', c: 'residential', w: 9, s: 4.5, p: [40, 10, 40, -40] },
    ],
    areas: [], trees: { census: [], fill: [] }, landmarks: [],
    transit: { subway: [], shelters: [] }, furniture: { hydrant: [], linknyc: [], bikeRack: [] },
  });
}

test('the roofscape plan is deterministic, capped and only carries the four record kinds', () => {
  const ring: [number, number][] = [[0, 0], [30, 0], [30, -20], [0, -20]];
  const tower = { id: 'ny:1', class: 'nycha' as const, heightMeters: 50 };
  const a = roofscapePlan(tower, ring);
  const b = roofscapePlan(tower, ring);
  assert.deepEqual(a, b);
  assert.ok(a.length <= MAX_PIECES_PER_ROOF);
  for (const piece of a) {
    assert.ok(['bulkhead', 'roofAc', 'chimneyPot', 'standpipe'].includes(piece.kind));
    assert.ok(Number.isFinite(piece.x) && Number.isFinite(piece.z));
  }
  // Churches keep bare roofs; sheds under the height floor get nothing.
  assert.equal(roofscapePlan({ id: 'c:1', class: 'church', heightMeters: 20 }, ring).length, 0);
  assert.equal(roofscapePlan({ id: 's:1', class: 'plain', heightMeters: 4 }, ring).length, 0);
  // A footprint too small for any kind.
  assert.equal(roofscapePlan(tower, [[0, 0], [4, 0], [4, -4], [0, -4]]).length, 0);
});

test('the NYCHA kit selects the nycha class only', () => {
  assert.equal(isNychaTower({ class: 'nycha' }), true);
  for (const c of ['brick', 'brownstone', 'glass', 'civic', 'church', 'plain'] as const) {
    assert.equal(isNychaTower({ class: c }), false, c);
  }
  // Balcony picks are deterministic and land inside the share's range.
  const share = Array.from({ length: 400 }, (_, i) => hasNychaBalcony('ny:1', 0, i)).filter(Boolean).length / 400;
  assert.ok(share > 0.2 && share < 0.5, `${share}`);
  assert.deepEqual(scaledRing([[0, 0], [10, 0], [10, 10], [0, 10]], 0.5), [[2.5, 2.5], [7.5, 2.5], [7.5, 7.5], [2.5, 7.5]]);
  const [dx, dz] = longestEdgeDir([[0, 0], [30, 0], [30, -20], [0, -20]]);
  assert.ok(Math.abs(dx) === 1 && dz === 0, 'the 30 m edge wins');
});

test('ad surfaces: stable ids, residency-based eligibility, geo round-trip', () => {
  assert.equal(adSurfaceId('osm:way:1', 3), 'ad:osm:way:1:e3');
  // The canon's residency rule: no paid campaigns on real residences.
  for (const c of ['brownstone', 'brick', 'nycha', 'church'] as const) assert.equal(adEligibility(c), 'community', c);
  for (const c of ['glass', 'civic', 'plain'] as const) assert.equal(adEligibility(c), 'campaign', c);
  const origin: [number, number] = [-73.95, 40.81];
  const [x, z] = projectCityPoint([-73.94, 40.82], origin);
  const geo = unprojectCityPoint(x, z, origin);
  assert.ok(Math.abs(geo[0] + 73.94) < 1e-9 && Math.abs(geo[1] - 40.82) < 1e-9);
  const surface = adSurface(
    { id: 'b:1', class: 'brick' }, 2, 10, -5, [0, 1], 9, 7, 12,
    { id: 't', origin, extentMeters: 850 },
  );
  assert.equal(surface.eligibility, 'community');
  assert.equal(surface.kind, 'facade-panel');
  assert.deepEqual([...surface.formats], ['emissive-panel']);
  assert.ok(surface.lodPriority > 0.9 && surface.lodPriority <= 1);
});

test('flagged build: the facelift touches nycha towers only, and adds no draws', () => {
  const tile = nychaTile();
  const off = build(tile, false);
  const on = build(tile, true);
  // Draw calls stay flat: everything merges into the existing buffers. On a
  // tile with no neon content the flag can surface the one neon mesh — the
  // delta is never more than a single draw.
  assert.ok(on.built.stats.drawCalls <= off.built.stats.drawCalls + 1,
    `${on.built.stats.drawCalls} vs ${off.built.stats.drawCalls}`);
  // Off: the layer is fully absent — reversible by the flag.
  assert.deepEqual(off.built.stats.future, {
    bulkheads: 0, acUnits: 0, chimneyPots: 0, standpipes: 0,
    nychaTowers: 0, nychaPanels: 0, nychaBalconies: 0, nychaEntrances: 0,
    roofGardens: 0, lightStrips: 0,
  });
  const f = on.built.stats.future;
  assert.equal(f.nychaTowers, 1, 'one tower in the tile');
  assert.equal(f.roofGardens, 1);
  assert.ok(f.nychaPanels >= 4, `every 8 m+ edge is panelled, got ${f.nychaPanels}`);
  assert.ok(f.lightStrips >= 4);
  assert.equal(f.nychaEntrances, 1, 'one entrance on the recorded front');
  assert.ok(f.nychaBalconies > 0);
  assert.ok(on.built.stats.triangles > off.built.stats.triangles, 'the overlay adds geometry');
  off.dispose(); on.dispose();
});

test('the real tile: 19 towers treated, ad inventory capped with unique stable ids', () => {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const off = build(dataset, false);
  const on = build(dataset, true);
  const f = on.built.stats.future;
  // The real tile already draws neon and detail, so the layer adds no draw at all.
  assert.equal(on.built.stats.drawCalls, off.built.stats.drawCalls);
  assert.equal(f.nychaTowers, 19);
  assert.equal(f.roofGardens, 19);
  assert.ok(f.nychaEntrances <= 19);
  assert.ok(f.bulkheads + f.acUnits + f.chimneyPots + f.standpipes > 0, 'the roofscape plan produced furniture');
  const ids = new Set(on.built.adSurfaces.map((s) => s.id));
  assert.ok(on.built.adSurfaces.length <= MAX_BILLBOARDS);
  assert.equal(ids.size, on.built.adSurfaces.length, 'every surface id is unique');
  for (const s of on.built.adSurfaces) {
    assert.equal(s.tileId, dataset.id);
    assert.ok(s.widthMeters > 0 && s.heightMeters > 0 && s.topMeters > 0);
    assert.ok(s.eligibility === 'campaign' || s.eligibility === 'community');
  }
  off.dispose(); on.dispose();
});
