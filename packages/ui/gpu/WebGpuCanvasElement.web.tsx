'use client';

import { createElement, useImperativeHandle, type Ref } from 'react';
import { useInstanceStore } from '../use-instance-store';
import type { GpuCanvasRef } from './types';

/**
 * The web GPU surface: a plain canvas element that fills its parent, exposing
 * the same `getContext('webgpu')` handle as react-native-webgpu's native
 * Canvas. A canvas is the one non-semantic host the UI layer allows; it is
 * created with createElement because no semantic wrapper exists for it.
 *
 * react-native-webgpu's own web build is not used here: Next's Turbopack
 * resolves the relative imports inside its compiled lib/ to the native
 * codegen specs instead of the .web.js files.
 */
export function WebGpuCanvasElement({ ref }: { ref?: Ref<GpuCanvasRef> }) {
  // The DOM node lives in a per-instance store, written when React attaches
  // it and read only from the imperative handle, never during render.
  const node = useInstanceStore<{ canvas: HTMLCanvasElement | null }>(() => ({ canvas: null }));
  useImperativeHandle(ref, () => ({
    getContext: (kind: 'webgpu') => {
      const context = node.getState().canvas?.getContext(kind) ?? null;
      // Web presents on its own; present() keeps the native call shape.
      return context ? Object.assign(context, { present: () => {} }) : null;
    },
  }));
  // GPU surface: sized by its parent, so the style is fixed geometry, not a token.
  const attach = (canvas: HTMLCanvasElement | null) => node.setState({ canvas });
  return createElement('canvas', {
    ref: attach,
    'data-gpu-surface': 'webgpu',
    style: { display: 'block', width: '100%', height: '100%' },
  });
}
