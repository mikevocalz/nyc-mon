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

/** The NYC-MON pointer, standing in for NeonBlade's FoxCursor. */
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
