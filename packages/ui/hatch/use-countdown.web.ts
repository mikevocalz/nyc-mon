'use client';
import { useEffect } from 'react';
import { useInstanceStore, useStore } from '../use-instance-store';
import { countdownProgress, minuteSteppedProgress } from '../care/ring-model';

/**
 * Countdown progress on web: a per-instance store stepped once a second
 * (full) or on the minute (reduced). At 64 pt a second of a 15-minute ring is
 * under half a degree, so a frame loop would only spend battery.
 */
export function useCountdownProgress(startedAt: number, endsAt: number, reducedMotion: boolean): number {
  const store = useInstanceStore(() => ({ p: 0 }));
  const p = useStore(store, (s) => s.p);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const now = Date.now();
      store.setState({ p: reducedMotion ? minuteSteppedProgress(now, startedAt, endsAt) : countdownProgress(now, startedAt, endsAt) });
      if (now >= endsAt) return;
      const step = reducedMotion ? 60_000 : 1000;
      timer = setTimeout(tick, step - (now % step));
    };
    tick();
    return () => clearTimeout(timer);
  }, [store, reducedMotion, startedAt, endsAt]);
  return p;
}
