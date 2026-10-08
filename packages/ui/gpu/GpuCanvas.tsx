'use client';

import { useEffect, useImperativeHandle, useRef } from 'react';
import { PixelRatio } from 'react-native';
import { twMerge } from 'tailwind-merge';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import { useInstanceStore, useStore } from '../use-instance-store';
import { useLayoutSize } from '../use-layout-size';
import { View } from '../tw';
import { useGpuState } from './gpu-store';
import type { GpuCanvasProps, GpuCanvasRef, GpuScene } from './types';

interface Runtime<P> {
  scene: GpuScene<P> | null;
  context: (GPUCanvasContext & { present?: () => void }) | null;
  params: P;
  running: boolean;
  time: number;
  last: number;
  width: number;
  height: number;
  pixelRatio: number;
  reducedMotion: boolean;
  queued: boolean;
}

/**
 * A WebGPU surface with one API on web and native.
 *
 * Web draws into a canvas element through react-native-webgpu's web build;
 * native draws into its Dawn-backed Canvas view. Both get the shared TypeGPU
 * root, so a scene written once runs on both. The surface fills its parent,
 * tracks layout size and device pixel ratio, stops its frame loop under
 * reduced motion (still drawing one frame), and renders `fallback` whenever
 * WebGPU is missing or the scene throws.
 *
 * Frames run on the JS thread through requestAnimationFrame. That suits
 * backgrounds and decorative effects; a scene that needs UI-thread frames
 * should drive react-native-webgpu from a worklet directly.
 */
export function GpuCanvas<P>({
  setup,
  params,
  fallback = null,
  forceFallback = false,
  paused = false,
  maxPixelRatio = 2,
  accessibilityLabel,
  className,
  onSupportChange,
  ref,
}: GpuCanvasProps<P>) {
  const gpu = useGpuState();
  const reducedMotion = useReducedMotion();
  const failure = useInstanceStore(() => ({ failed: false }));
  const failed = useStore(failure, (s) => s.failed);
  const { size, onLayout } = useLayoutSize({ width: 0, height: 0 });
  const canvasRef = useRef<GpuCanvasRef>(null);
  const runtime = useRef<Runtime<P>>(null);
  runtime.current ??= {
    scene: null,
    context: null,
    params,
    running: false,
    time: 0,
    last: 0,
    width: 0,
    height: 0,
    pixelRatio: 1,
    reducedMotion,
    queued: false,
  };

  const active = !forceFallback && !failed && gpu.support === 'supported' && gpu.root !== null && gpu.module !== null;
  const running = active && !paused && !reducedMotion;
  const hasSize = size.width > 0 && size.height > 0;

  // Draws one frame. Advances the clock only while the loop runs, so a
  // paused or reduced-motion canvas redraws the same moment.
  const draw = () => {
    const rt = runtime.current!;
    rt.queued = false;
    if (!rt.scene || !rt.context) return;
    const now = performance.now();
    let delta = 0;
    if (rt.running) {
      // Clamp so a backgrounded tab doesn't jump the scene forward.
      delta = rt.last ? Math.min((now - rt.last) / 1000, 0.1) : 0;
      rt.time += delta;
      rt.last = now;
    }
    try {
      rt.scene.render(
        { time: rt.time, delta, width: rt.width, height: rt.height, pixelRatio: rt.pixelRatio, reducedMotion: rt.reducedMotion },
        rt.params,
      );
      // Native presents explicitly after submit; react-native-webgpu's web
      // context exposes the same call as a no-op.
      rt.context.present?.();
    } catch (error) {
      console.error('[GpuCanvas] render failed, switching to the fallback.', error);
      failure.setState({ failed: true });
    }
  };

  const invalidate = () => {
    const rt = runtime.current!;
    if (rt.running || rt.queued) return;
    rt.queued = true;
    requestAnimationFrame(draw);
  };

  useImperativeHandle(ref, () => ({ invalidate }));

  useEffect(() => {
    if (gpu.support === 'pending' && !forceFallback) return;
    onSupportChange?.(active);
  }, [active, forceFallback, gpu.support, onSupportChange]);

  // Latest params and motion setting for the next frame; a still canvas
  // redraws so prop changes show up without the loop running.
  useEffect(() => {
    const rt = runtime.current!;
    rt.params = params;
    rt.reducedMotion = reducedMotion;
    invalidate();
  });

  // Build the scene once per canvas, root and setup function.
  const { root, format } = gpu;
  useEffect(() => {
    if (!active || !hasSize || !root || !format) return;
    const rt = runtime.current!;
    let scene: GpuScene<P> | null = null;
    let disposed = false;
    const fail = (error: unknown) => {
      console.error('[GpuCanvas] setup failed, switching to the fallback.', error);
      failure.setState({ failed: true });
    };
    const attach = (built: GpuScene<P>) => {
      if (disposed) {
        built.dispose?.();
        return;
      }
      scene = built;
      rt.scene = built;
      invalidate();
    };
    try {
      const context = canvasRef.current?.getContext('webgpu');
      if (!context) return;
      context.configure({ device: root.device, format, alphaMode: 'premultiplied' });
      rt.context = context;
      const built = setup({ root, device: root.device, context, format, invalidate });
      if (built instanceof Promise) built.then(attach, (error: unknown) => !disposed && fail(error));
      else attach(built);
    } catch (error) {
      fail(error);
      return;
    }
    return () => {
      disposed = true;
      scene?.dispose?.();
      rt.scene = null;
      rt.context?.unconfigure();
      rt.context = null;
    };
    // invalidate and failure are stable per instance; hasSize gates the first build only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, hasSize, root, format, setup]);

  // Track layout size and pixel ratio; resize the drawing buffer to match.
  useEffect(() => {
    if (!active || !hasSize) return;
    const rt = runtime.current!;
    const pixelRatio = Math.min(PixelRatio.get(), maxPixelRatio);
    rt.width = size.width;
    rt.height = size.height;
    rt.pixelRatio = pixelRatio;
    const canvas = rt.context?.canvas as { width: number; height: number } | undefined;
    if (canvas) {
      canvas.width = Math.max(1, Math.round(size.width * pixelRatio));
      canvas.height = Math.max(1, Math.round(size.height * pixelRatio));
    }
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, hasSize, size.width, size.height, maxPixelRatio, gpu.root]);

  // The frame loop. Stops under reduced motion or `paused`.
  useEffect(() => {
    const rt = runtime.current!;
    rt.running = running;
    if (!running) {
      rt.last = 0;
      invalidate();
      return;
    }
    let frame = 0;
    const tick = () => {
      draw();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      rt.running = false;
      rt.last = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  if (!active) {
    if (gpu.support === 'pending' && !forceFallback && !failed) {
      // Still checking: keep the slot measured but empty, so the fallback
      // never flashes in before a working GPU canvas.
      return <View aria-hidden className={twMerge('pointer-events-none absolute inset-0', className)} onLayout={onLayout} />;
    }
    return <>{fallback}</>;
  }

  const { Canvas } = gpu.module!;
  return (
    <View
      className={twMerge('pointer-events-none absolute inset-0', className)}
      onLayout={onLayout}
      aria-hidden={accessibilityLabel ? undefined : true}
      aria-label={accessibilityLabel}
      role={accessibilityLabel ? 'img' : undefined}
    >
      <Canvas ref={canvasRef} />
    </View>
  );
}
