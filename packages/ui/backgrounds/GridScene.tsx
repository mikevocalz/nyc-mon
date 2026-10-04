'use client';

import { brand } from '@acme/theme';
import { THEMES, type District } from './district-theme';
import { QuadBackground } from './QuadBackground';
import { normaliseOpacity, useLayers, type SolidBackgroundBaseProps } from './QuadBackground.shared';
import { gridSceneLayers } from './street-floor-model';

/**
 * A street-grid floor and a Mega City deck ceiling meeting at a lit horizon
 * gap. Both planes are solid block plates; the deck panels carry strip
 * lights and the avenues carry lamps.
 *
 * The prop API matches NeonBlade UI's Grid Scene (MIT, see
 * THIRD-PARTY-NOTICES.md): horizon, gap, columns, rows, lineColor,
 * glowColor, bgColor, speed, opacity, lineWidth, showCeiling and showFloor.
 */
export interface GridSceneProps extends SolidBackgroundBaseProps {
  /** Default megacity. */
  district?: District;
  /** Horizon as a fraction of height. Default 0.5. */
  horizon?: number;
  /** Gap between the planes as a fraction of height. Default 0.08. */
  gap?: number;
  /** Default 24. */
  columns?: number;
  /** Default 18. */
  rows?: number;
  /** Lamp and strip-light colour. Default the district accent. */
  lineColor?: string;
  /** Lamp glow and horizon line. Default royal (carolina in Mega City). */
  glowColor?: string;
  /** NeonBlade name: background. Default night. */
  bgColor?: string;
  /** Starter alias for bgColor; bgColor wins. */
  backgroundColor?: string;
  /** Default 0.6. Still under reduced motion. */
  speed?: number;
  /** 0 to 1 (or 0 to 100). Default 1. */
  opacity?: number;
  /** Street width multiplier. Default 1. */
  lineWidth?: number;
  /** Default true. */
  showCeiling?: boolean;
  /** Default true. */
  showFloor?: boolean;
}

export function GridScene({
  district = 'megacity',
  horizon = 0.5,
  gap = 0.08,
  columns = 24,
  rows = 18,
  lineColor,
  glowColor,
  bgColor,
  backgroundColor,
  speed = 0.6,
  opacity = 1,
  lineWidth = 1,
  showCeiling = true,
  showFloor = true,
  ...rest
}: GridSceneProps) {
  const theme = THEMES[district];
  const bg = bgColor ?? backgroundColor ?? brand.night;
  const layers = useLayers(gridSceneLayers, {
    district,
    horizon,
    gap,
    columns,
    rows,
    lineColor: lineColor ?? theme.accent,
    glowColor: glowColor ?? (district === 'megacity' ? brand.carolina : brand.royal),
    bgColor: bg,
    speed,
    lineWidth,
    showCeiling,
    showFloor,
  });
  return <QuadBackground {...rest} layers={layers} background={bg} opacity={normaliseOpacity(opacity)} />;
}
