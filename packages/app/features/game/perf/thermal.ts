// Thermal headroom monitor (performance-pass PR5.1). Opt-in:
// EXPO_PUBLIC_WORLD_THERMAL=1 — default off.
//
// Polls PowerManager through the local GamePerf module and publishes the
// latest classification on `thermalSignal`, a plain module-level slot (not
// React state — it is read once per frame inside city-scene's update, same
// pattern as FrameSampleWindow). city-scene feeds non-'ok' samples to the
// render-scale controller as a forced down-step, so the tier steps down
// before the device reaches SEVERE instead of waiting for frame drops.
//
// Cadence: 5s. The thermal API refreshes headroom roughly once per second,
// but a down-step within a few seconds of the warm-up is what the budget
// needs and keeps log volume reasonable over a 20-minute soak.
import { gamePerf, type GamePerfThermalSnapshot } from '@acme/ui/game-perf';
import { parseSkyRigFlag } from '../world/sky-rig.ts';

export const EXPERIMENTAL_WORLD_THERMAL = parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_THERMAL);

export type ThermalLevel = 'ok' | 'warm' | 'hot';

export interface ThermalSignal {
  /** Monotonic sample counter; consumers compare instead of subscribing. */
  seq: number;
  level: ThermalLevel;
  /** Last PowerManager THERMAL_STATUS_* value (-1 before first sample). */
  status: number;
  headroom: number | null;
}

export const thermalSignal: ThermalSignal = { seq: 0, level: 'ok', status: -1, headroom: null };

export const THERMAL_MODERATE_STATUS = 2; // PowerManager.THERMAL_STATUS_MODERATE
export const THERMAL_SEVERE_STATUS = 4; // PowerManager.THERMAL_STATUS_SEVERE
export const THERMAL_WARM_HEADROOM = 0.7;
export const THERMAL_HOT_HEADROOM = 0.9;

const THERMAL_RANK: Record<ThermalLevel, number> = { ok: 0, warm: 1, hot: 2 };

/**
 * True when a sample moved to a worse level. Consumers step down on the
 * transition only; the poll repeats an unchanged level every interval, and
 * stepping on each repeat would walk the scale to the floor while the device
 * merely stays warm.
 */
export function thermalWorsened(prev: ThermalLevel, next: ThermalLevel): boolean {
  return THERMAL_RANK[next] > THERMAL_RANK[prev];
}

export function classifyThermal(snapshot: {
  status: number;
  headroom: number | null;
  headroomForecast: number | null;
}): ThermalLevel {
  const worst = Math.max(snapshot.headroom ?? 0, snapshot.headroomForecast ?? 0);
  if (snapshot.status >= THERMAL_SEVERE_STATUS || worst >= THERMAL_HOT_HEADROOM) return 'hot';
  if (snapshot.status >= THERMAL_MODERATE_STATUS || worst >= THERMAL_WARM_HEADROOM) return 'warm';
  return 'ok';
}

export function mountThermalMonitor(
  intervalMs = 5_000,
  forecastSeconds = 30,
): () => void {
  const native = gamePerf();
  if (!native) {
    console.warn('[NYC-Mon/perf] thermal monitor skipped: GamePerf module unavailable');
    return () => {};
  }
  let disposed = false;
  const poll = async () => {
    const snap: GamePerfThermalSnapshot | null = await native
      .thermalSnapshot(forecastSeconds)
      .catch(() => null);
    if (disposed || snap === null) return;
    if (!snap.supported) {
      console.info('[NYC-Mon/perf] thermal API unsupported below Android 10');
      return;
    }
    const level = classifyThermal(snap);
    thermalSignal.seq += 1;
    thermalSignal.level = level;
    thermalSignal.status = snap.status;
    thermalSignal.headroom = snap.headroom;
    console.info('[NYC-Mon/perf] thermal', {
      status: snap.status,
      headroom: snap.headroom === null ? 'n/a' : Number(snap.headroom.toFixed(2)),
      forecast: snap.headroomForecast === null ? 'n/a' : Number(snap.headroomForecast.toFixed(2)),
      level,
    });
  };
  void poll();
  const timer = setInterval(() => void poll(), intervalMs);
  return () => {
    disposed = true;
    clearInterval(timer);
  };
}
