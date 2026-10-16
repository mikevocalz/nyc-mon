import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseCityDataset, type CityDatasetV2, type CityRoad } from '../city-dataset.ts';
import { CROWN_REACH, MAX_OVERHANG, treePlacements } from './foliage.ts';
import { segmentDistanceSq } from './geometry.ts';
import { placeStreetFurniture } from './street-furniture.ts';
import { BAND_INNER, createStreetClearance, KERB_MARGIN, WALKWAY_CLASSES } from './walkability.ts';

/** Brute force, no grid: the carriageway gap the road mesh draws (half width), over every road. */
function gapTo(roads: readonly CityRoad[], x: number, z: number): number {
  let gap = Infinity;
  for (const r of roads) {
    if (WALKWAY_CLASSES.has(r.class)) continue;
    for (let i = 2; i < r.points.length; i += 2) {
      const d = Math.sqrt(segmentDistanceSq(x, z, r.points[i - 2]!, r.points[i - 1]!, r.points[i]!, r.points[i + 1]!)) - r.widthMeters / 2;
      if (d < gap) gap = d;
    }
  }
  return gap;
}

function tile(roads: CityRoad[], osm: number[], fill: number[]): CityDatasetV2 {
  return {
    version: 2, id: 't', origin: [-73.95, 40.81], extentMeters: 200,
    source: { url: 'https://www.openstreetmap.org/copyright', attribution: 't', license: 'ODbL-1.0', retrievedAt: '2026-10-16T00:00:00Z' },
    notes: [], buildings: [], areas: [], landmarks: [], roads, trees: { osm, fill },
  };
}
const road = (id: string, cls: CityRoad['class'], points: number[], width: number): CityRoad => ({
  id, class: cls, widthMeters: width, sidewalkMeters: 0, points, widthEstimated: false,
});

test('OSM trees in the street move to the sidewalk band within 3 m, else drop; generated ones drop', () => {
  // A 10 m street along x and a 3 m zebra crossing across it at x = 50.
  const roads = [road('s', 'residential', [-100, 0, 100, 0], 10), road('c', 'crossing', [50, -6, 50, 6], 3)];
  const osm = [0, 4, /* 1 m inside the kerb: moves */ 20, 0.5 /* mid-street: 4.5+ m to a kerb, drops */, 50, 6 /* on the crossing's end */];
  const fill = [-20, 3 /* in the road: drops */, -30, 7 /* on the sidewalk: stays */];
  const { trees, report } = treePlacements(tile(roads, osm, fill));
  assert.equal(report.osmMoved, 2);
  assert.equal(report.osmDropped, 1);
  assert.equal(report.fillDropped, 1);
  for (const t of trees) {
    assert.ok(gapTo(roads, t.x, t.z) >= KERB_MARGIN, `${t.x},${t.z}`);
    assert.ok(CROWN_REACH * t.scale <= gapTo(roads, t.x, t.z) + MAX_OVERHANG + 1e-9, 'crown overhang');
  }
  const moved = trees.find((t) => t.osm && t.x === 0)!;
  assert.ok(Math.abs(moved.z - (5 + BAND_INNER + 0.2)) < 1e-6, `moved to ${moved.z}`);
});

test('the clearance agrees with a brute-force carriageway check', () => {
  const roads = [road('s', 'primary', [-100, 0, 100, 0], 18), road('w', 'footway', [-100, 12, 100, 12], 3)];
  const c = createStreetClearance(tile(roads, [], []));
  for (const [x, z] of [[0, 0], [0, 9.2], [0, 9.4], [0, 12], [30, -20]] as const) {
    assert.equal(c.inCarriageway(x, z), gapTo(roads, x, z) < KERB_MARGIN, `${x},${z}`);
  }
  assert.equal(c.inCarriageway(0, 12), false, 'footways are sidewalk, not street');
});

test('the real tile: no tree, pole or sign base inside any carriageway or crossing', () => {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const clearance = createStreetClearance(dataset);
  const { trees, report } = treePlacements(dataset, clearance);
  const { signs, lights, intersections } = placeStreetFurniture(dataset, clearance);
  const bases: [string, number, number][] = [
    ...trees.map((t) => ['tree', t.x, t.z] as [string, number, number]),
    ...signs.map((s) => ['sign', s.x, s.z] as [string, number, number]),
    ...lights.map((l) => ['light', l.x, l.z] as [string, number, number]),
  ];
  // Brute force over every road would be slow for 7k trees; the grid check is pinned to brute force above,
  // and here every sign and light, and every 25th tree, is also checked the slow way.
  const bad = bases.filter(([, x, z]) => clearance.inCarriageway(x, z));
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length} bases in the street`);
  bases.forEach(([kind, x, z], i) => {
    if (kind === 'tree' && i % 25 !== 0) return;
    assert.ok(gapTo(dataset.roads, x, z) >= KERB_MARGIN - 1e-9, `${kind} at ${x.toFixed(1)},${z.toFixed(1)}`);
  });
  for (const t of trees) assert.ok(CROWN_REACH * t.scale <= clearance.kerbGap(t.x, t.z) + MAX_OVERHANG + 1e-9);
  console.log(`clearance: ${JSON.stringify(report)}; trees ${trees.length} of ${dataset.trees.osm.length / 2 + dataset.trees.fill.length / 2}; signs ${signs.length} of ${intersections}; lights ${lights.length}`);
  assert.ok(signs.length > 100, `${signs.length} signs`);
  assert.ok(lights.length > 300, `${lights.length} lights`);
});
