import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHASE_DISTANCES, INITIAL_CITY_CAMERA, yawBehind } from '../city-camera.ts';
import {
  IDLE_CHASE, NOTHING_TO_INTERACT, RELEASED_CONTROLS,
  alignStrength, jumpCaller, recentreChase, spawnCaller, stepCaller, stepGameFrame,
  type CallerControls, type GameFrame,
} from './caller-controller.ts';
import { INITIAL_CALLER_STATE, createCallerStore, selectCallerTransform, type CallerState } from './caller-store.ts';
import { RUN_SPEED, WALK_SPEED, isAirborne } from './locomotion.ts';
import type { WorldQueries } from './walkability.ts';

const open: WorldQueries = { isWalkable: () => true, groundHeight: () => 0 };
const spawned: CallerState = { ...INITIAL_CALLER_STATE, spawned: true, heading: Math.PI };
const stick = (x: number, y: number, extra: Partial<CallerControls> = {}): CallerControls => ({ ...RELEASED_CONTROLS, stickX: x, stickY: y, engaged: true, ...extra });
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

test('an unspawned Caller never moves', () => {
  assert.equal(stepCaller(INITIAL_CALLER_STATE, stick(0, 1), 0, 1 / 60, open), INITIAL_CALLER_STATE);
});

test('a light push walks, a full push runs, both away from the camera at yaw 0', () => {
  const walked = stepCaller(spawned, stick(0, 0.3), 0, 0.1, open);
  assert.equal(walked.gait, 'walk');
  assert.ok(walked.z < 0 && near(walked.x, 0));
  assert.ok(near(walked.speed, WALK_SPEED * 0.5));
  const ran = stepCaller(spawned, stick(0, 1), 0, 0.1, open);
  assert.equal(ran.gait, 'run');
  assert.ok(near(ran.speed, RUN_SPEED));
  assert.ok(near(ran.stride, RUN_SPEED * 0.1));
});

test('holding run runs on a light push; looking around freezes the Caller', () => {
  assert.equal(stepCaller(spawned, stick(0, 0.2, { run: true }), 0, 0.1, open).gait, 'run');
  const looking = stepCaller(spawned, stick(1, 0, { look: true }), 0, 0.1, open);
  assert.equal(looking.x, 0);
  assert.equal(looking.gait, 'idle');
});

test('the figure turns toward the stick direction over a few frames', () => {
  let state = spawned; // facing -z (heading π)
  for (let i = 0; i < 30; i++) state = stepCaller(state, stick(1, 0), 0, 1 / 60, open);
  assert.ok(near(state.heading, Math.PI / 2, 1e-3), `heading ${state.heading}`);
});

test('a wall stops the Caller and the gait drops to idle', () => {
  const blocked: WorldQueries = { isWalkable: (_x, z) => z > -0.05, groundHeight: () => 0 };
  let state = spawned;
  for (let i = 0; i < 10; i++) state = stepCaller(state, stick(0, 1), 0, 0.1, blocked);
  assert.ok(state.z > -0.05);
  assert.equal(state.gait, 'idle');
});

test('jump arcs and lands; a press mid-air does nothing', () => {
  const up = jumpCaller(spawned);
  assert.ok(isAirborne(up.jump));
  assert.equal(jumpCaller(stepCaller(up, RELEASED_CONTROLS, 0, 0.1, open)).jump.velocity < up.jump.velocity, true);
  let state = up;
  for (let i = 0; i < 60; i++) state = stepCaller(state, RELEASED_CONTROLS, 0, 1 / 60, open);
  assert.equal(isAirborne(state.jump), false);
  assert.equal(jumpCaller(INITIAL_CALLER_STATE), INITIAL_CALLER_STATE);
});

test('spawn lands on walkable ground near the look-at point, facing away from the camera, at a chase distance', () => {
  const ring: WorldQueries = { isWalkable: (x, z) => Math.hypot(x, z) >= 5, groundHeight: () => 1.5 };
  const placed = spawnCaller(INITIAL_CALLER_STATE, { ...INITIAL_CITY_CAMERA, yaw: 0.5 }, ring)!;
  assert.ok(placed.caller.spawned);
  assert.ok(Math.hypot(placed.caller.x, placed.caller.z) >= 5);
  assert.equal(placed.caller.groundY, 1.5);
  assert.ok(near(yawBehind(placed.caller.heading), 0.5));
  assert.equal(placed.camera.distance, CHASE_DISTANCES[0], 'the 220 m map view pulls in to the chase');
  assert.equal(spawnCaller(INITIAL_CALLER_STATE, INITIAL_CITY_CAMERA, { isWalkable: () => false, groundHeight: () => 0 }), null);
});

function frame(): GameFrame {
  return { caller: spawned, camera: { ...INITIAL_CITY_CAMERA, yaw: 0, distance: 30 }, chase: IDLE_CHASE };
}

test('the chase camera follows the Caller and settles; reduced motion snaps', () => {
  let f: GameFrame = frame();
  for (let i = 0; i < 30; i++) f = stepGameFrame(f, stick(0, 1), 1 / 60, false, open);
  assert.ok(f.camera.z < 0 && f.camera.z > f.caller.z, 'the look-at trails the Caller');
  let settled = stepGameFrame(f, RELEASED_CONTROLS, 1 / 60, false, open);
  let frames = 0;
  while (settled.active && frames < 600) { settled = stepGameFrame(settled, RELEASED_CONTROLS, 1 / 60, false, open); frames++; }
  assert.ok(!settled.active && frames < 600, 'the loop stops once the camera settles');
  const snapped = stepGameFrame(frame(), stick(0, 1), 1 / 60, true, open);
  assert.equal(snapped.camera.z, snapped.caller.z);
  assert.equal(snapped.camera.yaw, 0, 'reduced motion never swings the yaw on its own');
});

test('the camera never swings on its own: a held stick keeps the same forward', () => {
  // Decision 2026-10-16 (device): no auto swing, so up stays up the screen.
  const turned: GameFrame = { ...frame(), camera: { ...frame().camera, yaw: 0.6 } };
  let f = turned;
  for (let i = 0; i < 60; i++) f = stepGameFrame(f, stick(0, 1), 1 / 60, false, open);
  assert.equal(f.camera.yaw, 0.6);
  assert.equal(alignStrength(stick(0, 1), RUN_SPEED), 0);
  assert.equal(alignStrength(stick(1, 0), RUN_SPEED), 0);
});

test('recentre swings behind the Caller and finishes; reduced motion finishes in one frame', () => {
  const start: GameFrame = { ...frame(), caller: { ...spawned, heading: Math.PI / 2 } };
  const chase = recentreChase(start.caller);
  let f = { ...start, chase, active: true };
  let frames = 0;
  while (f.chase.recentreYaw !== null && frames < 300) { f = stepGameFrame(f, RELEASED_CONTROLS, 1 / 60, false, open); frames++; }
  assert.ok(near(f.camera.yaw, yawBehind(Math.PI / 2)));
  assert.ok(frames > 1);
  const instant = stepGameFrame({ ...start, chase }, RELEASED_CONTROLS, 1 / 60, true, open);
  assert.equal(instant.chase.recentreYaw, null);
  assert.ok(near(instant.camera.yaw, yawBehind(Math.PI / 2)));
});

test('look around orbits the camera with the stick and leaves the Caller standing', () => {
  const f = stepGameFrame(frame(), stick(1, 0, { look: true }), 0.1, false, open);
  assert.equal(f.caller.x, 0);
  assert.ok(f.camera.yaw > Math.PI, 'stick right turns the view right (yaw falls, wrapping)');
});

test('the transform store exposes position and facing only once spawned', () => {
  const store = createCallerStore();
  assert.equal(selectCallerTransform(store.getState()), null);
  store.setState({ spawned: true, x: 3, z: -4, heading: 1 });
  assert.deepEqual(selectCallerTransform(store.getState()), { x: 3, z: -4, heading: 1 });
  assert.ok(NOTHING_TO_INTERACT.length <= 40);
});
