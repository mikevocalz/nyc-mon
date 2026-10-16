import type { HybridObject } from 'react-native-nitro-modules';
import type { GamepadAxis } from '../types/GamepadAxis';
import type { GamepadButton } from '../types/GamepadButton';
import type { GamepadDevice } from '../types/GamepadDevice';
import type { ListenerSubscription } from '../types/ListenerSubscription';

/**
 * Physical gamepads and the hardware keyboard, as raw observations. Nothing
 * here knows about the arcade cluster: `packages/ui/game-controls/hardware`
 * turns these into `GameInputRouter` calls.
 *
 * One instance per process. Listeners are additive and each owns its
 * cleanup, so the diagnostics overlay and the router adapter can subscribe
 * at the same time.
 *
 * Threading: iOS delivers on a serial queue owned by the module (never the
 * main thread); Android delivers on the main thread because `KeyEvent` and
 * `MotionEvent` arrive there. Nitro marshals every callback onto the JS
 * thread, so listeners run on JS in both cases, in arrival order.
 *
 * @see {@linkcode GamepadDevice}
 */
export interface GamepadInput extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /**
   * `true` when the platform can report hardware input at all. `false` on
   * an Android build where `InputManager` is missing (never seen on a
   * phone, possible on a TV box) and never `false` on iOS 14+.
   */
  readonly isAvailable: boolean;

  /** Snapshot of what is attached now. Cheap: no I/O, read from a cache the connection listener keeps. */
  getConnectedDevices(): GamepadDevice[];

  /**
   * Fires when a gamepad or the hardware keyboard attaches (`connected: true`)
   * or drops (`connected: false`). Every button and axis of a dropped device
   * is already released from the platform's point of view; the subscriber
   * decides what that means for an active session.
   */
  addOnConnectionChangedListener(
    listener: (device: GamepadDevice, connected: boolean) => void,
  ): ListenerSubscription;

  /**
   * Digital press and release. One event per edge, never repeated while
   * held. `timestampMs` is the platform's event time on its monotonic clock
   * (`CACurrentMediaTime` on iOS, `SystemClock.uptimeMillis` on Android),
   * comparable within a platform, not across devices.
   */
  addOnButtonListener(
    listener: (button: GamepadButton, pressed: boolean, deviceId: string, timestampMs: number) => void,
  ): ListenerSubscription;

  /**
   * Continuous travel. Sticks and the d-pad: −1…1, +y up. Triggers: 0…1.
   * Fires on every platform value change; the module applies no dead zone,
   * that is the adapter's job because it comes from the controller profile.
   */
  addOnAxisListener(
    listener: (axis: GamepadAxis, value: number, deviceId: string, timestampMs: number) => void,
  ): ListenerSubscription;

  /**
   * Hardware keyboard press and release. `keyCode` is the W3C
   * `KeyboardEvent.code` string (`KeyW`, `ArrowUp`, `Enter`, `Escape`) so
   * the keyboard mapping is one module for native and web. Keys the module
   * cannot name are dropped, not reported as `Unidentified`. Auto-repeat is
   * filtered: one `pressed: true` per physical press.
   */
  addOnKeyListener(
    listener: (keyCode: string, pressed: boolean, timestampMs: number) => void,
  ): ListenerSubscription;
}
