// ADPF PerformanceHintManager session (performance-pass PR5.2). Opt-in:
// EXPO_PUBLIC_WORLD_ADPF=1 — default off.
//
// Creates an ADPF session over the render workload's threads. Two pieces of
// thread identification, because the render thread differs by backend path:
// - JS path: the caller's own tid is captured natively at startHintSession
//   (the JS thread does update+render+present there), and reportFrameWork
//   feeds the probe's measured cpuMs back per frame via onFrameTiming.
// - Worklet path: 'nyc-mon-render' is resolved by /proc/self/task comm scan;
//   per-frame reporting is unavailable there (expoV2 modules live on the RN
//   runtime, not the worklet runtime), so the session carries the tid and
//   target only. 'RenderThread' is included on both paths for the UI-side
//   compositor work.
import { gamePerf } from '@acme/ui/game-perf';
import { parseSkyRigFlag } from '../world/sky-rig.ts';

export const EXPERIMENTAL_WORLD_ADPF = parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_ADPF);

const HINT_THREAD_NAMES = ['nyc-mon-render', 'RenderThread'];
let active = false;

export function startHintSession(targetFps = 60): boolean {
  const native = gamePerf();
  if (!native) return false;
  const targetNanos = 1e9 / targetFps;
  const rec = native.startHintSession(targetNanos, HINT_THREAD_NAMES);
  active = rec.active;
  console.info('[NYC-Mon/perf] hint session', {
    active: rec.active,
    reason: rec.reason,
    tids: rec.tids,
    targetMs: Number((targetNanos / 1e6).toFixed(2)),
  });
  return rec.active;
}

/** Feed one frame's measured CPU-side work (ms) to the live session. */
export function reportFrameWork(cpuMs: number): void {
  if (active) gamePerf()?.reportWorkDuration(cpuMs * 1e6);
}

export function stopHintSession(): void {
  if (!active) return;
  gamePerf()?.stopHintSession();
  active = false;
}
