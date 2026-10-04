import { brand, palette } from '@acme/theme';

/**
 * NYC-MON colour vocabulary for the NeonBlade ports.
 *
 * NeonBlade components take `"cyan" | "pink" | "green" | (string & {})` and a
 * handful also accept orange, white, purple, red and yellow. Every preset maps
 * onto a NYC-MON family here, so a port can keep NeonBlade's prop values while
 * rendering in the brand. Brand token names (orange, royal, carolina, leaf,
 * apple, white, silver, ink) are accepted too, and anything else is treated as
 * a CSS colour and passed through.
 */

export type NeonToken = 'orange' | 'royal' | 'carolina' | 'leaf' | 'apple' | 'silver' | 'ink' | 'white';
export type NeonPreset = 'cyan' | 'pink' | 'green' | 'white' | 'orange' | 'purple' | 'red' | 'yellow';
/** A preset, a brand token, or any CSS colour string. */
export type NeonColorInput = NeonPreset | NeonToken | (string & {});

/** NeonBlade preset name to the NYC-MON family that plays its role. */
export const NEON_PRESET_TOKENS: Record<NeonPreset, NeonToken> = {
  cyan: 'carolina',
  pink: 'apple',
  green: 'leaf',
  white: 'white',
  orange: 'orange',
  purple: 'royal',
  red: 'apple',
  yellow: 'orange',
};

type Family = Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950, string>;

const FAMILIES: Record<Exclude<NeonToken, 'white'>, Family> = {
  orange: palette.orange,
  royal: palette.royal,
  carolina: palette.carolina,
  leaf: palette.leaf,
  apple: palette.apple,
  silver: palette.silver,
  ink: palette.ink,
};

/** The 500 step of each family is the brand anchor sampled from the logo. */
const TOKEN_BASE: Record<NeonToken, string> = {
  orange: brand.orange,
  royal: brand.royal,
  carolina: brand.carolina,
  leaf: brand.leaf,
  apple: brand.apple,
  silver: brand.silver,
  ink: brand.night,
  white: brand.white,
};

/** Which token an input names, or null for a raw CSS colour. */
export function neonToken(input: NeonColorInput): NeonToken | null {
  if (input in NEON_PRESET_TOKENS) return NEON_PRESET_TOKENS[input as NeonPreset];
  if (input in TOKEN_BASE) return input as NeonToken;
  return null;
}

/** The shade family behind a token. White has none, so it borrows silver's. */
export function neonFamily(token: NeonToken): Family {
  return token === 'white' ? palette.silver : FAMILIES[token];
}

export interface NeonColor {
  /** The colour itself: fills, strokes, text. */
  base: string;
  /** Accent glow colour. Orange glows royal (the brand pairing); the rest glow in their own hue. */
  glow: string;
  /** `base` at 15% for hover and selected tints. */
  soft: string;
  /** Text colour that reads on a `base` fill. */
  on: string;
  /** The token behind it, or null for a raw CSS colour. */
  token: NeonToken | null;
}

/**
 * Resolve a NeonBlade colour prop. The default is orange with a royal glow.
 *
 * @example neonColor('cyan')            // carolina
 * @example neonColor('pink', 'royal')   // apple, glowing royal
 * @example neonColor('#ff4400')         // passed through
 */
export function neonColor(input: NeonColorInput = 'orange', glow?: NeonColorInput): NeonColor {
  const token = neonToken(input);
  const base = token ? TOKEN_BASE[token] : input;
  const glowColor = glow !== undefined ? neonColor(glow).base : token === 'orange' ? brand.royal : base;
  // Royal and apple are the only brand fills dark enough to carry white text.
  const on = token === 'royal' || token === 'apple' ? brand.white : brand.night;
  return { base, glow: glowColor, soft: withAlpha(base, 0.15), on, token };
}

export type Rgba = [r: number, g: number, b: number, a: number];

/**
 * Parse #RGB, #RGBA, #RRGGBB, #RRGGBBAA, rgb() and rgba() into 0-1 floats,
 * ready for a GPU uniform. Brand tokens and presets resolve first. Returns
 * opaque black for anything unparseable rather than throwing mid-frame.
 */
export function parseColor(input: NeonColorInput): Rgba {
  const token = neonToken(input);
  const css = (token ? TOKEN_BASE[token] : input).trim();
  if (css === 'transparent') return [0, 0, 0, 0];
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(css);
  if (hex) {
    let digits = hex[1]!;
    if (digits.length <= 4) digits = digits.replace(/./g, (c) => c + c);
    const n = (i: number) => parseInt(digits.slice(i, i + 2), 16) / 255;
    return [n(0), n(2), n(4), digits.length === 8 ? n(6) : 1];
  }
  const fn = /^rgba?\(([^)]+)\)$/i.exec(css);
  if (fn) {
    const parts = fn[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
    const [r = 0, g = 0, b = 0, a = 1] = parts;
    return [r / 255, g / 255, b / 255, a];
  }
  return [0, 0, 0, 1];
}

const toHexByte = (v: number) =>
  Math.round(Math.min(1, Math.max(0, v)) * 255)
    .toString(16)
    .padStart(2, '0');

/** `rgba()` string for any input with its alpha replaced. */
export function withAlpha(input: NeonColorInput, alpha: number): string {
  const [r, g, b] = parseColor(input);
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${alpha})`;
}

/** `#RRGGBB` mix of two colours; t = 0 is `a`, t = 1 is `b`. */
export function mixColor(a: NeonColorInput, b: NeonColorInput, t: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  return `#${[0, 1, 2].map((i) => toHexByte(ca[i]! + (cb[i]! - ca[i]!) * t)).join('')}`.toUpperCase();
}
