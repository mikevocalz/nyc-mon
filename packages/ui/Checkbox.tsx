'use client';
import { NeonCheckbox, type NeonCheckboxProps } from './cards/NeonCheckbox';

export interface CheckboxProps extends NeonCheckboxProps {
  /**
   * The NYC-MON checkbox is the only look: a night well that fills with the
   * tone over its depth plate. `neon` and `default` are both accepted so
   * older callers and stories keep compiling.
   */
  variant?: 'default' | 'neon';
}

// Native fork. The neon tile replaces the @expo/ui platform checkbox: it is
// a plain pressable control (role checkbox, checked state, haptic tick), so
// drawing it in the kit loses no platform behaviour and keeps the brand look
// identical on iOS, Android, PICO and Quest.
export function Checkbox({ variant: _variant, ...props }: CheckboxProps) {
  return <NeonCheckbox {...props} />;
}
