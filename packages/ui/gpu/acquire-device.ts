/// <reference types="@webgpu/types" />
// Where the app's one GPUDevice comes from. Pure (no React, no platform
// import), so node tests drive it with fakes and react-native-webgpu's mock.
//
// Two sources:
// - `own`: requestAdapter() + requestDevice(), the default path.
// - `shared`: Skia's Graphite device, wrapped by react-native-webgpu's
//   importDevice(Skia.getNativeDevice()) (react-native-webgpu 0.16.0
//   src/importDevice.ts `importDevice`; react-native-skia 3.6.1
//   lib/typescript/src/skia/types/Skia.d.ts `getNativeDevice`). Taken only
//   under EXPO_PUBLIC_WORLD_PHYSICAL, so TypeGPU, three and Skia draw on one
//   device (docs/adr/0026-one-gpu-device.md, gate G9).

/** Same truthy table as parseSkyRigFlag (packages/app/features/game/world/sky-rig.ts); @acme/ui cannot import the app. */
const TRUTHY_FLAG = new Set(['1', 'true', 'on', 'yes']);

export function parseDeviceFlag(value: string | undefined | null): boolean {
  return value != null && TRUTHY_FLAG.has(value.trim().toLowerCase());
}

/** Opt-in, default off: the slop-grade-city master flag (docs/plans/slop-grade-city-prompt.md §3). */
export const SHARED_GPU_DEVICE = parseDeviceFlag(process.env.EXPO_PUBLIC_WORLD_PHYSICAL);

export type GpuDeviceSource = 'own' | 'shared';

export interface AcquiredDevice {
  device: GPUDevice;
  source: GpuDeviceSource;
  /** Why the shared device was not used, when it was asked for and the own device stands in. */
  sharedError: string | null;
}

export interface AcquireDeviceDeps {
  /** Wraps Skia's Graphite device. Throws where there is none (web, Jest mock, a Skia v2 build). */
  importShared: () => Promise<GPUDevice>;
  requestAdapter: () => Promise<GPUAdapter | null>;
}

/**
 * The shared device first; on any failure the app's own device, with the
 * reason kept so the probe and the log can say which device three and
 * TypeGPU ended up on. G9 keeps separate devices when sharing fails, so a
 * failed import is a reported fallback, never a dead canvas. Returns null
 * when neither source yields a device (the `unsupported` case).
 */
export async function acquireSharedOrOwnDevice(deps: AcquireDeviceDeps): Promise<AcquiredDevice | null> {
  let sharedError: string;
  try {
    const device = await deps.importShared();
    return { device, source: 'shared', sharedError: null };
  } catch (error) {
    sharedError = error instanceof Error ? error.message : String(error);
  }
  const adapter = await deps.requestAdapter();
  if (!adapter) return null;
  return { device: await adapter.requestDevice(), source: 'own', sharedError };
}
