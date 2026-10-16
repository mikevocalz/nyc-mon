// One simulated frame of the Caller and the chase camera, as a pure function
// of the previous frame, the held controls and the clock. use-game-input.ts
// owns the loop and the stores; this file owns the order:
//   look-around orbit -> Caller steering, collision, jump -> chase camera.
import { chaseCamera, lookAroundAction, moveCityCamera, spawnChaseDistance, swingYaw, yawBehind } from '../city-camera.ts';
import type { CityCamera } from '../city-scene.ts';
import type { CallerState } from './caller-store.ts';
import {
  GROUNDED,
  MAX_FRAME_SECONDS,
  RUN_SPEED,
  TURN_RATE,
  cameraRelativeDirection,
  deflectionToGait,
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
  /** B held: run at any deflection. */
  readonly run: boolean;
  /** Z held: the stick orbits the camera and the Caller stands still. */
  readonly look: boolean;
}

export const RELEASED_CONTROLS: CallerControls = Object.freeze({ stickX: 0, stickY: 0, engaged: false, run: false, look: false });

/** Camera work that spans frames. `recentreYaw` is set by the recentre cap and cleared once the swing lands. */
export interface ChaseState {
  readonly recentreYaw: number | null;
}

export const IDLE_CHASE: ChaseState = Object.freeze({ recentreYaw: null });

/**
 * Stick share pointing away from the camera above which the camera starts
 * swinging behind the Caller. Below it (strafing, walking toward the camera)
 * the yaw holds, so a sideways push walks a straight line instead of a circle.
 */
export const ALIGN_FORWARD_SHARE = 0.7;

const clampDt = (dt: number) => (Number.isFinite(dt) && dt > 0 ? Math.min(dt, MAX_FRAME_SECONDS) : 0);

/** Advances the Caller one frame. Unspawned Callers do not move. */
export function stepCaller(state: CallerState, controls: CallerControls, cameraYaw: number, dt: number, world: WorldQueries): CallerState {
  if (!state.spawned) return state;
  const step = clampDt(dt);
  const jump = stepJump(state.jump, step);
  const direction = controls.engaged && !controls.look ? cameraRelativeDirection(controls.stickX, controls.stickY, cameraYaw) : null;
  if (direction === null || step === 0) {
    if (jump === state.jump && state.gait === 'idle') return state;
    return { ...state, jump, gait: 'idle', speed: 0 };
  }
  const { gait, speed } = deflectionToGait(Math.hypot(controls.stickX, controls.stickY), controls.run);
  const heading = turnToward(state.heading, headingFor(direction), TURN_RATE * step);
  if (gait === 'idle') return { ...state, jump, heading, gait, speed: 0 };
  const next = slideMove(state.x, state.z, direction.x * speed * step, direction.z * speed * step, world.isWalkable);
  const moved = Math.hypot(next.x - state.x, next.z - state.z);
  const blocked = moved < 1e-4;
  return {
    ...state,
    x: next.x,
    z: next.z,
    groundY: world.groundHeight(next.x, next.z),
    heading,
    jump,
    gait: blocked ? 'idle' : gait,
    speed: blocked ? 0 : moved / step,
    stride: state.stride + moved,
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

/** One frame of Caller and camera together. */
export function stepGameFrame(frame: GameFrame, controls: CallerControls, dt: number, reducedMotion: boolean, world: WorldQueries): GameFrameResult {
  const step = clampDt(dt);
  let camera = frame.camera;
  if (controls.engaged && controls.look) camera = moveCityCamera(camera, lookAroundAction(controls.stickX, step));
  const caller = stepCaller(frame.caller, controls, camera.yaw, step, world);
  let chase = frame.chase;
  if (caller.spawned) {
    const recentring = chase.recentreYaw !== null;
    camera = chaseCamera(camera, { x: caller.x, z: caller.z, heading: caller.heading, align: recentring ? 0 : alignStrength(controls, caller.speed) }, step, reducedMotion);
    if (chase.recentreYaw !== null) {
      const swung = swingYaw(camera, chase.recentreYaw, step, reducedMotion);
      camera = swung.camera;
      if (swung.done) chase = IDLE_CHASE;
    }
  }
  const settling = caller.spawned && Math.hypot(camera.x - caller.x, camera.z - caller.z) > 0.01;
  const active = controls.engaged || isAirborne(caller.jump) || chase.recentreYaw !== null || settling;
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

/** The X cap: swing the camera behind the Caller. */
export function recentreChase(state: CallerState): ChaseState {
  return state.spawned ? { recentreYaw: yawBehind(state.heading) } : IDLE_CHASE;
}

/** Spoken by the C cap until interactables exist. Proposed copy row `g01.caller.interact.none`. */
export const NOTHING_TO_INTERACT = 'Nothing to interact with here';
