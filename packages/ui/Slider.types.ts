import type { ControlTone, District } from './district';

export interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Shown as the neon nameplate above the track, and the control's accessible name. */
  label?: string;
  className?: string;
  /** Colour family of the filled track. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default Midtown (orange). */
  district?: District;
}
