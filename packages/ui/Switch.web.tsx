'use client';
import type { SwitchProps } from './Switch.types';
import { NeonSwitch } from './cards/NeonSwitch';

// Web fork: the NYC-MON toggle, a real <button role="switch"> underneath.
export function Switch({ variant: _variant, ...props }: SwitchProps) {
  return <NeonSwitch {...props} />;
}
