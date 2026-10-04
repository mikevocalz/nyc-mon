import { createElement, type Ref } from 'react';
import { Canvas, type CanvasRef } from 'react-native-webgpu';
import type { GpuCanvasRef, WebGpuModule } from './types';

// react-native-webgpu's Canvas, filling its parent, transparent over the views behind.
// GPU surface: the Canvas takes a style, not a className.
function NativeGpuCanvas({ ref }: { ref?: Ref<GpuCanvasRef> }) {
  return createElement(Canvas, { ref: ref as Ref<CanvasRef>, opaque: false, style: { flex: 1 } });
}

/**
 * Native: importing react-native-webgpu installs the Dawn-backed
 * `navigator.gpu` (its main entry calls the TurboModule's install()). The
 * import is static so that happens before the first support check.
 */
export async function loadWebGpu(): Promise<WebGpuModule | null> {
  if (typeof navigator === 'undefined' || !navigator.gpu) return null;
  return { Canvas: NativeGpuCanvas };
}
