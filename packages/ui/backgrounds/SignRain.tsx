'use client';

import { brand } from '@acme/theme';
import type { NeonColorInput } from '../neon/colors';
import { THEMES, type District } from '../district';
import { QuadBackground } from './QuadBackground';
import { normaliseOpacity, useLayers, type SolidBackgroundBaseProps } from './QuadBackground.shared';
import { SIGN_GREEN, signRainLayers, STREET_CHARACTERS } from './sign-rain-model';

/**
 * Street-sign glyph rain over a solid skyline: green sign plates with white
 * letters lead each column, trails step down through the district colour,
 * and some columns rain lit windows instead.
 *
 * The port of NeonBlade UI's ASCII Rain (MIT, see THIRD-PARTY-NOTICES.md). It
 * keeps ASCII Rain's props: `textColor`, `bgColor`, `fontSize`, `speed`,
 * `characters` and `opacity`.
 */
export interface SignRainProps extends SolidBackgroundBaseProps {
  /** Default midtown. Sets the skyline and the trail colour. */
  district?: District;
  /** NeonBlade name: trail glyph colour. Default the district accent. */
  textColor?: NeonColorInput;
  /** Head sign plate colour. Default NYC street-sign green. */
  signColor?: NeonColorInput;
  /** NeonBlade name: background. Default night. */
  bgColor?: string;
  /** NeonBlade name: glyph height in px. Default 18. */
  fontSize?: number;
  /** NeonBlade name: ms per step; lower is faster. Default 33. */
  speed?: number;
  /** NeonBlade name: the glyph pool. Default street names and numbers. */
  characters?: string;
  /** NeonBlade name: 0 to 100 (or 0 to 1). Default 90. */
  opacity?: number;
  /** Share of columns raining lit windows instead of letters. Default 0.25. */
  windowShare?: number;
  /** The skyline behind the rain. Default true. */
  skyline?: boolean;
  /** Default 1. */
  seed?: number;
}

export function SignRain({
  district = 'midtown',
  textColor,
  signColor = SIGN_GREEN,
  bgColor = brand.night,
  fontSize = 18,
  speed = 33,
  characters = STREET_CHARACTERS,
  opacity = 90,
  windowShare = 0.25,
  skyline = true,
  seed = 1,
  ...rest
}: SignRainProps) {
  const layers = useLayers(signRainLayers, {
    district,
    textColor: textColor ?? THEMES[district].accent,
    signColor,
    bgColor,
    fontSize,
    speed,
    characters,
    windowShare,
    skyline,
    seed,
  });
  return <QuadBackground {...rest} layers={layers} background={bgColor} opacity={normaliseOpacity(opacity)} />;
}
