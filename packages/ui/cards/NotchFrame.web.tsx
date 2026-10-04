'use client';

import { View } from '../tw';
import { neonDropShadowFilter } from '../neon/glow';
import { insetNotch, notchClipPath } from './notch';
import type { NotchFrameProps } from './NotchFrame.types';

/**
 * Web: three clipped layers, the same stack as CornerCutFrame. A depth plate
 * offset down and right, the border ring, then the face inset by the border
 * width with a notch shortened by that width so the ring stays even.
 * Inline styles hold only prop-driven values (clip polygons, colours,
 * offsets) that classes cannot express.
 */
export function NotchFrame({
  children, className, shape, fill, border, depthColor, glow, borderWidth = 3, depth = 6,
}: NotchFrameProps) {
  const outer = notchClipPath(shape);
  const inner = notchClipPath(insetNotch(shape, borderWidth));
  return (
    // Computed: drop-shadow follows the clipped alpha; colour is a prop.
    <View className="relative" style={glow ? { filter: neonDropShadowFilter(glow, 12) } : undefined}>
      {depth > 0 ? (
        <View
          aria-hidden
          className="pointer-events-none absolute inset-0"
          // Computed: depth offset, colour and clip polygon from props.
          style={{ transform: [{ translateX: depth }, { translateY: depth }], backgroundColor: depthColor, clipPath: outer } as object}
        />
      ) : null}
      {/* Computed: border width, colour and clip polygon from props. */}
      <View style={{ padding: borderWidth, backgroundColor: border, clipPath: outer } as object}>
        {/* Computed: face colour and inset clip polygon from props. */}
        <View className={className} style={{ backgroundColor: fill, clipPath: inner } as object}>
          {children}
        </View>
      </View>
    </View>
  );
}
