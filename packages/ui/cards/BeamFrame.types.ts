import type { ReactNode } from 'react';
import type { CutCorner } from '../neon/corner-cut';

/**
 * Beam animation, a subset of NeonBlade's border-beam variants.
 * - single: one beam runs the border clockwise.
 * - dual: a second beam in `beamB` runs the other way.
 * - pulse: one beam that dims and brightens as it travels.
 * NeonBlade's rainbow and gradient-sweep are left out: rainbow leaves the
 * palette, and the solid direction has no gradient beams.
 */
export type BeamVariant = 'single' | 'dual' | 'pulse';

export interface BeamFrameProps {
  children?: ReactNode;
  /** Classes for the face (padding, layout). */
  className?: string;
  corner?: CutCorner | 'none';
  /** Corner cut, px. Default 20. */
  cut?: number;
  /** Width of the border track the beam runs in, px. Default 3. */
  borderWidth?: number;
  /** Face fill. */
  fill: string;
  /** Border track colour (the unlit ring). */
  track: string;
  /** Beam colour. */
  beam: string;
  /** Beam tail colour, a darker step of the beam. */
  tail: string;
  /** Second beam for `dual`. */
  beamB?: string;
  /** Depth plate colour. */
  depthColor: string;
  /** Depth plate offset, px. Default 6. */
  depth?: number;
  variant?: BeamVariant;
  /** Seconds per lap. Default 4. */
  duration?: number;
  /** Seconds per lap of the second beam. Default 6. */
  durationB?: number;
  /** Freeze the beam (reduced motion). */
  still?: boolean;
}

/** Side of the square rotor that covers the frame at every angle. */
export function rotorSize(width: number, height: number): number {
  return Math.ceil(Math.hypot(width, height)) + 2;
}

/** Beam bar width, px: wide enough to read on a phone card, capped on wide ones. */
export function beamWidth(width: number, height: number): number {
  return Math.round(Math.max(40, Math.min(150, Math.min(width, height) * 0.55)));
}
