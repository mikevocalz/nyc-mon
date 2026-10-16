import type { GamepadFamily } from './GamepadFamily';
import type { GamepadInput } from '../specs/GamepadInput.nitro';

/**
 * One connected hardware source. Returned by
 * {@linkcode GamepadInput.getConnectedDevices} and carried by every
 * connection event.
 */
export interface GamepadDevice {
  /**
   * Stable for the life of the connection. The same value tags every button
   * and axis event from this device. Not stable across reconnects: the
   * platforms do not expose a serial, so a pad that drops and returns gets
   * a new id. The hardware keyboard is always `keyboard`.
   */
  readonly id: string;
  /** Vendor name as the platform reports it, for the diagnostics overlay. */
  readonly name: string;
  readonly family: GamepadFamily;
}
