import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUTTON_IDS } from '../contract.ts';
import { STOP_HOLD_MS } from './hold-to-stop.ts';
import {
  IDLE_KEYBOARD_STICK,
  KEYBOARD_BUTTON_BINDINGS,
  KEYBOARD_DIRECTION_KEYS,
  KEYBOARD_WALK_DEFLECTION,
  isMappedKeyCode,
  keyCodeToButtonId,
  keyboardEscapeHeld,
  keyboardKeyToMove,
  keyboardSessionKey,
  releaseKeyboardStick,
  type KeyboardStickState,
} from './keyboard-mapping.ts';

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `expected ${expected}, got ${actual}`);

function drive(state: KeyboardStickState, events: readonly (readonly [string, boolean])[]) {
  const moves = [];
  let current = state;
  for (const [code, pressed] of events) {
    const result = keyboardKeyToMove(current, code, pressed);
    current = result.next;
    if (result.move !== null) moves.push(result.move);
  }
  return { state: current, moves };
}

describe('button keys', () => {
  it('J K L are the bottom row a b c, U I O the top row x y z', () => {
    assert.equal(keyCodeToButtonId('KeyJ'), 'a');
    assert.equal(keyCodeToButtonId('KeyK'), 'b');
    assert.equal(keyCodeToButtonId('KeyL'), 'c');
    assert.equal(keyCodeToButtonId('KeyU'), 'x');
    assert.equal(keyCodeToButtonId('KeyI'), 'y');
    assert.equal(keyCodeToButtonId('KeyO'), 'z');
  });

  it('covers every cluster button exactly once and nothing else', () => {
    assert.deepEqual(Object.values(KEYBOARD_BUTTON_BINDINGS).sort(), [...BUTTON_IDS].sort());
    assert.equal(keyCodeToButtonId('KeyW'), undefined);
    assert.equal(keyCodeToButtonId('Enter'), undefined);
    assert.equal(keyCodeToButtonId(''), undefined);
  });
});

describe('WASD and arrows → eight-way stick', () => {
  it('maps both key sets to the same four directions', () => {
    assert.equal(KEYBOARD_DIRECTION_KEYS.KeyW, 'up');
    assert.equal(KEYBOARD_DIRECTION_KEYS.ArrowUp, 'up');
    assert.equal(KEYBOARD_DIRECTION_KEYS.KeyA, 'left');
    assert.equal(KEYBOARD_DIRECTION_KEYS.ArrowRight, 'right');
  });

  it('begins on the first key, updates on the second, ends on the last release', () => {
    const { moves } = drive(IDLE_KEYBOARD_STICK, [['KeyW', true], ['KeyD', true], ['KeyW', false], ['KeyD', false]]);
    assert.deepEqual(moves.map((m) => m.phase), ['begin', 'update', 'update', 'end']);
    assert.deepEqual({ x: moves[0]!.x, y: moves[0]!.y }, { x: 0, y: KEYBOARD_WALK_DEFLECTION });
    close(moves[1]!.x, KEYBOARD_WALK_DEFLECTION * Math.SQRT1_2);
    close(moves[1]!.y, KEYBOARD_WALK_DEFLECTION * Math.SQRT1_2);
    assert.deepEqual({ x: moves[2]!.x, y: moves[2]!.y }, { x: KEYBOARD_WALK_DEFLECTION, y: 0 });
    assert.deepEqual(moves[3], { x: 0, y: 0, phase: 'end' });
  });

  it('keeps diagonals the same length as a straight push in every quadrant', () => {
    for (const [a, b] of [['KeyW', 'KeyA'], ['KeyS', 'KeyD'], ['ArrowUp', 'ArrowRight'], ['ArrowDown', 'ArrowLeft']] as const) {
      const { state } = drive(IDLE_KEYBOARD_STICK, [[a, true], [b, true]]);
      close(Math.hypot(state.reading.x, state.reading.y), KEYBOARD_WALK_DEFLECTION);
      assert.ok(['ne', 'nw', 'se', 'sw'].includes(state.reading.direction));
    }
  });

  it('cancels opposite keys to centre and ends the stick', () => {
    const { moves, state } = drive(IDLE_KEYBOARD_STICK, [['KeyA', true], ['KeyD', true]]);
    assert.deepEqual(moves.map((m) => m.phase), ['begin', 'end']);
    assert.equal(state.reading.engaged, false);
    assert.equal(state.held.size, 2, 'both keys stay held until their own release');
  });

  it('ignores repeats and stray releases so the held set never drifts', () => {
    const { moves, state } = drive(IDLE_KEYBOARD_STICK, [['KeyW', true], ['KeyW', true], ['KeyS', false], ['KeyW', false], ['KeyW', false]]);
    assert.deepEqual(moves.map((m) => m.phase), ['begin', 'end']);
    assert.equal(state.held.size, 0);
  });

  it('walks without Shift and runs at full deflection with it, on press and release', () => {
    const { moves, state } = drive(IDLE_KEYBOARD_STICK, [['KeyW', true], ['ShiftLeft', true], ['ShiftLeft', false], ['KeyW', false]]);
    assert.ok(KEYBOARD_WALK_DEFLECTION < 0.75, 'below the Caller run threshold');
    assert.deepEqual(moves, [
      { x: 0, y: KEYBOARD_WALK_DEFLECTION, phase: 'begin' },
      { x: 0, y: 1, phase: 'update' },
      { x: 0, y: KEYBOARD_WALK_DEFLECTION, phase: 'update' },
      { x: 0, y: 0, phase: 'end' },
    ]);
    assert.equal(state.runHeld?.size, 0);
    // Shift first, then a direction: begins already running; a diagonal run is unit length.
    const running = drive(IDLE_KEYBOARD_STICK, [['ShiftRight', true], ['KeyW', true], ['KeyD', true]]).state;
    close(Math.hypot(running.reading.x, running.reading.y), 1);
  });

  it('Shift alone publishes nothing and is not a mapped key, so it never hides the touch controls', () => {
    const { moves, state } = drive(IDLE_KEYBOARD_STICK, [['ShiftLeft', true], ['ShiftLeft', true], ['ShiftLeft', false], ['ShiftRight', false]]);
    assert.deepEqual(moves, []);
    assert.equal(state.runHeld?.size, 0);
    assert.equal(isMappedKeyCode('ShiftLeft'), false);
  });

  it('leaves non-direction keys alone', () => {
    const result = keyboardKeyToMove(IDLE_KEYBOARD_STICK, 'KeyJ', true);
    assert.equal(result.next, IDLE_KEYBOARD_STICK);
    assert.equal(result.move, null);
  });

  it('releases an engaged stick with one end', () => {
    const engaged = drive(IDLE_KEYBOARD_STICK, [['ArrowLeft', true]]).state;
    assert.deepEqual(releaseKeyboardStick(engaged).move, { x: 0, y: 0, phase: 'end' });
    assert.equal(releaseKeyboardStick(IDLE_KEYBOARD_STICK).move, null);
  });
});

describe('Enter and Escape', () => {
  it('Enter down toggles by pill state; Enter up does nothing', () => {
    assert.equal(keyboardSessionKey(null, 'Enter', true, 10, 'playing').command, 'pause-request');
    assert.equal(keyboardSessionKey(null, 'Enter', true, 10, 'paused').command, 'resume-request');
    assert.equal(keyboardSessionKey(null, 'Enter', true, 10, 'start').command, null);
    assert.equal(keyboardSessionKey(null, 'Enter', true, 10, 'stopConfirm').command, null);
    assert.equal(keyboardSessionKey(null, 'Enter', false, 10, 'playing').command, null);
  });

  it('a short Escape toggles on release', () => {
    const down = keyboardSessionKey(null, 'Escape', true, 100, 'playing');
    assert.equal(down.command, null);
    assert.notEqual(down.next, null);
    const up = keyboardSessionKey(down.next, 'Escape', false, 400, 'playing');
    assert.equal(up.command, 'pause-request');
    assert.equal(up.next, null);
  });

  it(`Escape held ${STOP_HOLD_MS} ms requests a stop once; the release is silent`, () => {
    const down = keyboardSessionKey(null, 'Escape', true, 0, 'playing').next;
    assert.equal(keyboardEscapeHeld(down, STOP_HOLD_MS - 1).command, null);
    const fired = keyboardEscapeHeld(down, STOP_HOLD_MS);
    assert.equal(fired.command, 'stop-request');
    assert.equal(keyboardSessionKey(fired.next, 'Escape', false, STOP_HOLD_MS + 50, 'playing').command, null);
  });

  it('a long Escape whose timer never ran still requests a stop on release', () => {
    const down = keyboardSessionKey(null, 'Escape', true, 0, 'playing').next;
    assert.equal(keyboardSessionKey(down, 'Escape', false, STOP_HOLD_MS, 'playing').command, 'stop-request');
  });

  it('a repeated Escape down keeps the first down time', () => {
    const first = keyboardSessionKey(null, 'Escape', true, 0, 'playing').next;
    const again = keyboardSessionKey(first, 'Escape', true, 900, 'playing').next;
    assert.equal(again, first);
    assert.equal(keyboardEscapeHeld(again, STOP_HOLD_MS).command, 'stop-request');
  });

  it('other keys never touch the session', () => {
    const result = keyboardSessionKey(null, 'KeyJ', true, 0, 'playing');
    assert.equal(result.command, null);
    assert.equal(result.next, null);
  });
});
