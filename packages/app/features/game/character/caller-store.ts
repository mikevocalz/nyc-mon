// Where the Caller is, as plain data. Module scope like gameCameraStore: the
// position outlives the GameScreen component, so a fold or a tab change never
// moves the Caller. Nothing persists it yet; world-resume reads
// `selectCallerTransform` once ADR 0020 grows a Caller transform (see
// docs/implementation/caller-proxy.md).
//
// The simulation (caller-controller.ts) writes here once per simulated frame;
// the proxy actor reads it in update(). No React component subscribes per
// frame, so the store never causes a render on its own.
import { createStore } from 'zustand/vanilla';
import { GROUNDED, type Gait, type JumpState } from './locomotion.ts';

export interface CallerState {
  /** False until the lobby hands over and the Caller is placed; the proxy stays hidden until then. */
  readonly spawned: boolean;
  readonly x: number;
  readonly z: number;
  /** Ground height under the Caller, metres. */
  readonly groundY: number;
  /** Facing as a three.js rotation.y (locomotion.ts conventions). */
  readonly heading: number;
  readonly gait: Gait;
  /** Ground speed this frame, m/s. */
  readonly speed: number;
  /** Metres walked since spawn. The proxy's limb swing is a function of it, so animation follows distance, not the clock. */
  readonly stride: number;
  readonly jump: JumpState;
}

export const INITIAL_CALLER_STATE: CallerState = Object.freeze({
  spawned: false,
  x: 0,
  z: 0,
  groundY: 0,
  heading: Math.PI,
  gait: 'idle',
  speed: 0,
  stride: 0,
  jump: GROUNDED,
});

export function createCallerStore() {
  return createStore<CallerState>(() => ({ ...INITIAL_CALLER_STATE }));
}

/** The one Caller on the Game screen. */
export const callerStore = createCallerStore();

/** What a save would need: position and facing. Plain numbers so the snapshot builder can copy them. */
export interface CallerTransform {
  readonly x: number;
  readonly z: number;
  readonly heading: number;
}

export function selectCallerTransform(state: CallerState): CallerTransform | null {
  return state.spawned ? { x: state.x, z: state.z, heading: state.heading } : null;
}
