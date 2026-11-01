// Physical gamepad → arcade cluster, pure (Master Directive v2 §9 "Keyboard
// and hardware-gamepad adapters", §10 "XR and hardware gamepads"). No
// react-native import, so `node --test` covers every table and transition.
//
// The native module and the web adapter both report buttons by position
// (`south`, `east`, …), so one table serves Xbox, PlayStation, Nintendo and
// generic pads; the family only changes the label a diagnostics overlay
// would paint. Right stick, triggers, Select and Home are unbound: they
// reach the diagnostics overlay through the store, never the router (no
// invented mechanics).
import type { ButtonId, ControllerProfile, PillState, StickReading } from '../contract.ts';
import { NEUTRAL_STICK, isSameReading, readStick, toDigitalReading } from '../stick-math.ts';
import type { GamepadAxis } from '../../modules/nyc-gamepad-input/src/types/GamepadAxis';
import type { GamepadButton } from '../../modules/nyc-gamepad-input/src/types/GamepadButton';
import type { GamepadFamily } from '../../modules/nyc-gamepad-input/src/types/GamepadFamily';
import type { MoveCommand, SessionCommand } from './commands.ts';
import { type HoldState, beginHold, holdReached, markHoldFired, releaseHold } from './hold-to-stop.ts';
import { pillToggleCommand } from './pill-toggle.ts';

/** The six positional buttons that reach the cluster. */
export type BoundGamepadButton = 'south' | 'east' | 'west' | 'north' | 'left-shoulder' | 'right-shoulder';

/**
 * Positional button → cluster button. Decision: BUILD with the pad's own
 * geometry. The four face buttons form two rows on every vendor's pad (west
 * and north above south and east), which is the cluster's top row X Y over
 * bottom row A B; the bumpers fill Z (right, top) and C (left, bottom), the
 * same shape Street Fighter's pad defaults use. The literal pairwise reading
 * of the brief ("A/B/X/Y + LB/RB → a/b/c/x/y/z") would send Xbox X, on the
 * pad's left, to the cluster's bottom-right, so it was not used.
 *
 * | Position | Xbox | PlayStation | Nintendo | Cluster |
 * | --- | --- | --- | --- | --- |
 * | west | X | Square | Y | x |
 * | north | Y | Triangle | X | y |
 * | right-shoulder | RB | R1 | R | z |
 * | south | A | Cross | B | a |
 * | east | B | Circle | A | b |
 * | left-shoulder | LB | L1 | L | c |
 */
export const GAMEPAD_BUTTON_BINDINGS: Readonly<Record<BoundGamepadButton, ButtonId>> = {
  west: 'x',
  north: 'y',
  'right-shoulder': 'z',
  south: 'a',
  east: 'b',
  'left-shoulder': 'c',
};

const BOUND_BUTTONS: readonly BoundGamepadButton[] = ['west', 'north', 'right-shoulder', 'south', 'east', 'left-shoulder'];

function isBoundButton(button: GamepadButton): button is BoundGamepadButton {
  return BOUND_BUTTONS.includes(button as BoundGamepadButton);
}

/** The cluster button a positional button maps to, or `undefined` for the unbound ones. */
export function gamepadButtonToButtonId(button: GamepadButton): ButtonId | undefined {
  return isBoundButton(button) ? GAMEPAD_BUTTON_BINDINGS[button] : undefined;
}

/**
 * What each vendor prints on the six bound buttons, for a diagnostics overlay
 * or a settings hint. `generic` and `keyboard` fall back to the position.
 */
export const VENDOR_BUTTON_LABELS: Readonly<Record<GamepadFamily, Readonly<Record<BoundGamepadButton, string>>>> = {
  xbox: { west: 'X', north: 'Y', 'right-shoulder': 'RB', south: 'A', east: 'B', 'left-shoulder': 'LB' },
  playstation: { west: 'Square', north: 'Triangle', 'right-shoulder': 'R1', south: 'Cross', east: 'Circle', 'left-shoulder': 'L1' },
  nintendo: { west: 'Y', north: 'X', 'right-shoulder': 'R', south: 'B', east: 'A', 'left-shoulder': 'L' },
  generic: { west: 'West', north: 'North', 'right-shoulder': 'RB', south: 'South', east: 'East', 'left-shoulder': 'LB' },
  keyboard: { west: 'West', north: 'North', 'right-shoulder': 'RB', south: 'South', east: 'East', 'left-shoulder': 'LB' },
};

/**
 * Vendor family from a product name, for platforms that give nothing better
 * (the web Gamepad API's `Gamepad.id`, Android pads with an unknown vendor
 * id). The USB vendor ids Chrome embeds in the id string count too.
 */
export function gamepadFamilyFromName(name: string): GamepadFamily {
  const lower = name.toLowerCase();
  if (lower.includes('xbox') || lower.includes('x-box') || lower.includes('045e')) return 'xbox';
  if (
    lower.includes('playstation') ||
    lower.includes('dualsense') ||
    lower.includes('dualshock') ||
    lower.includes('wireless controller') ||
    lower.includes('054c')
  ) {
    return 'playstation';
  }
  if (lower.includes('nintendo') || lower.includes('switch') || lower.includes('joy-con') || lower.includes('057e')) return 'nintendo';
  return 'generic';
}

/**
 * The left stick and the d-pad as the mapping tracks them between axis
 * events. Raw values are the platform's (−1…1, +y up, no dead zone);
 * `reading` is the last value published to the router, so repeated axis
 * events that round to the same reading publish nothing.
 */
export interface GamepadStickState {
  readonly leftX: number;
  readonly leftY: number;
  readonly dpadX: number;
  readonly dpadY: number;
  readonly reading: StickReading;
}

export const IDLE_GAMEPAD_STICK: GamepadStickState = { leftX: 0, leftY: 0, dpadX: 0, dpadY: 0, reading: NEUTRAL_STICK };

const unit = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(-1, value)) : 0);

function withAxis(state: GamepadStickState, axis: GamepadAxis, value: number): GamepadStickState | null {
  const v = unit(value);
  switch (axis) {
    case 'left-x': return { ...state, leftX: v };
    case 'left-y': return { ...state, leftY: v };
    case 'dpad-x': return { ...state, dpadX: v };
    case 'dpad-y': return { ...state, dpadY: v };
    case 'right-x':
    case 'right-y':
    case 'left-trigger':
    case 'right-trigger':
      return null;
  }
}

function transition(previous: StickReading, next: StickReading): MoveCommand | null {
  if (isSameReading(previous, next)) return null;
  if (!previous.engaged) return { x: next.x, y: next.y, phase: 'begin' };
  if (!next.engaged) return { x: 0, y: 0, phase: 'end' };
  return { x: next.x, y: next.y, phase: 'update' };
}

/**
 * Folds one axis event into the stick state and says what to publish.
 *
 * The d-pad wins while it is pressed; otherwise the left stick reads. The
 * vector goes through {@linkcode readStick} with the profile's tuning (dead
 * zone as a fraction of full deflection, sensitivity, clamp to the unit
 * circle) and, in `dpad` stick mode, through {@linkcode toDigitalReading}.
 * The first engaged reading is a `begin`, later changes are `update`s, and
 * the return to the dead zone is one `end` at (0, 0). Right stick and
 * trigger axes change nothing.
 */
export function gamepadAxisToMove(
  state: GamepadStickState,
  axis: GamepadAxis,
  value: number,
  profile: Pick<ControllerProfile, 'stick' | 'stickMode'>,
): { readonly next: GamepadStickState; readonly move: MoveCommand | null } {
  const updated = withAxis(state, axis, value);
  if (updated === null) return { next: state, move: null };
  const usePad = updated.dpadX !== 0 || updated.dpadY !== 0;
  const x = usePad ? updated.dpadX : updated.leftX;
  const y = usePad ? updated.dpadY : updated.leftY;
  // readStick takes finger travel with +y down; a stick is a finger at full deflection = clampRadiusDp.
  const clamp = profile.stick.clampRadiusDp;
  const analog = readStick(x * clamp, -y * clamp, profile.stick);
  const reading = profile.stickMode === 'dpad' ? toDigitalReading(analog) : analog;
  const move = transition(state.reading, reading);
  return { next: { ...updated, reading }, move };
}

/** Releases an engaged stick (disconnect, background, unmount): one `end` if it was engaged. */
export function releaseGamepadStick(state: GamepadStickState): { readonly next: GamepadStickState; readonly move: MoveCommand | null } {
  return { next: IDLE_GAMEPAD_STICK, move: state.reading.engaged ? { x: 0, y: 0, phase: 'end' } : null };
}

/** Start (Xbox Menu, PlayStation Options, Nintendo Plus) went down. */
export function startButtonDown(timestampMs: number): HoldState {
  return beginHold(timestampMs);
}

/**
 * Start came up. A short press toggles pause/resume for the current
 * {@linkcode PillState} ({@linkcode pillToggleCommand}); a press that lasted
 * {@linkcode STOP_HOLD_MS} or more without the timer firing is a stop
 * request; nothing after the timer already sent one.
 */
export function startButtonUp(hold: HoldState | null, timestampMs: number, pill: PillState): { readonly next: null; readonly command: SessionCommand | null } {
  switch (releaseHold(hold, timestampMs)) {
    case 'short-press':
      return { next: null, command: pillToggleCommand(pill) };
    case 'stop':
      return { next: null, command: 'stop-request' };
    case 'none':
      return { next: null, command: null };
  }
}

/**
 * The hook's hold timer fired. Sends the stop request once the hold is long
 * enough and marks it sent, so the release that follows is silent. The
 * session still confirms the stop; this is a request, never the stop itself.
 */
export function startButtonHeld(hold: HoldState | null, nowMs: number): { readonly next: HoldState | null; readonly command: 'stop-request' | null } {
  if (!holdReached(hold, nowMs)) return { next: hold, command: null };
  return { next: markHoldFired(hold), command: 'stop-request' };
}
