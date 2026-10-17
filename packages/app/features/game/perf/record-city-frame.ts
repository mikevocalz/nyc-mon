/**
 * Dev-only, opt-in on-device probe. EXPO_PUBLIC_GAME_PERF=1; default off.
 * The returned data is synchronous render SUBMISSION cost on JS, not GPU or
 * Choreographer/UI frame time. Compare the latter with adb gfxinfo separately.
 *
 * `stages` (G1 attribution) splits cpuMs: scene update / nodeFrame advance /
 * renderer.render / present, plus the renderer's own draw-call and triangle
 * counts and the drawing-buffer size (render-scale verification).
 */
import type { ThreeFrameTiming } from '@acme/ui/three';
import { FrameSampleWindow } from './frame-sampler.ts';

export const CITY_FRAME_PROBE_ENABLED = process.env.EXPO_PUBLIC_GAME_PERF === '1';
const window = new FrameSampleWindow();

const round2 = (v: number) => Number(v.toFixed(2));

export function recordCityFrame(sample: ThreeFrameTiming): void {
  if (!CITY_FRAME_PROBE_ENABLED) return;
  const result = window.push(sample);
  if (result) console.info('[NYC-Mon/perf] JS render submission', {
    backend: sample.backend,
    cpuP50Ms: round2(result.cpuP50Ms),
    cpuP90Ms: round2(result.cpuP90Ms),
    worstMs: round2(result.cpuWorstMs),
    activeIntervals: result.activeIntervals,
    slowIntervals: result.slowIntervals,
    parkedIntervals: result.parkedIntervals,
    stages: result.stages === null ? null : {
      updateP50Ms: round2(result.stages.updateP50Ms),
      updateP90Ms: round2(result.stages.updateP90Ms),
      nodeP50Ms: round2(result.stages.nodeP50Ms),
      nodeP90Ms: round2(result.stages.nodeP90Ms),
      renderP50Ms: round2(result.stages.renderP50Ms),
      renderP90Ms: round2(result.stages.renderP90Ms),
      presentP50Ms: round2(result.stages.presentP50Ms),
      presentP90Ms: round2(result.stages.presentP90Ms),
      drawCallsP50: result.stages.drawCallsP50,
      trianglesP50: result.stages.trianglesP50,
      trianglesMax: result.stages.trianglesMax,
      bufferW: result.stages.bufferW,
      bufferH: result.stages.bufferH,
    },
  });
}
