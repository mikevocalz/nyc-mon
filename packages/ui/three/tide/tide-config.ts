import { brand } from '@acme/theme';
import type { NeonColorInput } from '../../neon/colors.ts';

export type NeonTideOrigin = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** Everything the tide scene reads each frame. Built from NeonTide's props, NeonBlade's names. */
export interface TideOptions {
  /** Trough colour. */
  colorA: NeonColorInput;
  /** Crest colour. */
  colorB: NeonColorInput;
  /** Specular highlight colour. NeonBlade's is white. */
  glossColor: NeonColorInput;
  /** Clear and fog colour. */
  bgColor: string;
  origin: NeonTideOrigin;
  speed: number;
  amplitude: number;
  frequency: number;
  glow: number;
  gloss: number;
  planeWidth: number;
  planeDepth: number;
  cameraHeight: number;
  cameraTilt: number;
  gridSegments: number;
  fog: boolean;
  /** 0..1. */
  opacity: number;
  hoverEffect: boolean;
  hoverRadius: number;
  hoverStrength: number;
}

/**
 * Default colours, from the theme tokens: royal troughs rising to carolina
 * crests over the night base, with orange glints where the light catches.
 * NeonBlade's own are cyan (#00f3ff) on #020408 with white highlights.
 */
export const TIDE_DEFAULT_COLORS = {
  colorA: brand.royal,
  colorB: brand.carolina,
  glossColor: brand.orange,
  bgColor: brand.night,
} as const;

/** NeonBlade's FogExp2 density. */
export const TIDE_FOG_DENSITY = 0.04;
/** How far the surface shifts toward the origin corner, as a share of its size. */
export const ORIGIN_SHIFT = 0.16;
/** Tilt of the surface about the axis across the flow, degrees: the origin corner rises toward the camera. */
export const TILT_DEGREES = 11;

/** Unit direction (x, z) from `origin` toward the opposite corner. */
export function directionFromOrigin(origin: NeonTideOrigin): [number, number] {
  const x = origin.includes('right') ? 1 : -1;
  const z = origin.includes('bottom') ? 1 : -1;
  const inv = 1 / Math.SQRT2;
  return [-x * inv, -z * inv];
}

/** Surface subdivisions per axis, clamped as in NeonBlade. */
export function tideSegments(gridSegments: number): number {
  return Math.max(8, Math.min(Math.round(gridSegments), 220));
}

/** Height mapped to 0..1 for the colour ramp, as the vertex shader does. */
export function heightNorm(height: number, amplitude: number): number {
  return Math.min(1, Math.max(0, (height / (amplitude * 3.5 + 0.001)) * 0.5 + 0.5));
}
