// Where a CityCamera puts the three.js camera: the orbit look-at, the distance-smoothed pitch and the height.
// Pure (no three), so node --test covers it and the website's walk (city-walk/walk-view.ts) can project and
// unproject screen points through exactly the pose the scene draws — the maths cannot drift apart.
// The body moved out of city-scene.ts unchanged; city-scene re-exports every name.
import type { CityCamera } from './city-scene.ts';

/** Camera distance clamp, metres. The floor is chase range for a 1.8 m Caller. */
export const CAMERA_MIN_DISTANCE = 8;
export const CAMERA_MAX_DISTANCE = 3000;
/** Pitch above the horizon: low behind the Caller, the original overview tilt (atan 0.8) from 220 m out. */
export const CHASE_PITCH = 0.35;
export const OVERVIEW_PITCH = Math.atan(0.8);
export const OVERVIEW_DISTANCE = 220;
/** Close up the camera looks at the Caller's chest, not the ground under their feet. */
const CHASE_LOOK_HEIGHT = 1.2;

const smooth = (t: number) => t * t * (3 - 2 * t);

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
  pitch: number;
  distance: number;
}

/**
 * Where the camera sits for a CityCamera. Horizontal offset `distance`
 * behind the target along (sin yaw, cos yaw), height `distance * tan(pitch)`,
 * so from 220 m out it matches the original framing (height 0.8 x distance)
 * that camera-input.ts's pan maths assumes. Pure, for tests; `out` reuses the
 * caller's pose object so the frame loop allocates nothing.
 */
export function cameraPose(value: CityCamera, out: CameraPose = { position: [0, 0, 0], target: [0, 0, 0], pitch: 0, distance: 0 }): CameraPose {
  const distance = Math.max(CAMERA_MIN_DISTANCE, Math.min(CAMERA_MAX_DISTANCE, value.distance));
  const t = smooth(Math.max(0, Math.min(1, (distance - CAMERA_MIN_DISTANCE) / (OVERVIEW_DISTANCE - CAMERA_MIN_DISTANCE))));
  const pitch = CHASE_PITCH + (OVERVIEW_PITCH - CHASE_PITCH) * t;
  const lookY = CHASE_LOOK_HEIGHT * (1 - t);
  out.position[0] = value.x + Math.sin(value.yaw) * distance;
  out.position[1] = lookY + distance * Math.tan(pitch);
  out.position[2] = value.z + Math.cos(value.yaw) * distance;
  out.target[0] = value.x;
  out.target[1] = lookY;
  out.target[2] = value.z;
  out.pitch = pitch;
  out.distance = distance;
  return out;
}
