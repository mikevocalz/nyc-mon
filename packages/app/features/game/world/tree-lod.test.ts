import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FAR_TREE_RADIUS, NEAR_TREE_CAP, NEAR_TREE_RADIUS, pickWithin, TREE_HIDE_METRES, TREE_NEAR_LOD_METRES, TREE_REFRESH_METRES, TreeLod,
} from './tree-lod.ts';

/** Trees on a line along x, one per metre from 0. */
function line(n: number) {
  const xs = new Float32Array(n);
  for (let i = 0; i < n; i++) xs[i] = i;
  return { xs, zs: new Float32Array(n) };
}

test('near set: inside the radius only, nearest first when over the cap, the rest fall to far crowns', () => {
  const { xs, zs } = line(1000);
  const lod = new TreeLod(xs, zs);
  assert.equal(lod.update(0, 0, 8), true);
  assert.equal(lod.nearCount, NEAR_TREE_RADIUS + 1, 'trees at 0..70 m');
  for (let k = 0; k < lod.nearCount; k++) assert.ok(xs[lod.near[k]!]! <= NEAR_TREE_RADIUS);
  assert.equal(lod.farCount, FAR_TREE_RADIUS - NEAR_TREE_RADIUS, 'far crowns out to the far radius');
  for (let k = 0; k < lod.farCount; k++) {
    const x = xs[lod.far[k]!]!;
    assert.ok(x > NEAR_TREE_RADIUS && x <= FAR_TREE_RADIUS);
  }

  // A dense cluster: the cap keeps the nearest, the overflow is drawn far, nothing is lost or doubled.
  const n = NEAR_TREE_CAP * 2;
  const cx = new Float32Array(n);
  const cz = new Float32Array(n);
  for (let i = 0; i < n; i++) { cx[i] = (i % 20) * 2; cz[i] = Math.floor(i / 20) * 2; }
  const dense = new TreeLod(cx, cz);
  dense.update(0, 0, 8);
  assert.equal(dense.nearCount, NEAR_TREE_CAP);
  assert.equal(dense.nearCount + dense.farCount, n);
  const d = (i: number) => Math.hypot(cx[i]!, cz[i]!);
  const farthestNear = Math.max(...Array.from(dense.near.subarray(0, dense.nearCount), d));
  const nearestFar = Math.min(...Array.from(dense.far.subarray(0, dense.farCount), d));
  assert.ok(farthestNear <= nearestFar, 'the nearest trees keep their leaves');
  assert.equal(new Set([...dense.near.subarray(0, dense.nearCount), ...dense.far.subarray(0, dense.farCount)]).size, n);
});

test('refresh hysteresis: small moves keep the sets, a 10 m move or an LOD step rebuilds', () => {
  const { xs, zs } = line(1000);
  const lod = new TreeLod(xs, zs);
  lod.update(0, 0, 8);
  assert.equal(lod.update(TREE_REFRESH_METRES - 0.5, 0, 8), false);
  assert.equal(lod.update(0, TREE_REFRESH_METRES - 0.5, 18), false, 'chase zoom inside one 50 m step');
  assert.equal(lod.update(TREE_REFRESH_METRES + 0.5, 0, 8), true);
  assert.equal(lod.nearCount, 81, 'recentred on x = 10.5: trees 0..80');
  assert.equal(lod.update(TREE_REFRESH_METRES + 0.5, 0, TREE_NEAR_LOD_METRES + 1), true, 'leaves off past the near LOD');
  assert.equal(lod.nearCount, 0);
  assert.ok(lod.farCount > 0);
  assert.equal(lod.update(TREE_REFRESH_METRES + 0.5, 0, TREE_HIDE_METRES + 1), true);
  assert.equal(lod.nearCount + lod.farCount, 0, 'all hidden from far away');
});

test('pickWithin returns the nearest inside the radius, sorted, capped', () => {
  const xs = new Float32Array([50, 5, 30, 1, 200, 12]);
  const zs = new Float32Array(6);
  const out = new Int32Array(3);
  const scratch = new Float32Array(6);
  const n = pickWithin(xs, zs, 0, 0, 40, out, scratch);
  assert.equal(n, 3);
  assert.deepEqual([...out], [3, 1, 5]);
  assert.equal(pickWithin(xs, zs, 0, 0, 0.5, out, scratch), 0);
});
