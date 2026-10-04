import type { ReactNode } from 'react';
import type { NeonColorInput } from './colors';
import type { CutCorner } from './corner-cut';
import type { GlowIntensity } from './glow';

/**
 * A solid panel with cut corners, the shape behind NeonBlade's corner-cut
 * button, notch card and accent frame. Solid first: the face is filled, a
 * darker depth plate sits behind it, and glow is an opt-in accent.
 */
export interface CornerCutFrameProps {
  children?: ReactNode;
  /** Classes for the content box inside the frame (padding, layout). */
  className?: string;
  /** Colour family: NeonBlade preset, brand token or CSS colour. Default orange. */
  tone?: NeonColorInput;
  /**
   * solid: face fill in the tone with a darker keyline.
   * outline: night fill with a border in the tone.
   * Default solid.
   */
  variant?: 'solid' | 'outline';
  /** Which corner is cut. Default bottom-right, as in NeonBlade. */
  corner?: CutCorner;
  /** Cut length in px. Default 16 (useNeonSize('md').cut). */
  cut?: number;
  /** Border width in px. Default 2. */
  borderWidth?: number;
  /** Offset of the solid depth plate behind the face, in px. 0 drops it. Default 4. */
  depth?: number;
  /** Accent glow around the cut shape. Off by default. */
  glow?: boolean | GlowIntensity;
  /**
   * Opt-in rounding: a corner radius in px. When set (> 0) the frame draws a
   * rounded rectangle instead of the corner cut. Default 0: the neon cut.
   */
  radius?: number;
}
