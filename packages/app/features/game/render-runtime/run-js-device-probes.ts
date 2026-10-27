// The `shared` and `skiatex` probes on the React Native (JS) runtime, where
// gpu-store's device and react-native-skia's `SkiaApi` global both live.
// game-render.ts runs the same probes on the worklet render runtime. RN
// runtime only: @acme/ui/gpu pulls in react-native, so it is imported on
// call, and the worklet runtime never loads this file. device-probes.ts
// loads only when a probe runs (physical-graph.ts).
import type { ProbeRecord } from './device-probes.ts';
import { loadDeviceProbes } from '../physical-graph.ts';
import { WORLD_DEVICE_PROBE } from '../world/physical-look.ts';
import { readInteropGlobals, WORLD_PHYSICAL, type InteropGlobals } from './shared-device.ts';

export interface JsProbeDeps {
  /** gpu-store: settles the device, then reports it with its source. */
  gpu: () => Promise<{ device: GPUDevice; source: string } | null>;
  globals: () => InteropGlobals;
  log: (line: string) => void;
}

const defaultDeps: JsProbeDeps = {
  gpu: async () => {
    const { ensureGpu, readGpuDevice } = await import('@acme/ui/gpu');
    await ensureGpu();
    return readGpuDevice();
  },
  globals: () => readInteropGlobals(),
  log: (line) => console.log(line),
};

/**
 * Runs the probe EXPO_PUBLIC_WORLD_PROBE names, once, when
 * EXPO_PUBLIC_WORLD_PHYSICAL is on. `pipecache` is timed on the render path
 * (game-render.ts), so it is not run here. Returns the record it logged.
 */
export async function runJsDeviceProbe(
  probe = WORLD_PHYSICAL ? WORLD_DEVICE_PROBE : null,
  deps: JsProbeDeps = defaultDeps,
): Promise<ProbeRecord | null> {
  if (probe !== 'shared' && probe !== 'skiatex') return null;
  const { formatProbeRecord, probeShared, probeSkiaTex, webgpuSampler } = loadDeviceProbes();
  const gpu = await deps.gpu();
  const { skia } = deps.globals();
  const device = gpu?.device ?? null;
  const record = probe === 'shared'
    ? await probeShared({ runtime: 'js', device, deviceSource: gpu?.source ?? 'none', skia })
    : await probeSkiaTex({ runtime: 'js', device, skia, sample: device ? webgpuSampler(device) : async () => [] });
  deps.log(`[GameRender] js runtime: ${formatProbeRecord(record)}`);
  return record;
}
