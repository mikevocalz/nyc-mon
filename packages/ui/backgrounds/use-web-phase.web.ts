'use client';
import { useEffect } from 'react';
import { useInstanceStore, useStore } from '../use-instance-store';

/**
 * Scroll phase (0 to 1) for canvas grids on web.
 *
 * On CanvasKit, Skia props fed from Reanimated `useDerivedValue` never draw
 * (static props do), so the web build advances the phase with
 * requestAnimationFrame instead. Speed 0, including reduced motion, never
 * starts the loop. The phase lives in a per-instance zustand store (repo
 * rule: no React useState); each frame's setState re-renders the canvas.
 */
export function useWebPhase(speed: number): number | null {
  const store = useInstanceStore(() => ({ phase: 0 }));
  const phase = useStore(store, (state) => state.phase);
  useEffect(() => {
    if (speed === 0) return;
    let frame = 0;
    let last = performance.now();
    let offset = store.getState().phase;
    const tick = (now: number) => {
      offset = (offset + ((now - last) / 1000) * speed * 1.5) % 1;
      last = now;
      store.setState({ phase: offset });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [speed, store]);
  return speed === 0 ? 0 : phase;
}
