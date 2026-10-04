'use client';

import { useMemo, type ReactNode } from 'react';
import { brand } from '@acme/theme';
import { CityHeightfieldFlat } from '../backgrounds/CityHeightfieldFlat';
import type { District } from '../backgrounds/district-theme';
import { normaliseOpacity } from '../backgrounds/QuadBackground.shared';
import type { NeonColorInput } from '../neon/colors';
import { useSizeClass } from '../use-size-class';
import { loadTerrain } from './terrain/load-terrain';
import type { CursorEffect, TerrainOptions, TerrainVariant } from './terrain/terrain-config';
import { ThreeCanvas } from './ThreeCanvas';
import type { ThreeBackend } from './types';

export interface HolographicTerrainProps {
  /** Height profile and palette: downtown's tower spine, midtown's Deco masses, harlem's rows and slabs, megacity's stacks. Default midtown. */
  district?: District;
  /** `solid` (default): shaded blocks with lit windows. `lines`: dark blocks with lit edges, NeonBlade's line look. */
  variant?: TerrainVariant;
  /** NeonBlade name: the accent, on the tallest roofs and on `lines` edges. Default the district accent. */
  lineColor?: NeonColorInput;
  /** NeonBlade name: sky, clear and fog colour. Default night. */
  bgColor?: string;
  /** NeonBlade name: how far heights swing. Default 0.8. */
  waveAmplitude?: number;
  /** NeonBlade name: how tightly the swell rolls across blocks. Default 1.5. */
  waveFrequency?: number;
  /** NeonBlade name: how fast the swell moves. Default 1. */
  waveSpeed?: number;
  /** NeonBlade name: pointer reach, world units. Default 3.5. */
  bumpRadius?: number;
  /** NeonBlade name: pointer lift, world units. Default 2.5. */
  bumpStrength?: number;
  /** NeonBlade name: terrain width, world units. Default 48. */
  planeWidth?: number;
  /** NeonBlade name: terrain depth, world units. Default 28. */
  planeDepth?: number;
  /** NeonBlade name: camera height; the camera keeps NeonBlade's tilt. Default 10. */
  cameraHeight?: number;
  /** NeonBlade name: blocks across the terrain width. Default 56 on wide screens, 40 on phones. */
  gridSegments?: number;
  /** NeonBlade name: FogExp2 in `bgColor`. Default true. */
  fog?: boolean;
  /** FogExp2 density. Default 0.07 (NeonBlade uses 0.045 on a smaller, nearer plane). */
  fogDensity?: number;
  /** NeonBlade name: 0 to 100 (or 0 to 1). Default 100. */
  opacity?: number;
  /** React to the pointer (mouse hover, touch). Default true. */
  hoverEffect?: boolean;
  /** `lift` (default) raises the blocks under the pointer; `ripple` sends rings out from it. */
  cursorEffect?: CursorEffect;
  /** Lit windows on the walls. Default true. */
  windowLights?: boolean;
  /** Blocks per second the city moves toward the camera. Reduced motion stops it. Default 0.6. */
  scrollSpeed?: number;
  /** Stop the frame loop; the last frame stays. */
  paused?: boolean;
  /** Web only: render on WebGPURenderer's WebGL2 backend even where WebGPU works. */
  forceWebGL?: boolean;
  /** Skip three.js and draw the flat 2D heightfield (TypeGPU quads, or Skia). */
  forceFallback?: boolean;
  /** Called with the backend in use, or null on the fallback. */
  onBackendChange?: (backend: ThreeBackend | null) => void;
  /** Accessible description. Unset means decorative and hidden from assistive tech. */
  accessibilityLabel?: string;
  className?: string;
  /** Foreground content, laid over the terrain. */
  children?: ReactNode;
}

/**
 * NeonBlade UI's Holographic Terrain (MIT, see THIRD-PARTY-NOTICES.md) as a
 * real three.js scene, rebuilt as a NYC-MON city: a grid of solid blocks with
 * stepped, flat-roofed heights, lit windows and avenue lights, scrolling
 * slowly toward a raised camera under FogExp2 in the night colour. The pointer
 * is raycast onto the street plane, as in the original, and lifts or ripples
 * the blocks under it (touch on native).
 *
 * Runs on three's WebGPURenderer through ThreeCanvas: WebGPU on web and
 * native (react-native-webgpu), WebGL2 on browsers without WebGPU. Where
 * neither runs it draws CityHeightfieldFlat. Keeps NeonBlade's prop names.
 */
export function HolographicTerrain({
  district = 'midtown',
  variant = 'solid',
  lineColor,
  bgColor = brand.night,
  waveAmplitude = 0.8,
  waveFrequency = 1.5,
  waveSpeed = 1,
  bumpRadius = 3.5,
  bumpStrength = 2.5,
  planeWidth = 48,
  planeDepth = 28,
  cameraHeight = 10,
  gridSegments,
  fog = true,
  fogDensity = 0.07,
  opacity = 100,
  hoverEffect = true,
  cursorEffect = 'lift',
  windowLights = true,
  scrollSpeed = 0.6,
  paused,
  forceWebGL,
  forceFallback = false,
  onBackendChange,
  accessibilityLabel,
  className,
  children,
}: HolographicTerrainProps) {
  const sizeClass = useSizeClass();
  const blocks = gridSegments ?? (sizeClass === 'regular' ? 56 : 40);
  const options: TerrainOptions = {
    district, variant, lineColor: lineColor ?? '', bgColor, waveAmplitude, waveFrequency, waveSpeed, bumpRadius, bumpStrength,
    planeWidth, planeDepth, cameraHeight, gridSegments: blocks, fog, fogDensity, hoverEffect, cursorEffect, windowLights, scrollSpeed,
  };
  // Params keyed on value, so a re-render with equal props doesn't redraw a still frame.
  const key = JSON.stringify(options);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the serialised options on purpose.
  const params = useMemo(() => options, [key]);

  const flat = (
    <CityHeightfieldFlat
      district={district}
      lineColor={lineColor}
      bgColor={bgColor}
      waveAmplitude={waveAmplitude}
      waveFrequency={waveFrequency}
      waveSpeed={waveSpeed}
      bumpRadius={bumpRadius}
      bumpStrength={bumpStrength}
      cameraHeight={cameraHeight}
      fog={fog}
      opacity={opacity}
      hoverEffect={hoverEffect}
      windowLights={windowLights}
      forceFallback={forceFallback}
      accessibilityLabel={accessibilityLabel}
      className={forceFallback ? className : 'flex-1'}
    >
      {forceFallback ? children : null}
    </CityHeightfieldFlat>
  );
  if (forceFallback) return flat;

  return (
    <ThreeCanvas
      load={loadTerrain}
      params={params}
      forceWebGL={forceWebGL}
      paused={paused}
      fallback={flat}
      tracksPointer={hoverEffect}
      background={bgColor}
      opacity={normaliseOpacity(opacity)}
      accessibilityLabel={accessibilityLabel}
      className={className}
      onBackendChange={onBackendChange}
    >
      {children}
    </ThreeCanvas>
  );
}
