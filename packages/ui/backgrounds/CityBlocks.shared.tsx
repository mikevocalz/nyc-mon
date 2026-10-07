'use client';

import { useMemo, useRef, type ReactNode } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { twMerge } from 'tailwind-merge';
import { palette, brand } from '@acme/theme';
import { GpuCanvas } from '../gpu/GpuCanvas';
import type { GpuCanvasHandle } from '../gpu/types';
import { withAlpha } from '../neon/colors';
import { useInstanceStore } from '../use-instance-store';
import { useSizeClass } from '../use-size-class';
import { View } from '../tw';
import { districtDefaults } from './city-blocks-model';
import { createCityBlocksScene, type CityParams } from './CityBlocks.gpu';
import type { CityBlocksSkiaProps } from './CityBlocks.skia';
import type { CityBlocksProps, CityPointer } from './CityBlocks.types';
import { useReducedMotion } from './use-reduced-motion';

type PointerLike = GestureResponderEvent & {
  currentTarget: { getBoundingClientRect?: () => { left: number; top: number } };
  nativeEvent: { clientX?: number; clientY?: number };
};

/**
 * Shared body of CityBlocks. Resolves props into the scene params, tracks
 * the pointer for the hover highlight, and hands the same params to either
 * the TypeGPU scene or the platform's Skia fallback.
 */
export function CityBlocksShell({
  district = 'midtown',
  blockSize,
  streetWidth = 10,
  seed = 1,
  windowLights = true,
  lightColor,
  accentColor,
  streetColor,
  traffic = true,
  trafficDensity = 1,
  trafficSpeed = 1,
  headlightColor = brand.white,
  taillightColor = palette.apple[400],
  hoverEffect = true,
  hoverColor = withAlpha(brand.orange, 0.35),
  overlay = false,
  forceFallback = false,
  paused = false,
  accessibilityLabel,
  className,
  children,
  renderFallback,
}: CityBlocksProps & { renderFallback: (props: CityBlocksSkiaProps) => ReactNode }) {
  const sizeClass = useSizeClass();
  const reducedMotion = useReducedMotion();
  const defaults = districtDefaults(district);
  const resolvedBlock = blockSize ?? (sizeClass === 'regular' ? 56 : 44);
  const resolvedLight = lightColor ?? defaults.light;
  const resolvedAccent = accentColor ?? defaults.accent;
  const resolvedStreet = streetColor ?? brand.night;

  const pointer = useInstanceStore<CityPointer>(() => ({ x: 0, y: 0, inside: false }));
  const gpu = useRef<GpuCanvasHandle>(null);

  const city = useMemo(
    () => ({ district, blockSize: resolvedBlock, streetWidth, seed, lightColor: resolvedLight, accentColor: resolvedAccent, windowLights }),
    [district, resolvedBlock, streetWidth, seed, resolvedLight, resolvedAccent, windowLights],
  );
  const trafficOpts = useMemo(
    () => ({ density: traffic ? trafficDensity : 0, speed: trafficSpeed, headlight: headlightColor, taillight: taillightColor }),
    [traffic, trafficDensity, trafficSpeed, headlightColor, taillightColor],
  );
  const params = useMemo<CityParams>(
    () => ({ city, traffic: trafficOpts, hoverEffect, hoverColor, overlay, streetColor: resolvedStreet, pointer }),
    [city, trafficOpts, hoverEffect, hoverColor, overlay, resolvedStreet, pointer],
  );

  const onPointerMove = (event: PointerLike) => {
    if (!hoverEffect) return;
    const rect = event.currentTarget.getBoundingClientRect?.();
    const { clientX, clientY } = event.nativeEvent;
    if (!rect || clientX === undefined || clientY === undefined) return;
    pointer.setState({ x: clientX - rect.left, y: clientY - rect.top, inside: true });
    gpu.current?.invalidate();
  };
  const onPointerLeave = () => {
    pointer.setState({ inside: false });
    gpu.current?.invalidate();
  };

  return (
    <View
      className={twMerge('relative flex-1 overflow-hidden bg-ink-950', className)}
      // Computed: streetColor is a caller colour prop, not a theme token.
      style={streetColor ? { backgroundColor: streetColor } : undefined}
      {...({ onPointerMove, onPointerLeave } as object)}
    >
      <GpuCanvas
        ref={gpu}
        setup={createCityBlocksScene}
        params={params}
        forceFallback={forceFallback}
        paused={paused}
        accessibilityLabel={accessibilityLabel}
        fallback={renderFallback({ params, pointer, running: !reducedMotion && !paused })}
      />
      {children}
    </View>
  );
}
