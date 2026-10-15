import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCityCameraStore, INITIAL_CITY_CAMERA, moveCityCamera } from './city-camera.ts';

test('camera pan follows heading without mutating its input', () => {
  const camera = { ...INITIAL_CITY_CAMERA };
  assert.deepEqual(moveCityCamera(camera, { type: 'pan', right: 10, forward: 20 }), { ...camera, x: 10, z: -20 });
  const rotated = moveCityCamera({ ...camera, yaw: Math.PI / 2 }, { type: 'pan', right: 10, forward: 20 });
  assert.ok(Math.abs(rotated.x + 20) < 1e-9);
  assert.ok(Math.abs(rotated.z + 10) < 1e-9);
  assert.deepEqual(camera, INITIAL_CITY_CAMERA);
});

test('camera bounds survive repeated gestures and invalid sensor input', () => {
  let camera = { ...INITIAL_CITY_CAMERA };
  for (let i = 0; i < 100; i++) camera = moveCityCamera(camera, { type: 'pan', right: 1e9, forward: -1e9 });
  assert.equal(camera.x, 2000); assert.equal(camera.z, 2000);
  assert.equal(moveCityCamera(camera, { type: 'pan', right: NaN, forward: 0 }), camera);
  assert.equal(moveCityCamera(camera, { type: 'zoom', factor: Infinity }), camera);
  assert.equal(moveCityCamera(camera, { type: 'zoom', factor: -1 }), camera);
  assert.deepEqual(moveCityCamera({ ...camera, x: NaN }, { type: 'orbit', radians: 0 }), INITIAL_CITY_CAMERA);
});

test('orbit wraps and zoom stays within renderer limits', () => {
  const camera = { ...INITIAL_CITY_CAMERA };
  assert.ok(Math.abs(moveCityCamera(camera, { type: 'orbit', radians: -Math.PI / 2 }).yaw - Math.PI * 1.5) < 1e-9);
  assert.equal(moveCityCamera(camera, { type: 'zoom', factor: 0.001 }).distance, 30);
  assert.equal(moveCityCamera({ ...camera, distance: 2000 }, { type: 'zoom', factor: 10 }).distance, 3000);
});

test('camera stores are isolated and reset restores the initial view', () => {
  const first = createCityCameraStore(); const second = createCityCameraStore();
  first.getState().move({ type: 'pan', right: 40, forward: 10 });
  assert.equal(first.getState().camera.x, 40);
  assert.deepEqual(second.getState().camera, INITIAL_CITY_CAMERA);
  first.getState().move({ type: 'reset' });
  assert.deepEqual(first.getState().camera, INITIAL_CITY_CAMERA);
});
