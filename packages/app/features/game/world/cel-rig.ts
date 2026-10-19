// The city's cel rig: the dsts-viewer studio rig (lighting model after the
// dsts-viewer cel shader, nuffle.me/dsts-viewer) turned to follow the sun,
// with its light levels kept and its hues taken from the palette. Pure apart
// from the shared @acme/ui helpers, so node tests can pin the values.
import { DSTS_DEFAULT_RIG, hemisphereSH, rigAroundSun, SH_L0, type CelRigValues } from '@acme/ui/three/cel';
import { CITY_COLORS, hexToRgb } from './palette.ts';

type Rgb = readonly [number, number, number];

const luminance = (c: Rgb) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** `color`'s hue at `level` times the luminance of `reference`. */
export function atLuminanceOf(color: Rgb, reference: Rgb, level = 1): [number, number, number] {
  const k = (luminance(reference) * level) / Math.max(luminance(color), 1e-6);
  return [color[0] * k, color[1] * k, color[2] * k];
}

/**
 * The key's share of the studio rig's level. Under linear output with no
 * tone mapping, the full studio key plus fills pushes the pale palette steps
 * (plaza, civic, ground) past 1 on sunlit roofs; 0.75 kept them just under.
 * At dusk (D17) the key drops to 0.62 so the lit windows and neon, added
 * after the cel colour, read against the walls.
 */
export const KEY_LEVEL = 0.62;
/** Ramp stand-in (in ramp u): shadow/mid edge at the terminator, mid/lit edge near N.L 0.55, a hair of softening. */
export const CITY_RAMP = [0.5, 0.68, 0.006] as const;
export const CITY_BANDS = [0.12, 0.55, 1] as const;

/** Linear rgb: the palette is authored as display values and fed straight through (see materials.ts). */
const rgb = (key: keyof typeof CITY_COLORS): Rgb => hexToRgb(CITY_COLORS[key]);

export function cityCelRig(sun: Rgb): CelRigValues {
  const dirs = rigAroundSun(sun);
  const studio = DSTS_DEFAULT_RIG;
  const sky = rgb('hemiSky');
  const ground = rgb('hemiGround');
  // The studio's flat SH ambient level, spread over the palette's sky and
  // ground instead of the same grey all round.
  const shLevel = (SH_L0 * studio.shL0) / Math.PI;
  const spread = 2 / (luminance(sky) + luminance(ground));
  const scaled = (c: Rgb): Rgb => [c[0] * spread, c[1] * spread, c[2] * spread];
  return {
    key: { dir: dirs.key, color: atLuminanceOf(rgb('sun'), studio.key.color, KEY_LEVEL) },
    fill1: { dir: dirs.fill1, color: atLuminanceOf(sky, studio.fill1.color) },
    fill2: { dir: dirs.fill2, color: atLuminanceOf(ground, studio.fill2.color) },
    sh: hemisphereSH(scaled(sky), scaled(ground), shLevel),
    ramp: CITY_RAMP,
    bands: CITY_BANDS,
    cool: atLuminanceOf(sky, [1, 1, 1]),
    // A faint dark-neutral sheen, as most DSTS materials author it.
    rimColor: [0.06, 0.06, 0.06],
    rimBase: [6, 1, 0.5],
  };
}
