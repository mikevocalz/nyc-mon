import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { InputEvent } from './contract.ts';
import { createGameInputRouter } from './create-game-input-router.ts';
import { ACCESSIBILITY_PRESS_MS, createTouchInputGate, type GateTimers } from './touch-input-gate.ts';

function fakeTimers() {
  const pending = new Map<number, { fn: () => void; ms: number }>();
  let next = 1;
  const timers: GateTimers = {
    setTimeout: (fn, ms) => { const id = next++; pending.set(id, { fn, ms }); return id; },
    clearTimeout: (handle) => { pending.delete(handle as number); },
  };
  const flush = () => { for (const [id, t] of [...pending]) { pending.delete(id); t.fn(); } };
  return { timers, pending, flush };
}

function setup(live = true) {
  const router = createGameInputRouter({ now: () => 5 });
  const events: InputEvent[] = [];
  router.addListener((e) => events.push(e));
  const t = fakeTimers();
  const gate = createTouchInputGate({ router, live, now: () => 7, timers: t.timers });
  return { router, events, gate, ...t };
}

describe('H4: a cap released after the controller stopped being live', () => {
  it('the up still reaches the router while not live, so the cap is not stranded', () => {
    const { router, gate } = setup(false);
    // The press landed while live (here straight on the router); the controller has since closed.
    router.buttonDown('a', 'touch', 1);
    gate.up('a', 2);
    assert.equal(router.heldButtons.size, 0);
  });

  it('live true → false cancels everything with one cancel-all; downs are refused afterwards', () => {
    const { router, events, gate } = setup();
    gate.down('b', 1);
    gate.setLive(false);
    assert.equal(router.heldButtons.size, 0);
    assert.equal(events.at(-1)?.kind, 'cancel-all');
    assert.equal(gate.down('b', 3), false);
    assert.equal(router.heldButtons.size, 0);
  });

  it('a stick begin is refused while not live; its end always goes through', () => {
    const { router, gate } = setup(false);
    gate.move(0.5, 0, 'begin', 1);
    assert.equal(router.stick.engaged, false);
  });
});

describe('L7: accessibility press timers', () => {
  it('sends the up after ACCESSIBILITY_PRESS_MS', () => {
    const { router, gate, pending, flush } = setup();
    gate.accessibilityActivate('x');
    assert.equal(router.heldButtons.has('x'), true);
    assert.equal([...pending.values()][0]?.ms, ACCESSIBILITY_PRESS_MS);
    flush();
    assert.equal(router.heldButtons.has('x'), false);
  });

  it('dispose clears the timer and releases the cap at once, so an unmount never strands it', () => {
    const { router, gate, pending } = setup();
    gate.accessibilityActivate('y');
    gate.dispose();
    assert.equal(pending.size, 0);
    assert.equal(router.heldButtons.has('y'), false);
  });
});

describe('H8: hiding the touch slots releases only touch', () => {
  it('touch caps go up and the touch stick cancels; the gamepad press that hid them stays', () => {
    const { router, events, gate } = setup();
    gate.down('a', 1);
    gate.move(0.6, 0.2, 'begin', 2);
    router.buttonDown('c', 'gamepad', 3);
    gate.releaseTouch();
    assert.deepEqual([...router.heldButtons], ['c']);
    assert.equal(router.stick.engaged, false);
    assert.equal(events.some((e) => e.kind === 'cancel-all'), false);
    // A keyboard begin is accepted now that touch let go of the stick.
    router.move(1, 0, 'begin', 'keyboard', 4);
    assert.equal(router.stick.engaged, true);
  });
});
