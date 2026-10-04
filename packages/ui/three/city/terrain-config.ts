import { brand, palette } from '@acme/theme';
import { mixColor, type NeonColorInput } from '../../neon/colors.ts';
import { THEMES, type District } from '../../backgrounds/district-theme.ts';

export type TerrainVariant = 'solid' | 'lines';
export type CursorEffect = 'lift' | 'ripple';

/** Everything the terrain scene reads each frame. Built from CityHeightfield's props. */
export interface TerrainOptions {
  district: District;
  variant: TerrainVariant;
  /** NeonBlade name: the accent. Roof caps of the tallest blocks and, in `lines`, the edges. */
  lineColor: NeonColorInput;
  /** NeonBlade name: sky, clear and fog colour. */
  bgColor: string;
  waveAmplitude: number;
  waveFrequency: number;
  waveSpeed: number;
  /** World units, as in NeonBlade. */
  bumpRadius: number;
  /** World units, as in NeonBlade. */
  bumpStrength: number;
  planeWidth: number;
  planeDepth: number;
  cameraHeight: number;
  /** Blocks across `planeWidth`. */
  gridSegments: number;
  fog: boolean;
  fogDensity: number;
  hoverEffect: boolean;
  cursorEffect: CursorEffect;
  windowLights: boolean;
  /** Blocks per second the city travels toward the camera. */
  scrollSpeed: number;
}

/**
 * Each district's height profile, in blocks: the base every block stands on,
 * the swell's peak, a ridge along the centre line, and the boost of the odd
 * slab (0 for none).
 * - Downtown: a tall spine of towers down the middle.
 * - Midtown: big, even Deco masses.
 * - Harlem: low row houses with tall plain project slabs standing over them.
 * - Mega City: everything tall, with taller stacks.
 */
export const PROFILES: Record<District, readonly [base: number, peak: number, centre: number, slab: number]> = {
  downtown: [0.8, 2.4, 2.2, 1.2],
  midtown: [1.0, 2.0, 0.9, 0.8],
  harlem: [0.5, 0.7, 0, 2.4],
  megacity: [1.5, 3.0, 1.2, 2.6],
};

/** Share of windows lit, per district. */
export const WINDOW_DENSITY: Record<District, number> = {
  downtown: 0.55,
  midtown: 0.45,
  harlem: 0.4,
  megacity: 0.6,
};

/** A block's footprint inside its cell; the rest is street. */
export const FOOTPRINT = 0.74;
/** World height of one block of height, per world unit of cell width. Keeps towers in proportion as the grid changes. */
export const HEIGHT_SCALE = 0.8;

export interface TerrainGrid {
  /** Columns, always even so block edges sit on whole cells and avenues line up. */
  cols: number;
  rows: number;
  /** Cell width in world units. */
  cell: number;
}

/** Columns, rows and cell size for a plane and block count. */
export function terrainGrid(planeWidth: number, planeDepth: number, gridSegments: number): TerrainGrid {
  const width = Math.max(4, planeWidth);
  const depth = Math.max(4, planeDepth);
  const cols = Math.max(8, Math.min(160, 2 * Math.round(gridSegments / 2)));
  const cell = width / cols;
  const rows = Math.max(4, Math.min(240, Math.round(depth / cell)));
  return { cols, rows, cell };
}

export interface TerrainPalette {
  /** Four building body colours, picked per block. */
  bodies: [string, string, string, string];
  accent: NeonColorInput;
  light: string;
  ground: string;
  avenue: string;
  sky: string;
}

/**
 * The district's solid colour set, from the theme tokens. Bodies are lifted a
 * step from the 2D skyline's (the 3D faces are shaded darker by the light),
 * and the ground sits one step above the sky so streets read against the fog.
 */
export function terrainPalette(district: District, lineColor: NeonColorInput | undefined, bgColor: string): TerrainPalette {
  const theme = THEMES[district];
  const lift = (c: string) => mixColor(c, brand.white, 0.1);
  const [a, b, c, d] = theme.bodies;
  return {
    bodies: [lift(a!), lift(b!), lift(c!), lift(d!)],
    accent: lineColor || theme.accent,
    light: theme.light,
    ground: mixColor(bgColor, palette.ink[900], 0.6),
    avenue: mixColor(theme.light, theme.accent, 0.35),
    sky: bgColor,
  };
}

/** NeonBlade's world-unit pointer radius and strength in blocks. */
export function bumpInBlocks(bumpRadius: number, bumpStrength: number, cell: number): { radius: number; strength: number } {
  const c = Math.max(0.05, cell);
  return { radius: Math.max(0.5, bumpRadius / c), strength: Math.max(0, bumpStrength / c) * 0.6 };
}

/** Camera field of view: wider on portrait screens so a phone still sees a street's width of city. */
export function cameraFov(aspect: number): number {
  return aspect >= 1 ? 55 : 55 + Math.min(1, 1 - aspect) * 30;
}
