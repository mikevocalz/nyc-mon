import { useImperativeHandle, useRef, type Ref } from 'react';
import { Canvas, type CanvasRef, type RNCanvasContext } from 'react-native-webgpu';
import type { ThreeSurfaceHandle } from './types';

/**
 * Native: react-native-webgpu's Dawn-backed Canvas. Its `getContext('webgpu')`
 * context carries a DOM-like `canvas` (width, height, clientWidth, no-op event
 * stubs), which is all WebGPURenderer needs. Frames are presented explicitly
 * after each render. There is no WebGL2 backend on native.
 */
export function ThreeSurface({ ref }: { ref?: Ref<ThreeSurfaceHandle> }) {
  const canvasRef = useRef<CanvasRef>(null);
  const contextRef = useRef<RNCanvasContext | null>(null);
  useImperativeHandle(ref, () => ({
    createRenderer: (THREE, { device }) => {
      const context = canvasRef.current?.getContext('webgpu');
      if (!context) throw new Error('[ThreeCanvas] react-native-webgpu context is not ready');
      contextRef.current = context;
      return new THREE.WebGPURenderer({
        antialias: true,
        // The native canvas is DOM-shaped enough for three; its types are not.
        canvas: context.canvas as unknown as HTMLCanvasElement,
        context,
        ...(device ? { device } : {}),
      });
    },
    present: () => contextRef.current?.present(),
  }));
  // Transparent over the views behind it (TextureView on Android), so the
  // parent's opacity applies. GPU surface: the Canvas takes a style, not a className.
  return <Canvas ref={canvasRef} opaque={false} style={{ flex: 1 }} />;
}
