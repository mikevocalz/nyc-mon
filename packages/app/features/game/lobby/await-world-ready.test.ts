import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createStore } from 'zustand/vanilla';
import type { GameScreenState } from '../game-session.ts';
import { awaitWorldReady, FIRST_FRAME_TIMEOUT_MS, WorldNotReadyError, type WaitTimers } from './await-world-ready.ts';

// Review finding C1: START used to wait on `firstFrame` with no failure path and no timeout.

function screenStore(initial: Partial<GameScreenState> = {}) {
  return createStore<GameScreenState>(() => ({ canvasFailed: false, firstFrame: false, attempt: 0, announcedReady: false, viewState: null, ...initial }));
}

function manualTimers() {
  const pending = new Map<number, () => void>();
  let next = 1;
  const timers: WaitTimers = {
    setTimeout: (fn) => {
      const id = next++;
      pending.set(id, fn);
      return id;
    },
    clearTimeout: (handle) => {
      pending.delete(handle as number);
    },
  };
  return { timers, pending, fire: () => [...pending.values()].forEach((fn) => fn()) };
}

describe('awaitWorldReady', () => {
  it('resolves on the first frame and clears its timer and subscription', async () => {
    const store = screenStore();
    const { timers, pending } = manualTimers();
    const wait = awaitWorldReady(store, 1000, timers);
    store.setState({ viewState: 'loading' });
    store.setState({ firstFrame: true, viewState: 'ready' });
    await wait;
    assert.equal(pending.size, 0);
  });

  for (const terminal of ['data-error', 'render-error', 'unsupported'] as const) {
    it(`rejects when GameScreen reports ${terminal}`, async () => {
      const store = screenStore();
      const { timers, pending } = manualTimers();
      const wait = awaitWorldReady(store, 1000, timers);
      store.setState({ viewState: terminal });
      await assert.rejects(wait, (error: unknown) => error instanceof WorldNotReadyError && error.reason === 'world-failed');
      assert.equal(pending.size, 0);
    });
  }

  it('rejects with a timeout when nothing arrives', async () => {
    const store = screenStore({ viewState: 'loading' });
    const { timers, fire } = manualTimers();
    const wait = awaitWorldReady(store, 1000, timers);
    fire();
    await assert.rejects(wait, (error: unknown) => error instanceof WorldNotReadyError && error.reason === 'timeout');
    // A late first frame after the timeout changes nothing (the promise already settled).
    store.setState({ firstFrame: true });
  });

  it('settles at once when the state is already decided', async () => {
    await awaitWorldReady(screenStore({ firstFrame: true }));
    await assert.rejects(awaitWorldReady(screenStore({ viewState: 'unsupported' })), WorldNotReadyError);
  });

  it('bounds the default wait', () => {
    assert.ok(FIRST_FRAME_TIMEOUT_MS > 0 && FIRST_FRAME_TIMEOUT_MS <= 30_000);
  });
});
