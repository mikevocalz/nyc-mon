// The Game screen's glue between the pure Caller maths and its module-scope
// stores: placing the Caller at hand-over, the cap actions, and the stick's
// step actions for screen-reader users (WCAG 2.5.7, the non-drag path).
// use-game-input.ts owns the frame loop and calls into here.
import { AccessibilityInfo } from 'react-native';
import { describeCamera, ORBIT_STEP } from '../camera-input.ts';
import { chaseCamera, nextChaseDistance } from '../city-camera.ts';
import { gameCameraStore } from '../game-session.ts';
import { IDLE_CHASE, jumpCaller, recentreChase, spawnCaller, type ChaseState } from './caller-controller.ts';
import { callerStore } from './caller-store.ts';
import { cameraRelativeDirection, headingFor, slideMove } from './locomotion.ts';
import type { WorldQueries } from './walkability.ts';
import { cityGroundHeight, isWalkable } from './world-queries.ts';

export const worldQueries: WorldQueries = { isWalkable, groundHeight: cityGroundHeight };

/** Camera work in flight (the recentre swing). Module scope with the stores; read and written by the frame loop. */
export const chaseRef: { current: ChaseState } = { current: IDLE_CHASE };

/**
 * Places the Caller at the walkable point nearest the camera's look-at and
 * pulls the camera in to a chase distance. Called each time gameplay input
 * turns on (the lobby's hand-over, a Retry), so a resumed save puts the
 * Caller back where the chase camera last looked.
 */
export function placeCaller(): void {
  const placed = spawnCaller(callerStore.getState(), gameCameraStore.getState().camera, worldQueries);
  if (placed === null) return;
  chaseRef.current = placed.chase;
  callerStore.setState(placed.caller, true);
  gameCameraStore.setState({ camera: placed.camera });
}

export function jump(): void {
  const before = callerStore.getState();
  const after = jumpCaller(before);
  if (after !== before) callerStore.setState(after, true);
}

export function recentre(): void {
  chaseRef.current = recentreChase(callerStore.getState());
}

export function cycleZoom(): void {
  const { camera, move } = gameCameraStore.getState();
  move({ type: 'zoom', factor: nextChaseDistance(camera.distance) / camera.distance });
}

/** One step for the stick's accessibility actions, metres. */
export const A11Y_STEP_METRES = 2;

type StepName = 'stepForward' | 'stepBack' | 'stepLeft' | 'stepRight' | 'turnLeft' | 'turnRight' | 'recentre';

/** Moves the Caller one step relative to the view and snaps the camera onto them; no animation, so no reduced-motion variant. */
function stepCaller(stickX: number, stickY: number): void {
  const caller = callerStore.getState();
  if (!caller.spawned) return;
  const camera = gameCameraStore.getState().camera;
  const direction = cameraRelativeDirection(stickX, stickY, camera.yaw);
  if (direction === null) return;
  const next = slideMove(caller.x, caller.z, direction.x * A11Y_STEP_METRES, direction.z * A11Y_STEP_METRES, worldQueries.isWalkable);
  const moved = Math.hypot(next.x - caller.x, next.z - caller.z);
  const updated = { ...caller, ...next, groundY: worldQueries.groundHeight(next.x, next.z), heading: headingFor(direction), stride: caller.stride + moved };
  callerStore.setState(updated, true);
  gameCameraStore.setState({ camera: chaseCamera(camera, { x: updated.x, z: updated.z, heading: updated.heading, align: 0 }, 0, true) });
  if (moved < 0.01) AccessibilityInfo.announceForAccessibility('Blocked');
}

/** The stick's step actions (copy deck `g01.stick.hint`: "Double tap for step controls"). Proposed labels, 14 characters max. */
export const CALLER_STEP_ACTIONS: readonly { name: StepName; label: string; perform: () => void }[] = [
  { name: 'stepForward', label: 'Step forward', perform: () => stepCaller(0, 1) },
  { name: 'stepBack', label: 'Step back', perform: () => stepCaller(0, -1) },
  { name: 'stepLeft', label: 'Step left', perform: () => stepCaller(-1, 0) },
  { name: 'stepRight', label: 'Step right', perform: () => stepCaller(1, 0) },
  { name: 'turnLeft', label: 'Turn view left', perform: () => gameCameraStore.getState().move({ type: 'orbit', radians: ORBIT_STEP }) },
  { name: 'turnRight', label: 'Turn view right', perform: () => gameCameraStore.getState().move({ type: 'orbit', radians: -ORBIT_STEP }) },
  { name: 'recentre', label: 'Recentre view', perform: () => {
    const caller = callerStore.getState();
    if (!caller.spawned) return;
    const { camera } = gameCameraStore.getState();
    gameCameraStore.setState({ camera: { ...camera, yaw: (caller.heading + Math.PI) % (Math.PI * 2) } });
  } },
];

/** Runs a step action and speaks where the view now faces. */
export function performCallerStep(name: string): boolean {
  const action = CALLER_STEP_ACTIONS.find((a) => a.name === name);
  if (!action) return false;
  action.perform();
  AccessibilityInfo.announceForAccessibility(describeCamera(gameCameraStore.getState().camera));
  return true;
}
