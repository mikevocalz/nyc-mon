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
 * NeonBlade's FoxCursor as an animated NYC-MON city mouse that chases the
 * pointer, sits and nibbles its pizza when the pointer rests.
 */
export interface MouseCursorProps extends Omit<CursorBase, 'hideNativeCursor'> {
  /** Drawing width in px. Default 48. */
  size?: number;
  /** chase: runs after the pointer and catches up. snap: nose pinned to the pointer, like the fox. Default chase. */
  follow?: 'chase' | 'snap';
  /** Chase speed, share of the gap closed per second (higher is quicker). Default 8. */
  speed?: number;
  /** ms the pointer must rest before the mouse sits down. Default 900. */
  idleAfter?: number;
  /** The slice of pizza it carries. Default true. */
  pizza?: boolean;
  /** Glow colour. Default royal. */
  glowColor?: NeonColorInput;
  /**
   * Hide the OS cursor. Default false: the mouse runs behind the pointer, so
   * the arrow stays for precise pointing. Turn on with follow="snap".
   */
  hideNativeCursor?: boolean;
}

/** The NYC-MON arrow pointer, a separate cursor from the mouse character. */
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
