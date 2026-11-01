import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUTTON_IDS, DEFAULT_CONTROLLER_PROFILE, type ButtonId, type ControllerProfile } from '../contract.ts';
import {
  GAMEPAD_BUTTON_BINDINGS,
  IDLE_GAMEPAD_STICK,
  VENDOR_BUTTON_LABELS,
  gamepadAxisToMove,
  gamepadButtonToButtonId,
  gamepadFamilyFromName,
  releaseGamepadStick,
  startButtonDown,
  startButtonHeld,
  startButtonUp,
  type GamepadStickState,
} from './gamepad-mapping.ts';
import { STOP_HOLD_MS } from './hold-to-stop.ts';
import type { GamepadAxis } from '../../modules/nyc-gamepad-input/src/types/GamepadAxis';
import type { GamepadButton } from '../../modules/nyc-gamepad-input/src/types/GamepadButton';

const profile: Pick<ControllerProfile, 'stick' | 'stickMode'> = { stick: DEFAULT_CONTROLLER_PROFILE.stick, stickMode: 'analog' };
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `expected ${expected}, got ${actual}`);

describe('button table', () => {
  it('maps the six positional buttons onto the six cluster buttons exactly once', () => {
    const targets = Object.values(GAMEPAD_BUTTON_BINDINGS).sort();
    assert.deepEqual(targets, [...BUTTON_IDS].sort());
  });

  it('keeps the pad geometry: face buttons in two rows, bumpers at the ends', () => {
    assert.equal(gamepadButtonToButtonId('west'), 'x');
    assert.equal(gamepadButtonToButtonId('north'), 'y');
    assert.equal(gamepadButtonToButtonId('right-shoulder'), 'z');
    assert.equal(gamepadButtonToButtonId('south'), 'a');
    assert.equal(gamepadButtonToButtonId('east'), 'b');
    assert.equal(gamepadButtonToButtonId('left-shoulder'), 'c');
  });

  it('leaves triggers, sticks, select, start, d-pad and home unbound', () => {
    const unbound: GamepadButton[] = [
      'left-trigger', 'right-trigger', 'select', 'start', 'left-stick', 'right-stick',
      'dpad-up', 'dpad-down', 'dpad-left', 'dpad-right', 'home',
    ];
    for (const button of unbound) assert.equal(gamepadButtonToButtonId(button), undefined, button);
  });

  it('labels every family for every bound button', () => {
    for (const labels of Object.values(VENDOR_BUTTON_LABELS)) {
      for (const button of Object.keys(GAMEPAD_BUTTON_BINDINGS)) {
        assert.ok((labels as Record<string, string>)[button], `${button} label`);
      }
    }
    assert.equal(VENDOR_BUTTON_LABELS.xbox.south, 'A');
    assert.equal(VENDOR_BUTTON_LABELS.playstation.south, 'Cross');
    assert.equal(VENDOR_BUTTON_LABELS.nintendo.south, 'B');
  });
});

describe('family from a product name', () => {
  it('recognises the three vendors by name or USB vendor id', () => {
    assert.equal(gamepadFamilyFromName('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'), 'xbox');
    assert.equal(gamepadFamilyFromName('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'), 'playstation');
    assert.equal(gamepadFamilyFromName('Wireless Controller'), 'playstation');
    assert.equal(gamepadFamilyFromName('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)'), 'nintendo');
    assert.equal(gamepadFamilyFromName('Joy-Con (L)'), 'nintendo');
    assert.equal(gamepadFamilyFromName('8BitDo SN30 Pro'), 'generic');
  });
});

function drive(state: GamepadStickState, events: readonly (readonly [GamepadAxis, number])[]) {
  const moves = [];
  let current = state;
  for (const [axis, value] of events) {
    const result = gamepadAxisToMove(current, axis, value, profile);
    current = result.next;
    if (result.move !== null) moves.push(result.move);
  }
  return { state: current, moves };
}

describe('left stick → move', () => {
  it('stays silent inside the dead zone', () => {
    const { moves } = drive(IDLE_GAMEPAD_STICK, [['left-x', 0.1], ['left-y', 0.05], ['left-x', 0]]);
    assert.deepEqual(moves, []);
  });

  it('begins on the first engaged reading, updates on change, ends at (0, 0)', () => {
    const { moves } = drive(IDLE_GAMEPAD_STICK, [['left-x', 1], ['left-x', 1], ['left-y', 1], ['left-x', 0], ['left-y', 0]]);
    assert.deepEqual(moves.map((m) => m.phase), ['begin', 'update', 'update', 'end']);
    close(moves[0]!.x, 1);
    assert.equal(moves[0]!.y, 0);
    close(moves[1]!.x, Math.SQRT1_2);
    close(moves[1]!.y, Math.SQRT1_2);
    assert.deepEqual(moves[3], { x: 0, y: 0, phase: 'end' });
  });

  it('keeps every reading inside the unit circle and +y up', () => {
    const { moves } = drive(IDLE_GAMEPAD_STICK, [['left-x', 1], ['left-y', -1]]);
    const last = moves.at(-1)!;
    assert.ok(Math.hypot(last.x, last.y) <= 1 + 1e-9);
    assert.ok(last.y < 0, 'a stick pushed down reads negative y');
  });

  it('applies the profile dead zone and sensitivity through readStick', () => {
    const tuned = { ...profile, stick: { ...profile.stick, deadZone: 0.5, sensitivity: 2 } };
    const inside = gamepadAxisToMove(IDLE_GAMEPAD_STICK, 'left-x', 0.49, tuned);
    assert.equal(inside.move, null);
    const past = gamepadAxisToMove(IDLE_GAMEPAD_STICK, 'left-x', 0.75, tuned);
    assert.equal(past.move?.phase, 'begin');
    close(past.move!.x, 1); // (0.75 - 0.5) / 0.5 × 2 = 1, clamped
  });

  it('treats non-finite values as centre and clamps beyond ±1', () => {
    const { moves } = drive(IDLE_GAMEPAD_STICK, [['left-x', 7], ['left-x', Number.NaN]]);
    assert.deepEqual(moves.map((m) => m.phase), ['begin', 'end']);
    close(moves[0]!.x, 1);
  });

  it('ignores the right stick and the triggers', () => {
    const { moves, state } = drive(IDLE_GAMEPAD_STICK, [['right-x', 1], ['right-y', 1], ['left-trigger', 1], ['right-trigger', 1]]);
    assert.deepEqual(moves, []);
    assert.equal(state, IDLE_GAMEPAD_STICK);
  });
});

describe('d-pad → move', () => {
  it('wins over the left stick while pressed and hands back when released', () => {
    const { moves } = drive(IDLE_GAMEPAD_STICK, [['left-x', 1], ['dpad-y', 1], ['dpad-y', 0]]);
    assert.deepEqual(moves.map((m) => m.phase), ['begin', 'update', 'update']);
    close(moves[1]!.x, 0);
    close(moves[1]!.y, 1);
    close(moves[2]!.x, 1);
    close(moves[2]!.y, 0);
  });

  it('snaps to eight directions in dpad stick mode, diagonals at unit length', () => {
    const digital = { ...profile, stickMode: 'dpad' as const };
    const result = gamepadAxisToMove(gamepadAxisToMove(IDLE_GAMEPAD_STICK, 'left-x', 0.9, digital).next, 'left-y', 0.7, digital);
    assert.equal(result.next.reading.direction, 'ne');
    close(result.move!.x, Math.SQRT1_2);
    close(result.move!.y, Math.SQRT1_2);
  });

  it('releases an engaged stick with one end, and an idle stick with nothing', () => {
    const engaged = drive(IDLE_GAMEPAD_STICK, [['left-x', 1]]).state;
    assert.deepEqual(releaseGamepadStick(engaged).move, { x: 0, y: 0, phase: 'end' });
    assert.equal(releaseGamepadStick(IDLE_GAMEPAD_STICK).move, null);
  });
});

describe('Start button', () => {
  it('short press pauses while playing and resumes while paused', () => {
    assert.equal(startButtonUp(startButtonDown(100), 300, 'playing').command, 'pause-request');
    assert.equal(startButtonUp(startButtonDown(100), 300, 'paused').command, 'resume-request');
  });

  it('short press does nothing before a session starts or while the stop dialog is up', () => {
    assert.equal(startButtonUp(startButtonDown(100), 300, 'start').command, null);
    assert.equal(startButtonUp(startButtonDown(100), 300, 'stopConfirm').command, null);
  });

  it(`held ${STOP_HOLD_MS} ms requests a stop once, and the release that follows is silent`, () => {
    const down = startButtonDown(1000);
    assert.equal(startButtonHeld(down, 1999).command, null);
    const fired = startButtonHeld(down, 2000);
    assert.equal(fired.command, 'stop-request');
    assert.equal(startButtonHeld(fired.next, 2500).command, null, 'no second stop');
    assert.equal(startButtonUp(fired.next, 2600, 'playing').command, null);
  });

  it('requests a stop on release when the timer never ran but the hold was long enough', () => {
    assert.equal(startButtonUp(startButtonDown(0), STOP_HOLD_MS, 'playing').command, 'stop-request');
  });

  it('ignores a release with no down on record', () => {
    assert.equal(startButtonUp(null, 50, 'playing').command, null);
    assert.equal(startButtonHeld(null, 5000).command, null);
  });
});

describe('cluster coverage', () => {
  it('every cluster button is reachable from some pad button', () => {
    const reached = new Set<ButtonId>();
    const all: GamepadButton[] = ['south', 'east', 'west', 'north', 'left-shoulder', 'right-shoulder'];
    for (const button of all) {
      const id = gamepadButtonToButtonId(button);
      if (id !== undefined) reached.add(id);
    }
    assert.equal(reached.size, BUTTON_IDS.length);
  });
});
