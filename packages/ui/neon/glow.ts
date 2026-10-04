import { withAlpha, type NeonColorInput } from './colors.ts';

/** NeonBlade's glow intensity presets (corner-cut button `glowIntensity`), in px. */
export const GLOW_INTENSITY = { low: 8, medium: 15, high: 28 } as const;
export type GlowIntensity = keyof typeof GLOW_INTENSITY;

const radiusOf = (intensity: GlowIntensity | number) =>
  typeof intensity === 'number' ? intensity : GLOW_INTENSITY[intensity];

/**
 * Accent glow for a rectangular view, as a style fragment.
 *
 * Returns a CSS `boxShadow` string. React Native Web maps it to CSS
 * box-shadow; React Native 0.88 renders it natively on iOS and Android (both
 * BaseViewConfigs register `boxShadow`, New Architecture only). Two layers:
 * a tight bright core and a wide soft halo.
 *
 * It belongs in `style`, not a class, only because the colour is a runtime
 * prop. For the two brand glows use the `shadow-glow-orange` and
 * `shadow-glow-royal` classes instead.
 *
 * Glow follows the view's rectangle (and border radius). For cut corners and
 * other non-rectangular shapes, draw the glow with Skia `BlurMask` (see
 * CornerCutFrame.native) or CSS `filter: drop-shadow` on web.
 */
export function neonGlow(color: NeonColorInput, intensity: GlowIntensity | number = 'medium') {
  const r = radiusOf(intensity);
  return {
    boxShadow: `0 0 ${Math.round(r / 3)}px ${withAlpha(color, 0.9)}, 0 0 ${r}px ${withAlpha(color, 0.45)}`,
  } as const;
}

/**
 * Glow that follows a shape's alpha, for web only: CSS drop-shadow respects
 * clip-path, which box-shadow does not. React Native's `filter: drop-shadow`
 * is Android-only, so native callers use Skia instead.
 */
export function neonDropShadowFilter(color: NeonColorInput, intensity: GlowIntensity | number = 'medium') {
  const r = radiusOf(intensity);
  return `drop-shadow(0 0 ${Math.round(r / 3)}px ${withAlpha(color, 0.9)}) drop-shadow(0 0 ${r}px ${withAlpha(color, 0.45)})`;
}

/** Text glow as React Native text-shadow props; works on web, iOS and Android. */
export function neonTextGlow(color: NeonColorInput, intensity: GlowIntensity | number = 'low') {
  return {
    textShadowColor: withAlpha(color, 0.85),
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: radiusOf(intensity),
  } as const;
}
