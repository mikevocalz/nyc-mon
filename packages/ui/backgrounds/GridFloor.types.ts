import type { ReactNode } from 'react';

/**
 * Synthwave perspective floor. The prop API matches NeonBlade UI's Grid Floor
 * (horizon, columns, rows, lineColor, glowColor, bgColor, speed, opacity,
 * lineWidth); the renderer is the starter's Skia canvas on every platform.
 */
export interface GridFloorProps {
  className?: string;
  children?: ReactNode;
  /** Horizon line as a fraction of container height (0 to 1). Default 0.45. */
  horizon?: number;
  /** Vertical perspective lines. Default 24. */
  columns?: number;
  /** Horizontal rows receding to the horizon. Default 18. */
  rows?: number;
  /** Grid line colour. Default: brand orange. */
  lineColor?: string;
  /** Glow under each row. Default: brand royal blue. */
  glowColor?: string;
  /** Soft band along the horizon. Default: brand carolina blue. Pass 'transparent' to drop it. */
  horizonGlowColor?: string;
  /** Background fill (NeonBlade name). Default: brand night. */
  bgColor?: string;
  /** Starter alias for bgColor; bgColor wins when both are set. */
  backgroundColor?: string;
  /** Forward scroll speed; 0 stops it. Forced to 0 under reduced motion. Default 0.6. */
  speed?: number;
  /** Peak line opacity (0 to 1). Default 0.85. */
  opacity?: number;
  /** Line width in px. Default 1. */
  lineWidth?: number;
}
