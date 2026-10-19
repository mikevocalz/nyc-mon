// One simulated frame of the Caller and the chase camera, as a pure function
// of the previous frame, the held controls and the clock. use-game-input.ts
// owns the loop and the stores; this file owns the order:
//   look-around orbit -> steering latch -> Caller steering, collision, jump
//   -> chase camera -> recentre swing or block settle.
import { chaseCamera, lookAroundAction, moveCityCamera, spawnChaseDistance, swingYaw, yawBehind } from '../city-camera.ts';
import type { CityCamera } from '../city-scene.ts';
import { NO_STREETS, type StreetAxisLookup } from '../street-axes.ts';
import { IDLE_SETTLE, isSettling, latchSteering, stepBlockSettle, steeringYaw, type BlockSettleState } from './block-settle.ts';
import type { CallerState } from './caller-store.ts';
import {
  GROUNDED,
  MAX_FRAME_SECONDS,
  RUN_SPEED,
  TURN_RATE,
  cameraRelativeDirection,
  cycleMetresFor,
  deflectionToGait,
  easePace,
  findSpawn,
  headingFor,
  isAirborne,
  slideMove,
  startJump,
  stepJump,
  turnToward,
  wrapAngle,
} from './locomotion.ts';
import type { WorldQueries } from './walkability.ts';

/** The controls held right now. The router's latest stick reading plus the hold caps. */
export interface CallerControls {
  readonly stickX: number;
  readonly stickY: number;
  readonly engaged: boolean;
  /** B held (Shift on a keyboard reaches the stick instead): run at any deflection. */
  readonly run: boolean;
  /** Z held: the stick orbits the camera and the Caller stands still. */
  readonly look: boolean;
}

export const RELEASED_CONTROLS: CallerControls = Object.freeze({ stickX: 0, stickY: 0, engaged: false, run: false, look: false });

/**
 * Camera work that spans frames. `recentreYaw` is set by the recentre cap
 * and cleared once the swing lands; `settle` is the block settle
 * (block-settle.ts), which waits while a recentre swings.
 */
export interface ChaseState {
  readonly recentreYaw: number | null;
  readonly settle: BlockSettleState;
}

export const IDLE_CHASE: ChaseState = Object.freeze({ recentreYaw: null, settle: IDLE_SETTLE });

/**
 * Stick share pointing away from the camera above which the camera starts
 * swinging behind the Caller. Below it (strafing, walking toward the camera)
 * the yaw holds, so a sideways push walks a straight line instead of a circle.
 */
export const ALIGN_FORWARD_SHARE = 0.7;

const clampDt = (dt: number) => (Number.isFinite(dt) && dt > 0 ? Math.min(dt, MAX_FRAME_SECONDS) : 0);

/**
 * Advances the Caller one frame. Unspawned Callers do not move.
 * `steerYaw` is the yaw the stick maps through: the camera's, less any yaw a
 * block settle turned under the held push (block-settle.ts).
 */
export function stepCaller(state: CallerState, controls: CallerControls, steerYaw: number, dt: number, world: WorldQueries): CallerState {
  if (!state.spawned) return state;
  const step = clampDt(dt);
  const jump = stepJump(state.jump, step);
  const direction = controls.engaged && !controls.look ? cameraRelativeDirection(controls.stickX, controls.stickY, steerYaw) : null;
  if (direction === null || step === 0) {
    if (jump === state.jump && state.gait === 'idle' && state.pace === 0) return state;
    return { ...state, jump, gait: 'idle', speed: 0, pace: 0 };
  }
  const target = deflectionToGait(Math.hypot(controls.stickX, controls.stickY), controls.run);
  const heading = turnToward(state.heading, headingFor(direction), TURN_RATE * step);
  if (target.gait === 'idle') return { ...state, jump, heading, gait: 'idle', speed: 0, pace: 0 };
  // The pace eases toward the target, so walk to run and back never snaps.
  // slideMove splits the move into 0.25 m collision steps, so a run frame
  // (4.2 m/s for up to 0.1 s) cannot pass through a footprint.
  const pace = easePace(state.pace, target.speed, step);
  const next = slideMove(state.x, state.z, direction.x * pace * step, direction.z * pace * step, world.isWalkable);
  const moved = Math.hypot(next.x - state.x, next.z - state.z);
  const blocked = moved < 1e-4;
  return {
    ...state,
    x: next.x,
    z: next.z,
    groundY: world.groundHeight(next.x, next.z),
    heading,
    jump,
    gait: blocked ? 'idle' : target.gait,
    speed: blocked ? 0 : moved / step,
    pace,
    stride: state.stride + moved,
    gaitPhase: state.gaitPhase + moved / cycleMetresFor(pace),
  };
}

/** Off: see the decision in {@linkcode alignStrength}. Kept as one switch so the swing can come back as a setting. */
const AUTO_SWING: boolean = false;

/** How strongly the chase should swing behind the Caller this frame, 0..1. */
export function alignStrength(controls: CallerControls, speed: number): number {
  // Decision (2026-10-16, device): no automatic swing. On the Surface Duo the
  // swing rotated "forward" under a held stick, so a straight push walked a
  // curve. Arcade feel is screen-relative: up is up the screen until the
  // player turns the view (twist, drag, Z look-around, X recentre).
  if (AUTO_SWING === false) return 0;
  if (!controls.engaged || controls.look || speed <= 0) return 0;
  const length = Math.hypot(controls.stickX, controls.stickY);
  if (length === 0) return 0;
  const forward = controls.stickY / length;
  if (forward < ALIGN_FORWARD_SHARE) return 0;
  return ((forward - ALIGN_FORWARD_SHARE) / (1 - ALIGN_FORWARD_SHARE)) * Math.min(1, speed / RUN_SPEED);
}

export interface GameFrame {
  readonly caller: CallerState;
  readonly camera: CityCamera;
  readonly chase: ChaseState;
}

export interface GameFrameResult extends GameFrame {
  /** True while anything is still moving, so the loop asks for another frame. */
  readonly active: boolean;
}

/**
 * One frame of Caller and camera together. `streets` answers which street
 * the Caller stands on, for the block settle; without one the settle aligns
 * to the Manhattan grid.
 */
export function stepGameFrame(
  frame: GameFrame,
  controls: CallerControls,
  dt: number,
  reducedMotion: boolean,
  world: WorldQueries,
  streets: StreetAxisLookup = NO_STREETS,
): GameFrameResult {
  const step = clampDt(dt);
  let camera = frame.camera;
  if (controls.engaged && controls.look) camera = moveCityCamera(camera, lookAroundAction(controls.stickX, step));
  let settle = latchSteering(frame.chase.settle, controls);
  const caller = stepCaller(frame.caller, controls, steeringYaw(camera, settle), step, world);
  let recentreYaw = frame.chase.recentreYaw;
  if (caller.spawned) {
    camera = chaseCamera(camera, { x: caller.x, z: caller.z, heading: caller.heading, align: recentreYaw !== null ? 0 : alignStrength(controls, caller.speed) }, step, reducedMotion);
    if (recentreYaw !== null) {
      const swung = swingYaw(camera, recentreYaw, step, reducedMotion);
      camera = swung.camera;
      if (swung.done) recentreYaw = null;
    }
    const moving = caller.x !== frame.caller.x || caller.z !== frame.caller.z;
    const settled = stepBlockSettle(settle, camera, controls, { x: caller.x, z: caller.z, heading: caller.heading, moving }, step, reducedMotion, streets, frame.chase.recentreYaw !== null);
    settle = settled.settle;
    camera = settled.camera;
  }
  const chase: ChaseState = recentreYaw === frame.chase.recentreYaw && settle === frame.chase.settle ? frame.chase : { recentreYaw, settle };
  const following = caller.spawned && Math.hypot(camera.x - caller.x, camera.z - caller.z) > 0.01;
  const active = controls.engaged || isAirborne(caller.jump) || recentreYaw !== null || isSettling(settle) || following;
  return { caller, camera, chase, active };
}

/**
 * Places the Caller on the walkable point nearest the camera's look-at
 * point, facing away from the camera. A new game's camera looks at the
 * dataset origin (the Apollo), so the Caller starts on the pavement nearest
 * it; a resumed game's camera looks at where the Caller last stood, because
 * the chase kept it there, so the Caller comes back to the same spot without
 * a new save field. Null when nothing walkable is in reach.
 */
export function spawnCaller(state: CallerState, camera: CityCamera, world: WorldQueries): GameFrame | null {
  const point = findSpawn(camera.x, camera.z, world.isWalkable);
  if (point === null) return null;
  const caller: CallerState = {
    ...state,
    spawned: true,
    x: point.x,
    z: point.z,
    groundY: world.groundHeight(point.x, point.z),
    heading: wrapAngle(camera.yaw + Math.PI),
    gait: 'idle',
    speed: 0,
    pace: 0,
    jump: GROUNDED,
  };
  return { caller, camera: { ...camera, distance: spawnChaseDistance(camera.distance) }, chase: IDLE_CHASE };
}

/** The A cap. A press in the air does nothing. */
export function jumpCaller(state: CallerState): CallerState {
  if (!state.spawned) return state;
  const jump = startJump(state.jump);
  return jump === state.jump ? state : { ...state, jump };
}

/** The X cap: swing the camera behind the Caller. Any block settle in flight gives way. */
export function recentreChase(state: CallerState, chase: ChaseState = IDLE_CHASE): ChaseState {
  if (!state.spawned) return { ...chase, recentreYaw: null };
  return { recentreYaw: yawBehind(state.heading), settle: { ...chase.settle, targetYaw: null } };
}

/** Spoken by the C cap until interactables exist. Proposed copy row `g01.caller.interact.none`. */
export const NOTHING_TO_INTERACT = 'Nothing to interact with here';
