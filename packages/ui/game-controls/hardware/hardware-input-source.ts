// What the adapter hook needs from a platform: the five observation methods
// of the native `GamepadInput` HybridObject (modules/nyc-gamepad-input), plus
// one web-only focus signal. The HybridObject satisfies this structurally;
// gamepad.web.ts builds the same shape from the Gamepad API and DOM key
// events. Types only, so the pure mappings and their tests never load Nitro.
import type { GamepadAxis } from '../../modules/nyc-gamepad-input/src/types/GamepadAxis';
import type { GamepadButton } from '../../modules/nyc-gamepad-input/src/types/GamepadButton';
import type { GamepadDevice } from '../../modules/nyc-gamepad-input/src/types/GamepadDevice';
import type { ListenerSubscription } from '../../modules/nyc-gamepad-input/src/types/ListenerSubscription';

/**
 * A platform's raw hardware observations. On iOS and Android this is the
 * `GamepadInput` HybridObject; on web it is {@linkcode createWebGamepadInput}.
 * Every listener method is additive and returns its own idempotent cleanup.
 *
 * @see {@linkcode useHardwareInput}, the only consumer.
 */
export interface HardwareInputSource {
  /** `false` when the platform cannot report hardware input at all; the hook then subscribes to nothing. */
  readonly isAvailable: boolean;
  /** Snapshot of attached gamepads (and, on native, the hardware keyboard). */
  getConnectedDevices(): GamepadDevice[];
  addOnConnectionChangedListener(listener: (device: GamepadDevice, connected: boolean) => void): ListenerSubscription;
  /** One event per edge, never repeated while held. */
  addOnButtonListener(
    listener: (button: GamepadButton, pressed: boolean, deviceId: string, timestampMs: number) => void,
  ): ListenerSubscription;
  /** Sticks and d-pad −1…1 with +y up, triggers 0…1, no dead zone applied. */
  addOnAxisListener(
    listener: (axis: GamepadAxis, value: number, deviceId: string, timestampMs: number) => void,
  ): ListenerSubscription;
  /** `keyCode` is the W3C `KeyboardEvent.code`; auto-repeat is already filtered. */
  addOnKeyListener(listener: (keyCode: string, pressed: boolean, timestampMs: number) => void): ListenerSubscription;
  /**
   * Web only: the window blurred or the document was hidden. Native has no
   * equivalent here; the hook watches `AppState` there instead.
   */
  addOnFocusLostListener?(listener: () => void): ListenerSubscription;
}
