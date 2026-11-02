import test from 'node:test';
import assert from 'node:assert/strict';
import { DistrictAuthority, DEFAULT_DISTRICT_SPEC, type DistrictSpec } from './district-authority.ts';
import { GEN_DISTRICT_ID, genDistrictSpec } from './gen-district.ts';

test('the gen district spec passes DistrictAuthority validation with the default district contract', () => {
  const spec = genDistrictSpec(() => true);
  // The constructor throws on an invalid spec — same gate the default spec passes.
  const room = new DistrictAuthority(spec);
  assert.equal(room.spec.districtId, GEN_DISTRICT_ID);
  assert.equal(spec.tickMs, DEFAULT_DISTRICT_SPEC.tickMs);
  assert.equal(spec.extentMetres, DEFAULT_DISTRICT_SPEC.extentMetres);
  assert.equal(spec.walkMetresPerSecond, DEFAULT_DISTRICT_SPEC.walkMetresPerSecond);
  assert.equal(spec.runMetresPerSecond, DEFAULT_DISTRICT_SPEC.runMetresPerSecond);
  assert.notEqual(spec.districtId, DEFAULT_DISTRICT_SPEC.districtId, 'a different district, not an alias');
});

test('the walkable hook is the injected query, verbatim', () => {
  const walkable = (x: number, z: number) => x < 5 && z < 5;
  const spec: DistrictSpec = genDistrictSpec(walkable);
  assert.equal(spec.walkable, walkable);
  assert.equal(spec.walkable!(3, 3), true);
  assert.equal(spec.walkable!(9, 3), false);
});

test('the authority applies the district walls: a blocked start is refused, a wall stops the step', () => {
  // One tick of walking covers 4.5 m/s x 50 ms = 0.225 m — the wall at 0.2 refuses the first step.
  const room = new DistrictAuthority(genDistrictSpec((x) => x < 0.2));
  assert.equal(room.join({ sessionId: 's1', callerId: 'c1', startX: 4, startZ: 0 }), 'blocked_start');
  assert.equal(room.join({ sessionId: 's1', callerId: 'c1', startX: 0, startZ: 0 }), null);
  room.submit('s1', { seq: 1, dx: 1, dz: 0, run: false });
  const snap = room.step();
  assert.equal(snap[0]!.x, 0, 'the walkable refused the proposed cell');
});
