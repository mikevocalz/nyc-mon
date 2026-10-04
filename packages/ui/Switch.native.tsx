'use client';
import type { SwitchProps } from './Switch.types';
import { NeonSwitch } from './cards/NeonSwitch';

/**
 * Native fork. The neon toggle replaces the @expo/ui SwiftUI / Compose
 * switch: a toggle is a plain pressable (role switch, checked state, haptic
 * tick) with no platform behaviour worth keeping over the brand look, and
 * the kit version renders the same on iOS, Android, PICO and Quest. The
 * thumb slide is a Reanimated 4 CSS transition, instant under reduced motion.
 */
export function Switch({ variant: _variant, ...props }: SwitchProps) {
  return <NeonSwitch {...props} />;
}
