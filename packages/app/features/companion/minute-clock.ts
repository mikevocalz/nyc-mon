'use client';

import { useEffect } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { msToNextMinute } from './minute-clock-math';

/** Background time after which a return counts as "resumed" (M13 background-resumed: ≥ 60 s). */
export const RESUME_AFTER_MS = 60_000;

interface MinuteClockState {
  /** Epoch ms, refreshed on each minute boundary and on every return to the foreground. */
  readonly nowMs: number;
  /** Bumped when the app returns after at least {@linkcode RESUME_AFTER_MS} in the background. */
  readonly resumeCount: number;
  readonly backgroundedAt: number | null;
}

/**
 * The screen clock for `/(home)` (M11 "useMinuteClock", M13 "nowMs is read in
 * the screen hook: once a minute, and on AppState change to active"). Core
 * never reads the clock (Law 3); screens pass `nowMs` into the selectors.
 */
export const useMinuteClock = create<MinuteClockState>()(() => ({
  nowMs: Date.now(),
  resumeCount: 0,
  backgroundedAt: null,
}));

/** Re-reads the clock now (after a write, so derived state uses the write's time). */
export function tickMinuteClock(): void {
  useMinuteClock.setState({ nowMs: Date.now() });
}

/** Drives {@linkcode useMinuteClock}. Mount once, in the `/(home)` layout. */
export function useMinuteClockDriver(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        tickMinuteClock();
        schedule();
      }, msToNextMinute(Date.now()));
    };
    tickMinuteClock();
    schedule();
    const sub = AppState.addEventListener('change', (next) => {
      const now = Date.now();
      if (next === 'active') {
        const { backgroundedAt, resumeCount } = useMinuteClock.getState();
        const resumed = backgroundedAt !== null && now - backgroundedAt >= RESUME_AFTER_MS;
        useMinuteClock.setState({ nowMs: now, backgroundedAt: null, resumeCount: resumed ? resumeCount + 1 : resumeCount });
        schedule();
      } else if (next === 'background') {
        useMinuteClock.setState({ backgroundedAt: now });
      }
    });
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      sub.remove();
    };
  }, []);
}
