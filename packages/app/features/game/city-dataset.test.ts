import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CITY_DATASET_MIGRATIONS, parseCityDataset, projectCityPoint } from './city-dataset.ts';
import { syntheticTileV2 as fixtureV2 } from './world/synthetic-tile.ts';
// Synthetic validation fixtures only. These are not a shipped NYC map.
function fixtureV1() {
  return { version: 1, id: 'test-tile', origin: [-73.95, 40.81],
    source: { url: 'https://www.openstreetmap.org/copyright', attribution: 'Test only', license: 'ODbL-1.0', retrievedAt: '2026-10-14T00:00:00Z' },
    features: [
      { id: 'building:1', kind: 'building', heightMeters: 12, points: [[-73.95,40.81],[-73.949,40.81],[-73.949,40.811],[-73.95,40.81]] },
      { id: 'road:1', kind: 'road', widthMeters: 8, points: [[-73.95,40.81],[-73.949,40.811]] },
    ] };
}

test('v2: validates provenance, classes and flags, and owns nothing mutable from the input', () => {
  const input = fixtureV2();
  const parsed = parseCityDataset(input);
  assert.equal(parsed.version, 2);
  assert.equal(parsed.buildings[0]!.class, 'brownstone');
  assert.equal(parsed.buildings[0]!.classEstimated, true);
  assert.equal(parsed.buildings[0]!.heightEstimated, false);
  assert.equal(parsed.buildings[1]!.name, 'Tower');
  assert.equal(parsed.roads[0]!.sidewalkMeters, 4.5);
  assert.equal(parsed.areas[0]!.kind, 'park');
  assert.deepEqual(parsed.trees.osm, [-20, 50]);
  assert.equal(parsed.landmarks[0]!.key, 'apollo-theater');
  input.buildings[0]!.p[0] = 999;
  assert.equal(parsed.buildings[0]!.ring[0], 0);
  assert.equal(parsed.source.license, 'ODbL-1.0');
});

test('v2: rejects bad versions, provenance, duplicates, unknown classes and dangling landmarks', () => {
  for (const patch of [{ version: 3 }, { source: {} }, { origin: [0, 0] }, { buildings: [], roads: [], areas: [] }]) {
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

test('v2: rejects oversized budgets before building anything', () => {
  const many = fixtureV2();
  many.buildings = Array.from({ length: 20_001 }, (_, i) => ({ ...fixtureV2().buildings[0]!, id: `b:${i}` }));
  assert.throws(() => parseCityDataset(many));
  const long = fixtureV2(); long.roads[0]!.p = Array.from({ length: 10_000 }, (_, i) => i % 100);
  assert.throws(() => parseCityDataset(long));
});

test('v1 tiles migrate to v2 at the same place', () => {
  const parsed = parseCityDataset(fixtureV1());
  assert.equal(parsed.version, 2);
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
