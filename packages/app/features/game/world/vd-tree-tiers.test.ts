import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VD_FAR_TREE_CAP, VD_FAR_TREE_RADIUS, VdTreeTiers } from './vd-tree-tiers.ts';
import { VD_MID_TREE_CAP, VD_NEAR_TREE_CAP } from './vd-trees-mesh.ts';

/** A fake lod set: `ids` split into a near head and a far tail, as TreeLod hands them over. */
const sets = (ids: number[], head = ids.length) => ({
  near: Int32Array.from(ids.slice(0, head)),
  nearCount: head,
  far: Int32Array.from(ids.slice(head)),
  farCount: ids.length - head,
});

/** `n` trees on a line along x, one every `step` metres starting at 0. */
const line = (n: number, step = 1) => {
  const xs = new Float32Array(n);
  for (let i = 0; i < n; i++) xs[i] = i * step;
  return { xs, zs: new Float32Array(n) };
};

const caps = { nearCap: 3, midCap: 4, midRadius: 20, farCap: 5 };

test('nearest trees win the full tier; caps are respected', () => {
  const { xs, zs } = line(40);
  const tiers = new VdTreeTiers(xs, zs, caps);
  tiers.update(0, 0, sets([...Array(40).keys()]));
  assert.deepEqual([...tiers.near.subarray(0, tiers.nearCount)], [0, 1, 2]);
  assert.equal(tiers.nearCount, caps.nearCap);
  // Trees 3..6 are mid (inside the 20 m radius), 7..19 the imposters the far cap holds.
  assert.deepEqual([...tiers.mid.subarray(0, tiers.midCount)], [3, 4, 5, 6]);
  assert.deepEqual([...tiers.far.subarray(0, tiers.farCount)], [7, 8, 9, 10, 11]);
  assert.equal(tiers.farCount, caps.farCap);
  assert.equal(tiers.overCount, 40 - 3 - 4 - 5, 'the tail keeps the plain crowns');
});

test('past the mid radius a candidate goes far even under the mid cap', () => {
  // Trees 5 m apart: 0,1,2 near; 3,4 inside the 20 m mid radius; 5.. past it — mid stops at the radius.
  const { xs, zs } = line(12, 5);
  const tiers = new VdTreeTiers(xs, zs, caps);
  tiers.update(0, 0, sets([...Array(12).keys()]));
  assert.deepEqual([...tiers.mid.subarray(0, tiers.midCount)], [3, 4]);
  assert.equal(tiers.farCount, caps.farCap);
  assert.equal(tiers.overCount, 12 - 3 - 2 - 5);
});

test('deterministic: same input, same tiers, and the buffers are reused', () => {
  const { xs, zs } = line(60, 2);
  const a = new VdTreeTiers(xs, zs, caps);
  const b = new VdTreeTiers(xs, zs, caps);
  const input = sets([...Array(60).keys()], 20);
  a.update(3, 0, input);
  b.update(3, 0, input);
  for (const key of ['near', 'mid', 'far', 'over'] as const) {
    assert.deepEqual([...a[key]], [...b[key]], key);
  }
  // A second refresh on the same instance writes into the same arrays — no allocation.
  const before = { near: a.near, mid: a.mid, far: a.far, over: a.over };
  a.update(30, 0, input);
  assert.equal(a.near, before.near);
  assert.equal(a.mid, before.mid);
  assert.equal(a.far, before.far);
  assert.equal(a.over, before.over);
});

test('empty candidate list empties every tier', () => {
  const { xs, zs } = line(10);
  const tiers = new VdTreeTiers(xs, zs, caps);
  tiers.update(0, 0, sets([...Array(10).keys()]));
  assert.ok(tiers.nearCount + tiers.midCount + tiers.farCount + tiers.overCount > 0);
  tiers.update(0, 0, sets([], 0));
  assert.equal(tiers.nearCount + tiers.midCount + tiers.farCount + tiers.overCount, 0);
});

test('the shipped constants stay in the measured range', () => {
  assert.equal(VD_NEAR_TREE_CAP, 48);
  assert.equal(VD_MID_TREE_CAP, 160);
  assert.ok(VD_FAR_TREE_RADIUS >= 120 && VD_FAR_TREE_RADIUS <= 160);
  assert.ok(VD_FAR_TREE_CAP >= 1024);
});
