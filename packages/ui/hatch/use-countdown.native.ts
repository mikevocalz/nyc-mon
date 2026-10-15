'use client';
import { useEffect } from 'react';
import { useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { countdownProgress, minuteSteppedProgress } from '../care/ring-model';

/**
 * Countdown progress on the UI thread. Full motion: a frame callback
 * recomputes it from the wall clock each frame (Reanimated 4.7
 * `useFrameCallback`), so React never re-renders for it. Reduced motion: a
 * JS timer on the minute boundary writes one step. Never stored anywhere.
 */
export function useCountdownProgress(startedAt: number, endsAt: number, reducedMotion: boolean): SharedValue<number> {
  // Starts at 0; the frame callback (or the first reduced tick) writes the real value before the next frame.
  const progress = useSharedValue(0);
  const frame = useFrameCallback(() => {
    'worklet';
    const p = countdownProgress(Date.now(), startedAt, endsAt);
    progress.set(p);
  }, !reducedMotion);
  useEffect(() => {
    frame.setActive(!reducedMotion && Date.now() < endsAt);
    if (!reducedMotion) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const now = Date.now();
      progress.set(minuteSteppedProgress(now, startedAt, endsAt));
      if (now < endsAt) timer = setTimeout(tick, 60_000 - (now % 60_000));
    };
    tick();
    return () => clearTimeout(timer);
  }, [frame, progress, reducedMotion, startedAt, endsAt]);
  return progress;
}
