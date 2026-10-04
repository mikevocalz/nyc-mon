'use client';

import { brand } from '@acme/theme';
import type { NeonColorInput } from '../neon/colors';
import type { District } from '../district';
import { QuadBackground } from './QuadBackground';
import { normaliseOpacity, useLayers, type SolidBackgroundBaseProps } from './QuadBackground.shared';
import { subwayLayers, type GlowIntensity } from './subway-model';

/**
 * A solid NYC subway map: chunky route bars on night keylines, white station
 * dots, route bullets, and trains running the lines.
 *
 * The port of NeonBlade UI's Cyber Circuit (MIT, see THIRD-PARTY-NOTICES.md),
 * traced as the subway. It keeps Cyber Circuit's props: `color`, `opacity`,
 * `lineThickness`, `dotSize`, `dotType`, `glowColor` and `glowIntensity`.
 */
export interface SubwayLinesProps extends SolidBackgroundBaseProps {
  /**
   * downtown: lines piling into the tip of the island. midtown: avenue trunks
   * and crosstown shuttles. harlem: a few express trunks. megacity: the dense
   * future network. Default midtown.
   */
  district?: District;
  /** NeonBlade name: first route's colour. Default from the route palette. */
  color?: NeonColorInput;
  /** NeonBlade name: 0 to 1. Default 1. */
  opacity?: number;
  /** NeonBlade name: route width; px = lineThickness x 5. Default 2. */
  lineThickness?: number;
  /** NeonBlade name: station dot size; radius px = dotSize x 1.8. Default 3. */
  dotSize?: number;
  /** NeonBlade name: white dots or white rings. Default filled. */
  dotType?: 'filled' | 'outline';
  /** NeonBlade name: train headlight glow. Default white. */
  glowColor?: NeonColorInput;
  /** NeonBlade name. Default medium. */
  glowIntensity?: GlowIntensity;
  /** Trains on the lines. Default true. Still under reduced motion. */
  trains?: boolean;
  /** Train speed multiplier. Default 1. */
  speed?: number;
  /** Default 1. */
  seed?: number;
  /** Background. Default night. */
  bgColor?: string;
}

export function SubwayLines({
  district = 'midtown',
  color,
  opacity = 1,
  lineThickness = 2,
  dotSize = 3,
  dotType = 'filled',
  glowColor = brand.white,
  glowIntensity = 'medium',
  trains = true,
  speed = 1,
  seed = 1,
  bgColor = brand.night,
  ...rest
}: SubwayLinesProps) {
  const layers = useLayers(subwayLayers, {
    district, color: color ?? null, lineThickness, dotSize, dotType, glowColor, glowIntensity, trains, speed, seed,
  });
  return <QuadBackground {...rest} layers={layers} background={bgColor} opacity={normaliseOpacity(opacity)} />;
}
