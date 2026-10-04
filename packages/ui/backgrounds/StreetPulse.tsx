'use client';

import { brand } from '@acme/theme';
import type { NeonColorInput } from '../neon/colors';
import { THEMES, type District } from './district-theme';
import { QuadBackground } from './QuadBackground';
import { useLayers, type SolidBackgroundBaseProps } from './QuadBackground.shared';
import { streetPulseLayers } from './street-pulse-model';

/**
 * Traffic pulses running a solid street grid: block plates (some of them
 * parks) with solid bars racing down the streets and turning at corners.
 *
 * The port of NeonBlade UI's Datalines with Grid (MIT, see
 * THIRD-PARTY-NOTICES.md). It keeps its props: `lineColor`, `shadowColor`,
 * `bgGridColor`, `cellSize`, `maxLines`, `baseSpeed`, `lineLength`,
 * `spawnProbability` and `overlay`.
 */
export interface StreetPulseProps extends SolidBackgroundBaseProps {
  /** Default midtown. Harlem has more parks; Mega City's blocks are royal. */
  district?: District;
  /** NeonBlade name: pulse colour. Default the district accent. */
  lineColor?: NeonColorInput;
  /** NeonBlade name: head glow. Default the pulse colour. */
  shadowColor?: NeonColorInput;
  /** NeonBlade name: block fill. Default per district. */
  bgGridColor?: NeonColorInput;
  /** NeonBlade name: block pitch in px. Default 50. */
  cellSize?: number;
  /** NeonBlade name: pulses at once. Default 12. */
  maxLines?: number;
  /** NeonBlade name: px per frame at 60 fps. Default 2. */
  baseSpeed?: number;
  /** NeonBlade name: trail length in px. Default 150. */
  lineLength?: number;
  /** NeonBlade name: how busy the streets are, 0 to 1. Default 0.1. */
  spawnProbability?: number;
  /** NeonBlade name: fade the edges. Default false. */
  overlay?: boolean;
  /** Default 1. */
  seed?: number;
  /** Street colour. Default night. */
  bgColor?: string;
}

export function StreetPulse({
  district = 'midtown',
  lineColor,
  shadowColor,
  bgGridColor,
  cellSize = 50,
  maxLines = 12,
  baseSpeed = 2,
  lineLength = 150,
  spawnProbability = 0.1,
  overlay = false,
  seed = 1,
  bgColor = brand.night,
  ...rest
}: StreetPulseProps) {
  const theme = THEMES[district];
  const line = lineColor ?? theme.accent;
  const layers = useLayers(streetPulseLayers, {
    district,
    lineColor: line,
    shadowColor: shadowColor ?? line,
    bgGridColor: bgGridColor ?? theme.block,
    cellSize,
    maxLines,
    baseSpeed,
    lineLength,
    spawnProbability,
    overlay,
    seed,
  });
  return <QuadBackground {...rest} layers={layers} background={bgColor} />;
}
