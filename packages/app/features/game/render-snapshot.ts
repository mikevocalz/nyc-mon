// What the worklet render runtime needs from the JS thread each frame, packed
// into one flat number array: the city camera, the Caller's pose inputs, the
// canvas size and the motion setting. The simulation stays on JS (it writes
// gameCameraStore and callerStore); the render runtime reads the latest array
// through a Synchronizable, so an input event costs a pack and a native write,
// never a hop onto the render runtime. Pure, for node tests.
import type { CityCamera } from './city-scene.ts';
import type { CallerState } from './character/caller-store.ts';
import type { Gait } from './character/locomotion.ts';

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
 */
export function packSnapshot(previous: readonly number[], camera: CityCamera, caller: CallerState, view: SnapshotView): number[] {
  'worklet';
  const out = previous.length === SNAPSHOT_LENGTH ? previous.slice() : emptySnapshot();
  const put = (slot: number, value: number) => {
    if (Number.isFinite(value)) out[slot] = value;
  };
  out[SNAPSHOT_SLOTS.version] = (out[SNAPSHOT_SLOTS.version] ?? 0) + 1;
  put(SNAPSHOT_SLOTS.width, view.width);
  put(SNAPSHOT_SLOTS.height, view.height);
  put(SNAPSHOT_SLOTS.pixelRatio, view.pixelRatio);
  out[SNAPSHOT_SLOTS.reducedMotion] = view.reducedMotion ? 1 : 0;
  put(SNAPSHOT_SLOTS.cameraX, camera.x);
  put(SNAPSHOT_SLOTS.cameraZ, camera.z);
  put(SNAPSHOT_SLOTS.cameraYaw, camera.yaw);
  put(SNAPSHOT_SLOTS.cameraDistance, camera.distance);
  out[SNAPSHOT_SLOTS.spawned] = caller.spawned ? 1 : 0;
  put(SNAPSHOT_SLOTS.callerX, caller.x);
  put(SNAPSHOT_SLOTS.callerZ, caller.z);
  put(SNAPSHOT_SLOTS.groundY, caller.groundY);
  put(SNAPSHOT_SLOTS.heading, caller.heading);
  out[SNAPSHOT_SLOTS.gait] = Math.max(0, GAITS.indexOf(caller.gait));
  put(SNAPSHOT_SLOTS.speed, caller.speed);
  put(SNAPSHOT_SLOTS.pace, caller.pace);
  put(SNAPSHOT_SLOTS.stride, caller.stride);
  put(SNAPSHOT_SLOTS.gaitPhase, caller.gaitPhase);
  put(SNAPSHOT_SLOTS.jumpHeight, caller.jump.height);
  put(SNAPSHOT_SLOTS.jumpVelocity, caller.jump.velocity);
  return out;
}

/** Only the version bumped: one more frame of the same state (ThreeCanvasHandle.invalidate). */
export function bumpSnapshot(previous: readonly number[]): number[] {
  'worklet';
  const out = previous.length === SNAPSHOT_LENGTH ? previous.slice() : emptySnapshot();
  out[SNAPSHOT_SLOTS.version] = (out[SNAPSHOT_SLOTS.version] ?? 0) + 1;
  return out;
}

export function snapshotVersion(snapshot: readonly number[]): number {
  'worklet';
  return snapshot[SNAPSHOT_SLOTS.version] ?? 0;
}

export function readCamera(snapshot: readonly number[]): CityCamera {
  'worklet';
  return {
    x: snapshot[SNAPSHOT_SLOTS.cameraX] ?? 0,
    z: snapshot[SNAPSHOT_SLOTS.cameraZ] ?? 0,
    yaw: snapshot[SNAPSHOT_SLOTS.cameraYaw] ?? 0,
    distance: snapshot[SNAPSHOT_SLOTS.cameraDistance] ?? 0,
  };
}

export function readCaller(snapshot: readonly number[]): CallerState {
  'worklet';
  const at = (slot: number) => snapshot[slot] ?? 0;
  return {
    spawned: at(SNAPSHOT_SLOTS.spawned) === 1,
    x: at(SNAPSHOT_SLOTS.callerX),
    z: at(SNAPSHOT_SLOTS.callerZ),
    groundY: at(SNAPSHOT_SLOTS.groundY),
    heading: at(SNAPSHOT_SLOTS.heading),
    gait: GAITS[at(SNAPSHOT_SLOTS.gait)] ?? 'idle',
    speed: at(SNAPSHOT_SLOTS.speed),
    pace: at(SNAPSHOT_SLOTS.pace),
    stride: at(SNAPSHOT_SLOTS.stride),
    gaitPhase: at(SNAPSHOT_SLOTS.gaitPhase),
    jump: { height: at(SNAPSHOT_SLOTS.jumpHeight), velocity: at(SNAPSHOT_SLOTS.jumpVelocity) },
  };
}

export function readView(snapshot: readonly number[]): SnapshotView {
  'worklet';
  return {
    width: snapshot[SNAPSHOT_SLOTS.width] ?? 0,
    height: snapshot[SNAPSHOT_SLOTS.height] ?? 0,
    pixelRatio: snapshot[SNAPSHOT_SLOTS.pixelRatio] ?? 1,
    reducedMotion: snapshot[SNAPSHOT_SLOTS.reducedMotion] === 1,
  };
}
