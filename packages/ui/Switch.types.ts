import type { ControlTone, District } from './district';

export interface SwitchProps {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
  /** neon is the NeonBlade toggle; default is the platform switch (native) or kit switch (web). */
  variant?: 'default' | 'neon';
  /** neon: colour family. Overrides `district`. */
  tone?: ControlTone;
  /** neon: theme by neighbourhood. */
  district?: District;
}
