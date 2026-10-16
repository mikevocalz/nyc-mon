// Pure movement maths for the Caller proxy: stick deflection to gait and
// speed, camera-relative steering, turning, collision slide, the jump arc and
// the spawn search. No three.js, no React, so `node --test` covers all of it.
//
// Conventions (shared with caller-proxy.ts and city-camera.ts):
// - The scene is metres on x/z with north = -z (city-dataset.ts).
// - `heading` is the Caller's facing as a three.js rotation.y: the figure is
//   modelled facing local +z, so it faces (sin heading, cos heading) on x/z.
// - The camera sits at target + (sin yaw, cos yaw) * distance (city-scene.ts),
//   so a camera directly behind the Caller has yaw = heading + PI.

/** Walking pace at the walk/run boundary, m/s. A brisk city walk. */
export const WALK_SPEED = 1.6;
/** Running pace, m/s. A jog, not a sprint: there is no stamina rule to pay for more. */
export const RUN_SPEED = 4.2;
/** Stick deflection (0..1) at and above which the Caller runs. */
export const RUN_DEFLECTION = 0.6;
/** Below this deflection the stick reads as released; the router's dead zone already ran. */
export const MIN_DEFLECTION = 0.05;
/** How fast the figure turns toward the stick direction, rad/s. */
export const TURN_RATE = 10;
/** Largest single move the collision test takes; longer frames are split into steps this long. */
export const MAX_COLLISION_STEP = 0.25;
/** Jump take-off speed, m/s, and gravity, m/s². Apex about 0.5 m, air time about 0.65 s. */
export const JUMP_SPEED = 3.2;
export const GRAVITY = 9.81;
/** Largest frame the simulation integrates; a stalled frame never teleports the Caller. */
export const MAX_FRAME_SECONDS = 0.1;

export type Gait = 'idle' | 'walk' | 'run';

const TAU = Math.PI * 2;

/** Wraps an angle into [0, 2π). */
export function wrapAngle(radians: number): number {
  return ((radians % TAU) + TAU) % TAU;
}

/** Signed shortest turn from `from` to `to`, in (-π, π]. */
export function angleDelta(from: number, to: number): number {
  const d = wrapAngle(to - from);
  return d > Math.PI ? d - TAU : d;
}

/**
 * Gait and ground speed for a stick deflection. Walk speed grows with the
 * push up to {@linkcode RUN_DEFLECTION}; past it the Caller runs at
 * {@linkcode RUN_SPEED}. `runHeld` (the B cap) runs at any deflection.
 */
export function deflectionToGait(deflection: number, runHeld: boolean): { gait: Gait; speed: number } {
  if (!Number.isFinite(deflection) || deflection < MIN_DEFLECTION) return { gait: 'idle', speed: 0 };
  const d = Math.min(deflection, 1);
  if (runHeld || d >= RUN_DEFLECTION) return { gait: 'run', speed: RUN_SPEED };
  return { gait: 'walk', speed: WALK_SPEED * (d / RUN_DEFLECTION) };
}

/**
 * The world-space unit direction a stick reading asks for, relative to the
 * camera: stick up walks away from the camera, stick right walks toward the
 * screen's right. Returns null for a released stick.
 */
export function cameraRelativeDirection(stickX: number, stickY: number, cameraYaw: number): { x: number; z: number } | null {
  if (![stickX, stickY, cameraYaw].every(Number.isFinite)) return null;
  const length = Math.hypot(stickX, stickY);
  if (length < MIN_DEFLECTION) return null;
  const sx = stickX / length;
  const sy = stickY / length;
  // Camera forward on the ground is (-sin yaw, -cos yaw); camera right is (cos yaw, -sin yaw).
  return {
    x: Math.cos(cameraYaw) * sx - Math.sin(cameraYaw) * sy,
    z: -Math.sin(cameraYaw) * sx - Math.cos(cameraYaw) * sy,
  };
}

/** The heading that faces a world direction. */
export function headingFor(direction: { x: number; z: number }): number {
  return wrapAngle(Math.atan2(direction.x, direction.z));
}

/** Turns `current` toward `target` by at most `maxStep` radians, the short way round. */
export function turnToward(current: number, target: number, maxStep: number): number {
  const d = angleDelta(current, target);
  if (Math.abs(d) <= maxStep) return wrapAngle(target);
  return wrapAngle(current + Math.sign(d) * maxStep);
}

export type WalkableTest = (x: number, z: number) => boolean;

/**
 * Moves from (x, z) by (dx, dz) without entering an unwalkable point. A
 * blocked move slides along whichever axis stays clear (x first, then z), so
 * walking diagonally into a wall runs along it instead of sticking. Long
 * moves are split into {@linkcode MAX_COLLISION_STEP} steps so a fast frame
 * cannot tunnel through a thin footprint.
 */
export function slideMove(x: number, z: number, dx: number, dz: number, isWalkable: WalkableTest): { x: number; z: number } {
  if (![x, z, dx, dz].every(Number.isFinite)) return { x, z };
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / MAX_COLLISION_STEP));
  const sx = dx / steps;
  const sz = dz / steps;
  let px = x;
  let pz = z;
  for (let i = 0; i < steps; i++) {
    if (isWalkable(px + sx, pz + sz)) { px += sx; pz += sz; continue; }
    if (sx !== 0 && isWalkable(px + sx, pz)) { px += sx; continue; }
    if (sz !== 0 && isWalkable(px, pz + sz)) { pz += sz; continue; }
    break;
  }
  return { x: px, z: pz };
}

/** Height above the ground and vertical speed. Both 0 while standing. */
export interface JumpState {
  readonly height: number;
  readonly velocity: number;
}

export const GROUNDED: JumpState = Object.freeze({ height: 0, velocity: 0 });

export function isAirborne(jump: JumpState): boolean {
  return jump.height > 0 || jump.velocity > 0;
}

/** Starts a jump from the ground; a press while airborne does nothing (no double jump). */
export function startJump(jump: JumpState): JumpState {
  return isAirborne(jump) ? jump : { height: 0, velocity: JUMP_SPEED };
}

/** One frame of the jump arc. Exact for constant gravity, so the landing does not depend on frame rate. */
export function stepJump(jump: JumpState, dt: number): JumpState {
  if (!isAirborne(jump) || !(dt > 0)) return jump;
  const height = jump.height + jump.velocity * dt - 0.5 * GRAVITY * dt * dt;
  if (height <= 0) return GROUNDED;
  return { height, velocity: jump.velocity - GRAVITY * dt };
}

/**
 * The nearest walkable point to (x, z): the point itself, else rings of
 * `step` metres outward, eight points per ring at first and more as the ring
 * grows. Null when nothing within `maxRadius` is walkable.
 */
export function findSpawn(x: number, z: number, isWalkable: WalkableTest, step = 1, maxRadius = 80): { x: number; z: number } | null {
  if (![x, z].every(Number.isFinite)) return null;
  if (isWalkable(x, z)) return { x, z };
  for (let radius = step; radius <= maxRadius; radius += step) {
    const points = Math.max(8, Math.ceil((TAU * radius) / step));
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * TAU;
      const px = x + Math.sin(angle) * radius;
      const pz = z + Math.cos(angle) * radius;
      if (isWalkable(px, pz)) return { x: px, z: pz };
    }
  }
  return null;
}
