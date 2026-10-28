import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_CALLER_STATE, type CallerState } from './character/caller-store.ts';
import {
  SNAPSHOT_LENGTH,
  SNAPSHOT_SLOTS,
  bumpSnapshot,
  emptySnapshot,
  packSnapshot,
  readCaller,
  readCamera,
  readView,
  snapshotVersion,
} from './render-snapshot.ts';

const camera = { x: -28, z: 22, yaw: 1.25, distance: 8 };
const caller: CallerState = {
  spawned: true, x: -28.5, z: 21.75, groundY: 0, heading: 3.1, gait: 'run', speed: 5.2, pace: 5.4, stride: 120.5, gaitPhase: 41.25,
  jump: { height: 0.4, velocity: 1.5 },
};
const view = { width: 540, height: 720, pixelRatio: 2, reducedMotion: false };

test('a packed snapshot reads back the same camera, Caller and view', () => {
  const snap = packSnapshot(emptySnapshot(), camera, caller, view);
  assert.equal(snap.length, SNAPSHOT_LENGTH);
  assert.deepEqual(readCamera(snap), camera);
  assert.deepEqual(readCaller(snap), caller);
  assert.deepEqual(readView(snap), view);
});

test('every write bumps the version; invalidate bumps only the version', () => {
  const a = packSnapshot(emptySnapshot(), camera, caller, view);
  const b = packSnapshot(a, camera, caller, view);
  assert.equal(snapshotVersion(a), 1);
  assert.equal(snapshotVersion(b), 2);
  const c = bumpSnapshot(b);
  assert.equal(snapshotVersion(c), 3);
  assert.deepEqual(c.slice(1), b.slice(1));
});

test('packing never mutates the previous snapshot', () => {
  const a = packSnapshot(emptySnapshot(), camera, caller, view);
  const copy = a.slice();
  packSnapshot(a, { ...camera, x: 900 }, caller, view);
  assert.deepEqual(a, copy);
});

test('non-finite numbers keep the previous value instead of reaching the renderer', () => {
  const a = packSnapshot(emptySnapshot(), camera, caller, view);
  const b = packSnapshot(a, { ...camera, x: Number.NaN, yaw: Number.POSITIVE_INFINITY }, { ...caller, z: Number.NaN }, { ...view, width: Number.NaN });
  assert.equal(readCamera(b).x, camera.x);
  assert.equal(readCamera(b).yaw, camera.yaw);
  assert.equal(readCaller(b).z, caller.z);
  assert.equal(readView(b).width, view.width);
});

test('the initial Caller round-trips as idle and not spawned', () => {
  const back = readCaller(packSnapshot(emptySnapshot(), camera, INITIAL_CALLER_STATE, view));
  assert.deepEqual(back, { ...INITIAL_CALLER_STATE, jump: { ...INITIAL_CALLER_STATE.jump } });
  assert.equal(back.gait, 'idle');
});

test('a short or foreign array is replaced by a full-length one', () => {
  const snap = packSnapshot([1, 2, 3], camera, caller, view);
  assert.equal(snap.length, SNAPSHOT_LENGTH);
  assert.equal(snap[SNAPSHOT_SLOTS.version], 1);
});

test('a reused out buffer is seeded from previous, not its own stale data', () => {
  const a = packSnapshot(emptySnapshot(), camera, caller, view);
  const out = new Array<number>(SNAPSHOT_LENGTH).fill(-999);
  const b = packSnapshot(a, { ...camera, x: Number.NaN }, caller, view, out);
  assert.equal(snapshotVersion(b), snapshotVersion(a) + 1);
  assert.equal(readCamera(b).x, camera.x);
  const c = bumpSnapshot(b, new Array<number>(SNAPSHOT_LENGTH).fill(-999));
  assert.equal(snapshotVersion(c), snapshotVersion(b) + 1);
  assert.deepEqual(c.slice(1), b.slice(1));
});
