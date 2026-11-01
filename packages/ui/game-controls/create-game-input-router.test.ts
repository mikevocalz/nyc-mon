import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ButtonId, ControllerBindings, InputEvent } from './contract.ts';
import { createGameInputRouter } from './create-game-input-router.ts';

const bindings: ControllerBindings = {
  x: { action: 'zoomIn', label: 'X' },
  y: { action: 'zoomOut', label: 'Y' },
  z: { action: 'reset', label: 'Z' },
  a: { action: 'rotateLeft', label: 'A' },
  b: { action: 'rotateRight', label: 'B' },
  c: { action: 'moveForward', label: 'C', enabled: false },
};

function recording() {
  const router = createGameInputRouter({ bindings, now: () => 999 });
  const events: InputEvent[] = [];
  const subscription = router.addListener((e) => events.push(e));
  return { router, events, subscription };
}

describe('buttons: strict down/up pairing per (button, source)', () => {
  it('holds two buttons while the stick moves, then releases them independently', () => {
    const { router, events } = recording();
    router.buttonDown('a', 'touch', 1);
    router.buttonDown('b', 'touch', 2);
    router.move(0, 0, 'begin', 'touch', 3);
    router.move(0.5, 0.5, 'update', 'touch', 4);
    assert.deepEqual([...router.heldButtons], ['a', 'b']);
    assert.equal(router.stick.engaged, true);
    assert.equal(router.stick.direction, 'ne');
    router.buttonUp('a', 'touch', 5);
    assert.deepEqual([...router.heldButtons], ['b']);
    assert.equal(router.stick.engaged, true, 'releasing a button leaves the stick alone');
    router.buttonUp('b', 'touch', 6);
    assert.equal(router.heldButtons.size, 0);
    assert.deepEqual(events.map((e) => e.kind), ['button-down', 'button-down', 'move', 'move', 'button-up', 'button-up']);
    assert.equal(router.diagnostics.accepted, 6);
    assert.equal(router.diagnostics.rejected, 0);
  });

  it('never sticks under rapid tapping', () => {
    const { router } = recording();
    for (let i = 0; i < 200; i += 1) {
      router.buttonDown('x', 'touch', i * 2);
      router.buttonUp('x', 'touch', i * 2 + 1);
    }
    assert.equal(router.heldButtons.size, 0);
    assert.equal(router.diagnostics.accepted, 400);
    assert.equal(router.diagnostics.rejected, 0);
  });

  it('drops a second down from the same source while the first is held', () => {
    const { router, events } = recording();
    router.buttonDown('x', 'touch', 1);
    router.buttonDown('x', 'touch', 2);
    assert.equal(events.length, 1);
    assert.equal(router.diagnostics.rejected, 1);
    assert.match(router.diagnostics.lastRejection ?? '', /already down from touch/);
  });

  it('refuses an up from a source that never pressed the button', () => {
    const { router, events } = recording();
    router.buttonDown('y', 'touch', 1);
    router.buttonUp('y', 'keyboard', 2);
    assert.deepEqual([...router.heldButtons], ['y'], 'keyboard cannot release a touch press');
    assert.equal(events.length, 1);
    assert.match(router.diagnostics.lastRejection ?? '', /not down from keyboard/);
    router.buttonUp('y', 'touch', 3);
    assert.equal(router.heldButtons.size, 0);
  });

  it('keeps a button held until every source that pressed it releases', () => {
    const { router } = recording();
    router.buttonDown('z', 'touch', 1);
    router.buttonDown('z', 'gamepad', 2);
    router.buttonUp('z', 'touch', 3);
    assert.deepEqual([...router.heldButtons], ['z']);
    assert.deepEqual([...router.diagnostics.activeSources], ['gamepad']);
    router.buttonUp('z', 'gamepad', 4);
    assert.equal(router.heldButtons.size, 0);
    assert.equal(router.diagnostics.activeSources.size, 0);
  });

  it('drops presses of a disabled binding but still accepts a release of a held one', () => {
    const { router } = recording();
    router.buttonDown('c', 'touch', 1);
    assert.equal(router.heldButtons.size, 0);
    assert.match(router.diagnostics.lastRejection ?? '', /c is disabled/);
    router.buttonDown('a', 'touch', 2);
    router.setBindings({ ...bindings, a: { ...bindings.a, enabled: false } });
    router.buttonUp('a', 'touch', 3);
    assert.equal(router.heldButtons.size, 0);
    assert.equal(router.diagnostics.rejected, 1);
  });

  it('rejects unknown ids, sources and non-finite timestamps without throwing', () => {
    const { router, events } = recording();
    router.buttonDown('q' as ButtonId, 'touch', 1);
    router.buttonDown('a', 'mouse' as never, 1);
    router.buttonDown('a', 'touch', Number.NaN);
    router.buttonUp('a', 'touch', Number.POSITIVE_INFINITY);
    assert.equal(events.length, 0);
    assert.equal(router.diagnostics.rejected, 4);
  });
});

describe('stick ownership', () => {
  it('belongs to the source that began it', () => {
    const { router, events } = recording();
    router.move(0, 0, 'begin', 'gamepad', 1);
    router.move(0.2, 0, 'update', 'touch', 2);
    assert.equal(events.length, 1);
    assert.match(router.diagnostics.lastRejection ?? '', /owned by gamepad/);
    router.move(0, 0, 'begin', 'touch', 3);
    assert.equal(events.length, 1, 'a second source cannot begin while the stick is owned');
    router.move(0, 0, 'end', 'gamepad', 4);
    router.move(0, 0, 'begin', 'touch', 5);
    assert.equal(events.length, 3);
  });

  it('rejects update and end without a begin', () => {
    const { router, events } = recording();
    router.move(0.5, 0, 'update', 'touch', 1);
    router.move(0, 0, 'end', 'touch', 2);
    assert.equal(events.length, 0);
    assert.equal(router.diagnostics.rejected, 2);
  });

  it('reads neutral on end and cancel whatever values arrive', () => {
    const { router, events } = recording();
    router.move(0, 0, 'begin', 'touch', 1);
    router.move(1, 0, 'update', 'touch', 2);
    router.move(1, 0, 'end', 'touch', 3);
    const last = events.at(-1);
    assert.equal(last?.kind, 'move');
    if (last?.kind === 'move') assert.deepEqual(last.reading, { x: 0, y: 0, engaged: false, direction: 'none' });
    assert.equal(router.stick.engaged, false);
  });

  it('rejects out-of-range and non-finite axes', () => {
    const { router } = recording();
    router.move(0, 0, 'begin', 'touch', 1);
    router.move(1.5, 0, 'update', 'touch', 2);
    router.move(Number.NaN, 0, 'update', 'touch', 3);
    router.move(0, 0, 'update', 'touch', Number.NaN);
    assert.equal(router.diagnostics.rejected, 3);
    assert.equal(router.diagnostics.accepted, 1);
  });
});

describe('cancelAll', () => {
  it('clears everything and emits exactly one event', () => {
    const { router, events } = recording();
    router.buttonDown('a', 'touch', 1);
    router.buttonDown('b', 'keyboard', 2);
    router.move(0, 0, 'begin', 'touch', 3);
    router.move(0.3, 0.3, 'update', 'touch', 4);
    events.length = 0;
    router.cancelAll('background');
    assert.deepEqual(events, [{ kind: 'cancel-all', reason: 'background', timestampMs: 999 }]);
    assert.equal(router.heldButtons.size, 0);
    assert.deepEqual(router.stick, { x: 0, y: 0, engaged: false, direction: 'none' });
    assert.equal(router.diagnostics.activeSources.size, 0);
    // The stick is free again and a stale up is a rejection, not a crash.
    router.move(0, 0, 'begin', 'keyboard', 5);
    router.buttonUp('a', 'touch', 6);
    assert.equal(router.diagnostics.rejected, 1);
  });

  it('rejects an unknown reason', () => {
    const { router, events } = recording();
    router.cancelAll('because' as never);
    assert.equal(events.length, 0);
    assert.equal(router.diagnostics.rejected, 1);
  });
});

describe('requests and listeners', () => {
  it('stamps pause, resume and stop with the injected clock', () => {
    const { router, events } = recording();
    router.pauseRequest('touch');
    router.resumeRequest('keyboard');
    router.stopRequest('accessibility');
    assert.deepEqual(events, [
      { kind: 'pause-request', source: 'touch', timestampMs: 999 },
      { kind: 'resume-request', source: 'keyboard', timestampMs: 999 },
      { kind: 'stop-request', source: 'accessibility', timestampMs: 999 },
    ]);
    router.stopRequest('wire' as never);
    assert.equal(router.diagnostics.rejected, 1);
  });

  it('removes a listener idempotently and delivers in arrival order', () => {
    const router = createGameInputRouter();
    const seen: string[] = [];
    const first = router.addListener((e) => seen.push(`1:${e.kind}`));
    const second = router.addListener((e) => seen.push(`2:${e.kind}`));
    router.buttonDown('a', 'touch', 1);
    first.remove();
    first.remove();
    router.buttonUp('a', 'touch', 2);
    second.remove();
    router.buttonDown('a', 'touch', 3);
    assert.deepEqual(seen, ['1:button-down', '2:button-down', '2:button-up']);
  });

  it('exposes heldButtons as a live read-only view', () => {
    const router = createGameInputRouter();
    const view = router.heldButtons;
    router.buttonDown('b', 'touch', 1);
    assert.ok(view.has('b'));
    router.buttonUp('b', 'touch', 2);
    assert.ok(!view.has('b'));
  });
});

describe('L9: a throwing listener does not starve the others', () => {
  it('later listeners still get the event, and the throw is counted', () => {
    const errors: unknown[] = [];
    const router = createGameInputRouter({ onListenerError: (error) => errors.push(error) });
    const seen: string[] = [];
    router.addListener(() => { throw new Error('boom'); });
    router.addListener((e) => seen.push(e.kind));
    assert.doesNotThrow(() => router.buttonDown('a', 'touch', 1));
    assert.deepEqual(seen, ['button-down']);
    assert.equal(router.listenerErrors, 1);
    assert.equal(errors.length, 1);
  });
});
