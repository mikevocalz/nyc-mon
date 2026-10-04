import { brand, palette } from '@acme/theme';
import { neonColor, neonToken, type NeonColorInput, type NeonToken } from '../neon/colors.ts';
import { shadeSteps, type ShadeSteps } from '../neon/shade.ts';
import type { District } from './districts.ts';

/** Solid tone families a chart, table or nav can take. */
export type ChartTone = 'orange' | 'royal' | 'carolina' | 'leaf' | 'apple';

/** Harlem's brownstone brick: the deep orange step, not the hero orange. */
const BRICK = palette.orange[700];

/**
 * Each district's series colours, in order. The first is the hero.
 *   downtown: glass towers, carolina over royal.
 *   midtown: deco limestone lit orange, royal structure.
 *   harlem: brownstone brick (orange 700), the apple as accent, the park's leaf.
 *   megacity: royal megastructures with carolina sky bridges.
 */
const DISTRICT_SERIES: Record<District, string[]> = {
  downtown: ['carolina', 'royal', 'orange', 'leaf', 'apple'],
  midtown: ['orange', 'royal', 'carolina', 'leaf', 'apple'],
  harlem: [BRICK, 'apple', 'leaf', 'carolina', 'royal'],
  megacity: ['royal', 'carolina', 'leaf', 'orange', 'apple'],
};

/**
 * The solid tone family that leads each district's charts, table and nav.
 * It follows the series hero, so it differs from DISTRICT_TONE (Downtown's
 * charts lead carolina, Harlem's orange, Mega City's royal).
 */
export const DISTRICT_CHART_TONE: Record<District, ChartTone> = {
  downtown: 'carolina',
  midtown: 'orange',
  harlem: 'orange',
  megacity: 'royal',
};

/** Window-light colour per district, matching CityBlocks. */
export const DISTRICT_LIGHT: Record<District, string> = {
  downtown: palette.carolina[200],
  midtown: palette.orange[300],
  harlem: palette.orange[300],
  megacity: palette.carolina[300],
};

export function districtSeries(district: District = 'midtown'): string[] {
  return DISTRICT_SERIES[district];
}

export function districtTone(district: District = 'midtown'): ChartTone {
  return DISTRICT_CHART_TONE[district];
}

/**
 * The colour for series `i`: an explicit colour wins (NeonBlade presets map
 * onto brand tokens), otherwise the district's i-th tone.
 */
export function seriesColor(i: number, district: District = 'midtown', color?: NeonColorInput): string {
  if (color) return neonColor(color).base;
  const tones = DISTRICT_SERIES[district];
  return neonColor(tones[i % tones.length]!).base;
}

/** Solid shade steps for series `i` (face, side, top, ...). */
export function seriesShades(i: number, district: District = 'midtown', color?: NeonColorInput): ShadeSteps {
  if (color) return shadeSteps(color);
  const tones = DISTRICT_SERIES[district];
  return shadeSteps(tones[i % tones.length]!);
}

/** The keyline under a line: royal under everything except royal, which takes night. */
export function keylineFor(color: string): string {
  const token: NeonToken | null = neonToken(color);
  if (token === 'royal' || color.toUpperCase() === brand.royal) return palette.royal[950];
  return brand.royal;
}
