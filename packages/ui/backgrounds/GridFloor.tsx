'use client';

import { brand } from '@acme/theme';
import { THEMES, type District } from '../district';
import { QuadBackground } from './QuadBackground';
import { normaliseOpacity, useLayers, type SolidBackgroundBaseProps } from './QuadBackground.shared';
import { streetFloorLayers } from './street-floor-model';

/**
 * A solid street-grid ground plane with avenue lighting: block plates with
 * kerbs streaming towards the viewer, lamps glowing along every fourth
 * avenue, under a stepped sky.
 *
 * The prop API matches NeonBlade UI's Grid Floor (MIT, see
 * THIRD-PARTY-NOTICES.md): horizon, columns, rows, lineColor, glowColor,
 * bgColor, speed, opacity and lineWidth.
 */
export interface GridFloorProps extends SolidBackgroundBaseProps {
  /** Block colours and default lights. Default midtown. */
  district?: District;
  /** Horizon line as a fraction of height (0 to 1). Default 0.45. */
  horizon?: number;
  /** Columns of blocks across. Default 24. */
  columns?: number;
  /** Rows of blocks from horizon to viewer. Default 18. */
  rows?: number;
  /** Avenue lamp colour. Default the district accent. */
  lineColor?: string;
  /** Lamp glow. Default royal (carolina in Mega City). */
  glowColor?: string;
  /** The horizon band. Default carolina. Pass 'transparent' to drop it. */
  horizonGlowColor?: string;
  /** NeonBlade name: sky colour at the top. Default night. */
  bgColor?: string;
  /** Starter alias for bgColor; bgColor wins. */
  backgroundColor?: string;
  /** Forward speed; 0 stops it. Still under reduced motion. Default 0.6. */
  speed?: number;
  /** 0 to 1 (or 0 to 100). Default 1. */
  opacity?: number;
  /** Street width multiplier. Default 1. */
  lineWidth?: number;
  /** A distant skyline on the horizon. Default false. */
  skyline?: boolean;
  /** Skyline seed. Default 1. */
  seed?: number;
}

export function GridFloor({
  district = 'midtown',
  horizon = 0.45,
  columns = 24,
  rows = 18,
  lineColor,
  glowColor,
  horizonGlowColor = brand.carolina,
  bgColor,
  backgroundColor,
  speed = 0.6,
  opacity = 1,
  lineWidth = 1,
  skyline = false,
  seed = 1,
  ...rest
}: GridFloorProps) {
  const theme = THEMES[district];
  const sky = bgColor ?? backgroundColor ?? brand.night;
  const layers = useLayers(streetFloorLayers, {
    district,
    horizon,
    columns,
    rows,
    lineColor: lineColor ?? theme.accent,
    glowColor: glowColor ?? (district === 'megacity' ? brand.carolina : brand.royal),
    horizonGlowColor,
    bgColor: sky,
    speed,
    lineWidth,
    skyline,
    seed,
  });
  return <QuadBackground {...rest} layers={layers} background={sky} opacity={normaliseOpacity(opacity)} />;
}
