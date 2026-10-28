import type { SceneMotion } from '../loop-policy';

/**
 * Per-stage state for DeviceStage, shared by the stage's React tree and its
 * scene through one vanilla Zustand store (repo rule: never useState).
 */
export interface StageState {
  /** The first frame with the H-Lynk in it has been drawn. */
  ready: boolean;
  /** Intro over, pointer away, tilt settled, nothing animating: the loop may pause. */
  resting: boolean;
  /** How much the scene moves now (loop-policy.ts): drives the canvas's pause and fps cap. */
  motion: SceneMotion;
  /** The target under the pointer: a screen target, 'side-key', or null. */
  hover: string | null;
  /** Side key presses, so the scene dips the key once per press. */
  presses: number;
  /**
   * Pointer presses on the stage, counted from its pointerdown handler. The
   * scene raycasts once per new press, so a tap shorter than a frame still lands.
   */
  taps: number;
  /** A pointer or finger is down on the stage (for the trackpad's hold: warming the egg). */
  held: boolean;
  /** Front-key presses, so the scene dips `lastKey` once per press. */
  keyPresses: number;
  /** The front key pressed last. */
  lastKey: DeviceKey | null;
}

export const initialStageState = (): StageState => ({
  ready: false, resting: false, motion: 'active', hover: null, presses: 0, taps: 0, held: false, keyPresses: 0, lastKey: null,
});

/** The hover target for the left side key. */
export const SIDE_KEY = 'side-key';

/**
 * The H-Lynk's front controls as the stage reports them. The 3D control row
 * models home, menu, `<` (prev), `>` (next) and the trackpad (activate);
 * `back` has no key of its own and comes from the stage's accessible
 * controls (Escape, a screen reader's Back).
 */
export type DeviceKey = 'prev' | 'next' | 'activate' | 'back' | 'home' | 'menu';

const KEY_PREFIX = 'key:';
/** The hover target for a front key. */
export const keyTarget = (key: DeviceKey): string => `${KEY_PREFIX}${key}`;
/** The front key a hover target names, or null for any other target. */
export function keyFromTarget(target: string | null): DeviceKey | null {
  if (target === null || !target.startsWith(KEY_PREFIX)) return null;
  const key = target.slice(KEY_PREFIX.length);
  return key === 'prev' || key === 'next' || key === 'activate' || key === 'back' || key === 'home' || key === 'menu' ? key : null;
}
