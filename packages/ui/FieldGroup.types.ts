import type { ReactNode } from 'react';
import type { ControlTone, District } from './district';

export interface FieldGroupProps {
  children?: ReactNode;
}

export interface FieldSectionProps {
  children?: ReactNode;
  /** Section heading, set in the display face in the panel's header strip. */
  title?: string;
  /** Kept for older callers; the display face already carries the weight, so it defaults to false. */
  titleUppercase?: boolean;
  /** Colour family of the cap bar and title. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default Midtown (orange). */
  district?: District;
}
