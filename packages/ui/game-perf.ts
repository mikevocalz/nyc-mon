// TS resolution anchor — Metro loads ./game-perf.native.ts on device. The
// stub keeps web/node-test builds working: gamePerf() answers null and every
// mount in packages/app/features/game/perf falls back to its existing
// behavior (frame-pacing inference only, no native calls).
export type {
  GamePerfDisplayMode,
  GamePerfHintSession,
  GamePerfNativeModule,
  GamePerfThermalSnapshot,
} from './game-perf.types';

import type { GamePerfNativeModule } from './game-perf.types';

export function gamePerf(): GamePerfNativeModule | null {
  return null;
}
