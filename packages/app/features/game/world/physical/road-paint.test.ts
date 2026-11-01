// Road paint follows the lane graph: lane lines and stop bars land inside
// the carriageway where the sim's traffic drives, the double yellow splits
// two-way pieces only, crosswalks come one per crosswalk leg, and colours
// are the token values in linear space, as three's Color would give them.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { physicalCityMaterials } from '@acme/theme';
import { parseCityDataset, type CityDatasetV3, type CityRoad } from '../../city-dataset.ts';
import { buildLaneTopology } from '../../living-city/topology.ts';
import { createStreetClearance } from '../walkability.ts';
import { ROAD_PAINT } from '../physical-materials-constants.ts';
import { buildRoadPaint, createRoadPaintMaterial, createRoadPaintMesh, srgbToLinear, trimEnds } from './road-paint.ts';
import { compileWgsl, stubRenderer, testUniforms } from './physical.test-support.ts';

function tile(roads: CityRoad[]): CityDatasetV3 {
  return {
    version: 3, id: 't', origin: [-73.95, 40.81], extentMeters: 200,
    sources: [{ url: 'https://www.openstreetmap.org/copyright', attribution: 't', license: 'ODbL-1.0', retrievedAt: '2026-10-16T00:00:00Z' }],
    notes: [], buildings: [], areas: [], landmarks: [], roads,
    trees: { census: [], fill: [] }, transit: { subway: [], shelters: [] }, furniture: { hydrant: [], linknyc: [], bikeRack: [] },
  };
}
const road = (id: string, cls: CityRoad['class'], points: number[], width: number, extra: Partial<CityRoad> = {}): CityRoad => ({
  id, class: cls, widthMeters: width, sidewalkMeters: 3, points, widthEstimated: false, ...extra,
});
/** The signal-controller test's four-way: two-way 4-lane streets crossing, four OSM crossing ways. */
const crossing = () => tile([
  road('ew-w', 'residential', [-60, 0, -6, 0], 12, { lanes: 4 }),
  road('ew-e', 'residential', [6, 0, 60, 0], 12, { lanes: 4 }),
  road('ns-n', 'residential', [0, -60, 0, -6], 12, { lanes: 2 }),
  road('ns-s', 'residential', [0, 6, 0, 60], 12, { lanes: 2, oneway: 1 }),
  road('cw-e', 'crossing', [8, -8, 8, 8], 2),
  road('cw-w', 'crossing', [-8, -8, -8, 8], 2),
  road('cw-n', 'crossing', [-8, -8, 8, -8], 2),
  road('cw-s', 'crossing', [-8, 8, 8, 8], 2),
]);

/** Strip centres (the mean of each quad's four corners), by colour. */
function centres(paint: ReturnType<typeof buildRoadPaint>) {
  const out: { x: number; z: number; yellow: boolean; period: number }[] = [];
  for (let q = 0; q < paint.index.length / 6; q++) {
    const v = paint.index[q * 6]!;
    let x = 0; let z = 0;
    for (let k = 0; k < 4; k++) { x += paint.position[(v + k) * 3]!; z += paint.position[(v + k) * 3 + 2]!; }
    out.push({ x: x / 4, z: z / 4, yellow: paint.color[v * 3 + 2]! < 0.1, period: paint.paint[v * 3 + 1]! });
  }
  return out;
}

test('colours are the road-paint tokens in linear space, as three.Color converts them', () => {
  for (const hex of Object.values(physicalCityMaterials.roadPaint)) {
    const c = new THREE.Color(hex);
    const v = Number.parseInt(hex.slice(1), 16);
    assert.ok(Math.abs(srgbToLinear(((v >> 16) & 255) / 255) - c.r) < 1e-6);
    assert.ok(Math.abs(srgbToLinear(((v >> 8) & 255) / 255) - c.g) < 1e-6);
    assert.ok(Math.abs(srgbToLinear((v & 255) / 255) - c.b) < 1e-6);
  }
});

test('trimEnds cuts metres off each end along the polyline', () => {
  assert.deepEqual(trimEnds([[0, 0], [10, 0], [10, 10]], 2, 3), [[2, 0], [10, 0], [10, 7]]);
  assert.deepEqual(trimEnds([[0, 0], [4, 0]], 2, 2), []);
});

test('the four-way: lane lines, a double yellow per two-way piece, stop bars and four crosswalks', () => {
  const dataset = crossing();
  const topology = buildLaneTopology(dataset);
  const paint = buildRoadPaint(dataset, topology);
  // ew pieces: 2 lanes each way → one dashed line per direction; ns-n: 1 each way → none; ns-s one-way 2 lanes → one.
  assert.equal(paint.stats.laneLines, 2 + 2 + 0 + 1);
  assert.equal(paint.stats.centreLines, 3, 'ew-w, ew-e, ns-n are two-way; ns-s is one-way');
  assert.equal(paint.stats.crosswalks, topology.xwalks.length);
  assert.equal(paint.stats.crosswalks, 4);
  // One bar per approach into the junction: ew-w, ew-e and ns-n each bring one; one-way ns-s only leaves it.
  const approaches = new Set(topology.lanes.filter((l) => !l.internal && topology.nodeById.get(l.to)?.kind === 'junction').map((l) => `${l.roadId}:${l.dir}`));
  assert.equal(approaches.size, 3);
  assert.equal(paint.stats.stopBars, approaches.size);
  // Every non-crosswalk mark sits inside a carriageway: paint lands where the traffic drives.
  const clearance = createStreetClearance(dataset);
  for (const c of centres(paint)) {
    if (c.period === ROAD_PAINT.crosswalkPeriod) continue;
    assert.ok(clearance.inCarriageway(c.x, c.z, 0), `mark at ${c.x.toFixed(2)}, ${c.z.toFixed(2)} outside the carriageway`);
  }
  // The double yellow straddles the centre line of the east–west street, 0.12 m each side.
  const yellow = centres(paint).filter((c) => c.yellow && Math.abs(c.z) < 1);
  assert.ok(yellow.length >= 4);
  for (const c of yellow) assert.ok(Math.abs(Math.abs(c.z) - ROAD_PAINT.yellowOffset) < 1e-4, `yellow at z ${c.z}`);
});

test('the real tile: markings on the lane graph, inside the carriageways, and the material compiles', async () => {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const topology = buildLaneTopology(dataset);
  const paint = buildRoadPaint(dataset, topology);
  assert.ok(paint.stats.laneLines > 50 && paint.stats.stopBars > 100 && paint.stats.crosswalks > 50, JSON.stringify(paint.stats));
  assert.equal(paint.stats.crosswalks, topology.xwalks.length);
  const clearance = createStreetClearance(dataset);
  let inside = 0; let total = 0;
  for (const c of centres(paint)) {
    if (c.period === ROAD_PAINT.crosswalkPeriod) continue;
    total++;
    if (clearance.inCarriageway(c.x, c.z, 0)) inside++;
  }
  // Mitred offsets at sharp CSCL bends can push a strip centre a little past a kerb; the measured share is pinned.
  assert.ok(inside / total > 0.99, `${inside}/${total} marks inside the carriageway`);
  // Deterministic.
  assert.deepEqual(buildRoadPaint(dataset, topology).position, paint.position);

  const material = createRoadPaintMaterial(THREE, testUniforms());
  const mesh = createRoadPaintMesh(THREE, paint, material);
  const out = compileWgsl(await stubRenderer(), mesh, material);
  assert.match(out.vertex, /paint/);
  assert.match(out.vertex, /side/);
  mesh.geometry.dispose(); material.dispose();
});
