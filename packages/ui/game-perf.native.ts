// Native accessor for the GamePerf local expo module
// (apps/mobile/modules/game-perf), Expo Modules 2.0 — same lookup pattern as
// reserved-regions.native.ts plus the expo.modules surface the v2 host
// actually installs on (ExpoModulesV2Host: "installed N module(s) on
// globalThis.expo.modules"). requireOptionalNativeModule reads the same
// global, so it doubles as the classic (v1) expo-module fallback.
import { requireOptionalNativeModule } from 'expo';
import type { GamePerfNativeModule } from './game-perf.types';

export type {
  GamePerfDisplayMode,
  GamePerfHintSession,
  GamePerfNativeModule,
  GamePerfThermalSnapshot,
} from './game-perf.types';

interface ExpoModulesGlobal {
  expo?: { modules?: Record<string, unknown> };
  expoV2?: {
    modules?: {
      GamePerf?: GamePerfNativeModule | null;
    };
  };
}

const legacyNative = requireOptionalNativeModule<GamePerfNativeModule>('GamePerf');
let diagnosed = false;

export function gamePerf(): GamePerfNativeModule | null {
  const g = globalThis as typeof globalThis & ExpoModulesGlobal;
  const found =
    g.expoV2?.modules?.GamePerf ??
    (g.expo?.modules?.GamePerf as GamePerfNativeModule | undefined) ??
    legacyNative;
  if (!found && !diagnosed) {
    diagnosed = true;
    try {
      console.warn(
        '[NYC-Mon/perf] GamePerf lookup failed; expo.modules keys:',
        Object.keys(g.expo?.modules ?? {}).slice(0, 40),
        'expoV2 keys:',
        Object.keys(g.expoV2?.modules ?? {}).slice(0, 40),
      );
    } catch {
      /* diagnostics only */
    }
  }
  return found;
}
