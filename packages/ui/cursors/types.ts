import type { RefObject } from 'react';
import type { NeonColorInput } from '../neon/colors';

export type CursorGlow = 'none' | 'low' | 'medium' | 'high';

interface CursorBase {
  /** Hide the OS cursor while the custom one is mounted (inside `containerRef` when given). Default true. */
  hideNativeCursor?: boolean;
  /** Turn the custom cursor off. */
  disabled?: boolean;
  /**
   * Contain the cursor to this element: it tracks relative to it, hides when
   * the pointer leaves, and only hides the OS cursor inside it. Render the
   * cursor inside that element (which needs relative positioning).
   */
  containerRef?: RefObject<HTMLElement | null>;
  /** Accent glow. Default low. */
  glowIntensity?: CursorGlow;
}

/**
 * NeonBlade's FoxCursor with a mouse face: a geometric line-art mouse centred
 * on the pointer, moving exactly with it.
 */
export interface MouseCursorProps extends CursorBase {
  /** Line colour: a NeonBlade preset, a brand token or any CSS colour. Default orange. */
  color?: NeonColorInput;
  /** Glow colour. Default: the colour's paired glow (orange glows royal). */
  glowColor?: NeonColorInput;
  /** Width and height of the face in px. Default 64. */
  size?: number;
  /** Line weight, in the same units as NeonBlade's fox. Default 2. */
  strokeWidth?: number;
  /** Translucent face fill, 0 (lines only) to 1. Default 0. */
  fillOpacity?: number;
}

/** The NYC-MON arrow pointer, a separate cursor from the mouse face. */
export interface PointerCursorProps extends CursorBase {
  /** Fill. Default orange. */
  color?: NeonColorInput;
  /** Outline. Default royal. */
  outlineColor?: NeonColorInput;
  /** Glow colour. Default royal. */
  glowColor?: NeonColorInput;
  /** Arrow height in px. Default 28. */
  size?: number;
}

/** NeonBlade's Crosshair, drawn as a rounded-square reticle. */
export interface CrosshairProps extends CursorBase {
  /** Brackets and dot. Default orange; over links and buttons it switches to `hotColor`. */
  color?: NeonColorInput;
  /** Colour over interactive elements. Default carolina. */
  hotColor?: NeonColorInput;
  outlineColor?: NeonColorInput;
  accentColor?: NeonColorInput;
  /** Default 44. */
  size?: number;
  /** Spin. Default true; off under reduced motion. */
  animated?: boolean;
  /** Seconds per turn. Default 8. */
  outerSpeed?: number;
  /** Seconds per turn, counter-rotating. Default 5. */
  innerSpeed?: number;
}
