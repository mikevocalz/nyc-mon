'use client';

import { create } from 'zustand';
import type { ClassicEvent, ScheduledVignette } from '@acme/core/sim';
import { useMonStore } from '../mon/mon.store';

interface CareTickState {
  /** Bumped on every tick that ran, so screens can react to a fresh result. */
  readonly seq: number;
  readonly at: number;
  readonly classicEvents: readonly ClassicEvent[];
  readonly vignettes: readonly ScheduledVignette[];
}

/**
 * The last sim tick's events and idle vignettes, for Mon Space (the Mon is
 * never a statue). Written only by {@linkcode runCareTick}.
 */
export const useCareTick = create<CareTickState>()(() => ({ seq: 0, at: 0, classicEvents: [], vignettes: [] }));

/**
 * Runs the sim tick for the active Mon (`tickMonCare` → `stepMonCare` →
 * `step()`): the minute clock calls it once a minute and on every return to
 * the foreground. With no Mon yet it does nothing. A tick that throws is
 * reported and skipped; the next minute tries again with the saved state.
 */
export function runCareTick(nowMs: number): void {
  let result;
  try {
    result = useMonStore.getState().tickMonCare(nowMs);
  } catch (error) {
    console.warn('[mon-space] care tick failed', error);
    return;
  }
  if (result === undefined) return;
  useCareTick.setState((s) => ({ seq: s.seq + 1, at: nowMs, classicEvents: result.classicEvents, vignettes: result.vignettes }));
}
