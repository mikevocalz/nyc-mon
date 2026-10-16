import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_CITY_CAMERA, moveCityCamera } from './city-camera.ts';
import {
  commandToAction, describeCamera, headingDegrees, metresPerDp, panToAction, pinchToAction,
  rotationToAction, startPanInertia, stepPanInertia, type CameraCommand,
} from './camera-input.ts';

const camera = { ...INITIAL_CITY_CAMERA, yaw: 0 };

test('drag moves the world with the finger', () => {
  const right = moveCityCamera(camera, panToAction(100, 0, camera, 800));
  assert.ok(right.x < 0, 'finger right -> camera west');
  const down = moveCityCamera(camera, panToAction(0, 100, camera, 800));
  assert.ok(down.z < 0, 'finger down -> camera north (forward at yaw 0)');
});

test('metres per dp scales with distance and rejects bad viewports', () => {
  assert.ok(Math.abs(metresPerDp(440, 800) / metresPerDp(220, 800) - 2) < 1e-9);
  assert.equal(metresPerDp(220, 0), 0);
  assert.equal(metresPerDp(Number.NaN, 800), 0);
  assert.deepEqual(moveCityCamera(camera, panToAction(50, 50, camera, 0)), camera);
});

test('pinch spread zooms in, pinch close zooms out, zero is rejected by the store', () => {
  assert.ok(moveCityCamera(camera, pinchToAction(1.2)).distance < camera.distance);
  assert.ok(moveCityCamera(camera, pinchToAction(0.8)).distance > camera.distance);
  assert.equal(moveCityCamera(camera, pinchToAction(0)), camera);
});

test('heading is -yaw, rotate left turns the heading counter-clockwise', () => {
  assert.equal(headingDegrees(camera), 0);
  const left = moveCityCamera(camera, commandToAction('rotateLeft', camera));
  assert.ok(Math.abs(headingDegrees(left) - 337.5) < 1e-9);
  const right = moveCityCamera(camera, commandToAction('rotateRight', camera));
  assert.ok(Math.abs(headingDegrees(right) - 22.5) < 1e-9);
  assert.equal(rotationToAction(0.1).type, 'orbit');
});

test('move forward follows the heading after a turn', () => {
  const turned = { ...camera, yaw: -Math.PI / 2 }; // heading 90 = east
  assert.equal(headingDegrees(turned), 90);
  const moved = moveCityCamera(turned, commandToAction('moveForward', turned));
  assert.ok(moved.x > turned.x + 1 && Math.abs(moved.z - turned.z) < 1e-6);
});

test('every command is a valid action and button steps are reversible', () => {
  const all: CameraCommand[] = ['zoomIn', 'zoomOut', 'rotateLeft', 'rotateRight', 'moveForward', 'moveBack', 'moveLeft', 'moveRight', 'reset'];
  for (const command of all) assert.ok(commandToAction(command, camera));
  const zoomed = moveCityCamera(moveCityCamera(camera, commandToAction('zoomIn', camera)), commandToAction('zoomOut', camera));
  assert.ok(Math.abs(zoomed.distance - camera.distance) < 1e-9);
  assert.deepEqual(moveCityCamera({ ...camera, x: 500 }, commandToAction('reset', camera)), INITIAL_CITY_CAMERA);
});

test('spoken summary names a compass point and distance', () => {
  assert.equal(describeCamera(camera), 'Facing north, 220 metres away');
  assert.equal(describeCamera({ ...camera, yaw: -Math.PI / 4 }), 'Facing north-east, 220 metres away');
});

test('fling glide is off under reduced motion and decays to a stop', () => {
  assert.equal(startPanInertia(2000, 0, true), null);
  assert.equal(startPanInertia(50, 0, false), null);
  assert.equal(startPanInertia(Number.NaN, 0, false), null);
  let state = startPanInertia(2000, 0, false);
  let frames = 0;
  while (state && frames < 1000) { state = stepPanInertia(state, 1 / 60).next; frames++; }
  assert.equal(state, null);
  assert.ok(frames > 10 && frames < 200);
  // Same total travel at 30 and 120 fps within tolerance (frame-rate independent).
  const travel = (fps: number) => { let s = startPanInertia(2000, 0, false); let x = 0; while (s) { const r = stepPanInertia(s, 1 / fps); x += r.changeX; s = r.next; } return x; };
  assert.ok(Math.abs(travel(30) - travel(120)) / travel(120) < 0.15);
});
