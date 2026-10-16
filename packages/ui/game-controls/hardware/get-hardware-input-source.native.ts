// Native fork: the `GamepadInput` Nitro HybridObject from
// modules/nyc-gamepad-input, when this binary carries it. A dev client built
// before the module existed, or Expo Go, has none; the hook then subscribes
// to nothing and the store reports `isAvailable: false`.
import { getGamepadInput, isGamepadInputInstalled } from '../../modules/nyc-gamepad-input/src';
import type { HardwareInputSource } from './hardware-input-source';

/** The process-wide {@linkcode HardwareInputSource}, or `null` when the native module is not in this binary. */
export function getHardwareInputSource(): HardwareInputSource | null {
  return isGamepadInputInstalled() ? getGamepadInput() : null;
}
