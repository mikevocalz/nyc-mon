// The hardware adapter's state machine, without React or react-native, so
// node tests drive it with a fake source and a real router. useHardwareInput
// owns the lifecycle (mount, AppState) and calls into this.
//
// Rules this file adds over the pure mappings:
// - Only meaningful input marks a hardware source active and hides the touch
//   overlay: a bound button, Start, a mapped key, or an axis event that
//   produced a stick move. Modifier keys, unbound keys, trigger noise and a
//   stick resting in its dead zone do not (finding H8).
// - A stick `begin` the router rejected (touch owned the stick) is retried:
//   while the adapter believes its stick is engaged and the router's stick is
//   not, the next `update` goes out as a `begin` (finding M7).
// - Held buttons are tracked per device. A disconnect releases only what that
//   device held, and ends the shared gamepad stick only if that device was
//   driving it (finding M8). When the last hardware device goes and hardware
//   was the active source, one `cancelAll('source-disconnected')` lets the
//   screen announce it and bring touch back.
import type { ButtonId, ControllerProfile, GameInputRouter, InputSource, PillState } from '../contract.ts';
import type { GamepadDevice } from '../../modules/nyc-gamepad-input/src/types/GamepadDevice';
import type { ListenerSubscription } from '../../modules/nyc-gamepad-input/src/types/ListenerSubscription';
import type { MoveCommand, SessionCommand } from './commands.ts';
import {
  IDLE_GAMEPAD_STICK,
  gamepadAxisToMove,
  gamepadButtonToButtonId,
  releaseGamepadStick,
  startButtonDown,
  startButtonHeld,
  startButtonUp,
  type GamepadStickState,
} from './gamepad-mapping.ts';
import type { HardwareInputSource } from './hardware-input-source.ts';
import type { HardwareInputStore } from './hardware-input.store.ts';
import { STOP_HOLD_MS, type HoldState } from './hold-to-stop.ts';
import {
  IDLE_KEYBOARD_STICK,
  isKeyboardRunKey,
  isMappedKeyCode,
  keyCodeToButtonId,
  keyboardEscapeHeld,
  keyboardKeyToMove,
  keyboardSessionKey,
  releaseKeyboardStick,
  type KeyboardStickState,
} from './keyboard-mapping.ts';

/** The device id keyboard events are filed under; keyboard events carry none. */
export const KEYBOARD_DEVICE_ID = 'keyboard';

/** Timer functions; injectable so tests run without real time. */
export interface AdapterTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** Options for {@linkcode createHardwareInputAdapter}. */
export interface HardwareInputAdapterOptions {
  readonly router: GameInputRouter;
  readonly source: HardwareInputSource;
  /** Read on every event, so profile and pill changes never resubscribe. */
  readonly getOptions: () => { readonly profile: ControllerProfile; readonly pill: PillState };
  readonly store: Pick<HardwareInputStore, 'setConnectedDevices' | 'setActiveSource'>;
  /** Reads the store's current active source. */
  readonly getActiveSource: () => InputSource | null;
  readonly timers?: AdapterTimers;
}

/** What {@linkcode createHardwareInputAdapter} returns. */
export interface HardwareInputAdapter {
  /** Background (native) or focus loss (web): forget everything after the router-wide cancel. */
  interrupt(reason: 'background' | 'focus-loss'): void;
  /** Unsubscribes and releases only what this adapter holds. Idempotent. */
  dispose(): void;
}

const DEFAULT_TIMERS: AdapterTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Subscribes to `source` and drives `router`. Call
 * {@linkcode HardwareInputAdapter.dispose} to detach.
 *
 * @see {@linkcode useHardwareInput}, which owns the lifecycle.
 */
export function createHardwareInputAdapter(options: HardwareInputAdapterOptions): HardwareInputAdapter {
  const { router, source, store, getOptions } = options;
  const timers = options.timers ?? DEFAULT_TIMERS;

  let gamepadStick: GamepadStickState = IDLE_GAMEPAD_STICK;
  let keyboardStick: KeyboardStickState = IDLE_KEYBOARD_STICK;
  /** The pad whose axes last moved the shared gamepad stick. */
  let gamepadStickDevice: string | null = null;
  let startHold: HoldState | null = null;
  let startHoldDevice: string | null = null;
  let escapeHold: HoldState | null = null;
  let startTimer: unknown;
  let escapeTimer: unknown;
  /** Buttons held, per device, per source. */
  const held: Record<'gamepad' | 'keyboard', Map<string, Set<ButtonId>>> = { gamepad: new Map(), keyboard: new Map() };
  let lastTimestampMs = 0;
  let disposed = false;

  const markActive = (inputSource: InputSource, timestampMs: number): void => {
    lastTimestampMs = timestampMs;
    store.setActiveSource(inputSource);
  };

  /** Sends a stick move, turning an `update` into a `begin` when the router no longer has our stick (M7). */
  const publishMove = (inputSource: 'gamepad' | 'keyboard', move: MoveCommand | null, timestampMs: number): void => {
    if (move === null) return;
    const phase = move.phase === 'update' && !router.stick.engaged ? 'begin' : move.phase;
    router.move(move.x, move.y, phase, inputSource, timestampMs);
  };

  const publishSession = (inputSource: InputSource, command: SessionCommand | null): void => {
    switch (command) {
      case 'pause-request': router.pauseRequest(inputSource); break;
      case 'resume-request': router.resumeRequest(inputSource); break;
      case 'stop-request': router.stopRequest(inputSource); break;
      case null: break;
    }
  };

  const heldBySource = (inputSource: 'gamepad' | 'keyboard', button: ButtonId): boolean => {
    for (const set of held[inputSource].values()) if (set.has(button)) return true;
    return false;
  };

  const publishButton = (inputSource: 'gamepad' | 'keyboard', deviceId: string, button: ButtonId, pressed: boolean, timestampMs: number): void => {
    const devices = held[inputSource];
    const set = devices.get(deviceId) ?? new Set<ButtonId>();
    if (pressed === set.has(button)) return;
    const sourceHeldBefore = heldBySource(inputSource, button);
    if (pressed) set.add(button);
    else set.delete(button);
    if (set.size === 0) devices.delete(deviceId);
    else devices.set(deviceId, set);
    const sourceHeldAfter = heldBySource(inputSource, button);
    // The router pairs per (button, source): only the first device down and the last device up reach it.
    if (!sourceHeldBefore && sourceHeldAfter) router.buttonDown(button, inputSource, timestampMs);
    else if (sourceHeldBefore && !sourceHeldAfter) router.buttonUp(button, inputSource, timestampMs);
  };

  const clearStartHold = (): void => {
    if (startTimer !== undefined) timers.clearTimeout(startTimer);
    startTimer = undefined;
    startHold = null;
    startHoldDevice = null;
  };

  const clearEscapeHold = (): void => {
    if (escapeTimer !== undefined) timers.clearTimeout(escapeTimer);
    escapeTimer = undefined;
    escapeHold = null;
  };

  /** Forgets everything held, without telling the router: the caller's `cancelAll` already did. */
  const forgetAll = (): void => {
    clearStartHold();
    clearEscapeHold();
    gamepadStick = IDLE_GAMEPAD_STICK;
    keyboardStick = IDLE_KEYBOARD_STICK;
    gamepadStickDevice = null;
    held.gamepad.clear();
    held.keyboard.clear();
  };

  /** Releases what one device holds (M8). */
  const releaseDevice = (inputSource: 'gamepad' | 'keyboard', deviceId: string): void => {
    const set = held[inputSource].get(deviceId);
    if (set) for (const button of [...set]) publishButton(inputSource, deviceId, button, false, lastTimestampMs);
    if (inputSource === 'gamepad') {
      if (gamepadStickDevice === deviceId) {
        publishMove('gamepad', releaseGamepadStick(gamepadStick).move, lastTimestampMs);
        gamepadStick = IDLE_GAMEPAD_STICK;
        gamepadStickDevice = null;
      }
      if (startHoldDevice === deviceId) clearStartHold();
    } else {
      publishMove('keyboard', releaseKeyboardStick(keyboardStick).move, lastTimestampMs);
      keyboardStick = IDLE_KEYBOARD_STICK;
      clearEscapeHold();
    }
  };

  /** Releases what this adapter holds, source by source, for an unmount. */
  const releaseAll = (): void => {
    for (const inputSource of ['gamepad', 'keyboard'] as const) {
      for (const deviceId of [...held[inputSource].keys()]) releaseDevice(inputSource, deviceId);
    }
    publishMove('gamepad', releaseGamepadStick(gamepadStick).move, lastTimestampMs);
    publishMove('keyboard', releaseKeyboardStick(keyboardStick).move, lastTimestampMs);
    forgetAll();
  };

  const subscriptions: ListenerSubscription[] = [
    source.addOnConnectionChangedListener((device: GamepadDevice, connected) => {
      const devices = source.getConnectedDevices();
      store.setConnectedDevices(devices);
      if (connected) return;
      const keyboard = device.family === 'keyboard';
      releaseDevice(keyboard ? 'keyboard' : 'gamepad', keyboard ? KEYBOARD_DEVICE_ID : device.id);
      if (devices.length > 0) return;
      const active = options.getActiveSource();
      if (active === 'gamepad' || active === 'keyboard') {
        forgetAll();
        router.cancelAll('source-disconnected');
      }
      store.setActiveSource(null);
    }),

    source.addOnButtonListener((button, pressed, deviceId, timestampMs) => {
      if (button === 'start') {
        markActive('gamepad', timestampMs);
        if (pressed) {
          startHold = startButtonDown(timestampMs);
          startHoldDevice = deviceId;
          if (startTimer !== undefined) timers.clearTimeout(startTimer);
          startTimer = timers.setTimeout(() => {
            startTimer = undefined;
            const result = startButtonHeld(startHold, timestampMs + STOP_HOLD_MS);
            startHold = result.next;
            publishSession('gamepad', result.command);
          }, STOP_HOLD_MS);
        } else {
          if (startTimer !== undefined) timers.clearTimeout(startTimer);
          startTimer = undefined;
          const result = startButtonUp(startHold, timestampMs, getOptions().pill);
          startHold = result.next;
          startHoldDevice = null;
          publishSession('gamepad', result.command);
        }
        return;
      }
      const id = gamepadButtonToButtonId(button);
      if (id === undefined) return;
      markActive('gamepad', timestampMs);
      publishButton('gamepad', deviceId, id, pressed, timestampMs);
    }),

    source.addOnAxisListener((axis, value, deviceId, timestampMs) => {
      const result = gamepadAxisToMove(gamepadStick, axis, value, getOptions().profile);
      gamepadStick = result.next;
      if (result.move === null) return;
      markActive('gamepad', timestampMs);
      gamepadStickDevice = result.next.reading.engaged ? deviceId : null;
      publishMove('gamepad', result.move, timestampMs);
    }),

    source.addOnKeyListener((code, pressed, timestampMs) => {
      // Shift only changes a held direction from walk to run. On its own it
      // publishes nothing and leaves the touch controls up.
      if (isKeyboardRunKey(code)) {
        const stick = keyboardKeyToMove(keyboardStick, code, pressed);
        keyboardStick = stick.next;
        if (stick.move === null) return;
        markActive('keyboard', timestampMs);
        publishMove('keyboard', stick.move, timestampMs);
        return;
      }
      if (!isMappedKeyCode(code)) return;
      markActive('keyboard', timestampMs);
      const stick = keyboardKeyToMove(keyboardStick, code, pressed);
      keyboardStick = stick.next;
      publishMove('keyboard', stick.move, timestampMs);

      const id = keyCodeToButtonId(code);
      if (id !== undefined) publishButton('keyboard', KEYBOARD_DEVICE_ID, id, pressed, timestampMs);

      const session = keyboardSessionKey(escapeHold, code, pressed, timestampMs, getOptions().pill);
      const wasDown = escapeHold !== null;
      escapeHold = session.next;
      publishSession('keyboard', session.command);
      if (escapeHold !== null && !wasDown) {
        escapeTimer = timers.setTimeout(() => {
          escapeTimer = undefined;
          const result = keyboardEscapeHeld(escapeHold, timestampMs + STOP_HOLD_MS);
          escapeHold = result.next;
          publishSession('keyboard', result.command);
        }, STOP_HOLD_MS);
      } else if (escapeHold === null && wasDown && escapeTimer !== undefined) {
        timers.clearTimeout(escapeTimer);
        escapeTimer = undefined;
      }
    }),
  ];

  if (source.addOnFocusLostListener !== undefined) {
    subscriptions.push(source.addOnFocusLostListener(() => interrupt('focus-loss')));
  }

  function interrupt(reason: 'background' | 'focus-loss'): void {
    if (disposed) return;
    forgetAll();
    router.cancelAll(reason);
    store.setActiveSource(null);
  }

  store.setConnectedDevices(source.getConnectedDevices());

  return {
    interrupt,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const subscription of subscriptions) subscription.remove();
      releaseAll();
    },
  };
}
