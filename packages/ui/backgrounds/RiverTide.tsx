'use client';

import { brand } from '@acme/theme';
import type { NeonColorInput } from '../neon/colors';
import type { District } from '../district';
import { QuadBackground } from './QuadBackground';
import { normaliseOpacity, useLayers, type SolidBackgroundBaseProps } from './QuadBackground.shared';
import { riverTideLayers, type RiverTideOrigin } from './river-tide-model';

export type { RiverTideOrigin };

/**
 * The river at night: a far-shore skyline over solid layered water bands,
 * each band wave-topped with a lit crest, and the city's lights broken up on
 * the swell. Downtown and Midtown face the Hudson; Harlem the East River.
 *
 * The port of NeonBlade UI's Neon Tide (MIT, see THIRD-PARTY-NOTICES.md). It
 * keeps its props: `colorA`, `colorB`, `bgColor`, `origin`, `speed`,
 * `amplitude`, `frequency`, `glow`, `gloss`, `opacity`, `hoverEffect`,
 * `hoverRadius` and `hoverStrength`.
 */
export interface RiverTideProps extends SolidBackgroundBaseProps {
  /** Default downtown. */
  district?: District;
  /** NeonBlade name: crest colour. Default per district. */
  colorA?: NeonColorInput;
  /** NeonBlade name: deepest water colour. Default per district. */
  colorB?: NeonColorInput;
  /** NeonBlade name: sky colour. Default night. */
  bgColor?: string;
  /** NeonBlade name: waves travel away from this corner. Default top-right. */
  origin?: RiverTideOrigin;
  /** NeonBlade name. Default 0.5. */
  speed?: number;
  /** NeonBlade name. Default 1.2. */
  amplitude?: number;
  /** NeonBlade name. Default 0.55. */
  frequency?: number;
  /** NeonBlade name: reflected city lights, 0 to 1. Default 0.9. */
  glow?: number;
  /** NeonBlade name: crest highlight, 0 to 1. Default 0.6. */
  gloss?: number;
  /** Water bands. Default 7. */
  bands?: number;
  /** Far-shore skyline. Default true. */
  shore?: boolean;
  /** NeonBlade name: 0 to 100 (or 0 to 1). Default 100. */
  opacity?: number;
  /** NeonBlade name: the swell rises under the pointer. Default true. */
  hoverEffect?: boolean;
  /** NeonBlade name. Default 4. */
  hoverRadius?: number;
  /** NeonBlade name. Default 1.4. */
  hoverStrength?: number;
  /** Default 1. */
  seed?: number;
}

export function RiverTide({
  district = 'downtown',
  colorA,
  colorB,
  bgColor = brand.night,
  origin = 'top-right',
  speed = 0.5,
  amplitude = 1.2,
  frequency = 0.55,
  glow = 0.9,
  gloss = 0.6,
  bands = 7,
  shore = true,
  opacity = 100,
  hoverEffect = true,
  hoverRadius = 4,
  hoverStrength = 1.4,
  seed = 1,
  ...rest
}: RiverTideProps) {
  const layers = useLayers(riverTideLayers, {
    district, colorA: colorA ?? null, colorB: colorB ?? null, bgColor, origin, speed, amplitude, frequency,
    glow, gloss, bands, shore, hoverEffect, hoverRadius, hoverStrength, seed,
  });
  return <QuadBackground {...rest} layers={layers} background={bgColor} opacity={normaliseOpacity(opacity)} tracksPointer={hoverEffect} />;
}
