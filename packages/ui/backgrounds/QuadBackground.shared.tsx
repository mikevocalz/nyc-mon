'use client';

import { useMemo, useRef, type ReactNode } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { twMerge } from 'tailwind-merge';
import { GpuCanvas } from '../gpu/GpuCanvas';
import type { GpuCanvasHandle } from '../gpu/types';
import { parseColor } from '../neon/colors';
import { useInstanceStore } from '../use-instance-store';
import { View } from '../tw';
import { createQuadScene, type QuadSceneParams } from './QuadScene.gpu';
import type { QuadSceneSkiaProps } from './QuadScene.skia';
import type { Layer, Pointer } from './quad-writer';
import { useReducedMotion } from './use-reduced-motion';

type PointerLike = GestureResponderEvent & {
  currentTarget: { getBoundingClientRect?: () => { left: number; top: number } };
  nativeEvent: { clientX?: number; clientY?: number; locationX?: number; locationY?: number };
};

/** Props every solid background shares. */
export interface SolidBackgroundBaseProps {
  /** Draw with Skia even where WebGPU works. For stories and tests. */
  forceFallback?: boolean;
  /** Accessible description. Unset means decorative and hidden from assistive tech. */
  accessibilityLabel?: string;
  className?: string;
  /** Foreground content, laid over the background. */
  children?: ReactNode;
  /**
   * Stop the frame loop and hold the current frame, as reduced motion does.
   * LazyScene sets it while the scene is off screen. Default false.
   */
  paused?: boolean;
}

export interface QuadBackgroundProps extends SolidBackgroundBaseProps {
  layers: readonly Layer[];
  /** Background fill (CSS colour). */
  background: string;
  /** Whether anything moves; still scenes skip the Skia frame loop. */
  animated?: boolean;
  /** Track the pointer for layers that react to it. */
  tracksPointer?: boolean;
  /** Opacity of the drawing over the background fill, 0 to 1. */
  opacity?: number;
}

/**
 * Shared body of every solid background: hands the same layers to the
 * TypeGPU quad scene or the platform's Skia fallback, tracks the pointer for
 * hover effects, and lays children over the canvas.
 */
export function QuadBackgroundShell({
  layers,
  background,
  animated = true,
  tracksPointer = false,
  opacity = 1,
  forceFallback = false,
  paused = false,
  accessibilityLabel,
  className,
  children,
  renderFallback,
}: QuadBackgroundProps & { renderFallback: (props: QuadSceneSkiaProps) => ReactNode }) {
  const reducedMotion = useReducedMotion();
  const pointer = useInstanceStore<Pointer>(() => ({ x: 0, y: 0, inside: false }));
  const gpu = useRef<GpuCanvasHandle>(null);
  const clear = useMemo(() => parseColor(background), [background]);
  const params = useMemo<QuadSceneParams>(() => ({ layers, clear, pointer }), [layers, clear, pointer]);

  const onPointerMove = (event: PointerLike) => {
    const rect = event.currentTarget.getBoundingClientRect?.();
    const { clientX, clientY, locationX, locationY } = event.nativeEvent;
    const x = rect && clientX !== undefined ? clientX - rect.left : locationX;
    const y = rect && clientY !== undefined ? clientY - rect.top : locationY;
    if (x === undefined || y === undefined) return;
    pointer.setState({ x, y, inside: true });
    gpu.current?.invalidate();
  };
  const onPointerLeave = () => {
    pointer.setState({ inside: false });
    gpu.current?.invalidate();
  };

  return (
    <View
      className={twMerge('relative flex-1 overflow-hidden', className)}
      // Computed: the fill is a caller colour prop, not a theme token.
      style={{ backgroundColor: background }}
      {...(tracksPointer ? ({ onPointerMove, onPointerLeave } as object) : {})}
    >
      <View
        aria-hidden
        className="pointer-events-none absolute inset-0"
        // Computed: opacity is a numeric caller prop.
        style={opacity < 1 ? { opacity } : undefined}
      >
        <GpuCanvas
          ref={gpu}
          setup={createQuadScene}
          params={params}
          forceFallback={forceFallback}
          paused={paused}
          accessibilityLabel={accessibilityLabel}
          fallback={renderFallback({ layers, background, pointer, running: animated && !reducedMotion && !paused })}
        />
      </View>
      {children}
    </View>
  );
}

/**
 * Memoise a background's layers on the value of its options, not their
 * identity: callers pass fresh literal props every render, and rebuilding
 * the layers would throw away the cached static skyline.
 */
export function useLayers<O>(factory: (options: O) => Layer[], options: O): Layer[] {
  const key = JSON.stringify(options);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the serialised options on purpose.
  return useMemo(() => factory(options), [factory, key]);
}

/** NeonBlade takes opacity as 0-100 on some backgrounds and 0-1 on others; accept both. */
export const normaliseOpacity = (value: number) => Math.max(0, Math.min(1, value > 1 ? value / 100 : value));
