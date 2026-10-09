'use client';

import { Platform } from 'react-native';
import { isHeadsetAndroid } from './headset';

// The device never changes during a process, so this resolves once.
const HEADSET = isHeadsetAndroid(
  Platform.OS,
  Platform.constants as { Manufacturer?: string; Brand?: string } | undefined,
);

/**
 * True inside a Quest or PICO 2D window. Kit components size type and
 * targets from it (`text-xr-*`, `min-h-target`); screens use it to pick the
 * same ramp.
 */
export function useIsHeadset(): boolean {
  return HEADSET;
}
