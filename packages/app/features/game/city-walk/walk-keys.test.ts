import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_CITY_CAMERA, moveCityCamera } from '../city-camera.ts';
import {
  MAX_FRAME_SECONDS, MOVE_DISTANCE_PER_SECOND, actionsForFrame, intentForKey, wheelToAction, type WalkIntent,
} from './walk-keys.ts';

const camera = { ...INITIAL_CITY_CAMERA, yaw: 0 };
const held = (...intents: WalkIntent[]) => new Set(intents);
const apply = (intents: Set<WalkIntent>, dt: number) => actionsForFrame(intents, camera, dt).reduce(moveCityCamera, camera);

test('arrows and WASD map to the same intents; R and Home reset; other keys are ignored', () => {
  assert.equal(intentForKey('ArrowUp'), 'forward');
  assert.equal(intentForKey('KeyW'), 'forward');
  assert.equal(intentForKey('KeyA'), 'left');
  assert.equal(intentForKey('KeyQ'), 'turnLeft');
  assert.equal(intentForKey('Equal'), 'zoomIn');
  assert.equal(intentForKey('Minus'), 'zoomOut');
  assert.equal(intentForKey('KeyR'), 'reset');
  assert.equal(intentForKey('Home'), 'reset');
  assert.equal(intentForKey('Tab'), null);
  assert.equal(intentForKey('Space'), null);
});

test('holding forward moves the camera forward by distance x speed x time', () => {
  const moved = apply(held('forward'), 0.05);
  // yaw 0 faces -z (camera-input.ts headingDegrees).
  assert.ok(moved.z < camera.z);
  assert.ok(Math.abs(camera.z - moved.z - camera.distance * MOVE_DISTANCE_PER_SECOND * 0.05) < 1e-9);
  assert.equal(moved.distance, camera.distance);
});

test('opposite keys cancel and an empty hold asks for nothing', () => {
  assert.deepEqual(actionsForFrame(held('forward', 'back'), camera, 0.05), []);
  assert.deepEqual(actionsForFrame(held(), camera, 0.05), []);
  assert.deepEqual(actionsForFrame(held('left', 'right', 'turnLeft', 'turnRight'), camera, 0.05), []);
});

test('a diagonal travels as far as a straight push', () => {
  const straight = apply(held('forward'), 0.05);
  const diagonal = apply(held('forward', 'right'), 0.05);
  const length = (c: typeof camera) => Math.hypot(c.x - camera.x, c.z - camera.z);
  assert.ok(Math.abs(length(straight) - length(diagonal)) < 1e-9);
});

test('turn and zoom keys orbit and zoom; zoom in brings the camera closer', () => {
  assert.notEqual(apply(held('turnLeft'), 0.05).yaw, camera.yaw);
  assert.ok(apply(held('zoomIn'), 0.05).distance < camera.distance);
  assert.ok(apply(held('zoomOut'), 0.05).distance > camera.distance);
});

test('a stalled frame is capped and a bad delta moves nothing', () => {
  assert.deepEqual(apply(held('forward'), 5), apply(held('forward'), MAX_FRAME_SECONDS));
  assert.deepEqual(actionsForFrame(held('forward'), camera, Number.NaN), []);
  assert.deepEqual(actionsForFrame(held('forward'), camera, -1), []);
});

test('wheel down zooms out, wheel up zooms in, zero and NaN do nothing', () => {
  assert.ok(moveCityCamera(camera, wheelToAction(120)!).distance > camera.distance);
  assert.ok(moveCityCamera(camera, wheelToAction(-120)!).distance < camera.distance);
  assert.equal(wheelToAction(0), null);
  assert.equal(wheelToAction(Number.NaN), null);
});
