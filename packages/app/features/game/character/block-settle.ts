// The chase camera's block settle: after the player lets go of a view turn,
// or once the Caller has turned onto a new street, the yaw eases onto the
// street the Caller is on (or the way opposite, whichever is nearer the
// current view). Pure, so `node --test` covers every trigger.
//
// The rule that matters (device, 2026-10-16): a held straight push never
// bends. Two things guarantee it:
// 1. Nothing here fires while the Caller holds one heading. The corner
//    trigger needs the heading to change by CORNER_MIN_TURN first.
// 2. While a settle turns the camera under a held stick, the steering frame
//    stays put: `steerOffset` collects the yaw the settle applied and the
//    stick keeps mapping through the old frame, so the Caller's world
//    direction holds. The offset clears when the stick is released or
//    re-aimed by more than STEER_RELATCH.
// Manual turns (twist, drag, Z look-around) never touch the offset: turning
// the view still turns a held push, as before.
import type { CityCamera } from '../city-scene.ts';
import { yawBehind } from '../city-camera.ts';
import { gridAxisYaw, shortestTurn, yawAlongAxis, type StreetAxisLookup } from '../street-axes.ts';
import { angleDelta, wrapAngle } from './locomotion.ts';

/** Settle ease, 1/s: the gap to the street axis shrinks by e every quarter second. */
export const SETTLE_RATE = 4;
/** The settle lands (snaps the last sliver) inside this many radians. */
export const SETTLE_DONE = 0.002;
/** A view-release settle skips views further than this from the street: the player is looking across it on purpose. */
export const VIEW_SETTLE_MAX = (50 * Math.PI) / 180;
/** The heading change from the last steady heading that counts as turning a corner. */
export const CORNER_MIN_TURN = (60 * Math.PI) / 180;
/** How long the new heading must hold, walking, before the corner counts. Filters a sidestep. */
export const CORNER_HOLD_SECONDS = 0.4;
/** Heading wobble still counted as one steady heading, per frame against the candidate. */
export const STEADY_TOLERANCE = (8 * Math.PI) / 180;
/** The new heading must run within this of a nearby street for the corner to settle onto it. */
export const CORNER_ALIGN_TOLERANCE = (30 * Math.PI) / 180;
/** At a right-angle corner both ways down the new street are 90° away; looking where the Caller walks wins by this margin. */
export const CORNER_HEADING_BIAS = (20 * Math.PI) / 180;
/** A held stick turned further than this from where it was latched is a new aim: the steering frame catches up with the camera. */
export const STEER_RELATCH = (45 * Math.PI) / 180;

export interface BlockSettleState {
  /** Yaw a settle is easing toward, or null when none is in flight. */
  readonly targetYaw: number | null;
  /** A touch gesture is turning the view (set by the runtime from the drag and twist gestures). */
  readonly viewHeld: boolean;
  /** Last frame's turning flag (gesture or Z held), for the release edge. */
  readonly wasTurning: boolean;
  /** Last frame's walking-stick flag, for the release edge. */
  readonly wasEngaged: boolean;
  /** Yaw the settle has applied under the current held push; the stick steers through `camera.yaw - steerOffset`. */
  readonly steerOffset: number;
  /** Stick angle (atan2(x, y)) the steering frame was latched at, or null with no push held. */
  readonly steerStickAngle: number | null;
  /** The last steady heading the corner trigger committed, or null before the first one. */
  readonly travelHeading: number | null;
  /** The heading being timed as a possible new steady heading. */
  readonly candidateHeading: number | null;
  readonly candidateSeconds: number;
}

export const IDLE_SETTLE: BlockSettleState = Object.freeze({
  targetYaw: null,
  viewHeld: false,
  wasTurning: false,
  wasEngaged: false,
  steerOffset: 0,
  steerStickAngle: null,
  travelHeading: null,
  candidateHeading: null,
  candidateSeconds: 0,
});

/** The held controls the settle reads; a subset of CallerControls. */
export interface SettleControls {
  readonly stickX: number;
  readonly stickY: number;
  readonly engaged: boolean;
  readonly look: boolean;
}

const walking = (c: SettleControls) => c.engaged && !c.look;

/**
 * The steering latch for this frame, before the Caller moves. Releasing or
 * re-aiming the stick drops the offset, so the push maps through the live
 * camera again.
 */
export function latchSteering(settle: BlockSettleState, controls: SettleControls): BlockSettleState {
  if (!walking(controls) || Math.hypot(controls.stickX, controls.stickY) === 0) {
    return settle.steerStickAngle === null && settle.steerOffset === 0 ? settle : { ...settle, steerStickAngle: null, steerOffset: 0 };
  }
  const angle = Math.atan2(controls.stickX, controls.stickY);
  if (settle.steerStickAngle === null) return { ...settle, steerStickAngle: angle, steerOffset: 0 };
  if (settle.steerOffset === 0) return settle.steerStickAngle === angle ? settle : { ...settle, steerStickAngle: angle };
  if (Math.abs(angleDelta(settle.steerStickAngle, angle)) > STEER_RELATCH) return { ...settle, steerStickAngle: angle, steerOffset: 0 };
  return settle;
}

/** The yaw the stick steers through this frame. */
export function steeringYaw(camera: CityCamera, settle: BlockSettleState): number {
  return wrapAngle(camera.yaw - settle.steerOffset);
}

/** The settle target for a view that was just let go, or null when the view should stay. */
export function viewSettleTarget(x: number, z: number, yaw: number, streets: StreetAxisLookup): number | null {
  const hit = streets(x, z, yaw);
  const axis = hit?.axisYaw ?? gridAxisYaw(yaw);
  const target = yawAlongAxis(yaw, axis);
  const d = Math.abs(shortestTurn(yaw, target));
  if (d > VIEW_SETTLE_MAX || d < SETTLE_DONE) return null;
  return target;
}

/** The settle target once the Caller has turned onto a street running along `heading`, or null when no street does. */
export function cornerSettleTarget(x: number, z: number, heading: number, yaw: number, streets: StreetAxisLookup): number | null {
  const lookAlong = yawBehind(heading);
  const hit = streets(x, z, lookAlong);
  const axis = hit !== null ? hit.axisYaw : gridAxisYaw(lookAlong);
  const misaligned = hit !== null ? hit.misalignment : Math.abs(shortestTurn(lookAlong, yawAlongAxis(lookAlong, axis)));
  if (misaligned > CORNER_ALIGN_TOLERANCE) return null;
  const target = yawAlongAxis(yaw, axis, lookAlong, CORNER_HEADING_BIAS);
  return Math.abs(shortestTurn(yaw, target)) < SETTLE_DONE ? null : target;
}

export interface SettleFrame {
  readonly x: number;
  readonly z: number;
  readonly heading: number;
  /** The Caller moved this frame. */
  readonly moving: boolean;
}

/**
 * One frame of the settle, after the Caller and the chase have moved.
 * `blocked` is true while something else owns the yaw (the X recentre
 * swing); the settle drops its target and waits.
 */
export function stepBlockSettle(
  settle: BlockSettleState,
  camera: CityCamera,
  controls: SettleControls,
  caller: SettleFrame,
  dt: number,
  reducedMotion: boolean,
  streets: StreetAxisLookup,
  blocked: boolean,
): { settle: BlockSettleState; camera: CityCamera } {
  const turning = settle.viewHeld || controls.look;
  const engaged = walking(controls);
  let next: BlockSettleState = { ...settle, wasTurning: turning, wasEngaged: engaged };
  let cam = camera;

  if (turning || blocked) {
    // The player (or the recentre) owns the yaw. Restart the corner timing so a turn made under the twist does not fire on release.
    return { settle: { ...next, targetYaw: null, candidateHeading: null, candidateSeconds: 0 }, camera: cam };
  }

  // Release edges: a view turn let go, or the walking stick let go.
  const released = (settle.wasTurning && !turning) || (settle.wasEngaged && !engaged);
  if (released && next.targetYaw === null) next = { ...next, targetYaw: viewSettleTarget(caller.x, caller.z, cam.yaw, streets) };

  // Corner: a new steady heading, far enough from the last one, along a street.
  if (caller.moving && engaged) {
    const steady = next.candidateHeading !== null && Math.abs(angleDelta(next.candidateHeading, caller.heading)) <= STEADY_TOLERANCE;
    next = steady
      ? { ...next, candidateSeconds: next.candidateSeconds + Math.max(0, dt) }
      : { ...next, candidateHeading: caller.heading, candidateSeconds: 0 };
    if (next.candidateSeconds >= CORNER_HOLD_SECONDS && next.candidateHeading !== null) {
      const heading = next.candidateHeading;
      if (next.travelHeading === null || Math.abs(angleDelta(next.travelHeading, heading)) < CORNER_MIN_TURN) {
        next = { ...next, travelHeading: heading };
      } else {
        const target = cornerSettleTarget(caller.x, caller.z, heading, cam.yaw, streets);
        if (target !== null) next = { ...next, targetYaw: target, travelHeading: heading };
      }
    }
  } else if (next.candidateHeading !== null || next.candidateSeconds !== 0) {
    next = { ...next, candidateHeading: null, candidateSeconds: 0 };
  }

  // Ease toward the target. Reduced motion lands in one frame.
  if (next.targetYaw !== null) {
    const d = shortestTurn(cam.yaw, next.targetYaw);
    const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;
    const done = reducedMotion || Math.abs(d) <= SETTLE_DONE;
    const applied = done ? d : d * (1 - Math.exp(-SETTLE_RATE * step));
    if (applied !== 0) cam = { ...cam, yaw: wrapAngle(cam.yaw + applied) };
    next = {
      ...next,
      targetYaw: done ? null : next.targetYaw,
      steerOffset: engaged ? next.steerOffset + applied : 0,
    };
  }
  return { settle: next, camera: cam };
}

/** True while a settle is still turning the camera, so the loop keeps drawing. */
export function isSettling(settle: BlockSettleState): boolean {
  return settle.targetYaw !== null;
}

/** The runtime's gesture flag. */
export function withViewHeld(settle: BlockSettleState, held: boolean): BlockSettleState {
  return settle.viewHeld === held ? settle : { ...settle, viewHeld: held, targetYaw: held ? null : settle.targetYaw };
}
