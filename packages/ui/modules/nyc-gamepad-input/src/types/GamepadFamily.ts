import type { GamepadButton } from './GamepadButton';
import type { GamepadDevice } from './GamepadDevice';

/**
 * Which vendor layout a connected device follows. Decides the label the
 * overlay paints for a physical button, nothing else: every family reports
 * buttons by physical position ({@linkcode GamepadButton}), so the mapping
 * to the arcade cluster is the same table for all of them.
 *
 * `generic` is any HID gamepad the platform cannot name (a third-party
 * Bluetooth pad). `keyboard` is the coalesced hardware keyboard.
 *
 * @see {@linkcode GamepadDevice.family}
 */
export type GamepadFamily = 'xbox' | 'playstation' | 'nintendo' | 'generic' | 'keyboard';
