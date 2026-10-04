import type { ControlTone, District } from './district';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Colour family of the active segment. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default Midtown (orange). */
  district?: District;
  /** Opt-in rounded corners (rounded-soft). Default false: square. */
  rounded?: boolean;
}
