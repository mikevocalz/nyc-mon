import { createStore } from 'zustand/vanilla';
import type { CityCamera } from './city-scene.ts';

/** The scene's close-range floor (city-scene.ts positionCamera eases pitch down to 0.35 rad here). */
export const MIN_CAMERA_DISTANCE = 8;
/** Starts over the 125th Street sidewalk in front of the Apollo, the walkable cell nearest the dataset origin (world lane, 2026-10-15). */
// yaw π/2 looks west along 125th Street (the facades run along x here); yaw 0
// faced the Apollo's wall, so a first push forward walked into the bricks
// (device, 2026-10-16).
export const INITIAL_CITY_CAMERA: Readonly<CityCamera> = Object.freeze({ x: -28, z: 22, yaw: Math.PI / 2, distance: 220 });
const TAU = Math.PI * 2;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export type CityCameraAction =
  | { type: 'pan'; right: number; forward: number }
  | { type: 'orbit'; radians: number }
  | { type: 'zoom'; factor: number }
  | { type: 'reset' };

/** Screen-relative metre deltas allow touch and accessible buttons to share controls. */
export function moveCityCamera(camera: CityCamera, action: CityCameraAction): CityCamera {
  if (action.type === 'reset') return { ...INITIAL_CITY_CAMERA };
  if (![camera.x, camera.z, camera.yaw, camera.distance].every(Number.isFinite)) return { ...INITIAL_CITY_CAMERA };
  switch (action.type) {
    case 'pan': {
      if (![action.right, action.forward].every(Number.isFinite)) return camera;
      const right = clamp(action.right, -500, 500);
      const forward = clamp(action.forward, -500, 500);
      return {
        ...camera,
        x: clamp(camera.x + Math.cos(camera.yaw) * right - Math.sin(camera.yaw) * forward, -2000, 2000),
        z: clamp(camera.z - Math.sin(camera.yaw) * right - Math.cos(camera.yaw) * forward, -2000, 2000),
      };
    }
    case 'orbit':
      if (!Number.isFinite(action.radians)) return camera;
      return { ...camera, yaw: ((camera.yaw % TAU + action.radians % TAU) % TAU + TAU) % TAU };
    case 'zoom':
      if (!Number.isFinite(action.factor) || action.factor <= 0) return camera;
      return { ...camera, distance: clamp(camera.distance * clamp(action.factor, 0.1, 10), MIN_CAMERA_DISTANCE, 3000) };
  }
}

/** Owned by the game shell, separate from the player's persisted Mon save. */
export function createCityCameraStore() {
  return createStore<{ camera: CityCamera; move: (action: CityCameraAction) => void }>((set) => ({
    camera: { ...INITIAL_CITY_CAMERA },
    move: (action) => set((state) => ({ camera: moveCityCamera(state.camera, action) })),
  }));
}

// ---- Third-person chase (the Caller proxy, PR #29 stage 2) -----------------
// The camera's look-at point follows the Caller; pinch and twist still change
// distance and yaw through moveCityCamera, so they orbit and zoom around the
// figure. Reduced motion is its own variant: the look-at snaps to the Caller
// every frame and the yaw never swings by itself.

/**
 * Chase distances the zoom-cycle cap steps through, nearest first. The low
 * end is the 30 m floor both moveCityCamera and createCityScene clamp to;
 * when the world lane lowers that floor, these move in with it.
 */
export const CHASE_DISTANCES = [8, 18, 40] as const;
/** Look-at catch-up rate, 1/s: the gap to the Caller shrinks by e every 1/8 s. */
export const CHASE_FOLLOW_RATE = 8;
/** How fast the camera swings behind a Caller walking away from it, rad/s at full speed. */
export const CHASE_ALIGN_RATE = 1.2;
/** Recentre swing, rad/s. A half turn takes about half a second. */
export const CHASE_RECENTRE_RATE = 6;
/** Look-around orbit at full stick deflection, rad/s. */
export const CHASE_LOOK_RATE = 2;

const wrap = (radians: number) => ((radians % TAU) + TAU) % TAU;
const shortest = (from: number, to: number) => {
  const d = wrap(to - from);
  return d > Math.PI ? d - TAU : d;
};

/** The yaw that puts the camera directly behind a Caller facing `heading`. */
export function yawBehind(heading: number): number {
  return wrap(heading + Math.PI);
}

export interface ChaseTarget {
  readonly x: number;
  readonly z: number;
  readonly heading: number;
  /** 0..1, the share of the Caller's speed that points away from the camera; drives the auto swing. */
  readonly align: number;
}

/**
 * One frame of the chase. Eases the look-at onto the Caller and, while the
 * Caller walks away from the camera, swings the yaw behind them in
 * proportion to `target.align`. Under reduced motion the look-at snaps and
 * the yaw is left alone.
 */
export function chaseCamera(camera: CityCamera, target: ChaseTarget, dt: number, reducedMotion: boolean): CityCamera {
  if (![target.x, target.z, target.heading].every(Number.isFinite)) return camera;
  if (reducedMotion) return { ...camera, x: target.x, z: target.z };
  const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;
  const keep = Math.exp(-CHASE_FOLLOW_RATE * step);
  const align = Math.max(0, Math.min(1, target.align));
  const swing = CHASE_ALIGN_RATE * align * step;
  const d = shortest(camera.yaw, yawBehind(target.heading));
  return {
    ...camera,
    x: target.x + (camera.x - target.x) * keep,
    z: target.z + (camera.z - target.z) * keep,
    yaw: swing > 0 ? wrap(camera.yaw + Math.sign(d) * Math.min(Math.abs(d), swing)) : camera.yaw,
  };
}

/**
 * Swings the yaw toward `targetYaw` by the recentre rate; reduced motion
 * snaps. `done` turns true once the yaw is there.
 */
export function swingYaw(camera: CityCamera, targetYaw: number, dt: number, reducedMotion: boolean): { camera: CityCamera; done: boolean } {
  if (!Number.isFinite(targetYaw)) return { camera, done: true };
  const d = shortest(camera.yaw, targetYaw);
  const step = reducedMotion ? Infinity : CHASE_RECENTRE_RATE * Math.min(Math.max(dt, 0), 0.1);
  if (Math.abs(d) <= step || Math.abs(d) < 1e-6) return { camera: { ...camera, yaw: wrap(targetYaw) }, done: true };
  return { camera: { ...camera, yaw: wrap(camera.yaw + Math.sign(d) * step) }, done: false };
}

/** Look around: stick right turns the view right (the compass heading grows, so yaw falls). */
export function lookAroundAction(stickX: number, dt: number): CityCameraAction {
  return { type: 'orbit', radians: -stickX * CHASE_LOOK_RATE * Math.min(Math.max(dt, 0), 0.1) };
}

/** The next stop of the zoom cycle after `distance`, wrapping back to the nearest. */
export function nextChaseDistance(distance: number): number {
  for (const stop of CHASE_DISTANCES) if (stop > distance + 1) return stop;
  return CHASE_DISTANCES[0];
}

/** The chase distance a freshly spawned Caller starts at: the current one when it is a chase distance, else the nearest stop. */
export function spawnChaseDistance(distance: number): number {
  const max = CHASE_DISTANCES[CHASE_DISTANCES.length - 1] ?? CHASE_DISTANCES[0];
  return Number.isFinite(distance) && distance >= CHASE_DISTANCES[0] && distance <= max ? distance : CHASE_DISTANCES[0];
}
