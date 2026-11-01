// The generated-city district seam (Phase 3 slice 3): flag-gated spec access
// and the save's districtId assignment — all behind EXPO_PUBLIC_WORLD_GEN,
// which the test run never sets, so the flag-off contract is what executes
// here. The flag-on path is covered through genDistrictSpec directly (the
// same expression the wiring sites evaluate). The app seam district.ts hands
// the tile's composed isWalkable in — it imports the tile JSON through
// bundled-queries.ts, so like bundled-queries itself it stays out of the
// node tests (the city-data.ts split); what is tested is the spec shape and
// the injected-query delegation, which are pure.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { CityDataset } from '../../city-dataset.ts';
import { GEN_DISTRICT_ID, genDistrictSpec } from '@acme/core/realtime';
import { buildWorldSave, type WorldSnapshotInput } from '../../world-resume/world-snapshot.ts';
import { EXPERIMENTAL_WORLD_GEN } from './flag.ts';

const snapshotInput = (): WorldSnapshotInput => ({
  previous: null,
  identity: { playerId: 'caller-a', deviceId: 'device-1' },
  sessionId: 'session-a',
  camera: { x: 0, z: 0, yaw: 0, distance: 200 },
  // buildWorldSave reads id, version and origin only — a literal stands in for the parsed tile.
  dataset: { id: 'harlem-apollo-20261017', version: 3, origin: [-73.94975, 40.81005] } as unknown as CityDataset,
  pill: 'playing',
  now: Date.UTC(2026, 9, 31, 12, 0, 0),
});

test('flag off: nothing registers a district and the save keeps districtId null', () => {
  assert.equal(EXPERIMENTAL_WORLD_GEN, false);
  // The same expressions the wiring sites evaluate (district.ts, world-snapshot.ts).
  const spec = EXPERIMENTAL_WORLD_GEN ? genDistrictSpec(() => true) : null;
  assert.equal(spec, null, 'the gen lane is off — no spec is built');
  const save = buildWorldSave(snapshotInput());
  assert.equal(save.districtId, null, 'flag off: byte-identical to before, the documented gap stands');
});

test('flag on shape: the spec exists, carries GEN_DISTRICT_ID and routes walkable through the injected query', () => {
  // genDistrictSpec(isWalkable) is what the flag-on branch of worldDistrict() builds; the env flag
  // is a module constant the test cannot re-roll, so exercise the spec directly.
  const tileQuery = (x: number, z: number) => x * x + z * z <= 100;
  const spec = genDistrictSpec(tileQuery);
  assert.equal(spec.districtId, 'harlem-apollo-gen');
  assert.equal(spec.districtId, GEN_DISTRICT_ID);
  assert.equal(spec.walkable, tileQuery, 'walkable queries are the injected tile query, verbatim');
  assert.equal(spec.walkable!(3, 4), true);
  assert.equal(spec.walkable!(10, 1), false);
  // 50 ms tick and the default speeds ride over from DEFAULT_DISTRICT_SPEC.
  assert.equal(spec.tickMs, 50);
});

test('a save carrying a district keeps it — the ?? chain never rewrites history', () => {
  const prior = buildWorldSave(snapshotInput());
  const next = buildWorldSave({ ...snapshotInput(), previous: { ...prior, districtId: 'harlem' } });
  assert.equal(next.districtId, 'harlem', 'previous?.districtId wins over any default');
});
