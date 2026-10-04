'use client';
import { useEffect } from 'react';
import { useInstanceStore, useStore } from '../use-instance-store';

/** Intro progress, 0 to 1. A plain number on web, a SharedValue on native. */
export type IntroProgress = number;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * Chart intro on web: 0 to 1 over `duration` ms with an ease-out.
 *
 * On CanvasKit, Skia props fed from Reanimated shared values do not draw
 * (static props do, see use-web-phase), so web steps the progress with
 * requestAnimationFrame in a per-instance zustand store and the canvas
 * redraws for the length of the intro only. Reduced motion starts at 1.
 */
export function useIntro(duration: number, reduced: boolean): IntroProgress {
  const store = useInstanceStore(() => ({ p: reduced ? 1 : 0 }));
  const p = useStore(store, (s) => s.p);
  useEffect(() => {
    if (reduced) {
      store.setState({ p: 1 });
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      store.setState({ p: easeOutCubic(t) });
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, reduced, store]);
  return reduced ? 1 : p;
}

/** Map the progress to a Skia prop value. `map` must be a worklet (native runs it on the UI thread). */
export function useIntroValue<T>(progress: IntroProgress, map: (p: number) => T): T {
  return map(progress);
}
