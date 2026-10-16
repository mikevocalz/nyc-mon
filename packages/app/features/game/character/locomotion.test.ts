import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CYCLE_METRES, FULL_RUN_DEFLECTION, FULL_WALK_DEFLECTION, GROUNDED, JUMP_SPEED, MAX_COLLISION_STEP, RUN_CYCLE_METRES,
  RUN_DEFLECTION, RUN_SPEED, WALK_SPEED,
  angleDelta, cameraRelativeDirection, cycleMetresFor, deflectionToGait, easePace, findSpawn, headingFor, isAirborne,
  slideMove, startJump, stepJump, turnToward, wrapAngle,
} from './locomotion.ts';

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

test('walk/run curve: a light push walks slowly, a normal push walks, past 0.75 it runs', () => {
  assert.deepEqual(deflectionToGait(0, false), { gait: 'idle', speed: 0 });
  assert.deepEqual(deflectionToGait(0.04, false), { gait: 'idle', speed: 0 });
  assert.deepEqual(deflectionToGait(Number.NaN, false), { gait: 'idle', speed: 0 });
  const light = deflectionToGait(FULL_WALK_DEFLECTION / 2, false);
  assert.equal(light.gait, 'walk');
  assert.ok(near(light.speed, WALK_SPEED / 2));
  assert.deepEqual(deflectionToGait(0.6, false), { gait: 'walk', speed: WALK_SPEED });
  assert.equal(RUN_DEFLECTION, 0.75);
  const atThreshold = deflectionToGait(RUN_DEFLECTION, false);
  assert.equal(atThreshold.gait, 'run');
  assert.ok(near(atThreshold.speed, WALK_SPEED), 'crossing the threshold does not jump the speed');
  const between = deflectionToGait((RUN_DEFLECTION + FULL_RUN_DEFLECTION) / 2, false);
  assert.ok(between.speed > WALK_SPEED && between.speed < RUN_SPEED);
  assert.deepEqual(deflectionToGait(FULL_RUN_DEFLECTION, false), { gait: 'run', speed: RUN_SPEED });
  assert.deepEqual(deflectionToGait(1.5, false), { gait: 'run', speed: RUN_SPEED });
});

test('the speed curve never falls as the push grows and has no step bigger than the sample spacing allows', () => {
  let previous = 0;
  for (let i = 0; i <= 1000; i++) {
    const { speed } = deflectionToGait(i / 1000, false);
    assert.ok(speed >= previous - 1e-12, `falls at ${i / 1000}`);
    if (i > 50) assert.ok(speed - previous < 0.05, `jumps at ${i / 1000}: ${previous} -> ${speed}`);
    previous = speed;
  }
});

test('pace eases toward the target the same way at any frame rate', () => {
  const run = (fps: number) => { let pace = WALK_SPEED; for (let i = 0; i < fps / 4; i++) pace = easePace(pace, RUN_SPEED, 1 / fps); return pace; };
  const at40 = run(40);
  const at120 = run(120);
  assert.ok(at40 > WALK_SPEED && at40 < RUN_SPEED, 'a quarter second in, still easing');
  assert.ok(Math.abs(at40 - at120) < 1e-9);
  assert.equal(easePace(2, RUN_SPEED, 0), 2);
  assert.equal(easePace(Number.NaN, RUN_SPEED, 0), 0);
});

test('a run takes longer strides than a walk', () => {
  assert.equal(cycleMetresFor(WALK_SPEED), CYCLE_METRES);
  assert.equal(cycleMetresFor(RUN_SPEED), RUN_CYCLE_METRES);
  assert.equal(cycleMetresFor(0), CYCLE_METRES);
  assert.ok(cycleMetresFor((WALK_SPEED + RUN_SPEED) / 2) > CYCLE_METRES);
});

test('a run-speed frame cannot tunnel through a thin wall', () => {
  // A 0.1 m wall at z = -0.2; one 0.1 s frame at run pace travels 0.42 m.
  const wall = (_x: number, z: number) => !(z < -0.15 && z > -0.25);
  const moved = slideMove(0, 0, 0, -RUN_SPEED * 0.1, wall);
  assert.ok(moved.z > -0.15, `tunnelled to ${moved.z}`);
  assert.ok(MAX_COLLISION_STEP <= 0.25);
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

test('a push into a wall that runs off the scene axes slides along it', () => {
  // A block face on Harlem's grid, 29° off the axes, 1 m from the start on the -x side.
  const grid = (29 * Math.PI) / 180;
  const nx = -Math.cos(grid); const nz = -Math.sin(grid);
  const face = (x: number, z: number) => x * nx + z * nz < 1;
  const push = (dx: number, dz: number) => {
    let p = { x: 0, z: 0 };
    for (let i = 0; i < 120; i++) p = slideMove(p.x, p.z, dx * 0.07, dz * 0.07, face);
    return Math.hypot(p.x, p.z);
  };
  // Stick up at the spawn yaw (π/2): straight -x, with a z part of -6e-17 that once counted as a slide.
  const up = cameraRelativeDirection(0, 1, Math.PI / 2)!;
  assert.ok(push(up.x, up.z) > 3, `straight push stopped after ${push(up.x, up.z)} m`);
  // A diagonal push whose x part and z part each run into the face on their own.
  assert.ok(push(-0.6, -0.8) > 2, `diagonal push stopped after ${push(-0.6, -0.8)} m`);
  // Straight at the face, nothing to slide along: it stops at the wall.
  assert.ok(push(nx, nz) < 1.01);
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
