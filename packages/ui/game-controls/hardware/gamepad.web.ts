// Web half of the hardware source: the Gamepad API polled with
// requestAnimationFrame only while a pad is connected, and DOM key events
// with auto-repeat filtered (Master Directive v2 §9). Produces the same
// positional buttons, normalized axes and W3C key codes as the native
// module, so everything above this file is shared.
//
// Only imported by get-hardware-input-source.web.ts; the `.web` suffix keeps
// it out of the native bundle. Touches `window`/`navigator` only inside
// functions, so the file itself is safe to import during SSR.
import type { GamepadAxis } from '../../modules/nyc-gamepad-input/src/types/GamepadAxis';
import type { GamepadButton } from '../../modules/nyc-gamepad-input/src/types/GamepadButton';
import type { GamepadDevice } from '../../modules/nyc-gamepad-input/src/types/GamepadDevice';
import type { ListenerSubscription } from '../../modules/nyc-gamepad-input/src/types/ListenerSubscription';
import { gamepadFamilyFromName } from './gamepad-mapping.ts';
import type { HardwareInputSource } from './hardware-input-source.ts';
import { createKeyEventFilter, isEditableTarget } from './web-key-filter.ts';

/**
 * W3C standard gamepad mapping, button index → position
 * (https://w3c.github.io/gamepad/#remapping). Indices 6 and 7 are the
 * triggers; their analog travel goes out as axes below.
 */
export const STANDARD_BUTTONS: readonly GamepadButton[] = [
  'south', 'east', 'west', 'north',
  'left-shoulder', 'right-shoulder', 'left-trigger', 'right-trigger',
  'select', 'start', 'left-stick', 'right-stick',
  'dpad-up', 'dpad-down', 'dpad-left', 'dpad-right',
  'home',
];

/** Standard mapping axis index → stick axis. Web reports +y down; the sign flips before JS listeners see it. */
const STANDARD_AXES: readonly (readonly [GamepadAxis, 1 | -1])[] = [
  ['left-x', 1],
  ['left-y', -1],
  ['right-x', 1],
  ['right-y', -1],
];

interface PadState {
  readonly device: GamepadDevice;
  readonly pressed: boolean[];
  readonly axes: Map<GamepadAxis, number>;
}

class Listeners<Listener> {
  private readonly set = new Set<Listener>();
  add(listener: Listener, onFirst?: () => void, onLast?: () => void): ListenerSubscription {
    const wasEmpty = this.set.size === 0;
    this.set.add(listener);
    if (wasEmpty) onFirst?.();
    return {
      remove: () => {
        if (!this.set.delete(listener)) return;
        if (this.set.size === 0) onLast?.();
      },
    };
  }
  snapshot(): Listener[] {
    return Array.from(this.set);
  }
}

/**
 * Builds the web {@linkcode HardwareInputSource}. One per page is enough;
 * `getHardwareInputSource` caches it. Call only in a browser.
 *
 * Pads: while at least one connection, button or axis listener exists, the
 * `gamepadconnected`/`gamepaddisconnected` window listeners are attached and
 * a requestAnimationFrame loop diffs every connected pad against its last
 * state, emitting one event per edge or axis change. The loop stops when the
 * last pad leaves or the last listener is removed, and the window listeners
 * come off with the last listener (finding M5). A
 * pad without the `standard` mapping is listed as connected (so the
 * diagnostics overlay can name it) but produces no events, because its
 * indices mean nothing portable. Timestamps are `performance.now()`.
 *
 * Keyboard: `keydown`/`keyup` on `window`, attached while a key listener
 * exists, filtered by {@linkcode createKeyEventFilter}: no auto-repeat, no
 * typing in editable targets, no Ctrl/Meta/Alt chords, mapped codes only,
 * and `preventDefault` on the ones forwarded (finding M6). The keyboard is not listed as a device:
 * the web platform cannot say whether one is attached.
 *
 * Focus: `blur` on `window` and `visibilitychange` to hidden fire the
 * focus-lost listeners and clear the pad caches, so a button still held
 * when focus returns is reported as a fresh press.
 */
export function createWebGamepadInput(): HardwareInputSource {
  const connectionListeners = new Listeners<(device: GamepadDevice, connected: boolean) => void>();
  const buttonListeners = new Listeners<(button: GamepadButton, pressed: boolean, deviceId: string, timestampMs: number) => void>();
  const axisListeners = new Listeners<(axis: GamepadAxis, value: number, deviceId: string, timestampMs: number) => void>();
  const keyListeners = new Listeners<(keyCode: string, pressed: boolean, timestampMs: number) => void>();
  const focusListeners = new Listeners<() => void>();

  const pads = new Map<number, PadState>();
  let frame: number | null = null;
  /** Connection, button and axis listeners together: the pad side runs only while this is above zero. */
  let padSubscribers = 0;
  const keyFilter = createKeyEventFilter();

  const isAvailable = typeof navigator.getGamepads === 'function';

  function deviceFor(gamepad: Gamepad): GamepadDevice {
    return { id: `web-${gamepad.index}`, name: gamepad.id, family: gamepadFamilyFromName(gamepad.id) };
  }

  function attach(gamepad: Gamepad): PadState {
    const state: PadState = { device: deviceFor(gamepad), pressed: [], axes: new Map() };
    pads.set(gamepad.index, state);
    for (const listener of connectionListeners.snapshot()) listener(state.device, true);
    if (frame === null && padSubscribers > 0) frame = requestAnimationFrame(poll);
    return state;
  }

  function detach(index: number): void {
    const state = pads.get(index);
    if (state === undefined) return;
    pads.delete(index);
    for (const listener of connectionListeners.snapshot()) listener(state.device, false);
    if (pads.size === 0 && frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  }

  function emitAxis(state: PadState, axis: GamepadAxis, value: number, now: number): void {
    const rounded = Number.isFinite(value) ? value : 0;
    if (state.axes.get(axis) === rounded) return;
    state.axes.set(axis, rounded);
    for (const listener of axisListeners.snapshot()) listener(axis, rounded, state.device.id, now);
  }

  function readPad(gamepad: Gamepad, state: PadState, now: number): void {
    if (gamepad.mapping !== 'standard') return;
    for (let index = 0; index < STANDARD_BUTTONS.length; index += 1) {
      const button = STANDARD_BUTTONS[index];
      const pressed = gamepad.buttons[index]?.pressed === true;
      if (button === undefined || state.pressed[index] === pressed) continue;
      state.pressed[index] = pressed;
      for (const listener of buttonListeners.snapshot()) listener(button, pressed, state.device.id, now);
    }
    for (let index = 0; index < STANDARD_AXES.length; index += 1) {
      const entry = STANDARD_AXES[index];
      const raw = gamepad.axes[index];
      if (entry === undefined || raw === undefined) continue;
      emitAxis(state, entry[0], raw * entry[1], now);
    }
    emitAxis(state, 'left-trigger', gamepad.buttons[6]?.value ?? 0, now);
    emitAxis(state, 'right-trigger', gamepad.buttons[7]?.value ?? 0, now);
    const up = gamepad.buttons[12]?.pressed === true ? 1 : 0;
    const down = gamepad.buttons[13]?.pressed === true ? 1 : 0;
    const left = gamepad.buttons[14]?.pressed === true ? 1 : 0;
    const right = gamepad.buttons[15]?.pressed === true ? 1 : 0;
    emitAxis(state, 'dpad-x', right - left, now);
    emitAxis(state, 'dpad-y', up - down, now);
  }

  function poll(): void {
    frame = null;
    const now = performance.now();
    for (const gamepad of navigator.getGamepads()) {
      if (gamepad === null || !gamepad.connected) continue;
      const state = pads.get(gamepad.index) ?? attach(gamepad);
      readPad(gamepad, state, now);
    }
    if (pads.size > 0 && padSubscribers > 0) frame = requestAnimationFrame(poll);
  }

  function onConnected(event: GamepadEvent): void {
    if (!pads.has(event.gamepad.index)) attach(event.gamepad);
  }

  function onDisconnected(event: GamepadEvent): void {
    detach(event.gamepad.index);
  }

  function onKey(event: KeyboardEvent): void {
    const decision = keyFilter.decide({
      type: event.type,
      code: event.code,
      repeat: event.repeat,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      editableTarget: isEditableTarget(event.target as HTMLElement | null),
    });
    if (!decision.forward) return;
    if (decision.preventDefault) event.preventDefault();
    const pressed = event.type === 'keydown';
    for (const listener of keyListeners.snapshot()) listener(event.code, pressed, event.timeStamp);
  }

  function startPads(): void {
    window.addEventListener('gamepadconnected', onConnected);
    window.addEventListener('gamepaddisconnected', onDisconnected);
    for (const gamepad of navigator.getGamepads()) {
      if (gamepad !== null && gamepad.connected && !pads.has(gamepad.index)) attach(gamepad);
    }
    if (pads.size > 0 && frame === null) frame = requestAnimationFrame(poll);
  }

  function stopPads(): void {
    window.removeEventListener('gamepadconnected', onConnected);
    window.removeEventListener('gamepaddisconnected', onDisconnected);
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    pads.clear();
  }

  /** Wraps a pad-side listener registration so the first starts the pad side and the last stops it. */
  function padListener<L>(listeners: Listeners<L>, listener: L): ListenerSubscription {
    const subscription = listeners.add(listener);
    padSubscribers += 1;
    if (padSubscribers === 1 && isAvailable) startPads();
    let removed = false;
    return {
      remove: () => {
        if (removed) return;
        removed = true;
        subscription.remove();
        padSubscribers -= 1;
        if (padSubscribers === 0 && isAvailable) stopPads();
      },
    };
  }

  function onFocusLost(): void {
    keyFilter.reset();
    for (const state of pads.values()) {
      state.pressed.length = 0;
      state.axes.clear();
    }
    for (const listener of focusListeners.snapshot()) listener();
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'hidden') onFocusLost();
  }

  function connectedDevices(): GamepadDevice[] {
    if (padSubscribers > 0) return Array.from(pads.values(), (state) => state.device);
    if (!isAvailable) return [];
    // Nothing subscribed, so nothing is tracked: read the pads live without starting the loop.
    const live: GamepadDevice[] = [];
    for (const gamepad of navigator.getGamepads()) {
      if (gamepad !== null && gamepad.connected) live.push(deviceFor(gamepad));
    }
    return live;
  }

  return {
    isAvailable,
    getConnectedDevices: connectedDevices,
    addOnConnectionChangedListener: (listener) => padListener(connectionListeners, listener),
    addOnButtonListener: (listener) => padListener(buttonListeners, listener),
    addOnAxisListener: (listener) => padListener(axisListeners, listener),
    addOnKeyListener: (listener) =>
      keyListeners.add(
        listener,
        () => {
          window.addEventListener('keydown', onKey);
          window.addEventListener('keyup', onKey);
        },
        () => {
          window.removeEventListener('keydown', onKey);
          window.removeEventListener('keyup', onKey);
        },
      ),
    addOnFocusLostListener: (listener) =>
      focusListeners.add(
        listener,
        () => {
          window.addEventListener('blur', onFocusLost);
          document.addEventListener('visibilitychange', onVisibilityChange);
        },
        () => {
          window.removeEventListener('blur', onFocusLost);
          document.removeEventListener('visibilitychange', onVisibilityChange);
        },
      ),
  };
}
