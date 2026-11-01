// Per-frame sink for ThreeCanvas.onFrameTiming on the JS render path.
// Three consumers, all self-gated and default-off:
// - recordCityFrame: the GAME_PERF submission-cost probe (EXPO_PUBLIC_GAME_PERF)
// - reportFrameWork: feeds cpuMs into the ADPF hint session (EXPO_PUBLIC_WORLD_ADPF)
// - adaptiveFrameBridge: the adaptive-tier controller's sampler
//   (EXPO_PUBLIC_WORLD_ADAPTIVE); city-scene registers the push while a
//   flagged scene is mounted, so with the flag off the bridge stays null.
// onFrameTiming itself adds ~4 clock reads per frame, so it is only attached
// when at least one consumer is enabled.
import type { ThreeFrameTiming } from '@acme/ui/three';
import { CITY_FRAME_PROBE_ENABLED, recordCityFrame } from './record-city-frame.ts';
import { EXPERIMENTAL_WORLD_ADPF, reportFrameWork } from './hint-session.ts';
import { adaptiveFrameBridge, EXPERIMENTAL_WORLD_ADAPTIVE } from './adaptive-tiers.ts';

export const CITY_FRAME_SINK_ENABLED = CITY_FRAME_PROBE_ENABLED || EXPERIMENTAL_WORLD_ADPF || EXPERIMENTAL_WORLD_ADAPTIVE;

export function onCityFrame(sample: ThreeFrameTiming): void {
  if (CITY_FRAME_PROBE_ENABLED) recordCityFrame(sample);
  if (EXPERIMENTAL_WORLD_ADPF) reportFrameWork(sample.cpuMs);
  if (EXPERIMENTAL_WORLD_ADAPTIVE) adaptiveFrameBridge.push?.(sample);
}
