// Hardware keyboard → arcade controls, pure (Master Directive v2 §9). No
// react-native import, so `node --test` covers every table and transition.
// Key names are W3C `KeyboardEvent.code` values: the native module converts
// GCKeyCode / Android key codes to the same strings, so this one table serves
// iOS, Android and web.
import type { ButtonId, PillState, StickReading } from '../contract.ts';
import { NEUTRAL_STICK, direction8, isSameReading } from '../stick-math.ts';
import type { MoveCommand, SessionCommand } from './commands.ts';
import { type HoldState, beginHold, holdReached, markHoldFired, releaseHold } from './hold-to-stop.ts';
import { pillToggleCommand } from './pill-toggle.ts';

/**
 * Cluster buttons on the right hand: the home row J K L is the bottom row
 * A B C, the row above (U I O) is the top row X Y Z, matching the cluster's
 * two-row arch under the fingers that rest on WASD's opposite side.
 *
 * | Key | Cluster |
 * | --- | --- |
 * | KeyU | x |
 * | KeyI | y |
 * | KeyO | z |
 * | KeyJ | a |
 * | KeyK | b |
 * | KeyL | c |
 */
export const KEYBOARD_BUTTON_BINDINGS: Readonly<Record<string, ButtonId>> = {
  KeyU: 'x',
  KeyI: 'y',
  KeyO: 'z',
  KeyJ: 'a',
  KeyK: 'b',
  KeyL: 'c',
};

/** The cluster button a key code maps to, or `undefined` for every other key. */
export function keyCodeToButtonId(code: string): ButtonId | undefined {
  return KEYBOARD_BUTTON_BINDINGS[code];
}

export type KeyboardDirection = 'up' | 'down' | 'left' | 'right';

/** WASD and the arrow keys drive the stick as an eight-way pad. */
export const KEYBOARD_DIRECTION_KEYS: Readonly<Record<string, KeyboardDirection>> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

/**
 * Either Shift runs while a direction key is held. Shift is a modifier, not a
 * mapped key: on its own it never marks the keyboard active or hides the
 * touch controls ({@linkcode isMappedKeyCode} leaves it out).
 */
export const KEYBOARD_RUN_KEYS: ReadonlySet<string> = new Set(['ShiftLeft', 'ShiftRight']);

export function isKeyboardRunKey(code: string): boolean {
  return KEYBOARD_RUN_KEYS.has(code);
}

/**
 * Stick deflection of a held direction key without Shift. A game reading
 * the stick as walk below a run threshold (the Caller runs from 0.75) walks
 * at full walking pace here; Shift publishes full deflection.
 */
export const KEYBOARD_WALK_DEFLECTION = 0.6;

/** Enter and Escape short-press toggle pause/resume; Escape held is the stop request. */
export const KEYBOARD_PAUSE_KEY = 'Enter';
export const KEYBOARD_STOP_KEY = 'Escape';

/** True for every key this file maps: a direction, a cluster button, Enter or Escape. */
export function isMappedKeyCode(code: string): boolean {
  return (
    KEYBOARD_DIRECTION_KEYS[code] !== undefined ||
    KEYBOARD_BUTTON_BINDINGS[code] !== undefined ||
    code === KEYBOARD_PAUSE_KEY ||
    code === KEYBOARD_STOP_KEY
  );
}

/**
 * Which direction keys are down, which Shift keys are down, and the last
 * reading published. Two keys on one axis (A and D together) cancel to 0,
 * as a physical pad would.
 */
export interface KeyboardStickState {
  readonly held: ReadonlySet<string>;
  readonly reading: StickReading;
  /** Shift keys down. Optional so older callers' literals still type-check; absent means none. */
  readonly runHeld?: ReadonlySet<string>;
}

export const IDLE_KEYBOARD_STICK: KeyboardStickState = { held: new Set(), reading: NEUTRAL_STICK, runHeld: new Set() };

function readingFor(held: ReadonlySet<string>, running: boolean): StickReading {
  let x = 0;
  let y = 0;
  for (const code of held) {
    switch (KEYBOARD_DIRECTION_KEYS[code]) {
      case 'up': y += 1; break;
      case 'down': y -= 1; break;
      case 'left': x -= 1; break;
      case 'right': x += 1; break;
      case undefined: break;
    }
  }
  x = Math.sign(x);
  y = Math.sign(y);
  if (x === 0 && y === 0) return NEUTRAL_STICK;
  // A diagonal keeps the same length as a straight push so the game moves at one speed in every direction.
  const length = running ? 1 : KEYBOARD_WALK_DEFLECTION;
  const scale = x !== 0 && y !== 0 ? length * Math.SQRT1_2 : length;
  x *= scale;
  y *= scale;
  return { x, y, engaged: true, direction: direction8(x, y) };
}

/**
 * Folds one key edge into the stick state. Keys that are neither a direction
 * nor Shift change nothing. A down for a key already held (auto-repeat that
 * slipped through, or a key down before the adapter mounted) and an up for a
 * key not held change nothing either, so the held sets can never drift. The
 * first engaged reading is a `begin`, later changes `update` (Shift while a
 * direction is held is one), the last direction key up one `end`. Shift with
 * no direction held publishes nothing.
 */
export function keyboardKeyToMove(
  state: KeyboardStickState,
  code: string,
  pressed: boolean,
): { readonly next: KeyboardStickState; readonly move: MoveCommand | null } {
  const runKey = isKeyboardRunKey(code);
  if (!runKey && KEYBOARD_DIRECTION_KEYS[code] === undefined) return { next: state, move: null };
  const previousRun = state.runHeld ?? new Set<string>();
  if (pressed === (runKey ? previousRun.has(code) : state.held.has(code))) return { next: state, move: null };
  const held = new Set(state.held);
  const runHeld = new Set(previousRun);
  const target = runKey ? runHeld : held;
  if (pressed) target.add(code);
  else target.delete(code);
  const reading = readingFor(held, runHeld.size > 0);
  const next = { held, reading, runHeld };
  if (isSameReading(state.reading, reading)) return { next, move: null };
  if (!state.reading.engaged) return { next, move: { x: reading.x, y: reading.y, phase: 'begin' } };
  if (!reading.engaged) return { next, move: { x: 0, y: 0, phase: 'end' } };
  return { next, move: { x: reading.x, y: reading.y, phase: 'update' } };
}

/** Releases every held direction key (focus loss, background, unmount): one `end` if engaged. */
export function releaseKeyboardStick(state: KeyboardStickState): { readonly next: KeyboardStickState; readonly move: MoveCommand | null } {
  return { next: IDLE_KEYBOARD_STICK, move: state.reading.engaged ? { x: 0, y: 0, phase: 'end' } : null };
}

/**
 * Folds Enter and Escape edges into the stop-hold state and says which
 * session request to make. Enter acts on its down edge (it has no hold
 * meaning, so there is nothing to wait for). Escape acts on its up edge: a
 * short press toggles like Enter, a press of {@linkcode STOP_HOLD_MS} or
 * more is a stop request unless {@linkcode keyboardEscapeHeld} already sent
 * it. Any other key changes nothing.
 */
export function keyboardSessionKey(
  hold: HoldState | null,
  code: string,
  pressed: boolean,
  timestampMs: number,
  pill: PillState,
): { readonly next: HoldState | null; readonly command: SessionCommand | null } {
  if (code === KEYBOARD_PAUSE_KEY) {
    return { next: hold, command: pressed ? pillToggleCommand(pill) : null };
  }
  if (code !== KEYBOARD_STOP_KEY) return { next: hold, command: null };
  if (pressed) {
    // A second down while already down is a repeat the platform should have filtered; keep the first.
    return { next: hold ?? beginHold(timestampMs), command: null };
  }
  switch (releaseHold(hold, timestampMs)) {
    case 'short-press':
      return { next: null, command: pillToggleCommand(pill) };
    case 'stop':
      return { next: null, command: 'stop-request' };
    case 'none':
      return { next: null, command: null };
  }
}

/** The hook's Escape hold timer fired; same contract as `startButtonHeld` for a gamepad. */
export function keyboardEscapeHeld(hold: HoldState | null, nowMs: number): { readonly next: HoldState | null; readonly command: 'stop-request' | null } {
  if (!holdReached(hold, nowMs)) return { next: hold, command: null };
  return { next: markHoldFired(hold), command: 'stop-request' };
}
