import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHASE_DISTANCES, INITIAL_CITY_CAMERA, yawBehind } from '../city-camera.ts';
import {
  IDLE_CHASE, NOTHING_TO_INTERACT, RELEASED_CONTROLS,
  alignStrength, jumpCaller, recentreChase, spawnCaller, stepCaller, stepGameFrame,
  type CallerControls, type GameFrame,
} from './caller-controller.ts';
import { INITIAL_CALLER_STATE, createCallerStore, selectCallerTransform, type CallerState } from './caller-store.ts';
import { RUN_SPEED, WALK_SPEED, angleDelta, isAirborne } from './locomotion.ts';
import { IDLE_SETTLE, withViewHeld } from './block-settle.ts';
import type { StreetAxisLookup } from '../street-axes.ts';
import type { WorldQueries } from './walkability.ts';

const open: WorldQueries = { isWalkable: () => true, groundHeight: () => 0 };
const spawned: CallerState = { ...INITIAL_CALLER_STATE, spawned: true, heading: Math.PI };
const stick = (x: number, y: number, extra: Partial<CallerControls> = {}): CallerControls => ({ ...RELEASED_CONTROLS, stickX: x, stickY: y, engaged: true, ...extra });
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

test('an unspawned Caller never moves', () => {
  assert.equal(stepCaller(INITIAL_CALLER_STATE, stick(0, 1), 0, 1 / 60, open), INITIAL_CALLER_STATE);
});

test('a light push walks, a full push runs, both away from the camera at yaw 0; the pace eases in', () => {
  let walked = spawned;
  for (let i = 0; i < 60; i++) walked = stepCaller(walked, stick(0, 0.3), 0, 1 / 60, open);
  assert.equal(walked.gait, 'walk');
  assert.ok(walked.z < 0 && near(walked.x, 0));
  assert.ok(near(walked.speed, WALK_SPEED * 0.6, 1e-2), `walk ${walked.speed}`);
  let ran = spawned;
  const first = stepCaller(ran, stick(0, 1), 0, 1 / 60, open);
  assert.ok(first.speed > 0 && first.speed < RUN_SPEED, 'a push from rest does not start at full run');
  for (let i = 0; i < 60; i++) ran = stepCaller(ran, stick(0, 1), 0, 1 / 60, open);
  assert.equal(ran.gait, 'run');
  assert.ok(near(ran.speed, RUN_SPEED, 1e-2), `run ${ran.speed}`);
  assert.ok(ran.gaitPhase > 0 && ran.stride > ran.gaitPhase, 'the gait cycle is longer than a metre');
});

test('walk to run and back eases instead of snapping; release stops', () => {
  let state = spawned;
  for (let i = 0; i < 60; i++) state = stepCaller(state, stick(0, 0.6), 0, 1 / 60, open);
  assert.ok(near(state.pace, WALK_SPEED, 1e-3));
  const pushed = stepCaller(state, stick(0, 1), 0, 1 / 60, open);
  assert.equal(pushed.gait, 'run');
  assert.ok(pushed.pace > WALK_SPEED && pushed.pace < WALK_SPEED + 0.5, `one frame later ${pushed.pace}`);
  const stopped = stepCaller(pushed, RELEASED_CONTROLS, 0, 1 / 60, open);
  assert.equal(stopped.pace, 0);
  assert.equal(stopped.gait, 'idle');
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
  const chase = recentreChase(start.caller, start.chase);
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

// ---- Block settle ---------------------------------------------------------
// A single street running along x (east-west, like 125th Street on the grid
// if the tile were axis-aligned): its camera axis is yaw π/2 (look west) or 3π/2.
const eastWest: StreetAxisLookup = (_x, _z, ref) => ({ axisYaw: Math.PI / 2, distance: 2, misalignment: Math.min(Math.abs(angleDelta(ref, Math.PI / 2)), Math.abs(angleDelta(ref, -Math.PI / 2))) });
// A crossroads: the east-west street and a north-south one (axis yaw 0).
const crossroads: StreetAxisLookup = (_x, _z, ref) => {
  const ew = Math.min(Math.abs(angleDelta(ref, Math.PI / 2)), Math.abs(angleDelta(ref, -Math.PI / 2)));
  const ns = Math.min(Math.abs(angleDelta(ref, 0)), Math.abs(angleDelta(ref, Math.PI)));
  return ew <= ns ? { axisYaw: Math.PI / 2, distance: 2, misalignment: ew } : { axisYaw: 0, distance: 2, misalignment: ns };
};
const run = (f: GameFrame, controls: CallerControls, frames: number, streets: StreetAxisLookup, reduced = false, fps = 60) => {
  let out = { ...f, active: true };
  for (let i = 0; i < frames; i++) out = stepGameFrame(out, controls, 1 / fps, reduced, open, streets);
  return out;
};
const looking = (yaw: number): GameFrame => ({ ...frame(), camera: { ...frame().camera, yaw }, caller: { ...spawned, heading: yaw + Math.PI } });

test('no settle during a held straight push, however long, even off the street axis', () => {
  // The view is 0.4 rad off the street. Held up for 5 s: the yaw never moves, so the push never bends.
  const start = looking(Math.PI / 2 + 0.4);
  let f = { ...start, active: true };
  const xs: number[] = [];
  const zs: number[] = [];
  for (let i = 0; i < 300; i++) {
    f = stepGameFrame(f, stick(0, 1), 1 / 60, false, open, eastWest);
    xs.push(f.caller.x); zs.push(f.caller.z);
    assert.equal(f.camera.yaw, start.camera.yaw, `yaw moved at frame ${i}`);
  }
  // Straight: every point lies on the line from the start through the end.
  const ex = xs.at(-1)!, ez = zs.at(-1)!;
  for (let i = 0; i < xs.length; i += 20) assert.ok(Math.abs(xs[i]! * ez - zs[i]! * ex) < 1e-6 * Math.hypot(ex, ez) * 10);
});

test('letting go of the stick settles the view onto the nearest way down the street', () => {
  const held = run(looking(Math.PI / 2 + 0.4), stick(0, 1), 30, eastWest);
  const released = run(held, RELEASED_CONTROLS, 120, eastWest);
  assert.ok(near(released.camera.yaw, Math.PI / 2, 1e-3), `yaw ${released.camera.yaw}`);
  assert.equal(released.chase.settle.targetYaw, null);
  // From the other side of the axis it picks the opposite way down the street, the nearer one.
  const back = run(run(looking(3 * Math.PI / 2 - 0.3), stick(0, 1), 10, eastWest), RELEASED_CONTROLS, 120, eastWest);
  assert.ok(near(back.camera.yaw, 3 * Math.PI / 2, 1e-3), `yaw ${back.camera.yaw}`);
});

test('the settle eases at the same rate at any frame rate, and reduced motion snaps', () => {
  const settleAfter = (fps: number) => {
    const held = run(looking(Math.PI / 2 + 0.4), stick(0, 1), 2, eastWest, false, fps);
    return run(held, RELEASED_CONTROLS, fps / 5, eastWest, false, fps).camera.yaw;
  };
  const at30 = settleAfter(30);
  const at120 = settleAfter(120);
  assert.ok(at30 > Math.PI / 2 + 0.01, 'still easing 0.2 s after release');
  assert.ok(Math.abs(at30 - at120) < 0.02, `30 fps ${at30} vs 120 fps ${at120}`);
  const held = run(looking(Math.PI / 2 + 0.4), stick(0, 1), 2, eastWest, true);
  const snapped = stepGameFrame(held, RELEASED_CONTROLS, 1 / 60, true, open, eastWest);
  assert.ok(near(snapped.camera.yaw, Math.PI / 2, 1e-9));
  assert.equal(snapped.chase.settle.targetYaw, null);
});

test('a view turned across the street on purpose stays put', () => {
  // 80° off the street: the player is looking at the block's face, not down the street.
  const held = run(looking(Math.PI / 2 + (80 * Math.PI) / 180), stick(0, 1), 10, eastWest);
  const released = run(held, RELEASED_CONTROLS, 60, eastWest);
  assert.equal(released.camera.yaw, held.camera.yaw);
});

test('a manual turn holds the settle off until it is let go, then settles', () => {
  const start = looking(Math.PI / 2 + 0.4);
  const turning: GameFrame = { ...start, chase: { ...start.chase, settle: withViewHeld(IDLE_SETTLE, true) } };
  const during = run(turning, RELEASED_CONTROLS, 30, eastWest);
  assert.equal(during.camera.yaw, start.camera.yaw, 'no settle while the finger is down');
  const letGo: GameFrame = { ...during, chase: { ...during.chase, settle: withViewHeld(during.chase.settle, false) } };
  assert.ok(near(run(letGo, RELEASED_CONTROLS, 120, eastWest).camera.yaw, Math.PI / 2, 1e-3));
  // Z held: the stick orbits the view; letting go of Z settles it.
  const orbited = run(start, stick(1, 0, { look: true }), 10, eastWest);
  assert.notEqual(orbited.camera.yaw, start.camera.yaw);
  const after = run(orbited, RELEASED_CONTROLS, 200, eastWest);
  assert.ok(Math.abs(angleDelta(after.camera.yaw, Math.PI / 2)) < 1e-3 || Math.abs(angleDelta(after.camera.yaw, -Math.PI / 2)) < 1e-3, `yaw ${after.camera.yaw}`);
});

test('turning a corner under a held stick settles onto the new street without bending the walk', () => {
  // Walk west along the east-west street (view yaw π/2, stick up), then turn right onto the north-south one.
  const start = looking(Math.PI / 2);
  const along = run(start, stick(0, 1), 60, crossroads);
  assert.equal(along.camera.yaw, Math.PI / 2);
  // Stick right: the Caller turns north and keeps walking. Let the figure finish turning.
  let f = run(along, stick(1, 0), 20, crossroads);
  const headingAfterTurn = f.caller.heading;
  const yawBefore = f.camera.yaw;
  // Hold it. Within two seconds the camera swings round behind the Caller.
  const path: { x: number; z: number }[] = [];
  for (let i = 0; i < 120; i++) {
    f = stepGameFrame(f, stick(1, 0), 1 / 60, false, open, crossroads);
    path.push({ x: f.caller.x, z: f.caller.z });
  }
  assert.ok(near(f.camera.yaw, 0, 2e-2) || near(f.camera.yaw, Math.PI * 2, 2e-2), `camera looks north now: yaw ${f.camera.yaw}, from ${yawBefore}`);
  // The walk stays a straight line north the whole time the camera swung.
  assert.ok(near(f.caller.heading, headingAfterTurn, 1e-6));
  for (let i = 1; i < path.length; i++) {
    const dx = path[i]!.x - path[i - 1]!.x;
    const dz = path[i]!.z - path[i - 1]!.z;
    assert.ok(Math.abs(dx) < 1e-6 && dz < 0, `frame ${i} moved (${dx}, ${dz})`);
  }
  // Releasing the stick hands steering back to the camera: up now walks north, the way the view faces.
  const fresh = run(run(f, RELEASED_CONTROLS, 1, crossroads), stick(0, 1), 30, crossroads);
  assert.ok(fresh.caller.z < f.caller.z - 0.5 && Math.abs(fresh.caller.x - f.caller.x) < 0.05, `(${fresh.caller.x - f.caller.x}, ${fresh.caller.z - f.caller.z})`);
});

test('a first push from standstill in a new direction is not a corner', () => {
  // Spawned facing away from the camera, then pushed right and held: one steady heading, no turn.
  const start = looking(Math.PI / 2);
  const f = run(start, stick(1, 0), 180, crossroads);
  assert.equal(f.camera.yaw, Math.PI / 2);
});

test('recentre wins over a settle in flight', () => {
  const held = run(looking(Math.PI / 2 + 0.4), stick(0, 1), 5, eastWest);
  const releasing = stepGameFrame(held, RELEASED_CONTROLS, 1 / 60, false, open, eastWest);
  assert.notEqual(releasing.chase.settle.targetYaw, null);
  const chase = recentreChase(releasing.caller, releasing.chase);
  assert.equal(chase.settle.targetYaw, null);
  assert.notEqual(chase.recentreYaw, null);
});
