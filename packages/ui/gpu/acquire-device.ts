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
 * What the app's own device asks for: every feature the adapter advertises —
 * compressed-format uploads (KTX2) validate against the device's features, not
 * the adapter's — and the adapter's limits. three r187 does the same when it
 * owns device creation (three.webgpu.js, WebGPUBackend init). Test doubles may
 * expose neither, so both read defensively. `label` names the source in GPU
 * traces (chrome://gpu, Dawn error text).
 */
export function ownDeviceDescriptor(adapter: GPUAdapter): GPUDeviceDescriptor {
  // for...in reaches GPUSupportedLimits' WebIDL attributes; spread and
  // Object.keys see none, which is why requiredLimits is not `adapter.limits`.
  const requiredLimits: Record<string, number> = {};
  const limits = (adapter.limits ?? {}) as unknown as Record<string, number>;
  for (const name in limits) requiredLimits[name] = limits[name]!;
  return {
    label: 'nyc-mon:own',
    requiredFeatures: (adapter.features ? [...adapter.features] : []) as GPUFeatureName[],
    requiredLimits,
  };
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
    const shared = await withTimeout(deps.importShared(), REQUEST_ADAPTER_TIMEOUT_MS);
    if (shared) return { device: shared, source: 'shared', sharedError: null };
    sharedError = 'importShared() timed out or returned no device';
  } catch (error) {
    sharedError = error instanceof Error ? error.message : String(error);
  }
  const adapter = await requestAdapterWithTimeout(deps.requestAdapter).catch(() => null);
  if (!adapter) return null;
  return { device: await requestDeviceWithFallback(adapter), source: 'own', sharedError };
}

/**
 * The full descriptor (every advertised feature and limit) buys the widest
 * device on capable GPUs — but a device can refuse it even though every entry
 * came from its own adapter (Dawn requestDevice rejects a requiredFeatures/
 * requiredLimits member it won't grant). Fall back to a bare requestDevice
 * before declaring the GPU unsupported — an adapterless failure must come
 * from requestAdapter returning null, not from a strict descriptor. Both
 * attempts are time-bounded: on wedged adapters requestDevice can stall
 * without settling, which previously left the app on a black canvas instead
 * of the 2D fallback (A12X iPad Pro, Dawn 157).
 */
const REQUEST_DEVICE_TIMEOUT_MS = 8000;
const REQUEST_ADAPTER_TIMEOUT_MS = 10000;

/**
 * Adapter requests can also stall without settling on a wedged Dawn backend
 * (same failure class as requestDevice — the canvas mounts while support is
 * `pending` and covers the app with a black view). Bounded for the same
 * reason: a hang must end at unsupported, not a frozen screen.
 */
export function requestAdapterWithTimeout(request: () => Promise<GPUAdapter | null>): Promise<GPUAdapter | null> {
  return withTimeout(request(), REQUEST_ADAPTER_TIMEOUT_MS);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p.then((v) => v as T | null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

export async function requestDeviceWithFallback(adapter: GPUAdapter): Promise<GPUDevice> {
  const wide = await withTimeout(adapter.requestDevice(ownDeviceDescriptor(adapter)), REQUEST_DEVICE_TIMEOUT_MS).catch(() => null);
  if (wide) return wide;
  const bare = await withTimeout(adapter.requestDevice(), REQUEST_DEVICE_TIMEOUT_MS);
  if (!bare) throw new Error('requestDevice() timed out or returned no device');
  return bare;
}
