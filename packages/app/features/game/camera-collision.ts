// The chase camera uses the same mapped building footprints as the player.
// This constrains its rendered eye, not the authored/saved orbit distance.
import type { CityBuilding } from './city-dataset.ts';
import type { CameraPose } from './city-camera-pose.ts';
import { pairs, pointInRing, segmentDistanceSq } from './world/geometry.ts';

const CELL = 32;
export const CHASE_COLLISION_DISTANCE = 40;
export const CAMERA_CLEARANCE = 0.25;
const PROBE_STEP = CAMERA_CLEARANCE / 2;
const EMPTY: readonly number[] = [];
const keyOf = (x: number, z: number) => x * 100_003 + z;

type PointBlocked = (x: number, y: number, z: number, radius: number) => boolean;

/** Only the bundled mapped buildings are indexed; this is not a claim that
 * streamed districts or generated geometry have camera colliders yet.
 */
export function createCameraBlocker(buildings: readonly Pick<CityBuilding, 'ring' | 'holes' | 'heightMeters'>[]): PointBlocked {
  const cells = new Map<number, number[]>();
  const records = buildings.map((building, index) => {
    const ring = pairs(building.ring);
    const holes = building.holes.map(pairs);
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const [x, z] of ring) {
      minX = Math.min(minX, x); minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x); maxZ = Math.max(maxZ, z);
    }
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
        const key = keyOf(cx, cz);
        const list = cells.get(key);
        if (list) list.push(index); else cells.set(key, [index]);
      }
    }
    return { ring, holes, height: building.heightMeters, minX, minZ, maxX, maxZ };
  });
  const nearRing = (ring: readonly (readonly [number, number])[], x: number, z: number, radius: number) => {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!, b = ring[(i + 1) % ring.length]!;
      if (segmentDistanceSq(x, z, a[0], a[1], b[0], b[1]) <= radius * radius) return true;
    }
    return false;
  };
  return (x, y, z, radius) => {
    const span = Math.max(1, Math.ceil(radius / CELL));
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let dx = -span; dx <= span; dx++) for (let dz = -span; dz <= span; dz++) {
      for (const index of cells.get(keyOf(cx + dx, cz + dz)) ?? EMPTY) {
        const b = records[index]!;
        if (y > b.height + radius || y < -radius || x < b.minX - radius || x > b.maxX + radius || z < b.minZ - radius || z > b.maxZ + radius) continue;
        if (nearRing(b.ring, x, z, radius) || b.holes.some((hole) => nearRing(hole, x, z, radius))) return true;
        if (pointInRing(x, z, b.ring) && !b.holes.some((hole) => pointInRing(x, z, hole))) return true;
      }
    }
    return false;
  };
}

/** Clips the eye toward the chest along its desired sightline. A small swept
 * sphere protects the near plane too. Sampling steps are below the sphere's
 * diameter, then a binary search refines the first contact without tunneling
 * through thin walls. The requested target/yaw/distance stay untouched.
 */
export function constrainChaseCameraPose(pose: CameraPose, blocked: PointBlocked, radius = CAMERA_CLEARANCE): CameraPose {
  if (pose.distance > CHASE_COLLISION_DISTANCE) return pose;
  const [tx, ty, tz] = pose.target;
  const dx = pose.position[0] - tx, dy = pose.position[1] - ty, dz = pose.position[2] - tz;
  const length = Math.hypot(dx, dy, dz);
  if (length === 0 || blocked(tx, ty, tz, 0)) return pose;
  const steps = Math.max(1, Math.ceil(length / PROBE_STEP));
  let clear = 0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // Near-plane extent shrinks with the rendered eye distance; using the
    // full requested zoom's extent beside the player collapses narrow alleys.
    if (!blocked(tx + dx * t, ty + dy * t, tz + dz * t, Math.max(CAMERA_CLEARANCE, radius * t))) { clear = t; continue; }
    let hit = t;
    for (let j = 0; j < 10; j++) {
      const middle = (clear + hit) / 2;
      if (blocked(tx + dx * middle, ty + dy * middle, tz + dz * middle, Math.max(CAMERA_CLEARANCE, radius * middle))) hit = middle;
      else clear = middle;
    }
    pose.position[0] = tx + dx * clear;
    pose.position[1] = ty + dy * clear;
    pose.position[2] = tz + dz * clear;
    return pose;
  }
  return pose;
}

/** Stationary frames (traffic, sky and animation) reuse the last collision
 * result; camera movement still resolves from the desired pose every time.
 */
export function createChaseCameraConstraint(blocked: PointBlocked) {
  const previous = new Float64Array(7).fill(NaN);
  const eye = new Float64Array(3);
  return (pose: CameraPose, radius = CAMERA_CLEARANCE): CameraPose => {
    let same = previous[6] === radius;
    for (let i = 0; i < 3; i++) same = same && previous[i] === pose.position[i] && previous[i + 3] === pose.target[i];
    if (same) {
      for (let i = 0; i < 3; i++) pose.position[i] = eye[i]!;
      return pose;
    }
    for (let i = 0; i < 3; i++) { previous[i] = pose.position[i]!; previous[i + 3] = pose.target[i]!; }
    previous[6] = radius;
    constrainChaseCameraPose(pose, blocked, radius);
    for (let i = 0; i < 3; i++) eye[i] = pose.position[i]!;
    return pose;
  };
}
