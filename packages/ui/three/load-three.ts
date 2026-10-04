import type { Three } from './types';

let loading: Promise<Three> | null = null;

/**
 * three.js on its WebGPU entry (`three/webgpu`: WebGPURenderer, node
 * materials, and the WebGL2 backend it falls back to), loaded once on first
 * use so it stays out of the first bundle chunk on web.
 */
export function loadThree(): Promise<Three> {
  loading ??= import('three/webgpu');
  return loading;
}
