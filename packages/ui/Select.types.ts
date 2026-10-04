import type { ComponentProps, ReactNode } from 'react';
import type { Select as PrimitiveSelect } from './primitives';
import type { ControlTone, District } from './district';

export interface SelectOption {
  value: string;
  label?: string;
  disabled?: boolean;
}

export interface SelectProps extends ComponentProps<typeof PrimitiveSelect> {
  label: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  containerClassName?: string;
  /** Options as data (NeonBlade's API). Rendered before any option children. */
  options?: SelectOption[];
  /** `<option>` elements; read for value, label and disabled. */
  children?: ReactNode;
  /** The NYC-MON field is the only look; `neon` and `default` are both accepted for older callers. */
  variant?: 'default' | 'neon';
  /** Colour family for the nameplate and well border. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default Midtown (orange). */
  district?: District;
  /** Opt-in rounded corners (rounded-soft) on the well and the open list. Default false: square. */
  rounded?: boolean;
}
