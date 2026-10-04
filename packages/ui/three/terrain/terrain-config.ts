import { brand } from '@acme/theme';
import type { NeonColorInput } from '../../neon/colors.ts';

/** Everything the terrain scene reads each frame. Built from HolographicTerrain's props. */
export interface TerrainOptions {
  lineColor: NeonColorInput;
  bgColor: NeonColorInput;
  /** Tint of the lines the cursor lifts, blended in by the bump's own falloff. */
  accentColor: NeonColorInput;
  waveAmplitude: number;
  waveFrequency: number;
  waveSpeed: number;
  bumpRadius: number;
  bumpStrength: number;
  planeWidth: number;
  planeDepth: number;
  cameraHeight: number;
  gridSegments: number;
  fog: boolean;
  /** 0..1. */
  opacity: number;
}

/**
 * Default colours, from the theme: night behind, carolina lines (the brand
 * family NeonBlade's cyan maps to) and orange where the cursor lifts the
 * mesh. NeonBlade's own are #00ffff on #020a0a, with no accent.
 */
export const TERRAIN_COLORS = {
  lineColor: brand.carolina,
  bgColor: brand.night,
  accentColor: brand.orange,
} as const;

/** NeonBlade's numbers, unchanged. */
export const TERRAIN_DEFAULTS = {
  waveAmplitude: 0.8,
  waveFrequency: 1.5,
  waveSpeed: 1,
  bumpRadius: 3.5,
  bumpStrength: 2.5,
  planeWidth: 24,
  planeDepth: 24,
  cameraHeight: 10,
  gridSegments: 60,
  fog: true,
  opacity: 100,
} as const;

/** FogExp2 density, NeonBlade's fixed value. */
export const FOG_DENSITY = 0.045;
/** Camera field of view, degrees. */
export const CAMERA_FOV = 60;
/** How much of the accent the very top of the cursor bump takes; the rest stays the line colour. */
export const ACCENT_MIX = 0.85;

/**
 * Pointer easing, per second (exp(-rate * dt)). NeonBlade moves the bump to
 * each new hit and switches it on and off in one frame; easing both keeps the
 * mesh from jumping with every pointer event.
 */
export const CURSOR_FOLLOW = 14;
export const CURSOR_FADE = 6;

/** Plane subdivisions per axis, clamped to 8..200 as NeonBlade does. */
export function terrainSegments(gridSegments: number): number {
  return Math.max(8, Math.min(Math.round(gridSegments), 200));
}

/** Camera position: NeonBlade derives z from the height (x 1.4) for its ~35 degree tilt, and looks at the origin. */
export function cameraPosition(cameraHeight: number): [x: number, y: number, z: number] {
  return [0, cameraHeight, cameraHeight * 1.4];
}

/** NeonBlade's 0..100 opacity; 0..1 is accepted too. */
export function terrainOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity > 1 ? opacity / 100 : opacity));
}

/** three's FogExp2 factor at a view depth: 0 near, toward 1 far. */
export function fogFactor(depth: number, density = FOG_DENSITY): number {
  return 1 - Math.exp(-density * density * depth * depth);
}
