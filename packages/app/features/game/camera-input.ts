// Pure mapping from touch, buttons and accessibility actions to the
// CityCameraAction contract in ./city-camera.ts (PR #30). No react-native
// import, so `node --test` covers every mapping.
//
// Every input path ends in moveCityCamera, which already clamps and rejects
// non-finite values; this file only converts units and picks step sizes.
import type { CityCamera } from './city-scene.ts';
import type { CityCameraAction } from './city-camera.ts';

/** createCityScene's PerspectiveCamera fov, in degrees (city-scene.ts). */
const VERTICAL_FOV_DEG = 50;
/** createCityScene puts the camera at height distance * 0.8 over a horizontal offset of distance. */
const SLANT_PER_DISTANCE = Math.hypot(1, 0.8);

/**
 * Ground metres under one layout dp at the look-at point. An approximation:
 * the camera is tilted, so rows nearer the horizon cover more ground. Good
 * enough for a drag to track the finger near screen centre.
 */
export function metresPerDp(distance: number, viewportHeightDp: number): number {
  if (!Number.isFinite(distance) || !Number.isFinite(viewportHeightDp) || viewportHeightDp <= 0) return 0;
  const slant = distance * SLANT_PER_DISTANCE;
  return (2 * slant * Math.tan((VERTICAL_FOV_DEG * Math.PI) / 360)) / viewportHeightDp;
}

/**
 * One-finger drag. The world follows the finger: dragging right moves the
 * camera left, dragging down moves it forward. Physical screen axes, so RTL
 * does not mirror the map.
 */
export function panToAction(changeX: number, changeY: number, camera: CityCamera, viewportHeightDp: number): CityCameraAction {
  const scale = metresPerDp(camera.distance, viewportHeightDp);
  return { type: 'pan', right: -changeX * scale, forward: changeY * scale };
}

/** Pinch. RNGH 3.2.1 scaleChange is current.scale / previous.scale; spreading fingers (>1) moves closer. */
export function pinchToAction(scaleChange: number): CityCameraAction {
  return { type: 'zoom', factor: scaleChange > 0 ? 1 / scaleChange : Number.NaN };
}

/**
 * Two-finger twist. RNGH rotationChange is radians since the last event.
 * Sign: a clockwise twist turns the map clockwise, so the view heading turns
 * counter-clockwise, which is positive orbit (see headingDegrees).
 * DEVICE CHECK: confirm the sign on iOS and Android hardware; the platforms
 * have historically disagreed on rotation direction.
 */
export function rotationToAction(rotationChange: number): CityCameraAction {
  return { type: 'orbit', radians: rotationChange };
}

/** Button and accessibility-action steps. Same actions for both so they never drift apart. */
export const ZOOM_STEP = 1.25;
export const ORBIT_STEP = Math.PI / 8;
/** A move button travels a quarter of the camera distance, so steps feel the same at every zoom. */
export const PAN_STEP_PER_DISTANCE = 0.25;

export type CameraCommand =
  | 'zoomIn' | 'zoomOut'
  | 'rotateLeft' | 'rotateRight'
  | 'moveForward' | 'moveBack' | 'moveLeft' | 'moveRight'
  | 'reset';

export function commandToAction(command: CameraCommand, camera: CityCamera): CityCameraAction {
  const step = camera.distance * PAN_STEP_PER_DISTANCE;
  switch (command) {
    case 'zoomIn': return { type: 'zoom', factor: 1 / ZOOM_STEP };
    case 'zoomOut': return { type: 'zoom', factor: ZOOM_STEP };
    case 'rotateLeft': return { type: 'orbit', radians: ORBIT_STEP };
    case 'rotateRight': return { type: 'orbit', radians: -ORBIT_STEP };
    case 'moveForward': return { type: 'pan', right: 0, forward: step };
    case 'moveBack': return { type: 'pan', right: 0, forward: -step };
    case 'moveLeft': return { type: 'pan', right: -step, forward: 0 };
    case 'moveRight': return { type: 'pan', right: step, forward: 0 };
    case 'reset': return { type: 'reset' };
  }
}

/**
 * Compass heading the camera faces, degrees clockwise from north.
 * city-scene.ts places the camera at target + (sin yaw, cos yaw) * distance
 * with north = -z, so it looks along (-sin yaw, -cos yaw): bearing = -yaw.
 */
export function headingDegrees(camera: CityCamera): number {
  const degrees = (-camera.yaw * 180) / Math.PI;
  return ((degrees % 360) + 360) % 360;
}

const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'] as const;

/** Spoken after an accessibility action, so a screen-reader user hears where the view went. */
export function describeCamera(camera: CityCamera): string {
  const point = POINTS[Math.round(headingDegrees(camera) / 45) % 8]!;
  return `Facing ${point}, ${Math.round(camera.distance)} metres away`;
}

/** Fling glide after a drag. Off under reduced motion: the camera stops where the finger lifts. */
export interface PanInertia { velocityX: number; velocityY: number }
const INERTIA_DECAY_PER_SECOND = 5;
const INERTIA_START_DP_PER_S = 200;
const INERTIA_STOP_DP_PER_S = 20;

export function startPanInertia(velocityX: number, velocityY: number, reducedMotion: boolean): PanInertia | null {
  if (reducedMotion || !Number.isFinite(velocityX) || !Number.isFinite(velocityY)) return null;
  return Math.hypot(velocityX, velocityY) >= INERTIA_START_DP_PER_S ? { velocityX, velocityY } : null;
}

/** Frame-rate independent decay. Returns the drag delta for this frame and the next state (null = stopped). */
export function stepPanInertia(state: PanInertia, deltaSeconds: number): { changeX: number; changeY: number; next: PanInertia | null } {
  const dt = Math.min(Math.max(deltaSeconds, 0), 0.1);
  const changeX = state.velocityX * dt;
  const changeY = state.velocityY * dt;
  const keep = Math.exp(-INERTIA_DECAY_PER_SECOND * dt);
  const next = { velocityX: state.velocityX * keep, velocityY: state.velocityY * keep };
  return { changeX, changeY, next: Math.hypot(next.velocityX, next.velocityY) < INERTIA_STOP_DP_PER_S ? null : next };
}
