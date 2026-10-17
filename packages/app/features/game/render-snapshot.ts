// What the worklet render runtime needs from the JS thread each frame, packed
// into one flat number array: the city camera, the Caller's pose inputs, the
// canvas size and the motion setting. The simulation stays on JS (it writes
// gameCameraStore and callerStore); the render runtime reads the latest array
// through a Synchronizable, so an input event costs a pack and a native write,
// never a hop onto the render runtime. Pure, for node tests.
import type { CityCamera } from './city-scene.ts';
import type { CallerState } from './character/caller-store.ts';
import type { Gait, JumpState } from './character/locomotion.ts';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
/** A CallerState the snapshot reader may rewrite in place (the caller owns it; the render runtime keeps one per session). */
export type MutableCallerState = Omit<Mutable<CallerState>, 'jump'> & { jump: Mutable<JumpState> };

/** Slot of each value. `version` grows on every write so the reader can tell a new frame from a repeat. */
export const SNAPSHOT_SLOTS = {
  version: 0,
  width: 1,
  height: 2,
  pixelRatio: 3,
  reducedMotion: 4,
  cameraX: 5,
  cameraZ: 6,
  cameraYaw: 7,
  cameraDistance: 8,
  spawned: 9,
  callerX: 10,
  callerZ: 11,
  groundY: 12,
  heading: 13,
  gait: 14,
  speed: 15,
  pace: 16,
  stride: 17,
  gaitPhase: 18,
  jumpHeight: 19,
  jumpVelocity: 20,
} as const;
export const SNAPSHOT_LENGTH = 21;

const GAITS: readonly Gait[] = ['idle', 'walk', 'run'];

export interface SnapshotView {
  width: number;
  height: number;
  pixelRatio: number;
  reducedMotion: boolean;
}

/** A fresh array with every slot at zero except a 1x pixel ratio. */
export function emptySnapshot(): number[] {
  const out = new Array<number>(SNAPSHOT_LENGTH).fill(0);
  out[SNAPSHOT_SLOTS.pixelRatio] = 1;
  return out;
}

/**
 * The next snapshot: `previous` with a bumped version and the given camera,
 * Caller and view written in. Non-finite camera or Caller numbers keep the
 * previous value, so a bad frame never reaches the renderer as NaN.
 * `out` reuses a caller's buffer for the write. Never pass a buffer that was
 * already handed to a Synchronizable: worklets caches serializables by
 * JS-object identity (serializableMappingCache in serializable.native.ts), so
 * `setBlocking` on a previously-serialized array re-stores the first frozen
 * clone and readers see its version 1 forever (measured on the Duo,
 * 2026-10-17). Callers writing to a Synchronizable must leave `out` unset.
 */
export function packSnapshot(previous: readonly number[], camera: CityCamera, caller: CallerState, view: SnapshotView, out?: number[]): number[] {
  'worklet';
  const target = out ?? (previous.length === SNAPSHOT_LENGTH ? previous.slice() : emptySnapshot());
  const put = (slot: number, value: number) => {
    if (Number.isFinite(value)) target[slot] = value;
  };
  target[SNAPSHOT_SLOTS.version] = (target[SNAPSHOT_SLOTS.version] ?? 0) + 1;
  put(SNAPSHOT_SLOTS.width, view.width);
  put(SNAPSHOT_SLOTS.height, view.height);
  put(SNAPSHOT_SLOTS.pixelRatio, view.pixelRatio);
  target[SNAPSHOT_SLOTS.reducedMotion] = view.reducedMotion ? 1 : 0;
  put(SNAPSHOT_SLOTS.cameraX, camera.x);
  put(SNAPSHOT_SLOTS.cameraZ, camera.z);
  put(SNAPSHOT_SLOTS.cameraYaw, camera.yaw);
  put(SNAPSHOT_SLOTS.cameraDistance, camera.distance);
  target[SNAPSHOT_SLOTS.spawned] = caller.spawned ? 1 : 0;
  put(SNAPSHOT_SLOTS.callerX, caller.x);
  put(SNAPSHOT_SLOTS.callerZ, caller.z);
  put(SNAPSHOT_SLOTS.groundY, caller.groundY);
  put(SNAPSHOT_SLOTS.heading, caller.heading);
  target[SNAPSHOT_SLOTS.gait] = Math.max(0, GAITS.indexOf(caller.gait));
  put(SNAPSHOT_SLOTS.speed, caller.speed);
  put(SNAPSHOT_SLOTS.pace, caller.pace);
  put(SNAPSHOT_SLOTS.stride, caller.stride);
  put(SNAPSHOT_SLOTS.gaitPhase, caller.gaitPhase);
  put(SNAPSHOT_SLOTS.jumpHeight, caller.jump.height);
  put(SNAPSHOT_SLOTS.jumpVelocity, caller.jump.velocity);
  return target;
}

/** Only the version bumped: one more frame of the same state (ThreeCanvasHandle.invalidate). Same `out` warning as packSnapshot — never a Synchronizable-written buffer. */
export function bumpSnapshot(previous: readonly number[], out?: number[]): number[] {
  'worklet';
  const target = out ?? (previous.length === SNAPSHOT_LENGTH ? previous.slice() : emptySnapshot());
  target[SNAPSHOT_SLOTS.version] = (target[SNAPSHOT_SLOTS.version] ?? 0) + 1;
  return target;
}

export function snapshotVersion(snapshot: readonly number[]): number {
  'worklet';
  return snapshot[SNAPSHOT_SLOTS.version] ?? 0;
}

/** `out` reuses the caller's camera object; the read writes the four slots into it. */
export function readCamera(snapshot: readonly number[], out?: CityCamera): CityCamera {
  'worklet';
  const target = out ?? { x: 0, z: 0, yaw: 0, distance: 0 };
  target.x = snapshot[SNAPSHOT_SLOTS.cameraX] ?? 0;
  target.z = snapshot[SNAPSHOT_SLOTS.cameraZ] ?? 0;
  target.yaw = snapshot[SNAPSHOT_SLOTS.cameraYaw] ?? 0;
  target.distance = snapshot[SNAPSHOT_SLOTS.cameraDistance] ?? 0;
  return target;
}

/** `out` reuses the caller's state object; its `jump` must already exist. */
export function readCaller(snapshot: readonly number[], out?: MutableCallerState): CallerState {
  'worklet';
  const at = (slot: number) => snapshot[slot] ?? 0;
  const target: MutableCallerState = out ?? { spawned: false, x: 0, z: 0, groundY: 0, heading: 0, gait: 'idle', speed: 0, pace: 0, stride: 0, gaitPhase: 0, jump: { height: 0, velocity: 0 } };
  target.spawned = at(SNAPSHOT_SLOTS.spawned) === 1;
  target.x = at(SNAPSHOT_SLOTS.callerX);
  target.z = at(SNAPSHOT_SLOTS.callerZ);
  target.groundY = at(SNAPSHOT_SLOTS.groundY);
  target.heading = at(SNAPSHOT_SLOTS.heading);
  target.gait = GAITS[at(SNAPSHOT_SLOTS.gait)] ?? 'idle';
  target.speed = at(SNAPSHOT_SLOTS.speed);
  target.pace = at(SNAPSHOT_SLOTS.pace);
  target.stride = at(SNAPSHOT_SLOTS.stride);
  target.gaitPhase = at(SNAPSHOT_SLOTS.gaitPhase);
  target.jump.height = at(SNAPSHOT_SLOTS.jumpHeight);
  target.jump.velocity = at(SNAPSHOT_SLOTS.jumpVelocity);
  return target;
}

export function readView(snapshot: readonly number[], out?: SnapshotView): SnapshotView {
  'worklet';
  const target = out ?? { width: 0, height: 0, pixelRatio: 1, reducedMotion: false };
  target.width = snapshot[SNAPSHOT_SLOTS.width] ?? 0;
  target.height = snapshot[SNAPSHOT_SLOTS.height] ?? 0;
  target.pixelRatio = snapshot[SNAPSHOT_SLOTS.pixelRatio] ?? 1;
  target.reducedMotion = snapshot[SNAPSHOT_SLOTS.reducedMotion] === 1;
  return target;
}
