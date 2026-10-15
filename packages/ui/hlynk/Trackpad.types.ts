import type { HLynkTier } from './tier';

/**
 * Hold-to-commit, paired with the action's spoken name. Both or neither:
 * a commit that assistive tech cannot name does not exist.
 * @see TrackpadProps
 */
export type TrackpadCommit =
  | { onCommit?: undefined; commitLabel?: undefined }
  | {
      /** Hold 600 ms, or the named accessibility action, or the screen's labelled equivalent. */
      onCommit: () => void;
      /** Name of the commit action for VoiceOver/TalkBack, e.g. "Choose this egg". */
      commitLabel: string;
    };

/**
 * Props for `Trackpad`, the H-Lynk's square centre control, placed by
 * {@linkcode HLynkShell} through its `trackpad` prop. Every gesture has a
 * non-gesture route: VoiceOver/TalkBack actions (increment and decrement
 * step, activate, the named commit), arrow keys and Enter on web, and
 * `TrackpadActions` for an on-screen labelled control (WCAG 2.5.1).
 */
export type TrackpadProps = {
  /** @default 'core' */
  tier?: HLynkTier;
  /** The current target, spoken as the control's name, e.g. "Metro Egg, 1 of 3". Default copy: `hlynk.trackpad.label`. */
  label: string;
  /** Spoken after the name; set per screen (none on M01). */
  hint?: string;
  /** Tap: the screen's primary action. */
  onActivate?: () => void;
  /** Flick left (-1) or right (1); also VoiceOver decrement/increment and the arrow keys. */
  onStep?: (direction: -1 | 1) => void;
  /**
   * Press-and-hold that lasts as long as the press (M11 warm, M12 "Stay
   * close", M08's hold ring). Fires once a still press passes
   * `TRACKPAD_GESTURE.holdStartMs` (150 ms), so a tap never starts a hold.
   * With `onCommit` set too, the commit at 600 ms ends the hold.
   */
  onHoldStart?: () => void;
  /** The hold ended: release, drag away, cancel, commit or unmount. Always paired with one `onHoldStart`. */
  onHoldEnd?: () => void;
  /** Drag, in points since the last call (M13 room pan only). While set, horizontal drags pan instead of stepping. */
  onPan?: (dxPt: number, dyPt: number) => void;
  /**
   * `ring`: the red ring. `hatch`: the red ring plus an orange rim, during
   * the hatch only (Decision #7).
   * @default 'ring'
   */
  accent?: 'ring' | 'hatch';
  /** Ring drops to the unlit red; the face stays black; the control stays named and focusable. @default false */
  disabled?: boolean;
  /** Reduced press feedback: ring flashes white, no scale. */
  reducedMotion: boolean;
  /** Square pad, or the wide pill of the compact shell. @default 'square' */
  shape?: 'square' | 'pill';
  /**
   * The square's side, or the pill's width, in points. The shell sets it from
   * the measured row so narrow phones shrink the pad, never the keys.
   * @default 112 (square), 224 (pill)
   */
  sizePt?: number;
  testID?: string;
} & TrackpadCommit;
