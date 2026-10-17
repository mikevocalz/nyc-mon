/**
 * Dev-only, opt-in on-device probe. EXPO_PUBLIC_GAME_PERF=1; default off.
 * The returned data is synchronous render SUBMISSION cost on JS, not GPU or
 * Choreographer/UI frame time. Compare the latter with adb gfxinfo separately.
 */
import type { ThreeFrameTiming } from '@acme/ui/three';
import { FrameSampleWindow } from './frame-sampler.ts';

export const CITY_FRAME_PROBE_ENABLED = process.env.EXPO_PUBLIC_GAME_PERF === '1';
const window = new FrameSampleWindow();

export function recordCityFrame(sample: ThreeFrameTiming): void {
  if (!CITY_FRAME_PROBE_ENABLED) return;
  const result = window.push(sample);
  if (result) console.info('[NYC-Mon/perf] JS render submission', {
    backend: sample.backend,
    cpuP50Ms: Number(result.cpuP50Ms.toFixed(2)),
    cpuP90Ms: Number(result.cpuP90Ms.toFixed(2)),
    worstMs: Number(result.cpuWorstMs.toFixed(2)),
    activeIntervals: result.activeIntervals,
    slowIntervals: result.slowIntervals,
    parkedIntervals: result.parkedIntervals,
  });
}
