import { brand, palette } from '@acme/theme';
import { mixColor } from '../neon/colors.ts';
import type { District } from './districts.ts';

/**
 * The solid colour set of each district. Every value comes from the theme
 * palette (or a mix of two palette steps), so the backgrounds stay on brand.
 */
export interface DistrictTheme {
  /** Sky bands, top to horizon. Drawn as solid steps, never a gradient. */
  sky: string[];
  /** Building body colours. */
  bodies: string[];
  /** Crowns, lane lights, crest highlights. */
  accent: string;
  /** Window light. */
  light: string;
  /** Aviation beacons on spires and masts. */
  beacon: string;
  /** Street and ground plane. */
  ground: string;
  /** Block tops on street-grid backgrounds. */
  block: string;
  /** Water bands, far to near. */
  water: string[];
  /** Window frames and mullions. */
  frame: string;
}

const brick = mixColor(palette.apple[900], palette.orange[900], 0.5);
const brickDeep = mixColor(palette.apple[950], palette.orange[950], 0.5);

/** The background colour set per district (CityBlocks, skylines, rain, river...). */
export const THEMES: Record<District, DistrictTheme> = {
  // FiDi at night: royal glass, orange lights, the harbour in royal steps.
  downtown: {
    sky: [brand.night, palette.royal[950], palette.royal[900], palette.royal[800]],
    bodies: [palette.royal[800], palette.royal[900], palette.ink[800], palette.carolina[900]],
    accent: brand.orange,
    light: palette.orange[300],
    beacon: palette.apple[400],
    ground: palette.ink[950],
    block: palette.royal[900],
    water: [palette.royal[800], palette.royal[900], palette.royal[700], palette.royal[950], palette.royal[800], palette.royal[900]],
    frame: palette.royal[900],
  },
  // Midtown: Deco stone in ink and silver, warm lights, orange crowns.
  midtown: {
    sky: [brand.night, palette.ink[900], palette.royal[950], palette.royal[900]],
    bodies: [palette.ink[800], palette.ink[700], palette.silver[900], palette.royal[900]],
    accent: brand.orange,
    light: palette.orange[200],
    beacon: palette.apple[400],
    ground: palette.ink[950],
    block: palette.ink[800],
    water: [palette.carolina[900], palette.royal[900], palette.carolina[800], palette.royal[950], palette.carolina[900], palette.royal[900]],
    frame: palette.ink[800],
  },
  // Harlem: brownstone brick, warm light, apple-red accents; the East River.
  harlem: {
    sky: [brand.night, palette.ink[900], palette.royal[950], brickDeep],
    bodies: [palette.orange[900], brick, palette.apple[900], palette.orange[950]],
    accent: palette.apple[500],
    light: palette.orange[300],
    beacon: palette.apple[400],
    ground: palette.ink[950],
    block: palette.orange[950],
    water: [palette.ink[800], palette.royal[950], palette.ink[700], palette.ink[900], palette.royal[900], palette.ink[900]],
    frame: palette.orange[950],
  },
  // Mega City: the grid at future scale, royal mass with carolina light.
  megacity: {
    sky: [palette.ink[950], palette.royal[950], palette.royal[900], palette.royal[700]],
    bodies: [palette.royal[700], palette.royal[900], palette.ink[800], palette.carolina[800]],
    accent: brand.carolina,
    light: palette.carolina[300],
    beacon: palette.carolina[200],
    ground: palette.ink[950],
    block: palette.royal[800],
    water: [palette.carolina[800], palette.royal[800], palette.carolina[700], palette.royal[900], palette.carolina[800], palette.royal[700]],
    frame: palette.carolina[900],
  },
};

/** Stepped colours from `a` to `b`, inclusive: solid bands instead of a gradient. */
export function steps(a: string, b: string, count: number): string[] {
  if (count <= 1) return [a];
  return Array.from({ length: count }, (_, i) => mixColor(a, b, i / (count - 1)));
}

/** The full stepped sky for a theme, `count` bands from top to horizon. */
export function skyBands(theme: DistrictTheme, count = 6): string[] {
  const out: string[] = [];
  const stops = theme.sky;
  for (let i = 0; i < count; i++) {
    const t = (i / Math.max(1, count - 1)) * (stops.length - 1);
    const k = Math.min(stops.length - 2, Math.floor(t));
    out.push(mixColor(stops[k]!, stops[k + 1]!, t - k));
  }
  return out;
}
