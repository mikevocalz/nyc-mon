import type { HLynkTier } from './tier';

/** Props every {@linkcode ScannerLedProps} variant shares. */
interface ScannerLedBase {
  /**
   * The tier. The head is black on every tier (Decision #16).
   * @default 'core'
   */
  tier?: HLynkTier;
  /**
   * Throw one upward red fan from the emitter, once, when this turns true.
   * Decorative; Phase 1 uses it only at M01 boot. Absent under reduced motion.
   * @default false
   */
  fan?: boolean;
  /**
   * Draw the authored reduced-motion sibling: steady light with a static cue
   * (tick row, filled dot or exclamation dot) and no fan. Pass the app's
   * setting; the LED never reads the OS.
   */
  reducedMotion: boolean;
  /** Head height: the 40 pt band, or the 24 pt strip of the compact shell. @default 'standard' */
  size?: 'standard' | 'compact';
  testID?: string;
}

/**
 * Props for `ScannerLed`: the H-Lynk's black scanner head with its red
 * emitter, used inside {@linkcode HLynkShell}. A discriminated union on
 * `state`: the three meaningful states require the `label` that is their
 * text equivalent (WCAG 1.4.1), and `progress` exists only while incubating.
 */
export type ScannerLedProps = ScannerLedBase &
  (
    | { state: 'off' }
    | { state: 'boot' }
    | {
        state: 'incubating';
        /** status chip text, e.g. `hlynk.led.incubating` "Incubating"; spoken as "Status light: …" */
        label: string;
        /** 0–1, drawn as the reduced-motion tick row */
        progress: number;
      }
    | {
        state: 'ready' | 'needsYou';
        /** status chip text (`hlynk.led.ready`, `hlynk.led.needs_you`) */
        label: string;
      }
  );
