'use client';
import { led } from '@acme/theme';
import { View } from '../tw';
import { FAN_POLYGON, type ScannerFanProps } from './ScannerFan.types';

const CLIP = `polygon(${FAN_POLYGON.map(([x, y]) => `${x}% ${y}%`).join(', ')})`;

/**
 * PLATFORM FORK (web): the fan wedge as a clipped gradient. Inline style
 * because clip-path and the gradient are computed geometry, which classes
 * cannot hold (same as neon/CornerCutFrame.web.tsx).
 */
export function ScannerFan({ widthPt, heightPt }: ScannerFanProps) {
  return (
    <View
      aria-hidden
      style={{
        width: widthPt,
        height: heightPt,
        clipPath: CLIP,
        backgroundImage: `linear-gradient(to top, ${led.on}, ${led.on}00)`,
      } as object}
    />
  );
}
