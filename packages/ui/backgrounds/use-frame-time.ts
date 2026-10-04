'use client';
import { useEffect } from 'react';
import { useInstanceStore, useStore } from '../use-instance-store';

/**
 * Seconds since the loop started, advanced by requestAnimationFrame on the
 * JS thread. Stops (and holds its value) when `running` is false. For Skia
 * fallbacks that redraw a small subtree per frame; the GPU path has its own
 * clock in GpuCanvas. Per-instance zustand store (repo rule: no useState).
 */
export function useFrameTime(running: boolean): number {
  const store = useInstanceStore(() => ({ time: 0 }));
  const time = useStore(store, (s) => s.time);
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;
      store.setState({ time: store.getState().time + delta });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, store]);
  return time;
}
