'use client';

import { useMemo, type ReactNode } from 'react';
import { neonColor, type NeonColorInput } from '../neon/colors';
import { loadTerrain } from './terrain/load-terrain';
import { TERRAIN_COLORS, TERRAIN_DEFAULTS, type TerrainOptions } from './terrain/terrain-config';
import { ThreeCanvas } from './ThreeCanvas';
import type { ThreeBackend } from './types';

export interface HolographicTerrainProps {
  /** Wireframe line colour. A NeonBlade preset, brand token or CSS colour. Default carolina. */
  lineColor?: NeonColorInput;
  /** Background and fog colour. Default night. */
  bgColor?: NeonColorInput;
  /** Tint of the lines the cursor lifts, blended in by the bump's falloff. Set it to `lineColor` for NeonBlade's single colour. Default orange. */
  accentColor?: NeonColorInput;
  /** Peak height of the animated sine waves, world units. Default 0.8. */
  waveAmplitude?: number;
  /** Spatial frequency of the waves. Default 1.5. */
  waveFrequency?: number;
  /** Animation speed multiplier. Default 1. */
  waveSpeed?: number;
  /** Cursor bump radius, world units. Default 3.5. */
  bumpRadius?: number;
  /** Peak height of the cursor bump, world units. Default 2.5. */
  bumpStrength?: number;
  /** Terrain width along x, world units. Default 24. */
  planeWidth?: number;
  /** Terrain depth along z, world units. Default 24. */
  planeDepth?: number;
  /** Camera height; its z follows at height x 1.4. Default 10. */
  cameraHeight?: number;
  /** Plane subdivisions per axis, 8 to 200. Default 60. */
  gridSegments?: number;
  /** Exponential fog that fades the far edge into `bgColor`. Default true. */
  fog?: boolean;
  /** 0 to 100 (or 0 to 1). Default 100. */
  opacity?: number;
  /** Stop the frame loop; the last frame stays. */
  paused?: boolean;
  /** Web only: render on WebGPURenderer's WebGL2 backend even where WebGPU works. */
  forceWebGL?: boolean;
  /** Called with the backend in use, or null where no backend runs. */
  onBackendChange?: (backend: ThreeBackend | null) => void;
  /** Accessible description. Unset means decorative and hidden from assistive tech. */
  accessibilityLabel?: string;
  className?: string;
  /** Foreground content, laid over the terrain. */
  children?: ReactNode;
}

/**
 * NeonBlade UI's Holographic Terrain (MIT, see THIRD-PARTY-NOTICES.md): a
 * wireframe plane rolled by four overlapping sines, a gaussian bump rising
 * under the cursor, the far edge fading into the background through FogExp2,
 * seen from a raised camera. Same geometry, shader maths, motion, pointer
 * raycast and props as the original; the colours default to the theme
 * (carolina lines on night, orange where the cursor lifts the mesh).
 *
 * Runs on three's WebGPURenderer through ThreeCanvas: WebGPU on web and
 * native (react-native-webgpu), WebGL2 on browsers without WebGPU. Where no
 * backend runs it leaves the plain `bgColor` fill.
 */
export function HolographicTerrain({
  lineColor = TERRAIN_COLORS.lineColor,
  bgColor = TERRAIN_COLORS.bgColor,
  accentColor = TERRAIN_COLORS.accentColor,
  waveAmplitude = TERRAIN_DEFAULTS.waveAmplitude,
  waveFrequency = TERRAIN_DEFAULTS.waveFrequency,
  waveSpeed = TERRAIN_DEFAULTS.waveSpeed,
  bumpRadius = TERRAIN_DEFAULTS.bumpRadius,
  bumpStrength = TERRAIN_DEFAULTS.bumpStrength,
  planeWidth = TERRAIN_DEFAULTS.planeWidth,
  planeDepth = TERRAIN_DEFAULTS.planeDepth,
  cameraHeight = TERRAIN_DEFAULTS.cameraHeight,
  gridSegments = TERRAIN_DEFAULTS.gridSegments,
  fog = TERRAIN_DEFAULTS.fog,
  opacity = TERRAIN_DEFAULTS.opacity,
  paused,
  forceWebGL,
  onBackendChange,
  accessibilityLabel,
  className,
  children,
}: HolographicTerrainProps) {
  const options: TerrainOptions = {
    lineColor, bgColor, accentColor, waveAmplitude, waveFrequency, waveSpeed, bumpRadius, bumpStrength,
    planeWidth, planeDepth, cameraHeight, gridSegments, fog, opacity,
  };
  // Params keyed on value, so a re-render with equal props doesn't redraw a still frame.
  const key = JSON.stringify(options);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the serialised options on purpose.
  const params = useMemo(() => options, [key]);

  return (
    <ThreeCanvas
      load={loadTerrain}
      params={params}
      forceWebGL={forceWebGL}
      paused={paused}
      background={neonColor(bgColor).base}
      accessibilityLabel={accessibilityLabel}
      className={className}
      onBackendChange={onBackendChange}
    >
      {children}
    </ThreeCanvas>
  );
}
