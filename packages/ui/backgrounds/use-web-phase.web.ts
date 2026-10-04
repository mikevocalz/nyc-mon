'use client';
import { useEffect, useState } from 'react';

/**
 * Scroll phase (0 to 1) for canvas grids on web.
 *
 * On CanvasKit, Skia props fed from Reanimated `useDerivedValue` never draw
 * (static props do), so the web build advances the phase with
 * requestAnimationFrame instead. Speed 0, including reduced motion, never
 * starts the loop.
 */
export function useWebPhase(speed: number): number | null {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (speed === 0) return;
    let frame = 0;
    let last = performance.now();
    let offset = 0;
    const tick = (now: number) => {
      offset = (offset + ((now - last) / 1000) * speed * 1.5) % 1;
      last = now;
      setPhase(offset);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [speed]);
  return speed === 0 ? 0 : phase;
}
