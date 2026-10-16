import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GROUNDED, JUMP_SPEED, RUN_DEFLECTION, RUN_SPEED, WALK_SPEED,
  angleDelta, cameraRelativeDirection, deflectionToGait, findSpawn, headingFor, isAirborne,
  slideMove, startJump, stepJump, turnToward, wrapAngle,
} from './locomotion.ts';

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

test('deflection below the run threshold walks, scaled; at and above it runs', () => {
  assert.deepEqual(deflectionToGait(0, false), { gait: 'idle', speed: 0 });
  assert.deepEqual(deflectionToGait(Number.NaN, false), { gait: 'idle', speed: 0 });
  const half = deflectionToGait(RUN_DEFLECTION / 2, false);
  assert.equal(half.gait, 'walk');
  assert.ok(near(half.speed, WALK_SPEED / 2));
  assert.deepEqual(deflectionToGait(RUN_DEFLECTION, false), { gait: 'run', speed: RUN_SPEED });
  assert.deepEqual(deflectionToGait(1.5, false), { gait: 'run', speed: RUN_SPEED });
});

test('holding run runs at any deflection past the dead zone, never from a released stick', () => {
  assert.deepEqual(deflectionToGait(0.2, true), { gait: 'run', speed: RUN_SPEED });
  assert.equal(deflectionToGait(0, true).gait, 'idle');
});

test('stick up walks away from the camera, stick right walks to the screen right', () => {
  // yaw 0: camera south of the target looking north (-z).
  const up = cameraRelativeDirection(0, 1, 0)!;
  assert.ok(near(up.x, 0) && near(up.z, -1));
  const right = cameraRelativeDirection(1, 0, 0)!;
  assert.ok(near(right.x, 1) && near(right.z, 0));
  // Camera turned to look east (heading 90 = yaw -π/2): up walks east.
  const east = cameraRelativeDirection(0, 1, -Math.PI / 2)!;
  assert.ok(near(east.x, 1) && near(east.z, 0));
  assert.equal(cameraRelativeDirection(0, 0, 0), null);
  assert.equal(cameraRelativeDirection(Number.NaN, 1, 0), null);
});

test('direction is unit length whatever the deflection', () => {
  const d = cameraRelativeDirection(0.3, 0.3, 1)!;
  assert.ok(near(Math.hypot(d.x, d.z), 1));
});

test('heading faces the direction: +z is 0, +x is π/2', () => {
  assert.ok(near(headingFor({ x: 0, z: 1 }), 0));
  assert.ok(near(headingFor({ x: 1, z: 0 }), Math.PI / 2));
  assert.ok(near(headingFor({ x: 0, z: -1 }), Math.PI));
});

test('turning takes the short way round and stops on the target', () => {
  assert.ok(near(angleDelta(0.1, Math.PI * 2 - 0.1), -0.2));
  assert.ok(near(turnToward(0.1, Math.PI * 2 - 0.1, 0.05), 0.05));
  assert.ok(near(turnToward(0.1, 0.12, 1), 0.12));
  assert.ok(near(wrapAngle(-Math.PI / 2), Math.PI * 1.5));
});

test('collision slides along a wall instead of stopping dead', () => {
  const wallAtXOne = (x: number) => x < 1;
  const slid = slideMove(0.5, 0, 2, 2, wallAtXOne);
  assert.ok(slid.x < 1 && slid.x >= 0.5, 'x stops short of the wall');
  assert.ok(near(slid.z, 2), 'z keeps all its travel');
  const open = slideMove(0, 0, 3, -4, () => true);
  assert.ok(near(open.x, 3) && near(open.z, -4));
});

test('a fast move cannot tunnel through a thin footprint', () => {
  const thinWall = (x: number) => !(x > 1.05 && x < 1.3);
  const moved = slideMove(0, 0, 5, 0, thinWall);
  assert.ok(moved.x <= 1.05, `stopped at ${moved.x}`);
});

test('fully boxed in, the Caller stays put; bad input changes nothing', () => {
  assert.deepEqual(slideMove(0, 0, 1, 1, () => false), { x: 0, z: 0 });
  assert.deepEqual(slideMove(0, 0, Number.NaN, 1, () => true), { x: 0, z: 0 });
});

test('jump rises, lands, and lands at the same time at any frame rate', () => {
  const airTime = (fps: number) => {
    let jump = startJump(GROUNDED);
    let t = 0;
    while (isAirborne(jump) && t < 5) { jump = stepJump(jump, 1 / fps); t += 1 / fps; }
    return t;
  };
  const expected = (2 * JUMP_SPEED) / 9.81;
  assert.ok(Math.abs(airTime(30) - expected) < 1 / 30 + 1e-9);
  assert.ok(Math.abs(airTime(120) - expected) < 1 / 120 + 1e-9);
  assert.equal(stepJump(GROUNDED, 1 / 60), GROUNDED);
});

test('no double jump', () => {
  const up = stepJump(startJump(GROUNDED), 0.1);
  assert.equal(startJump(up), up);
});

test('spawn finds the walkable point nearest the request', () => {
  assert.deepEqual(findSpawn(0, 0, () => true), { x: 0, z: 0 });
  const outsideRadiusThree = (x: number, z: number) => Math.hypot(x, z) >= 3;
  const spawn = findSpawn(0, 0, outsideRadiusThree)!;
  assert.ok(Math.hypot(spawn.x, spawn.z) >= 3 && Math.hypot(spawn.x, spawn.z) < 4);
  assert.equal(findSpawn(0, 0, () => false, 1, 5), null);
});
