import type { StoreApi } from 'zustand/vanilla';
import type { GameScreenState } from '../game-session.ts';
import type { GameViewState } from '../game-status.ts';

// The wait between the lobby's `hold` and the session start (review finding
// C1). Resolves on the world's first frame; rejects when GameScreen reports a
// state that can never draw (`data-error`, `render-error`, `unsupported`) or
// when nothing happens within FIRST_FRAME_TIMEOUT_MS. Every path removes the
// subscription and the timer, so a failed START leaves nothing running.

/** How long START holds the cover for a first frame before it gives up. */
export const FIRST_FRAME_TIMEOUT_MS = 20_000;

/** The view states that end the wait with a failure: none of them can reach a first frame without the Caller acting. */
export function isTerminalViewState(state: GameViewState | null): boolean {
  return state === 'data-error' || state === 'render-error' || state === 'unsupported';
}

/** Why the wait failed; the lobby shows the same generic line for both and keeps the reason for diagnostics. */
export class WorldNotReadyError extends Error {
  readonly reason: 'world-failed' | 'timeout';
  constructor(reason: 'world-failed' | 'timeout', detail: string) {
    super(`world not ready: ${detail}`);
    this.name = 'WorldNotReadyError';
    this.reason = reason;
  }
}

/** Timer seam so a test can drive the timeout without waiting 20 s. */
export interface WaitTimers {
  readonly setTimeout: (fn: () => void, ms: number) => unknown;
  readonly clearTimeout: (handle: unknown) => void;
}

const REAL_TIMERS: WaitTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Waits for `firstFrame` on `store`.
 *
 * @throws {WorldNotReadyError} `world-failed` when `viewState` turns terminal, `timeout` after `timeoutMs`.
 */
export function awaitWorldReady(
  store: Pick<StoreApi<GameScreenState>, 'getState' | 'subscribe'>,
  timeoutMs: number = FIRST_FRAME_TIMEOUT_MS,
  timers: WaitTimers = REAL_TIMERS,
): Promise<void> {
  const settled = (state: GameScreenState): 'ready' | 'failed' | null => {
    if (state.firstFrame) return 'ready';
    if (isTerminalViewState(state.viewState)) return 'failed';
    return null;
  };
  const initial = store.getState();
  const now = settled(initial);
  if (now === 'ready') return Promise.resolve();
  if (now === 'failed') return Promise.reject(new WorldNotReadyError('world-failed', String(initial.viewState)));
  return new Promise<void>((resolve, reject) => {
    let done = false;
    const finish = (outcome: () => void): void => {
      if (done) return;
      done = true;
      unsubscribe();
      timers.clearTimeout(timer);
      outcome();
    };
    const unsubscribe = store.subscribe((state) => {
      const result = settled(state);
      if (result === 'ready') finish(resolve);
      else if (result === 'failed') finish(() => reject(new WorldNotReadyError('world-failed', String(state.viewState))));
    });
    const timer = timers.setTimeout(() => finish(() => reject(new WorldNotReadyError('timeout', `${timeoutMs} ms`))), timeoutMs);
  });
}
