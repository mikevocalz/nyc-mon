import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createKlippShotRig,
  sanitizeKlippShot,
  SHOT_MAX_FOV,
  SHOT_MIN_FOV,
  type KlippCameraShot,
} from './klipp-shot-bridge.ts';
import { cinematicCameraStore } from './cinematic-camera.store.ts';

const shot: KlippCameraShot = { position: [10, 3, 8], quaternion: [0, 0, 0, 1], fov: 60, near: 0.1, far: 3000 };
const chase = { position: [0, 160, 200] as const, target: [0, 1.2, 0] as const, near: 4, far: 3000 };

test('sanitise preserves a positive frustum gap when near exceeds the maximum far', () => {
  const clean = sanitizeKlippShot({ ...shot, near: 30_000, far: 40_000 })!;
  assert.ok(clean.near < clean.far);
  assert.equal(clean.far, 20_000);
  assert.ok(clean.far - clean.near >= 0.099999);
});

function rig() {
  const camera = new THREE.PerspectiveCamera(50, 1.5, 0.5, 10_000);
  const r = createKlippShotRig(camera);
  r.setSize(1200, 800);
  r.setChase(chase.position, chase.target, chase.near, chase.far);
  return { camera, r };
}

test('resizing a settled offset shot reapplies normalized framing to the new viewport', () => {
  const { camera, r } = rig();
  r.setReducedMotion(true);
  r.setShot({ ...shot, viewOffset: [0.25, -0.5] });
  r.update(1);
  r.update(0);
  assert.equal(camera.view!.offsetX, -150);
  r.setSize(600, 400);
  r.update(0);
  assert.equal(camera.view!.fullWidth, 600);
  assert.equal(camera.view!.fullHeight, 400);
  assert.equal(camera.view!.offsetX, -75);
  assert.equal(camera.view!.offsetY, -100);
  r.dispose();
});

test('the store sanitises a shot once, and clamps instead of rejecting', () => {
  cinematicCameraStore.getState().clear();
  assert.equal(cinematicCameraStore.getState().shot, null);
  assert.equal(cinematicCameraStore.getState().setShot({ ...shot, fov: 8 }), true);
  assert.equal(cinematicCameraStore.getState().shot!.fov, SHOT_MIN_FOV);
  assert.equal(cinematicCameraStore.getState().setShot({ ...shot, position: [Number.NaN, 0, 0] }), false);
  assert.equal(cinematicCameraStore.getState().shot!.fov, SHOT_MIN_FOV, 'a rejected shot does not replace the live one');
  cinematicCameraStore.getState().clear();
  assert.equal(cinematicCameraStore.getState().shot, null);
});

test('sanitise normalises the quaternion and clamps lens extremes', () => {
  const clean = sanitizeKlippShot({ ...shot, quaternion: [0, 0, 0, 2], fov: 120, near: 0, far: 30_000 })!;
  assert.ok(Math.abs(Math.hypot(...clean.quaternion) - 1) < 1e-9);
  assert.equal(clean.fov, SHOT_MAX_FOV);
  assert.equal(clean.near, 0.05);
  assert.equal(clean.far, 20_000);
  assert.equal(sanitizeKlippShot(null), null);
  assert.equal(sanitizeKlippShot({ ...shot, quaternion: [0, 0, 0, 0] }), null);
  assert.equal(sanitizeKlippShot({ ...shot, position: [1, Number.NaN, 0] }), null);
});

test('a shot lands through KlippThree.write: transform, lens and viewOffset', () => {
  const { camera, r } = rig();
  assert.equal(r.update(0), true, 'first update cuts explore in');
  assert.deepEqual(camera.position.toArray(), [0, 160, 200]);
  r.setShot({ ...shot, viewOffset: [0.5, 0], lookAt: [0, 1, 0] });
  r.update(1);
  assert.deepEqual(camera.position.toArray(), [10, 3, 8]);
  assert.equal(camera.fov, 60);
  assert.equal(camera.near, 0.1);
  assert.equal(camera.far, 3000);
  assert.equal(camera.view?.enabled, true, 'viewOffset reaches the camera');
  assert.equal(camera.view!.offsetX, -0.5 * 600, 'normalised offset to pixels at the given size');
  r.setShot(null);
  r.update(1);
  assert.deepEqual(camera.position.toArray(), [0, 160, 200], 'clearing blends back to the chase pose');
  assert.equal(camera.fov, 50, 'the lens returns to the captured chase fov');
  assert.notEqual(camera.view?.enabled, true, 'view offset clears');
  r.dispose();
});

test('out-of-range fov clamps into the blend rather than rejecting the shot', () => {
  const { camera, r } = rig();
  r.update(0);
  r.setShot({ ...shot, fov: 12 });
  assert.equal(r.update(0), true, 'a blend is in flight');
  r.update(1);
  assert.deepEqual(camera.position.toArray(), [10, 3, 8]);
  assert.equal(camera.fov, SHOT_MIN_FOV, 'telephoto clamps, never snaps back to explore');
  r.dispose();
});

test('a corrupt shot never activates; a live blend keeps moving', () => {
  const { camera, r } = rig();
  r.update(0);
  r.setShot({ ...shot, position: [Number.NaN, 0, 0] });
  r.update(1);
  assert.deepEqual(camera.position.toArray(), [0, 160, 200], 'unwritable shot: the chase pose holds');
  r.setShot(shot);
  r.update(0);
  assert.equal(r.update(0.1), true, 'blend still moving');
  r.setShot({ ...shot, position: [Number.NaN, 0, 0] });
  r.update(1);
  assert.deepEqual(camera.position.toArray(), [0, 160, 200], 'corrupt input blends back rather than snapping');
  r.dispose();
});

test('reduced motion cuts a shot in one frame instead of blending', () => {
  const { camera, r } = rig();
  r.setReducedMotion(true);
  r.update(0);
  r.setShot(shot);
  r.update(0);
  assert.deepEqual(camera.position.toArray(), [10, 3, 8], 'cut lands instantly with dt 0');
  r.dispose();
});

test('the rig allocates nothing and writes nothing once settled', () => {
  const { camera, r } = rig();
  r.update(0);
  r.setShot(shot);
  r.update(1);
  // The first post-blend frame can rewrite once on float drift; the next is quiet.
  r.update(0);
  const projection = camera.projectionMatrix.clone();
  assert.equal(r.update(0), false, 'settled: no further frame needed');
  assert.ok(camera.projectionMatrix.equals(projection), 'no lens rebuild when nothing changed');
  r.dispose();
});


test('first transitions with zero, negative and non-finite delta stay finite and progress on the on-demand clock', (t) => {
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  for (const delta of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    for (const initialized of [false, true]) {
      const { camera, r } = rig();
      if (initialized) r.update(0);
      r.setShot(shot);
      for (let i = 0; i < 20; i++) {
        clock += 100;
        r.update(delta);
        assert.ok([...camera.position.toArray(), ...camera.quaternion.toArray(), camera.fov, camera.near, camera.far].every(Number.isFinite), `delta ${delta}, initialized ${initialized}`);
      }
      assert.deepEqual(camera.position.toArray(), shot.position);
      r.dispose();
    }
  }
});
