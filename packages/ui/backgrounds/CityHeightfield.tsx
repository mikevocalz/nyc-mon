'use client';

import { brand } from '@acme/theme';
import { useSizeClass } from '../use-size-class';
import type { NeonColorInput } from '../neon/colors';
import { THEMES, type District } from '../district';
import { heightfieldLayers } from './heightfield-model';
import { QuadBackground } from './QuadBackground';
import { normaliseOpacity, useLayers, type SolidBackgroundBaseProps } from './QuadBackground.shared';

/**
 * A stepped city heightfield: rows of solid blocks rising and falling like
 * terrain, floors snapping as they go, with lit facades and the pointer
 * lifting the blocks under it.
 *
 * The port of NeonBlade UI's Holographic Terrain (MIT, see
 * THIRD-PARTY-NOTICES.md). It keeps its props: `lineColor`, `bgColor`,
 * `waveAmplitude`, `waveFrequency`, `waveSpeed`, `bumpRadius`,
 * `bumpStrength`, `cameraHeight`, `gridSegments`, `fog` and `opacity`.
 */
export interface CityHeightfieldProps extends SolidBackgroundBaseProps {
  /** Height profile and colours. downtown peaks, harlem stays low with slabs, megacity towers. Default midtown. */
  district?: District;
  /** NeonBlade name: roof colour of the tallest blocks. Default the district accent. */
  lineColor?: NeonColorInput;
  /** NeonBlade name: sky colour. Default night. */
  bgColor?: string;
  /** NeonBlade name. Default 0.8. */
  waveAmplitude?: number;
  /** NeonBlade name. Default 1.5. */
  waveFrequency?: number;
  /** NeonBlade name. Default 1. */
  waveSpeed?: number;
  /** NeonBlade name: pointer lift radius in blocks. Default 3.5. */
  bumpRadius?: number;
  /** NeonBlade name: pointer lift height. Default 2.5. */
  bumpStrength?: number;
  /** NeonBlade name: higher camera, lower horizon. Default 10. */
  cameraHeight?: number;
  /** NeonBlade name: blocks across the near edge. Default 12 on wide screens, 7 on phones. */
  gridSegments?: number;
  /** NeonBlade name: fade distant blocks into the sky. Default true. */
  fog?: boolean;
  /** NeonBlade name: 0 to 100 (or 0 to 1). Default 100. */
  opacity?: number;
  /** Lift blocks under the pointer. Default true. */
  hoverEffect?: boolean;
  /** Lit windows. Default true. */
  windowLights?: boolean;
}

export function CityHeightfield({
  district = 'midtown',
  lineColor,
  bgColor = brand.night,
  waveAmplitude = 0.8,
  waveFrequency = 1.5,
  waveSpeed = 1,
  bumpRadius = 3.5,
  bumpStrength = 2.5,
  cameraHeight = 10,
  gridSegments,
  fog = true,
  opacity = 100,
  hoverEffect = true,
  windowLights = true,
  ...rest
}: CityHeightfieldProps) {
  const sizeClass = useSizeClass();
  const layers = useLayers(heightfieldLayers, {
    district,
    lineColor: lineColor ?? THEMES[district].accent,
    bgColor,
    waveAmplitude,
    waveFrequency,
    waveSpeed,
    bumpRadius,
    bumpStrength,
    gridSegments: gridSegments ?? (sizeClass === 'regular' ? 12 : 7),
    cameraHeight,
    fog,
    hoverEffect,
    windowLights,
  });
  return <QuadBackground {...rest} layers={layers} background={bgColor} opacity={normaliseOpacity(opacity)} tracksPointer={hoverEffect} />;
}
