import type { ControlTone, District } from './district';

export interface SwitchProps {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
  /**
   * The NYC-MON toggle is the only look: the track fills with the tone and
   * the night-keyed thumb slides across. `neon` and `default` are both
   * accepted so older callers and stories keep compiling.
   */
  variant?: 'default' | 'neon';
  /** Colour family. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default Midtown (orange). */
  district?: District;
  /** Opt-in rounded corners (rounded-soft). Default false: square. */
  rounded?: boolean;
}
