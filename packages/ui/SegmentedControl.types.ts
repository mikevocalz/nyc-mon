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
  /**
   * Classes for every segment, e.g. a flex-basis that sets how many fit on a
   * row ("basis-[40%] sm:basis-auto" gives a 2x2 grid of four on phones).
   */
  segmentClassName?: string;
  /** Colour family of the active segment. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default Midtown (orange). */
  district?: District;
  /** Opt-in rounded corners (rounded-soft). Default false: square. */
  rounded?: boolean;
  /**
   * Accessible name of the radio group. Give this or `aria-labelledby`
   * (the id of a visible label) unless an enclosing fieldset/legend names it.
   */
  'aria-label'?: string;
  /** Id of the element whose text names the radio group. */
  'aria-labelledby'?: string;
}
