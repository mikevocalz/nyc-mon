'use client';
import { useEffect } from 'react';
import { tgpu, type TgpuRoot } from 'typegpu';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { loadWebGpu } from './load-webgpu';
import type { GpuSupport, WebGpuModule } from './types';

interface GpuState {
  support: GpuSupport;
  root: TgpuRoot | null;
  format: GPUTextureFormat | null;
  module: WebGpuModule | null;
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
}));

let starting: Promise<void> | null = null;

async function start(): Promise<void> {
  try {
    const module = await loadWebGpu();
    const adapter = module ? await navigator.gpu.requestAdapter() : null;
    if (!module || !adapter) {
      gpuStore.setState({ support: 'unsupported' });
      return;
    }
    const device = await adapter.requestDevice();
    const root = tgpu.initFromDevice({ device });
    gpuStore.setState({
      support: 'supported',
      root,
      format: navigator.gpu.getPreferredCanvasFormat(),
      module,
    });
    // A lost device (driver reset, tab backgrounded too long on some
    // mobiles) invalidates every resource. Drop the root and build a new
    // one; canvases rebuild their scenes when the root changes.
    void device.lost.then((info) => {
      if (gpuStore.getState().root !== root) return;
      gpuStore.setState({ support: 'pending', root: null });
      starting = null;
      if (info.reason !== 'destroyed') ensureGpu();
    });
  } catch (error) {
    console.warn('[GpuCanvas] WebGPU unavailable, using the fallback renderer.', error);
    gpuStore.setState({ support: 'unsupported' });
  }
}

/** Start the support check and device creation once. Safe to call repeatedly. */
export function ensureGpu(): Promise<void> {
  starting ??= start();
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
