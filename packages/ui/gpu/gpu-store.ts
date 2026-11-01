'use client';
import { useEffect } from 'react';
import type { TgpuRoot } from 'typegpu';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { acquireSharedOrOwnDevice, SHARED_GPU_DEVICE, type GpuDeviceSource } from './acquire-device';
import { loadWebGpu } from './load-webgpu';
import type { GpuSupport, WebGpuModule } from './types';

interface GpuState {
  support: GpuSupport;
  root: TgpuRoot | null;
  format: GPUTextureFormat | null;
  module: WebGpuModule | null;
  /** Which device `root` sits on: `shared` is Skia's Graphite device (EXPO_PUBLIC_WORLD_PHYSICAL only). */
  deviceSource: GpuDeviceSource | null;
}

/**
 * One adapter, one device, one TypeGPU root for the whole app: TypeGPU
 * resources from different roots can't interact, and every extra device
 * costs memory. Module-level zustand store (repo rule: no React useState);
 * the server snapshot is `pending`.
 */
export const gpuStore = createStore<GpuState>(() => ({
  support: 'pending',
  root: null,
  format: null,
  module: null,
  deviceSource: null,
}));

let starting: Promise<void> | null = null;

async function start(): Promise<void> {
  try {
    const module = await loadWebGpu();
    const adapter = module ? await navigator.gpu.requestAdapter() : null;
    if (!module || !adapter) {
      // Distinguish "no navigator.gpu" from "adapter request resolved null":
      // the unsupported state is terminal, so the cause must be in the log.
      console.warn(
        '[GpuCanvas] WebGPU unavailable, using the fallback renderer.',
        !module ? 'navigator.gpu is not installed' : 'requestAdapter() returned null',
      );
      gpuStore.setState({ support: 'unsupported' });
      return;
    }
    // TypeGPU (~110 KB gzip) loads only once a device exists: every page
    // that mounts a canvas would otherwise ship it, WebGPU or not.
    const [device, { tgpu }] = await Promise.all([adapter.requestDevice(), import('typegpu')]);
    adopt(tgpu.initFromDevice({ device }), module, 'own');
  } catch (error) {
    console.warn('[GpuCanvas] WebGPU unavailable, using the fallback renderer.', error);
    gpuStore.setState({ support: 'unsupported' });
  }
}

function adopt(root: TgpuRoot, module: WebGpuModule, deviceSource: GpuDeviceSource): void {
  gpuStore.setState({
    support: 'supported',
    root,
    format: navigator.gpu.getPreferredCanvasFormat(),
    module,
    deviceSource,
  });
  // A lost device (driver reset, tab backgrounded too long on some
  // mobiles) invalidates every resource. Drop the root and build a new
  // one; canvases rebuild their scenes when the root changes.
  void root.device.lost.then((info) => {
    if (gpuStore.getState().root !== root) return;
    if (deviceSource === 'shared') {
      // React Native Skia 3.6.1 treats the loss of its device as fatal, so a
      // fresh importDevice() would wrap the same dead device and loop here
      // (react-native-webgpu docs, integrations/react-native-skia.mdx,
      // "Device loss"). Skia 3.7.3 replaces the device instead (G10, ADR 0026).
      console.warn('[GpuCanvas] the shared Skia device was lost; WebGPU stays off until restart.', info.message);
      gpuStore.setState({ support: 'unsupported', root: null, deviceSource: null });
      return;
    }
    gpuStore.setState({ support: 'pending', root: null });
    starting = null;
    if (info.reason !== 'destroyed') ensureGpu();
  });
}

/**
 * EXPO_PUBLIC_WORLD_PHYSICAL: TypeGPU takes Skia's Graphite device through
 * typegpu 0.12.7 `tgpu.initFromDevice` (core/root/init.d.ts; the root does
 * not own the device, so `root.destroy()` leaves Skia's device alone). three
 * then gets the same device from `root.device` on both render paths
 * (ThreeCanvas.tsx, WorkletThreeCanvas.tsx). If Skia's device cannot be
 * imported, the app's own device stands in and the warning says why.
 */
async function startShared(): Promise<void> {
  try {
    const module = await loadWebGpu();
    if (!module) {
      console.warn('[GpuCanvas] WebGPU unavailable, using the fallback renderer.', 'navigator.gpu is not installed');
      gpuStore.setState({ support: 'unsupported' });
      return;
    }
    const [acquired, { tgpu }] = await Promise.all([
      acquireSharedOrOwnDevice({
        importShared: async () => (await import('./shared-device-source')).importSharedDevice(),
        requestAdapter: () => navigator.gpu.requestAdapter(),
      }),
      import('typegpu'),
    ]);
    if (!acquired) {
      console.warn('[GpuCanvas] WebGPU unavailable, using the fallback renderer.', 'requestAdapter() returned null');
      gpuStore.setState({ support: 'unsupported' });
      return;
    }
    if (acquired.sharedError) console.warn('[GpuCanvas] Skia device not shared, using an own device:', acquired.sharedError);
    adopt(tgpu.initFromDevice({ device: acquired.device }), module, acquired.source);
  } catch (error) {
    console.warn('[GpuCanvas] WebGPU unavailable, using the fallback renderer.', error);
    gpuStore.setState({ support: 'unsupported' });
  }
}

/** The app's device and where it came from, once `ensureGpu` has settled; null before then or without WebGPU. */
export function readGpuDevice(): { device: GPUDevice; source: GpuDeviceSource } | null {
  const { root, deviceSource } = gpuStore.getState();
  return root && deviceSource ? { device: root.device, source: deviceSource } : null;
}

/** Start the support check and device creation once. Safe to call repeatedly. */
export function ensureGpu(): Promise<void> {
  starting ??= SHARED_GPU_DEVICE ? startShared() : start();
  return starting;
}

/**
 * Whether WebGPU works here: `pending`, then `supported` or `unsupported`.
 * Starts the check on first use. Callers that need to choose a renderer
 * before mounting a GpuCanvas can branch on this.
 */
export function useGpuSupport(): GpuSupport {
  useEffect(() => {
    void ensureGpu();
  }, []);
  return useStore(gpuStore, (s) => s.support);
}

export function useGpuState() {
  useEffect(() => {
    void ensureGpu();
  }, []);
  return useStore(gpuStore);
}
