import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCityDataset, projectCityPoint } from './city-dataset.ts';
// Synthetic validation fixtures only. These are not a shipped NYC map.
function fixture() {
  return { version: 1, id: 'test-tile', origin: [-73.95, 40.81],
    source: { url: 'https://www.openstreetmap.org/copyright', attribution: 'Test only', license: 'ODbL-1.0', retrievedAt: '2026-10-14T00:00:00Z' },
    features: [
      { id: 'building:1', kind: 'building', heightMeters: 12, points: [[-73.95,40.81],[-73.949,40.81],[-73.949,40.811],[-73.95,40.81]] },
      { id: 'road:1', kind: 'road', widthMeters: 8, points: [[-73.95,40.81],[-73.949,40.811]] },
    ] };
}
test('validates provenance and owns nested geometry', () => {
  const input = fixture(); const parsed = parseCityDataset(input);
  input.features[0]!.points[0]![0] = 0;
  assert.equal(parsed.features[0]!.points[0]![0], -73.95);
  assert.equal(parsed.source.license, 'ODbL-1.0');
});
test('rejects missing provenance, unsupported versions and duplicate IDs', () => {
  for (const patch of [{version:2}, {source:{}}, {features:[]}, {origin:[0,0]}]) assert.throws(() => parseCityDataset({...fixture(),...patch}));
  const duplicate = fixture(); duplicate.features[1]!.id = duplicate.features[0]!.id;
  assert.throws(() => parseCityDataset(duplicate), /Duplicate/);
});
test('rejects corrupt geometry and non-finite or oversized dimensions', () => {
  for (const height of [NaN, Infinity, -1, 0, 1001]) {
    const input = fixture(); input.features[0]!.heightMeters = height;
    assert.throws(() => parseCityDataset(input), /dimension/);
  }
  const open = fixture(); open.features[0]!.points.pop();
  assert.throws(() => parseCityDataset(open), /closed/);
  const outside = fixture(); outside.features[1]!.points[0] = [0,0];
  assert.throws(() => parseCityDataset(outside), /NYC/);
  const line = fixture(); line.features[0]!.points = [[-73.95,40.81],[-73.949,40.81],[-73.948,40.81],[-73.95,40.81]];
  assert.throws(() => parseCityDataset(line), /area/);
});
test('rejects oversized point and feature budgets before projection', () => {
  const input = fixture(); input.features[1]!.points = Array.from({length:100001}, () => [-73.95,40.81]);
  assert.throws(() => parseCityDataset(input), /budget/);
  assert.throws(() => parseCityDataset({...fixture(), features: Array(10001).fill(fixture().features[0])}), /budget/);
});
test('projects east and north to local metre axes without modifying source', () => {
  const origin = [-73.95,40.81] as const;
  const [x,z] = projectCityPoint([-73.949,40.811],origin);
  assert.ok(x > 80 && x < 90); assert.ok(z < -110 && z > -112);
  const [zeroX,zeroZ] = projectCityPoint(origin,origin);
  assert.equal(zeroX,0); assert.ok(zeroZ === 0);
  assert.throws(() => projectCityPoint([NaN,40.81],origin));
});
