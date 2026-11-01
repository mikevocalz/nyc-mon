'use client';
// ThreeCanvas with `renderThread="worklet"`: the canvas lives here, on the JS
// side, and everything three.js does (renderer init, scene build, compile,
// update, render, present) runs on `workletHost`'s render runtime. This file
// keeps what only the JS side can do: layout size, the native surface, the
// on-screen/paused/reduced-motion gate, the fallback, and the handle.
//
// `load` and `params` are not used: they are JS-thread closures and do not
// cross runtimes. The host builds the scene and mirrors its own state.
import { useEffect, useImperativeHandle, useRef } from 'react';
import { PixelRatio } from 'react-native';
import { twMerge } from 'tailwind-merge';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import { useGpuState } from '../gpu/gpu-store';
import { useInstanceStore, useStore } from '../use-instance-store';
import { useLayoutSize } from '../use-layout-size';
import { View } from '../tw';
import { ThreeSurface } from './surface';
import type { ThreeCanvasProps, ThreeSurfaceHandle } from './types';
import type { WorkletRenderEvent, WorkletRenderHost, WorkletRenderSession } from './worklet-host';
import { useOnScreen } from './use-on-screen';

export function WorkletThreeCanvas<P>({
  paused = false,
  maxPixelRatio = 2,
  fallback = null,
  accessibilityLabel,
  className,
  opacity = 1,
  background,
  androidSurfaceType,
  onBackendChange,
  children,
  ref,
  workletHost,
}: ThreeCanvasProps<P> & { workletHost: WorkletRenderHost }) {
  const gpu = useGpuState();
  const reducedMotion = useReducedMotion();
  const host = useRef<unknown>(null);
  const onScreen = useOnScreen(host);
  const status = useInstanceStore(() => ({ failed: false }));
  const failed = useStore(status, (s) => s.failed);
  const { size, onLayout } = useLayoutSize({ width: 0, height: 0 });
  const surfaceRef = useRef<ThreeSurfaceHandle>(null);
  const session = useRef<WorkletRenderSession | null>(null);

  const pending = gpu.support === 'pending';
  const live = gpu.support === 'supported' && !!gpu.root && !failed;
  const device = live ? (gpu.root?.device ?? null) : null;
  const hasSize = size.width > 0 && size.height > 0;
  const running = live && !paused && !reducedMotion && onScreen;
  const pixelRatio = Math.min(PixelRatio.get(), maxPixelRatio);

  useImperativeHandle(ref, () => ({ invalidate: () => session.current?.invalidate() }));

  useEffect(() => {
    if (!pending && !live) onBackendChange?.(null);
  }, [pending, live, onBackendChange]);

  // One session per device; size, motion and the loop gate update it in place.
  useEffect(() => {
    if (!live || !hasSize) return;
    const context = surfaceRef.current?.getContext?.() ?? null;
    if (!context) {
      console.error('[ThreeCanvas] the native canvas context is not ready for the worklet runtime.');
      status.setState({ failed: true });
      return;
    }
    const onEvent = (event: WorkletRenderEvent) => {
      if (event.kind === 'backend') onBackendChange?.(event.backend);
      else {
        console.error('[ThreeCanvas] the worklet render runtime failed.', event.message);
        status.setState({ failed: true });
      }
    };
    let started: WorkletRenderSession | null = null;
    try {
      started = workletHost.start({ context, device, width: size.width, height: size.height, pixelRatio, reducedMotion, onEvent });
    } catch (error) {
      console.error('[ThreeCanvas] the worklet render runtime did not start.', error);
      status.setState({ failed: true });
      return;
    }
    session.current = started;
    started.setRunning(running);
    return () => {
      started.dispose();
      if (session.current === started) session.current = null;
    };
    // Size, motion and the loop gate are pushed by the effects below; hasSize gates the first start only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, hasSize, device, workletHost]);

  useEffect(() => {
    session.current?.resize(size.width, size.height, pixelRatio);
  }, [size.width, size.height, pixelRatio]);
  useEffect(() => {
    session.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);
  useEffect(() => {
    session.current?.setRunning(running);
  }, [running]);

  let surface = null;
  if (live) surface = <ThreeSurface key={device ? 'shared' : 'own'} ref={surfaceRef} androidSurfaceType={androidSurfaceType} />;
  else if (!pending) surface = fallback;

  return (
    <View
      ref={host as never}
      className={twMerge('relative flex-1 overflow-hidden', className)}
      // Computed: the fill is a caller colour prop, not a theme token.
      style={background ? { backgroundColor: background } : undefined}
      onLayout={onLayout}
    >
      <View
        className="pointer-events-none absolute inset-0"
        aria-hidden={accessibilityLabel ? undefined : true}
        aria-label={accessibilityLabel}
        role={accessibilityLabel ? 'img' : undefined}
        // Computed: opacity is a numeric caller prop.
        style={opacity < 1 ? { opacity } : undefined}
      >
        {surface}
      </View>
      {children}
    </View>
  );
}
