// Mounts the flag-gated platform perf pieces while the game screen is live
// (performance-pass PR4.2 + PR5.1-2). All three are default-off; with every
// flag unset this effect mounts nothing and touches nothing.
//
// - mountDisplayRate: window-level refresh-rate vote (EXPO_PUBLIC_WORLD_FRAME_RATE)
// - mountThermalMonitor: PowerManager headroom poller -> thermalSignal
//   (EXPO_PUBLIC_WORLD_THERMAL); city-scene reads the signal as a render-scale
//   down-step input.
// - startHintSession: ADPF PerformanceHintManager session over the render
//   threads (EXPO_PUBLIC_WORLD_ADPF); the session target is the display's
//   current mode rate.
import { useEffect } from 'react';
import { EXPERIMENTAL_WORLD_FRAME_RATE, mountDisplayRate } from './display-rate.ts';
import { EXPERIMENTAL_WORLD_THERMAL, mountThermalMonitor } from './thermal.ts';
import { EXPERIMENTAL_WORLD_ADPF, startHintSession, stopHintSession } from './hint-session.ts';
import { gamePerf } from '@acme/ui/game-perf';
import { WORLD_TIER } from './tier.ts';

/**
 * PR4.3: the phone tier's band (27–38 fps) cannot hold more than 60, so it
 * asks for 60 and the display switches mode instead of frames swinging. The
 * high tier asks for the display's top rate.
 */
export const TIER_DISPLAY_RATE_HZ: number | undefined = WORLD_TIER === 'phone' ? 60 : undefined;

export function useGamePerfMounts(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    const cleanups: (() => void)[] = [];
    if (EXPERIMENTAL_WORLD_FRAME_RATE) cleanups.push(mountDisplayRate(TIER_DISPLAY_RATE_HZ));
    if (EXPERIMENTAL_WORLD_THERMAL) cleanups.push(mountThermalMonitor());
    if (EXPERIMENTAL_WORLD_ADPF) {
      let cancelled = false;
      void gamePerf()
        ?.displayModes()
        .then((modes) => {
          if (cancelled) return;
          const hz = modes.find((m) => m.current)?.refreshRate ?? 60;
          startHintSession(hz);
        });
      cleanups.push(() => {
        cancelled = true;
        stopHintSession();
      });
    }
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [active]);
}
