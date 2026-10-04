import { brand } from '@acme/theme';
import { mixColor, neonFamily, neonToken, parseColor, type NeonColorInput } from './colors.ts';

/**
 * Solid shade steps: the primary building block for NYC-MON surfaces.
 *
 * The look is solid filled shapes, and depth comes from stacking layers in
 * stepped shades of one colour family, the way a sports badge stacks a face,
 * a darker bevel and a near-black keyline. Glow is an accent on top, never
 * the structure.
 *
 * Brand tokens read straight from their palette family, so the steps match
 * the Tailwind classes (`bg-orange-700` is `shadeSteps('orange').side`). Raw
 * CSS colours are mixed toward the banner white and the night keyline.
 */
export interface ShadeSteps {
  /** Brightest step: rim light, the lit edge of a roof or bevel. */
  highlight: string;
  /** Surfaces facing the light: roofs, the top of a raised panel. */
  top: string;
  /** The colour itself: the main face. */
  face: string;
  /** Surfaces turned away from the light: building sides, the panel's depth plate. */
  side: string;
  /** Deep recesses: the side facing furthest from the light, unlit windows. */
  deep: string;
  /** Cast shadow and keyline, almost night. */
  shadow: string;
}

export function shadeSteps(input: NeonColorInput): ShadeSteps {
  const token = neonToken(input);
  if (token === 'white') {
    const silver = neonFamily('silver');
    return { highlight: brand.white, top: silver[50], face: brand.white, side: silver[400], deep: silver[600], shadow: silver[800] };
  }
  if (token) {
    const f = neonFamily(token);
    return { highlight: f[300], top: f[400], face: f[500], side: f[700], deep: f[900], shadow: f[950] };
  }
  const base = mixColor(input, input, 0);
  return {
    highlight: mixColor(base, brand.white, 0.5),
    top: mixColor(base, brand.white, 0.22),
    face: base,
    side: mixColor(base, brand.night, 0.35),
    deep: mixColor(base, brand.night, 0.65),
    shadow: mixColor(base, brand.night, 0.85),
  };
}

/** Shade steps as 0-1 RGBA tuples, for GPU uniforms and instance buffers. */
export function shadeStepsRgba(input: NeonColorInput) {
  const s = shadeSteps(input);
  return {
    highlight: parseColor(s.highlight),
    top: parseColor(s.top),
    face: parseColor(s.face),
    side: parseColor(s.side),
    deep: parseColor(s.deep),
    shadow: parseColor(s.shadow),
  };
}
