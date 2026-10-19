import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CityCamera } from './city-scene.ts';
import { MIN_CAMERA_DISTANCE,
  CHASE_DISTANCES, chaseCamera, createCityCameraStore, INITIAL_CITY_CAMERA, lookAroundAction, moveCityCamera,
  nextChaseDistance, spawnChaseDistance, swingYaw, yawBehind,
} from './city-camera.ts';

test('camera pan follows heading without mutating its input', () => {
  const camera = { ...INITIAL_CITY_CAMERA, yaw: 0 };
  assert.deepEqual(moveCityCamera(camera, { type: 'pan', right: 10, forward: 20 }), { ...camera, x: camera.x + 10, z: camera.z - 20 });
  const rotated = moveCityCamera({ ...camera, yaw: Math.PI / 2 }, { type: 'pan', right: 10, forward: 20 });
  assert.ok(Math.abs(rotated.x - (camera.x - 20)) < 1e-9);
  assert.ok(Math.abs(rotated.z - (camera.z - 10)) < 1e-9);
  assert.deepEqual(camera, { ...INITIAL_CITY_CAMERA, yaw: 0 });
});

test('camera bounds survive repeated gestures and invalid sensor input', () => {
  let camera = { ...INITIAL_CITY_CAMERA, yaw: 0 };
  for (let i = 0; i < 100; i++) camera = moveCityCamera(camera, { type: 'pan', right: 1e9, forward: -1e9 });
  assert.equal(camera.x, 2000); assert.equal(camera.z, 2000);
  assert.equal(moveCityCamera(camera, { type: 'pan', right: NaN, forward: 0 }), camera);
  assert.equal(moveCityCamera(camera, { type: 'zoom', factor: Infinity }), camera);
  assert.equal(moveCityCamera(camera, { type: 'zoom', factor: -1 }), camera);
  assert.deepEqual(moveCityCamera({ ...camera, x: NaN }, { type: 'orbit', radians: 0 }), INITIAL_CITY_CAMERA);
});

test('orbit wraps and zoom stays within renderer limits', () => {
  const camera = { ...INITIAL_CITY_CAMERA, yaw: 0 };
  assert.ok(Math.abs(moveCityCamera(camera, { type: 'orbit', radians: -Math.PI / 2 }).yaw - Math.PI * 1.5) < 1e-9);
  assert.equal(moveCityCamera({ ...camera, distance: 20 }, { type: 'zoom', factor: 0.001 }).distance, MIN_CAMERA_DISTANCE);
  assert.equal(moveCityCamera({ ...camera, distance: 2000 }, { type: 'zoom', factor: 10 }).distance, 3000);
});

test('camera stores are isolated and reset restores the initial view', () => {
  const first = createCityCameraStore(); const second = createCityCameraStore();
  first.getState().move({ type: 'pan', right: 40, forward: 10 });
  // The start view looks along 125th Street (yaw π/2): right is -z, forward is -x.
  assert.ok(Math.abs(first.getState().camera.x - (INITIAL_CITY_CAMERA.x - 10)) < 1e-9);
  assert.ok(Math.abs(first.getState().camera.z - (INITIAL_CITY_CAMERA.z - 40)) < 1e-9);
  assert.deepEqual(second.getState().camera, INITIAL_CITY_CAMERA);
  first.getState().move({ type: 'reset' });
  assert.deepEqual(first.getState().camera, INITIAL_CITY_CAMERA);
});

// The chase tests start at the origin so look-at maths reads in plain numbers.
const chaseStart: CityCamera = { ...INITIAL_CITY_CAMERA, yaw: 0, x: 0, z: 0, distance: CHASE_DISTANCES[2] };

test('chase eases the look-at onto the Caller at a frame-rate independent pace', () => {
  const target = { x: 10, z: 0, heading: Math.PI, align: 0 };
  const after = (fps: number) => { let c = chaseStart; for (let i = 0; i < fps / 4; i++) c = chaseCamera(c, target, 1 / fps, false); return c.x; };
  assert.ok(after(60) > 5 && after(60) < 10);
  assert.ok(Math.abs(after(40) - after(120)) < 1e-6);
  assert.equal(chaseCamera(chaseStart, { ...target, x: Number.NaN }, 1 / 60, false), chaseStart);
});

test('reduced motion snaps the look-at and never swings the yaw', () => {
  const snapped = chaseCamera(chaseStart, { x: 10, z: -3, heading: 1, align: 1 }, 1 / 60, true);
  assert.deepEqual(snapped, { ...chaseStart, x: 10, z: -3 });
});

test('the auto swing turns toward behind the Caller, at most the align rate', () => {
  const swung = chaseCamera(chaseStart, { x: 0, z: 0, heading: Math.PI / 2, align: 1 }, 0.1, false);
  assert.ok(swung.yaw > Math.PI && swung.yaw < Math.PI * 2, 'turns the short way toward 3π/2');
  assert.equal(chaseCamera(chaseStart, { x: 0, z: 0, heading: Math.PI / 2, align: 0 }, 0.1, false).yaw, 0);
});

test('recentre swing lands exactly; reduced motion lands at once', () => {
  let state = { camera: chaseStart, done: false };
  let frames = 0;
  while (!state.done && frames < 100) { state = swingYaw(state.camera, yawBehind(0), 1 / 60, false); frames++; }
  assert.ok(Math.abs(state.camera.yaw - Math.PI) < 1e-9 && frames > 10);
  assert.equal(swingYaw(chaseStart, Math.PI, 1 / 60, true).done, true);
});

test('zoom cycle steps through the chase distances and wraps; spawn picks a chase distance', () => {
  assert.equal(nextChaseDistance(CHASE_DISTANCES[0]), CHASE_DISTANCES[1]);
  assert.equal(nextChaseDistance(CHASE_DISTANCES[2]), CHASE_DISTANCES[0]);
  assert.equal(nextChaseDistance(220), CHASE_DISTANCES[0]);
  assert.equal(spawnChaseDistance(220), CHASE_DISTANCES[0]);
  assert.equal(spawnChaseDistance(CHASE_DISTANCES[1]), CHASE_DISTANCES[1]);
  assert.ok(Math.min(...CHASE_DISTANCES) >= MIN_CAMERA_DISTANCE, 'never below the renderer floor');
});

test('look around: stick right turns the view right', () => {
  const turned = moveCityCamera(chaseStart, lookAroundAction(1, 0.1));
  assert.ok(turned.yaw > Math.PI, 'yaw falls and wraps, so the compass heading grows');
});
