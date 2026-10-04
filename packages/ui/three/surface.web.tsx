'use client';

import { createElement, useImperativeHandle, type Ref } from 'react';
import { useInstanceStore } from '../use-instance-store';
import type { ThreeSurfaceHandle } from './types';

/**
 * Web: a canvas element that fills its parent. WebGPURenderer gets the
 * element itself and opens a `webgpu` or `webgl2` context on it, so a backend
 * change needs a fresh element (ThreeCanvas keys the surface by backend).
 * A canvas is the one non-semantic host the UI layer allows; no semantic
 * wrapper exists for it, hence createElement.
 */
export function ThreeSurface({ ref }: { ref?: Ref<ThreeSurfaceHandle> }) {
  // The DOM node lives in a per-instance store, written when React attaches
  // it and read only from the imperative handle, never during render.
  const node = useInstanceStore<{ canvas: HTMLCanvasElement | null }>(() => ({ canvas: null }));
  useImperativeHandle(ref, () => ({
    createRenderer: (THREE, { backend, device }) => {
      const canvas = node.getState().canvas;
      if (!canvas) throw new Error('[ThreeCanvas] canvas is not attached yet');
      return new THREE.WebGPURenderer({
        canvas,
        antialias: true,
        forceWebGL: backend === 'webgl2',
        // Share the app's one WebGPU device (the TypeGPU root's) instead of
        // opening another. three never destroys a device it was handed.
        ...(backend === 'webgpu' && device ? { device } : {}),
      });
    },
    present: () => {},
  }));
  const attach = (canvas: HTMLCanvasElement | null) => node.setState({ canvas });
  return createElement('canvas', {
    ref: attach,
    'data-three-surface': 'true',
    // GPU surface: sized by its parent; fixed geometry, not a theme token.
    style: { display: 'block', width: '100%', height: '100%' },
  });
}
