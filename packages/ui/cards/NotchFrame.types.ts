import type { ReactNode } from 'react';
import type { NotchShape } from './notch';

/**
 * A solid panel with notches bitten out of its sides: the shape behind
 * `<Card variant="notch">`. Colours arrive resolved, so the frame stays a
 * dumb drawing primitive and the card owns tone and district.
 */
export interface NotchFrameProps {
  children?: ReactNode;
  /** Classes for the face (padding, layout). */
  className?: string;
  shape: NotchShape;
  /** Face fill. */
  fill: string;
  /** Border ring colour. */
  border: string;
  /** Depth plate colour. */
  depthColor: string;
  /** Accent glow colour; leave out for no glow. */
  glow?: string;
  /** Border width, px. Default 3. */
  borderWidth?: number;
  /** Depth plate offset down and right, px. 0 drops it. Default 6. */
  depth?: number;
}
