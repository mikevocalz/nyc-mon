import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { Canvas, type CanvasRef, type RNCanvasContext } from 'react-native-webgpu';
import type { AndroidSurfaceType, ThreeSurfaceHandle } from './types';
import { WORLD_PERF_GPU_TIMESTAMPS } from './gpu-timestamps';
import { observeSurfacePresentation } from './surface-presentation-probe';
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
  const probe = useRef<ReturnType<typeof observeSurfacePresentation> | null>(null);
  useEffect(() => () => { probe.current?.dispose(); probe.current = null; }, []);
  useImperativeHandle(ref, () => ({
    createRenderer: (THREE, { device, rendererParams }) => {
      const context = canvasRef.current?.getContext('webgpu');
      if (!context?.canvas) throw new Error('[ThreeCanvas] react-native-webgpu context is not ready');
      probe.current?.dispose(); probe.current = null;
      contextRef.current = context;
      if (WORLD_PERF_GPU_TIMESTAMPS) {
        try {
        probe.current = observeSurfacePresentation(context, {
          nativeSurface: () => canvasRef.current!.getNativeSurface(), now: () => performance.now(),
          log: sample => console.info('[ThreeCanvas] native surface', sample),
          onError: error => console.warn('[ThreeCanvas] native surface probe failed.', error),
        });
        } catch (error) { console.warn('[ThreeCanvas] native surface probe unavailable.', error); }
      }
      return new THREE.WebGPURenderer({
        antialias: true,
        // The native canvas is DOM-shaped enough for three; its types are not.
        canvas: context.canvas as unknown as HTMLCanvasElement,
        context,
        ...(device ? { device } : {}),
        ...rendererParams,
      });
    },
    present: () => {
      const context = contextRef.current;
      if (!context) return;
      // The probe observes the texture the renderer already acquired; it never
      // calls getCurrentTexture or present itself.
      probe.current?.presentAttempt();
      context.present();
    },
    isReady: () => {
      const canvas = canvasRef.current?.getContext('webgpu')?.canvas as { width?: number; height?: number } | undefined;
      return typeof canvas?.width === 'number' && canvas.width > 0 && typeof canvas.height === 'number' && canvas.height > 0;
    },
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
  return <Canvas ref={canvasRef} android={{ backingView: androidSurfaceType, opaque: false }} style={{ flex: 1 }} />;
}
