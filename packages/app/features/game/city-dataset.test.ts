import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';
import { resolveResume } from '@acme/core';
import {
  CITY_DATASET_MIGRATIONS,
  parseCityDataset,
  projectCityPoint,
  RECORD_CLASS,
  RECORD_DETAIL,
  RECORD_FLOORS,
  RECORD_HEIGHT,
  RECORD_STYLE,
} from './city-dataset.ts';
import { syntheticTileV2 as fixtureV2, syntheticTileV3 as fixtureV3 } from './world/synthetic-tile.ts';
// Synthetic validation fixtures only. These are not a shipped NYC map.
function fixtureV1() {
  return { version: 1, id: 'test-tile', origin: [-73.95, 40.81],
    source: { url: 'https://www.openstreetmap.org/copyright', attribution: 'Test only', license: 'ODbL-1.0', retrievedAt: '2026-10-14T00:00:00Z' },
    features: [
      { id: 'building:1', kind: 'building', heightMeters: 12, points: [[-73.95,40.81],[-73.949,40.81],[-73.949,40.811],[-73.95,40.81]] },
      { id: 'road:1', kind: 'road', widthMeters: 8, points: [[-73.95,40.81],[-73.949,40.811]] },
    ] };
}

test('v3: parses the record fields, the sources list and the new collections', () => {
  const input = fixtureV3();
  const parsed = parseCityDataset(input);
  assert.equal(parsed.version, 3);
  assert.equal(parsed.sources.length, 2);
  assert.equal(parsed.sources[1]!.licenseUrl, 'https://opendatacommons.org/licenses/odbl/1-0/');
  const b = parsed.buildings[0]!;
  assert.equal(b.floors, 4);
  assert.equal(b.floorHeightMeters, 3.5);
  assert.equal(b.styleId, 5);
  assert.equal(b.storefrontHeightMeters, 0);
  assert.equal(b.windowWidthMeters, 1.75);
  assert.equal(b.frontEdgeIndex, 0);
  assert.equal(b.detailMask, 67);
  // e = 5 = RECORD_HEIGHT | RECORD_FLOORS: the rest stay estimates.
  assert.equal(b.heightEstimated, false);
  assert.equal(b.floorsEstimated, false);
  assert.equal(b.classEstimated, true);
  assert.equal(b.styleEstimated, true);
  assert.equal(b.detailEstimated, true);
  const road = parsed.roads[0]!;
  assert.deepEqual([road.lanes, road.oneway, road.speedMph, road.segmentId], [2, 1, 25, 7]);
  assert.deepEqual(parsed.trees.census, [-20, 50]);
  assert.deepEqual(parsed.furniture.hydrant, [1, 2, 0.5]);
  assert.deepEqual(parsed.furniture.bikeRack, [3, 4, 1.2, 6, 7, 0]);
  input.buildings[0]!.p[0] = 999;
  assert.equal(parsed.buildings[0]!.ring[0], 0, 'the parser owns its copy');
});

test('v3: rejects bad sources, unknown classes, dangling landmarks, bad triplets and a front edge outside the ring', () => {
  for (const patch of [{ version: 4 }, { sources: [] }, { origin: [0, 0] }, { buildings: [], roads: [], areas: [] }]) {
    assert.throws(() => parseCityDataset({ ...fixtureV3(), ...patch }), JSON.stringify(patch));
  }
  const badSource = fixtureV3(); badSource.sources[0]!.url = 'http://example.com';
  assert.throws(() => parseCityDataset(badSource), /HTTPS/);
  const unknown = fixtureV3(); (unknown.buildings[0] as { c: string }).c = 'castle';
  assert.throws(() => parseCityDataset(unknown), /Invalid city dataset/);
  const dangling = fixtureV3(); dangling.landmarks[0]!.buildingId = 'nope';
  assert.throws(() => parseCityDataset(dangling), /missing building/);
  const triplets = fixtureV3(); triplets.furniture.hydrant = [1, 2];
  assert.throws(() => parseCityDataset(triplets), /Triplet/);
  const nan = fixtureV3(); (nan.furniture as { linknyc: number[] }).linknyc = [1, Number.NaN, 0];
  assert.throws(() => parseCityDataset(nan));
  const edge = fixtureV3(); edge.buildings[0]!.fi = 9;
  assert.throws(() => parseCityDataset(edge), /front edge/);
});

test('v3: the first Zod issue names the field path', () => {
  const input = fixtureV3();
  input.buildings[1]!.h = -1;
  assert.throws(() => parseCityDataset(input), /buildings\.1\.h/);
  input.buildings[1]!.h = 60;
  input.roads[0]!.l = 500;
  assert.throws(() => parseCityDataset(input), /roads\.0\.l/);
});

test('v2 tiles still parse into v3 shape, keeping v2 estimate flags', () => {
  const input = fixtureV2();
  const parsed = parseCityDataset(input);
  assert.equal(parsed.version, 3);
  assert.equal(parsed.buildings[0]!.class, 'brownstone');
  assert.equal(parsed.buildings[0]!.classEstimated, true);
  assert.equal(parsed.buildings[0]!.heightEstimated, false);
  assert.equal(parsed.buildings[0]!.floorsEstimated, true);
  assert.equal(parsed.buildings[0]!.styleEstimated, true);
  assert.equal(parsed.buildings[0]!.detailEstimated, true);
  assert.equal(parsed.buildings[0]!.floors, undefined);
  assert.equal(parsed.buildings[1]!.name, 'Tower');
  assert.equal(parsed.roads[0]!.sidewalkMeters, 4.5);
  assert.equal(parsed.roads[0]!.lanes, undefined);
  assert.equal(parsed.areas[0]!.kind, 'park');
  assert.deepEqual(parsed.trees.census, [-20, 50]);
  assert.deepEqual(parsed.furniture, { hydrant: [], linknyc: [], bikeRack: [] });
  assert.equal(parsed.landmarks[0]!.key, 'apollo-theater');
  input.buildings[0]!.p[0] = 999;
  assert.equal(parsed.buildings[0]!.ring[0], 0);
  assert.equal(parsed.sources[0]!.license, 'ODbL-1.0');
});

test('v2: rejects bad versions, provenance, duplicates, unknown classes and dangling landmarks', () => {
  for (const patch of [{ version: 4 }, { source: {} }, { origin: [0, 0] }, { buildings: [], roads: [], areas: [] }]) {
    assert.throws(() => parseCityDataset({ ...fixtureV2(), ...patch }));
  }
  const duplicate = fixtureV2(); duplicate.buildings[1]!.id = 'b:1';
  assert.throws(() => parseCityDataset(duplicate), /Duplicate/);
  const unknown = fixtureV2(); (unknown.buildings[0] as { c: string }).c = 'castle';
  assert.throws(() => parseCityDataset(unknown), /Invalid city dataset/);
  const dangling = fixtureV2(); dangling.landmarks[0]!.buildingId = 'nope';
  assert.throws(() => parseCityDataset(dangling), /missing building/);
  const http = fixtureV2(); http.source.url = 'http://example.com';
  assert.throws(() => parseCityDataset(http), /HTTPS/);
});

test('v2: rejects corrupt geometry, non-finite or oversized dimensions and the tile radius', () => {
  for (const h of [Number.NaN, Infinity, -1, 0, 1001]) {
    const input = fixtureV2(); input.buildings[0]!.h = h;
    assert.throws(() => parseCityDataset(input));
  }
  const odd = fixtureV2(); odd.buildings[0]!.p.pop();
  assert.throws(() => parseCityDataset(odd), /Odd/);
  const line = fixtureV2(); line.buildings[0]!.p = [0, 0, 10, 0, 20, 0];
  assert.throws(() => parseCityDataset(line), /area/);
  const far = fixtureV2(); far.roads[0]!.p = [0, 0, 2500, 0];
  assert.throws(() => parseCityDataset(far), /radius/);
  const still = fixtureV2(); still.roads[0]!.p = [5, 5, 5, 5];
  assert.throws(() => parseCityDataset(still), /distinct/);
  const nan = fixtureV2(); nan.trees.fill = [Number.NaN, 0];
  assert.throws(() => parseCityDataset(nan));
});

test('v2 and v3 reject oversized budgets before building anything', () => {
  const many = fixtureV2();
  many.buildings = Array.from({ length: 20_001 }, (_, i) => ({ ...fixtureV2().buildings[0]!, id: `b:${i}` }));
  assert.throws(() => parseCityDataset(many));
  const long = fixtureV2(); long.roads[0]!.p = Array.from({ length: 10_000 }, (_, i) => i % 100);
  assert.throws(() => parseCityDataset(long));
  const manyV3 = fixtureV3();
  manyV3.buildings = Array.from({ length: 20_001 }, (_, i) => ({ ...fixtureV3().buildings[0]!, id: `b:${i}` }));
  assert.throws(() => parseCityDataset(manyV3));
});

test('v1 tiles migrate to v3 at the same place', () => {
  const parsed = parseCityDataset(fixtureV1());
  assert.equal(parsed.version, 3);
  assert.equal(parsed.buildings.length, 1);
  assert.equal(parsed.buildings[0]!.class, 'plain');
  assert.equal(parsed.buildings[0]!.ring.length, 6, 'closing point dropped');
  const [x, z] = projectCityPoint([-73.949, 40.811], [-73.95, 40.81]);
  assert.equal(parsed.roads[0]!.points[2], x);
  assert.equal(parsed.roads[0]!.points[3], z);
  const open = fixtureV1(); open.features[0]!.points.pop();
  assert.throws(() => parseCityDataset(open), /closed/);
  const outside = fixtureV1(); outside.features[1]!.points[0] = [0, 0];
  assert.throws(() => parseCityDataset(outside), /NYC/);
});

const ORIGIN = { crs: 'EPSG:4326' as const, longitude: -73.94975, latitude: 40.81005 };
function worldSave(datasetId: string, datasetVersion: number) {
  return {
    version: 1, revision: 5, savedAt: 1_760_000_000_000, deviceId: 'device-a', playerId: 'caller-1',
    sessionId: 'session-1', worldInstanceId: 'world-1', districtId: 'harlem',
    position: { ...ORIGIN, longitude: -73.945 },
    dataset: { datasetId, datasetVersion, originRef: ORIGIN },
    headingRadians: 0.5,
    camera: { x: 412.5, z: -187.25, yaw: 0.6, distance: 160 },
    gameplay: { pill: 'paused' },
    sync: { syncedRevision: 5, pendingSince: null },
  };
}

function resumeWith(dataset: { datasetId: string; datasetVersion: number }, blob: unknown) {
  return resolveResume({
    candidates: [{ source: 'local', blob }],
    now: 1_760_100_000_000,
    ownerId: 'caller-1',
    dataset: { ...dataset, originRef: ORIGIN },
    datasetMigrations: CITY_DATASET_MIGRATIONS,
  });
}

test('v2 and v1 saves resume on the v3 tile through the migration chain, positions untouched', () => {
  const v3 = { datasetId: 'harlem-apollo-20261017', datasetVersion: 3 };
  const fromV2 = resumeWith(v3, worldSave('harlem-apollo-20261014', 2));
  assert.equal(fromV2.kind, 'resume', 'v2 save must not hit incompatible-dataset');
  if (fromV2.kind !== 'resume') return;
  assert.deepEqual(fromV2.save.dataset, { ...v3, originRef: ORIGIN });
  assert.equal(fromV2.save.position.longitude, -73.945);
  const fromV1 = resumeWith(v3, worldSave('harlem-apollo-20261014', 1));
  assert.equal(fromV1.kind, 'resume');
  const fromV2onV2 = resumeWith({ datasetId: 'harlem-apollo-20261014', datasetVersion: 2 }, worldSave('harlem-apollo-20261014', 1));
  assert.equal(fromV2onV2.kind, 'resume', 'the same-id v1 to v2 chain still works');
});

test('a save from an unrelated dataset id still gets incompatible-dataset', () => {
  const v3 = { datasetId: 'harlem-apollo-20261017', datasetVersion: 3 };
  const result = resumeWith(v3, worldSave('queens-flushing-20261017', 2));
  assert.equal(result.kind, 'error');
  if (result.kind !== 'error') return;
  assert.equal(result.reason, 'incompatible-dataset');
  const noChain = resumeWith(v3, worldSave('harlem-apollo-20261014', 9));
  assert.equal(noChain.kind, 'error');
  if (noChain.kind === 'error') assert.equal(noChain.reason, 'incompatible-dataset');
});

const baked = JSON.parse(readFileSync(new URL('./data/harlem-apollo.json', import.meta.url), 'utf8')) as {
  version: number; id: string; buildings: { e?: number; h: number; f?: number; d?: number; vs?: number }[];
};

test('baked v3 tile: provenance bits cover the new fields and rule-only fields stay estimates', () => {
  assert.equal(baked.version, 3);
  assert.equal(baked.id, 'harlem-apollo-20261017');
  let heightRecords = 0;
  let floorRecords = 0;
  for (const b of baked.buildings) {
    const e = b.e ?? 0;
    assert.ok(Number.isInteger(e) && e >= 0 && e <= 31, `e ${e}`);
    // Class, style and detail are compiler rules: no record bit may be set
    // (docs/design/handoff/harlem-v3.md — the three bits are always cleared).
    assert.equal(e & (RECORD_CLASS | RECORD_STYLE | RECORD_DETAIL), 0, `rule-only field marked as record on ${JSON.stringify(b)}`);
    if (e & RECORD_HEIGHT) heightRecords++;
    if (e & RECORD_FLOORS) floorRecords++;
    if (b.d !== undefined) assert.ok(b.d >= 0 && b.d <= 127);
  }
  assert.ok(heightRecords > baked.buildings.length * 0.9, `record heights ${heightRecords} of ${baked.buildings.length}`);
  assert.ok(floorRecords > 0, 'PLUTO floor records reached the bake');
  const parsed = parseCityDataset(baked);
  for (const b of parsed.buildings) {
    if (b.detailMask !== undefined) assert.equal(b.detailEstimated, true);
    if (b.styleId !== undefined) assert.equal(b.styleEstimated, true);
  }
  assert.ok(parsed.buildings.some((b) => b.floors !== undefined && !b.floorsEstimated), 'record floors in the parsed tile');
});

test('the v1 to v2 save migration keeps positions', () => {
  const step = CITY_DATASET_MIGRATIONS.find((m) => m.fromDatasetVersion === 1);
  assert.ok(step);
  assert.equal(step.toDatasetVersion, 2);
  const position = { crs: 'EPSG:4326' as const, longitude: -73.95, latitude: 40.81 };
  assert.deepEqual(step.migratePosition(position), position);
});

test('projects east and north to local metre axes', () => {
  const origin = [-73.95, 40.81] as const;
  const [x, z] = projectCityPoint([-73.949, 40.811], origin);
  assert.ok(x > 80 && x < 90); assert.ok(z < -110 && z > -112);
  const [zeroX, zeroZ] = projectCityPoint(origin, origin);
  assert.equal(zeroX, 0); assert.ok(zeroZ === 0);
  assert.throws(() => projectCityPoint([Number.NaN, 40.81], origin));
});
