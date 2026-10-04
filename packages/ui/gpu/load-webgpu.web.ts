import type { WebGpuModule } from './types';
import { WebGpuCanvasElement } from './WebGpuCanvasElement.web';

/**
 * Web: WebGPU is a browser API, so support is just `navigator.gpu`. The
 * surface is a canvas element (WebGpuCanvasElement). Nothing here touches
 * `window` at import time, so the module is safe during server rendering.
 */
export async function loadWebGpu(): Promise<WebGpuModule | null> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) return null;
  return { Canvas: WebGpuCanvasElement };
}
