import type { ReactNode } from 'react';
import type { NeonColorInput } from '../neon/colors';

export type GlitchIntensity = 'subtle' | 'normal' | 'heavy' | 'chaos';
export type GlitchSpeed = 'slow' | 'normal' | 'fast' | 'frenzy';
export type GlowLevel = 'none' | 'subtle' | 'normal' | 'strong' | 'intense';

/**
 * Options for the effect variants of the kit Text. Each option names the
 * variant that reads it; the others ignore it. Colours take a NeonBlade
 * preset (cyan, pink, green...), a brand token or any CSS colour.
 */
export interface TextEffectOptions {
  /** glitch: "hover" glitches while hovered or pressed, "active" always. Default hover. */
  mode?: 'hover' | 'active';
  /** glitch: the first misprint layer. Default pink (apple). */
  colorA?: NeonColorInput;
  /** glitch: the second misprint layer. Default cyan (carolina). */
  colorB?: NeonColorInput;
  /** glitch: layer offset, 1 to 6 px. Default normal. */
  intensity?: GlitchIntensity;
  /** glitch: loop length. Default normal (1s). */
  speed?: GlitchSpeed;
  /**
   * neonGlow: one colour, or a stack: the first is the face, each next one
   * is a solid drop layer behind it (the sports-lettering shadow stack).
   * glitch, outline: the face colour. Default white for glitch, orange elsewhere.
   */
  colors?: NeonColorInput | NeonColorInput[];
  /** neonGlow, glitch, outline: accent glow colour. Default: the face colour. */
  glowColor?: NeonColorInput;
  /** neonGlow, outline (on hover), glitch: glow strength. Default normal for neonGlow, none elsewhere. */
  glowIntensity?: GlowLevel;
  /** neonGlow: pulse the glow. Stops under reduced motion. Default false. */
  animate?: boolean;
  /** outline: the outline colour. Default royal, the wordmark's outline. */
  strokeColor?: NeonColorInput;
  /** outline: the fill. "transparent" for outline only. Default orange. */
  fillColor?: NeonColorInput;
  /** outline: outline width in px. Default 3. */
  strokeWidth?: number;
  /** outline: outline colour while hovered or pressed. */
  hoverStrokeColor?: NeonColorInput;
  /** outline: fill while hovered or pressed. */
  hoverFillColor?: NeonColorInput;
}

export interface EffectTextProps extends TextEffectOptions {
  children?: ReactNode;
  /** Typography classes from the Text variant plus the caller's className. No colour classes. */
  className: string;
  /** Spoken text when children is not a plain string. */
  accessibilityLabel?: string;
}

export const GLOW_RADIUS: Record<GlowLevel, number> = { none: 0, subtle: 5, normal: 10, strong: 18, intense: 28 };
