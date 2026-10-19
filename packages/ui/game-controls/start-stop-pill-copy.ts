// The pill's words and its hold-ring quantization, kept out of the component
// so node tests can check them against STOP_HOLD_MS. Strings are the G01 copy
// deck's (`docs/design/screens/G01-arcade-controller/05-copy.md`, g01.pill.*
// and g01.a11y.*) unless a line says otherwise.
import { STOP_HOLD_MS, type PillState } from './contract.ts';

/**
 * The pill's visual state: the contract's {@linkcode PillState} plus
 * `disabled` (the session is loading or cannot start). `disabled` is not
 * written to Rive until §8 carries it.
 */
export type StartStopPillState = PillState | 'disabled';

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five'] as const;

/**
 * The spoken length of a hold. Whole seconds up to five are words ("one
 * second"); anything else is spoken in seconds with one decimal ("1.5
 * seconds"), so the hint can never disagree with the number the gesture uses.
 */
export function holdDurationSpoken(holdMs: number): string {
  const seconds = holdMs / 1000;
  if (Number.isInteger(seconds) && seconds >= 1 && seconds < NUMBER_WORDS.length) {
    return `${NUMBER_WORDS[seconds]} second${seconds === 1 ? '' : 's'}`;
  }
  const rounded = Math.round(seconds * 10) / 10;
  return `${rounded} seconds`;
}

/** The `stopConfirm` hint (g01.pill.stop_confirm), derived from the hold length. */
export function stopHoldHint(holdMs: number = STOP_HOLD_MS): string {
  return `Hold for ${holdDurationSpoken(holdMs)} to stop. Your last save is kept`;
}

export const PILL_LEGEND: Readonly<Record<StartStopPillState, string>> = {
  start: 'START',
  playing: 'PAUSE',
  paused: 'RESUME',
  stopConfirm: 'HOLD TO STOP',
  disabled: '',
};

export const PILL_SPOKEN: Readonly<Record<StartStopPillState, string>> = {
  start: 'Start',
  playing: 'Pause',
  paused: 'Resume',
  stopConfirm: 'Stop',
  disabled: 'Start',
};

/** Hints per state. `stopConfirm` takes the hold length; see {@linkcode stopHoldHint}. */
export function pillHint(state: StartStopPillState, holdMs: number = STOP_HOLD_MS): string {
  switch (state) {
    case 'start':
      return 'Starts the game';
    case 'playing':
      return 'Pauses the game';
    case 'paused':
      return 'Resumes the game';
    case 'stopConfirm':
      return stopHoldHint(holdMs);
    case 'disabled':
      return 'Not available right now';
  }
}

/** Polite announcements on the session's transitions (g01.a11y.*). */
export const PILL_ANNOUNCE: Partial<Record<StartStopPillState, string>> = {
  paused: 'Paused',
  playing: 'Resumed',
};

/** g01.a11y.stop_released */
export const PILL_STOP_RELEASED = 'Stop cancelled';
/** g01.a11y.stopped */
export const PILL_STOPPED = 'Stopped. Your last save is kept';

/**
 * The confirm the screen-reader "Stop" action opens (G01 `07-a11y.md` Focus
 * order item 1). Title and body reuse deck words; "Cancel" is the platform
 * word and has no deck row yet (reported for the deck owner).
 */
export const PILL_STOP_CONFIRM = {
  title: 'Stop',
  description: 'Your last save is kept',
  confirm: 'Stop',
  cancel: 'Cancel',
} as const;

/** Ring steps per hold: 20 normally, 4 under reduced motion (the `07-a11y.md` map). */
export function holdProgressSteps(reducedMotion: boolean): number {
  'worklet';
  return reducedMotion ? 4 : 20;
}

/**
 * Snaps a 0…1 hold fill to the ring's steps. Clamped, and non-finite input
 * reads as 0, so the value written to `pill/holdProgress` is always one of
 * the steps the artboard authors.
 */
export function quantizeHoldProgress(progress: number, reducedMotion: boolean): number {
  'worklet';
  if (!Number.isFinite(progress)) return 0;
  const steps = holdProgressSteps(reducedMotion);
  const clamped = Math.min(1, Math.max(0, progress));
  return Math.floor(clamped * steps + 1e-9) / steps;
}
