import type { ReactNode } from 'react';
import type { NeonColorInput } from '../neon/colors';
import type { District } from './city-blocks-model';

export type { District };

/** Pointer position relative to the CityBlocks root, in layout px. */
export interface CityPointer {
  x: number;
  y: number;
  inside: boolean;
}

/**
 * A solid New York street grid seen from above at an angle: filled blocks,
 * stacked setback towers, avenue lane lines, window lights and traffic.
 *
 * Started as the port of NeonBlade UI's Hexagons background (MIT, see
 * packages/ui/THIRD-PARTY-NOTICES.md), then redrawn as NYC-MON's own
 * city-block tiling. It keeps NeonBlade's prop names for what carried over:
 * `hoverEffect`, `hoverColor` and `overlay`.
 */
export interface CityBlocksProps {
  /**
   * downtown: FiDi supertalls with setbacks and spires.
   * midtown: Art Deco crowns, stepped setbacks, rooftop water towers.
   * harlem: brownstone rows with stoops and cornices, project slabs, towers behind.
   * megacity: the future NYC, megastructures and sky bridges.
   * Default midtown.
   */
  district?: District;
  /** North-south depth of a block in px. Default 56 on regular windows, 44 on compact. */
  blockSize?: number;
  /** Street width in px; avenues run 1.8x wider. Default 10. */
  streetWidth?: number;
  /** Layout seed: same seed, same city. Default 1. */
  seed?: number;

  /** Lit windows on facades. Default true. */
  windowLights?: boolean;
  /** Window light colour. Default warm orange-300 (carolina-300 in Mega City). */
  lightColor?: NeonColorInput;
  /** Lane markings and Art Deco crowns. Default per district (orange in most). */
  accentColor?: NeonColorInput;
  /** Street and avenue fill. Default night. */
  streetColor?: NeonColorInput;

  /** Moving headlights and taillights along the lanes. Default true. Stops under reduced motion. */
  traffic?: boolean;
  /** Traffic density multiplier. Default 1. */
  trafficDensity?: number;
  /** Traffic speed multiplier. Default 1. */
  trafficSpeed?: number;
  /** Default white. */
  headlightColor?: NeonColorInput;
  /** Default apple. */
  taillightColor?: NeonColorInput;

  /** NeonBlade name: highlight the block under the pointer. Default true. */
  hoverEffect?: boolean;
  /** NeonBlade name: hover highlight colour. Default orange at 35%. */
  hoverColor?: string;
  /** NeonBlade name: fade the edges to night. Default false. */
  overlay?: boolean;

  /** Draw with Skia even where WebGPU works. For stories and tests. */
  forceFallback?: boolean;
  /** Accessible description. Unset means decorative and hidden from assistive tech. */
  accessibilityLabel?: string;
  className?: string;
  /** Foreground content, laid over the city. */
  children?: ReactNode;
}
