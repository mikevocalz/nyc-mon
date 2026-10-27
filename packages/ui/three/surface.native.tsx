import { useImperativeHandle, useRef, type Ref } from 'react';
import { Canvas, type CanvasRef, type RNCanvasContext } from 'react-native-webgpu';
import type { AndroidSurfaceType, ThreeSurfaceHandle } from './types';
import type { NativeCanvasContext } from './worklet-host';

/**
 * Native: react-native-webgpu's Dawn-backed Canvas. Its `getContext('webgpu')`
 * context carries a DOM-like `canvas` (width, height, clientWidth, no-op event
 * stubs), which is all WebGPURenderer needs. Frames are presented explicitly
 * after each render. There is no WebGL2 backend on native.
 */
export function ThreeSurface({ ref, androidSurfaceType }: { ref?: Ref<ThreeSurfaceHandle>; androidSurfaceType?: AndroidSurfaceType }) {
  const canvasRef = useRef<CanvasRef>(null);
  const contextRef = useRef<RNCanvasContext | null>(null);
  useImperativeHandle(ref, () => ({
    createRenderer: (THREE, { device, rendererParams }) => {
      const context = canvasRef.current?.getContext('webgpu');
      if (!context) throw new Error('[ThreeCanvas] react-native-webgpu context is not ready');
      contextRef.current = context;
      return new THREE.WebGPURenderer({
        antialias: true,
        // The native canvas is DOM-shaped enough for three; its types are not.
        canvas: context.canvas as unknown as HTMLCanvasElement,
        context,
        ...(device ? { device } : {}),
        ...rendererParams,
      });
    },
    present: () => contextRef.current?.present(),
    // Worklet render mode: the context goes to the render runtime, which builds the renderer and presents.
    getContext: () => {
      const context = canvasRef.current?.getContext('webgpu') ?? null;
      contextRef.current = context;
      return context as unknown as NativeCanvasContext | null;
    },
  }));
  // Transparent over the views behind it (TextureView on Android by default),
  // so the parent's opacity applies. `androidSurfaceType` can instead pick the
  // AHB-pool HardwareBufferView (mailbox present — never stalls the producer
  // on the window queue) or a SurfaceView; see AndroidSurfaceType. GPU surface:
  // the Canvas takes a style, not a className.
  return <Canvas ref={canvasRef} opaque={false} android={{ surfaceType: androidSurfaceType }} style={{ flex: 1 }} />;
}
