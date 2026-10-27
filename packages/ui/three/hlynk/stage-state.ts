/**
 * Per-stage state for DeviceStage, shared by the stage's React tree and its
 * scene through one vanilla Zustand store (repo rule: never useState).
 */
export interface StageState {
  /** The first frame with the H-Lynk in it has been drawn. */
  ready: boolean;
  /** Intro over, pointer away, tilt settled, nothing animating: the loop may pause. */
  resting: boolean;
  /** The target under the pointer: a screen target, 'side-key', or null. */
  hover: string | null;
  /** Side key presses, so the scene dips the key once per press. */
  presses: number;
  /**
   * Pointer presses on the stage, counted from its pointerdown handler. The
   * scene raycasts once per new press, so a tap shorter than a frame still lands.
   */
  taps: number;
}

export const initialStageState = (): StageState => ({ ready: false, resting: false, hover: null, presses: 0, taps: 0 });

/** The hover target for the left side key. */
export const SIDE_KEY = 'side-key';
