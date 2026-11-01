// Screen-space maths for the website's city walk (/city/walk), all pure so node --test covers it:
//   - world point -> canvas pixel (the floating map labels),
//   - canvas pixel -> ground point under it (tap-to-move),
//   - the eased glide a tap or a landmark pick rides (startTravel / stepTravel).
//
// The pose comes from city-camera-pose.ts — the same function the scene positions its PerspectiveCamera with —
// and the projection is the pinhole the scene's fov-50 camera draws, so a label pinned to a world point sits
// where the point draws.
import { cameraPose } from '../city-camera-pose.ts';
import type { CityCamera } from '../city-scene.ts';

/** The stage's drawable size in CSS px. */
export interface WalkViewport {
  readonly width: number;
  readonly height: number;
}

/** The camera's position and orthonormal basis (right/up/forward) for a CityCamera, plus tan(fov/2). */
export interface CameraBasis {
  readonly px: number;
  readonly py: number;
  readonly pz: number;
  readonly rx: number;
  readonly ry: number;
  readonly rz: number;
  readonly ux: number;
  readonly uy: number;
  readonly uz: number;
  readonly fx: number;
  readonly fy: number;
  readonly fz: number;
  readonly tanHalf: number;
}

/** createCityScene's PerspectiveCamera fov, degrees (also camera-input.ts VERTICAL_FOV_DEG). */
const FOV_DEG = 50;

const norm = (x: number, y: number, z: number): readonly [number, number, number] => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};

/**
 * The basis for a CityCamera: forward is target - position, right is forward x world-up, up is right x forward.
 * Returns null when the pose cannot produce a frame (degenerate inputs); callers then skip the pass.
 */
export function cameraBasis(camera: CityCamera): CameraBasis | null {
  if (![camera.x, camera.z, camera.yaw, camera.distance].every(Number.isFinite)) return null;
  const pose = cameraPose(camera);
  const [fx, fy, fz] = norm(pose.target[0] - pose.position[0], pose.target[1] - pose.position[1], pose.target[2] - pose.position[2]);
  // right = forward x world-up = (-fz, 0, fx); the camera looks down, so this never degenerates.
  const [rx, ry, rz] = norm(-fz, 0, fx);
  // up = right x forward
  const ux = ry * fz - rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy - ry * fx;
  return {
    px: pose.position[0], py: pose.position[1], pz: pose.position[2],
    rx, ry, rz, ux, uy, uz, fx, fy, fz,
    tanHalf: Math.tan((FOV_DEG * Math.PI) / 360),
  };
}

/** A world point's canvas pixel and view depth, or null behind the camera (or just off its near plane). */
export function projectToScreen(
  basis: CameraBasis,
  x: number,
  y: number,
  z: number,
  viewport: WalkViewport,
): { x: number; y: number; depth: number } | null {
  const aspect = viewport.width / viewport.height;
  if (!(aspect > 0) || !Number.isFinite(aspect)) return null;
  const dx = x - basis.px;
  const dy = y - basis.py;
  const dz = z - basis.pz;
  const depth = dx * basis.fx + dy * basis.fy + dz * basis.fz;
  // the scene's near plane sits at min(5, distance*0.02) (city-scene.ts positionCamera); anything nearer is clipped.
  if (depth <= 0.5) return null;
  const px = (dx * basis.rx + dy * basis.ry + dz * basis.rz) / (depth * basis.tanHalf * aspect);
  const py = (dx * basis.ux + dy * basis.uy + dz * basis.uz) / (depth * basis.tanHalf);
  return { x: ((px + 1) / 2) * viewport.width, y: ((1 - py) / 2) * viewport.height, depth };
}

/**
 * The ground-plane (y = 0) point under a canvas pixel, or null when the pixel looks at or above the horizon.
 * Tap-to-move aims the look-at here.
 */
export function groundPointForScreen(
  basis: CameraBasis,
  px: number,
  py: number,
  viewport: WalkViewport,
): { x: number; z: number } | null {
  const aspect = viewport.width / viewport.height;
  if (!(aspect > 0) || !Number.isFinite(aspect)) return null;
  const nx = ((px / viewport.width) * 2 - 1) * basis.tanHalf * aspect;
  const ny = (1 - (py / viewport.height) * 2) * basis.tanHalf;
  const [dx, dy, dz] = norm(
    basis.fx + nx * basis.rx + ny * basis.ux,
    basis.fy + nx * basis.ry + ny * basis.uy,
    basis.fz + nx * basis.rz + ny * basis.uz,
  );
  if (dy >= -1e-6) return null;
  const t = -basis.py / dy;
  return { x: basis.px + dx * t, z: basis.pz + dz * t };
}

// ---- taps and the travel glide ------------------------------------------------

/** A tap is a press that barely moved and did not last; anything else is a drag the pointer path owns. */
export const TAP_MAX_MOVE_PX = 10;
export const TAP_MAX_MS = 500;

export function isTap(down: { x: number; y: number; at: number }, up: { x: number; y: number; at: number }): boolean {
  return Math.hypot(up.x - down.x, up.y - down.y) <= TAP_MAX_MOVE_PX && up.at - down.at <= TAP_MAX_MS;
}

/**
 * One glide toward a ground point: eased (slower start, slower end) over `duration` seconds; zero under reduced
 * motion, so the camera lands in one step. Progress is eased time, not eased distance, so it never stalls a metre
 * short of a far pick.
 */
export interface WalkTravel {
  readonly fromX: number;
  readonly fromZ: number;
  readonly toX: number;
  readonly toZ: number;
  readonly duration: number;
  t: number;
}

/** Below this the tap was practically on the look-at already; not worth a glide. */
export const TRAVEL_MIN_METERS = 3;
/** Glide length limits, seconds: a doorstep hop stays snappy, a cross-town pick never takes two seconds. */
export const TRAVEL_MIN_SECONDS = 0.45;
export const TRAVEL_MAX_SECONDS = 1.8;
/** The pace the duration scales to, metres per second. */
const TRAVEL_METERS_PER_SECOND = 9000;

export function startTravel(camera: CityCamera, x: number, z: number, reducedMotion: boolean): WalkTravel | null {
  if (![x, z].every(Number.isFinite)) return null;
  const dist = Math.hypot(x - camera.x, z - camera.z);
  if (dist < TRAVEL_MIN_METERS) return null;
  const duration = reducedMotion ? 0 : Math.min(TRAVEL_MAX_SECONDS, Math.max(TRAVEL_MIN_SECONDS, dist / TRAVEL_METERS_PER_SECOND));
  return { fromX: camera.x, fromZ: camera.z, toX: x, toZ: z, duration, t: 0 };
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * The look-at point this frame of a travel; `done` once the glide has landed. `dt` is clamped like the key loop's,
 * so a stalled tab resumes mid-glide instead of jumping.
 */
export function stepTravel(travel: WalkTravel, deltaSeconds: number): { x: number; z: number; done: boolean } {
  const dt = Math.min(Math.max(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0), 0.1);
  travel.t = travel.duration === 0 ? travel.duration : Math.min(travel.duration, travel.t + dt);
  const f = travel.duration === 0 ? 1 : smoothstep(travel.t / travel.duration);
  return {
    x: travel.fromX + (travel.toX - travel.fromX) * f,
    z: travel.fromZ + (travel.toZ - travel.fromZ) * f,
    done: travel.t >= travel.duration,
  };
}
