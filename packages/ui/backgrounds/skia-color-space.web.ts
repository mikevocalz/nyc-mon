'use client';
import { useEffect, useRef, type RefObject } from 'react';

/** Frames to wait for react-native-skia to create the canvas's WebGL context. */
const MAX_WAIT_FRAMES = 120;

/**
 * react-native-skia 3.0.2 on web renders into an sRGB CanvasKit surface but
 * tags the WebGL drawing buffer "display-p3", so the browser reads every
 * sRGB value as P3 and the fallback comes out oversaturated next to the
 * WebGPU path (leaf #3FAE3A showed as #00B11D). This puts the buffer back to
 * sRGB once the context exists, then asks for a redraw because changing the
 * colour space clears the buffer.
 *
 * It only touches a context that is already there: `width > 0` means
 * react-native-skia has created the context and sized the canvas, so
 * getContext returns its context instead of creating one.
 */
export function useSrgbDrawingBuffer(host: RefObject<unknown>, redraw: () => void) {
  const latest = useRef(redraw);
  latest.current = redraw;
  useEffect(() => {
    let frame = 0;
    let tries = 0;
    const fix = () => {
      const node = host.current as HTMLElement | null;
      const canvas = node?.querySelector?.('canvas');
      if (canvas && canvas.width > 0) {
        const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
        if (gl && gl.drawingBufferColorSpace !== 'srgb') {
          gl.drawingBufferColorSpace = 'srgb';
          latest.current();
        }
        return;
      }
      if (++tries < MAX_WAIT_FRAMES) frame = requestAnimationFrame(fix);
    };
    frame = requestAnimationFrame(fix);
    return () => cancelAnimationFrame(frame);
  }, [host]);
}
