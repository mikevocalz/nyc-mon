// Which GPUDevice the Game world's WebGPURenderer runs on under
// EXPO_PUBLIC_WORLD_PHYSICAL (gate G9, docs/adr/0026-one-gpu-device.md).
//
// The device three gets today: gpu-store.ts makes one device for the TypeGPU
// root; ThreeCanvas.tsx and WorkletThreeCanvas.tsx (L49) pass `root.device`
// on, and worklet-host.ts (L223) hands it to game-render.ts as `args.device`.
// Under the flag gpu-store makes that root on Skia's Graphite device, so the
// handed device is already the shared one and nothing more happens here.
//
// When nothing is handed (WebGPU unsupported on the RN runtime, or a host
// that starts the render runtime before gpu-store settles), this runtime can
// still import Skia's device itself through the two JSI globals the packages
// install: `SkiaApi` (react-native-skia 3.6.1 src/skia/Skia.ts and
// NativeSetup.ts) and `RNWebGPU` (react-native-webgpu 0.16.0
// src/importDevice.ts calls `RNWebGPU.importDevice(pointer)`). Reading the
// globals instead of importing the packages keeps react-native off the
// worklet render runtime (game-render.ts header). Whether either global
// exists on that runtime is a Phase 0 probe question, not an assumption.
//
// Worklet-safe: imports nothing that imports react-native.
import { EXPERIMENTAL_WORLD_PHYSICAL } from '../world/physical-look.ts';
import type { SkiaInterop } from './skia-texture-bridge.ts';

/** The slop-grade-city master flag (world/physical-look.ts), default off. */
export const WORLD_PHYSICAL = EXPERIMENTAL_WORLD_PHYSICAL;

interface RnWebGpuGlobal {
  importDevice(pointer: bigint): GPUDevice;
}

export interface InteropGlobals {
  skia: SkiaInterop | null;
  webgpu: RnWebGpuGlobal | null;
}

/** The Skia and react-native-webgpu JSI globals, when this runtime has them. */
export function readInteropGlobals(target: object = globalThis): InteropGlobals {
  const g = target as { SkiaApi?: Partial<SkiaInterop>; RNWebGPU?: Partial<RnWebGpuGlobal> };
  const skia = g.SkiaApi && typeof g.SkiaApi.getNativeDevice === 'function' ? (g.SkiaApi as SkiaInterop) : null;
  const webgpu = g.RNWebGPU && typeof g.RNWebGPU.importDevice === 'function' ? (g.RNWebGPU as RnWebGpuGlobal) : null;
  return { skia, webgpu };
}

/**
 * - `shared`: Skia's device, handed by gpu-store or imported on this runtime.
 * - `own`: an app device that is not Skia's.
 * - `unknown`: a device was handed but the host did not say which.
 * - `three`: nothing handed or imported; three requests its own device.
 */
export type RendererDeviceSource = 'shared' | 'own' | 'unknown' | 'three';

export interface RendererDevice {
  device: GPUDevice | null;
  source: RendererDeviceSource;
  /** One line for the runtime trace. */
  note: string;
}

/**
 * The device for `new WebGPURenderer({ device })` under the flag. A handed
 * device always wins, so three keeps sharing TypeGPU's root as it does today.
 */
export function resolveRendererDevice(
  handed: GPUDevice | null,
  handedSource: 'shared' | 'own' | null | undefined,
  globals: InteropGlobals,
): RendererDevice {
  if (handed) {
    const source = handedSource ?? 'unknown';
    return { device: handed, source, note: `handed by the RN runtime (gpu-store root.device, ${source})` };
  }
  if (!globals.skia || !globals.webgpu) {
    const missing = [!globals.skia && 'SkiaApi', !globals.webgpu && 'RNWebGPU'].filter(Boolean).join(' and ');
    return { device: null, source: 'three', note: `nothing handed; ${missing} not installed on this runtime` };
  }
  try {
    const device = globals.webgpu.importDevice(globals.skia.getNativeDevice());
    return { device, source: 'shared', note: 'imported on this runtime: RNWebGPU.importDevice(SkiaApi.getNativeDevice())' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { device: null, source: 'three', note: `nothing handed; importDevice failed: ${message}` };
  }
}
