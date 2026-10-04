'use client';
import { NeonCheckbox, type NeonCheckboxProps } from './cards/NeonCheckbox';

export interface CheckboxProps extends NeonCheckboxProps {
  /** The NYC-MON checkbox is the only look; `neon` and `default` are both accepted for older callers. */
  variant?: 'default' | 'neon';
}

// Web fork: the same neon tile, a real <button role="checkbox"> underneath.
export function Checkbox({ variant: _variant, ...props }: CheckboxProps) {
  return <NeonCheckbox {...props} />;
}
