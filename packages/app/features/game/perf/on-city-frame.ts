// Per-frame sink for ThreeCanvas.onFrameTiming on the JS render path.
// Two consumers, both self-gated and default-off:
// - recordCityFrame: the GAME_PERF submission-cost probe (EXPO_PUBLIC_GAME_PERF)
// - reportFrameWork: feeds cpuMs into the ADPF hint session (EXPO_PUBLIC_WORLD_ADPF)
// onFrameTiming itself adds ~4 clock reads per frame, so it is only attached
// when at least one consumer is enabled.
import type { ThreeFrameTiming } from '@acme/ui/three';
import { CITY_FRAME_PROBE_ENABLED, recordCityFrame } from './record-city-frame.ts';
import { EXPERIMENTAL_WORLD_ADPF, reportFrameWork } from './hint-session.ts';

export const CITY_FRAME_SINK_ENABLED = CITY_FRAME_PROBE_ENABLED || EXPERIMENTAL_WORLD_ADPF;

export function onCityFrame(sample: ThreeFrameTiming): void {
  if (CITY_FRAME_PROBE_ENABLED) recordCityFrame(sample);
  if (EXPERIMENTAL_WORLD_ADPF) reportFrameWork(sample.cpuMs);
}
