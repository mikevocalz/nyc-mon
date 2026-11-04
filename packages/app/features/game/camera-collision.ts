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

/** Index only the supplied solid footprints. Callers combine bundled map and loaded authored-building volumes;
 * geometry without a supplied footprint still requires separate collision coverage.
 */
export function createCameraBlocker(buildings: readonly (Pick<CityBuilding, 'ring' | 'holes' | 'heightMeters'> & { baseMeters?: number })[]): PointBlocked {
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
    return { ring, holes, height: building.heightMeters, base: building.baseMeters ?? 0, minX, minZ, maxX, maxZ };
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
        if (y > b.height + radius || y < b.base - radius || x < b.minX - radius || x > b.maxX + radius || z < b.minZ - radius || z > b.maxZ + radius) continue;
        if (nearRing(b.ring, x, z, radius) || b.holes.some((hole) => nearRing(hole, x, z, radius))) return true;
        if (pointInRing(x, z, b.ring) && !b.holes.some((hole) => pointInRing(x, z, hole))) return true;
      }
    }
    return false;
  };
}

const SIDES = [1, -1] as const;
function clearCameraArm(blocked: PointBlocked, tx: number, ty: number, tz: number,
  ax: number, ay: number, az: number, length: number, radius: number): number {
  const steps = Math.max(1, Math.ceil(length / PROBE_STEP));
  let clear = 0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!blocked(tx + ax * t, ty + ay * t, tz + az * t, Math.max(CAMERA_CLEARANCE, radius * t))) { clear = t; continue; }
    let hit = t;
    for (let j = 0; j < 10; j++) {
      const middle = (clear + hit) / 2;
      if (blocked(tx + ax * middle, ty + ay * middle, tz + az * middle, Math.max(CAMERA_CLEARANCE, radius * middle))) hit = middle;
      else clear = middle;
    }
    return clear;
  }
  return 1;
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
  let clear = clearCameraArm(blocked, tx, ty, tz, dx, dy, dz, length, radius), actualX = dx, actualZ = dz;
  // A straight spring arm can collapse to centimetres beside a facade: the
  // eye then sits inside the avatar and authored window details, despite its
  // point clearing the footprint. Find the nearest usable render orbit before
  // accepting that collapse. Input yaw and saved zoom remain the requested pose.
  const framing = Math.min(3, length * 0.6);
  if (clear * length < Math.min(2, framing)) {
    for (let step = 1; step <= 6; step++) {
      for (const side of SIDES) {
        const angle = side * step * Math.PI / 6, c = Math.cos(angle), sn = Math.sin(angle);
        const ax = dx * c - dz * sn, az = dx * sn + dz * c;
        const candidate = clearCameraArm(blocked, tx, ty, tz, ax, dy, az, length, radius);
        if (candidate > clear) { clear = candidate; actualX = ax; actualZ = az; }
        if (clear * length >= framing) break;
      }
      if (clear * length >= framing) break;
    }
  }
  pose.position[0] = tx + actualX * clear;
  pose.position[1] = ty + dy * clear;
  pose.position[2] = tz + actualZ * clear;
  return pose;
}

/** Stationary frames (traffic, sky and animation) reuse the last collision
 * result; camera movement still resolves from the desired pose every time.
 */
export function createChaseCameraConstraint(blocked: PointBlocked, revision: () => number = () => 0) {
  let previousRevision = -1;
  const previous = new Float64Array(7).fill(NaN);
  const eye = new Float64Array(3);
  return (pose: CameraPose, radius = CAMERA_CLEARANCE): CameraPose => {
    const currentRevision = revision();
    let same = previousRevision === currentRevision && previous[6] === radius;
    for (let i = 0; i < 3; i++) same = same && previous[i] === pose.position[i] && previous[i + 3] === pose.target[i];
    if (same) {
      for (let i = 0; i < 3; i++) pose.position[i] = eye[i]!;
      return pose;
    }
    for (let i = 0; i < 3; i++) { previous[i] = pose.position[i]!; previous[i + 3] = pose.target[i]!; }
    previous[6] = radius; previousRevision = currentRevision;
    constrainChaseCameraPose(pose, blocked, radius);
    for (let i = 0; i < 3; i++) eye[i] = pose.position[i]!;
    return pose;
  };
}
