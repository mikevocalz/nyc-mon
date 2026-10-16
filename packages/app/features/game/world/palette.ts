// The city's material colours, every one derived from @acme/theme palette
// steps (no hex literal lives here; the tokens file owns them). Some city
// materials have no single token, so they are a fixed mix of two or three
// steps; docs/implementation/city-world.md lists each recipe. Pure: no three
// import, so node tests can pin the values.
import { palette } from '@acme/theme';

const { orange, royal, carolina, leaf, apple, ink, concrete } = palette;

function channels(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1, 7), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Linear blend of two `#RRGGBB` tokens in display space; t = 0 gives `a`. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = channels(a);
  const cb = channels(b);
  const k = Math.max(0, Math.min(1, t));
  const out = ca.map((v, i) => Math.round(v + (cb[i]! - v) * k));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** `#RRGGBB` to 0..1 channels, for vertex colours. */
export function hexToRgb(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex);
  return [r / 255, g / 255, b / 255];
}

export const CITY_COLORS = {
  // Sky and air: a warm afternoon over Harlem.
  skyZenith: mixHex(carolina[400], royal[300], 0.25),
  skyHorizon: mixHex(carolina[100], orange[50], 0.55),
  sunGlow: orange[100],
  sun: orange[50],
  hemiSky: carolina[100],
  hemiGround: concrete[400],
  // Ground and land use.
  ground: mixHex(concrete[200], orange[100], 0.25),
  park: mixHex(leaf[400], leaf[500], 0.35),
  garden: leaf[400],
  grass: leaf[300],
  pitch: leaf[500],
  playground: orange[200],
  plaza: concrete[100],
  parking: concrete[300],
  school: mixHex(concrete[200], orange[200], 0.3),
  water: mixHex(carolina[500], royal[400], 0.3),
  // Streets.
  asphalt: ink[700],
  laneYellow: orange[300],
  laneWhite: concrete[50],
  sidewalk: concrete[300],
  curb: concrete[400],
  // Facades, by material class.
  brownstone: mixHex(orange[900], concrete[700], 0.35),
  brick: mixHex(mixHex(orange[800], apple[800], 0.5), concrete[500], 0.3),
  nycha: mixHex(mixHex(orange[800], apple[900], 0.5), concrete[600], 0.25),
  glass: mixHex(carolina[700], concrete[400], 0.35),
  civic: mixHex(concrete[100], orange[50], 0.5),
  church: mixHex(concrete[400], orange[200], 0.3),
  plain: concrete[200],
  roof: concrete[600],
  window: mixHex(ink[800], carolina[900], 0.4),
  // Trees and shadow.
  leafLight: leaf[500],
  leafDark: leaf[700],
  trunk: mixHex(orange[950], ink[800], 0.4),
  shadow: ink[900],
  // Landmarks.
  marquee: apple[500],
  marqueeLights: orange[200],
  terracotta: concrete[50],
  beacon: royal[400],
} as const;

export type CityColor = keyof typeof CITY_COLORS;
