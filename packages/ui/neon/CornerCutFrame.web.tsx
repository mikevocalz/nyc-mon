'use client';

import { View } from '../tw';
import type { CornerCutFrameProps } from './CornerCutFrame.types';
import { cornerCutClipPath, insetCut } from './corner-cut';
import { frameColors } from './frame-colors';
import { GLOW_INTENSITY, neonDropShadowFilter } from './glow';

/**
 * Web: three clipped layers. The depth plate is the frame shape offset down
 * and right; the border is the outer shape in the border colour; the face is
 * the same shape inset by the border width, with the cut shortened so the
 * diagonal edge keeps an even width. Glow is a CSS drop-shadow on the
 * wrapper, which follows the clipped alpha where box-shadow would not.
 *
 * The inline styles below are all geometry or colour computed from props
 * (clip-path polygon, depth offset, prop colours), which classes can't hold.
 */
export function CornerCutFrame({
  children,
  className,
  tone = 'orange',
  variant = 'solid',
  corner = 'bottom-right',
  cut = 16,
  borderWidth = 2,
  depth = 4,
  glow = false,
  radius = 0,
}: CornerCutFrameProps) {
  const colors = frameColors(tone, variant);
  // Opt-in rounding swaps the clip polygon for a border radius on each layer.
  const round = radius > 0;
  const outer = round ? undefined : cornerCutClipPath(cut, corner);
  const inner = round ? undefined : cornerCutClipPath(insetCut(cut, borderWidth), corner);
  const outerRadius = round ? radius : undefined;
  const innerRadius = round ? Math.max(0, radius - borderWidth) : undefined;
  const glowRadius = glow === false ? 0 : glow === true ? GLOW_INTENSITY.medium : GLOW_INTENSITY[glow];

  return (
    // Computed: the drop-shadow colour comes from the tone prop.
    <View className="relative" style={glowRadius ? { filter: neonDropShadowFilter(colors.glow, glowRadius) } : undefined}>
      {depth > 0 ? (
        <View
          aria-hidden
          className="pointer-events-none absolute inset-0"
          // Computed: depth offset and tone colour from props, clip polygon from cut.
          style={{ transform: [{ translateX: depth }, { translateY: depth }], backgroundColor: colors.depth, clipPath: outer, borderRadius: outerRadius } as object}
        />
      ) : null}
      <View
        // Computed: border width, tone colour and clip polygon from props.
        style={{ padding: borderWidth, backgroundColor: colors.border, clipPath: outer, borderRadius: outerRadius } as object}
      >
        <View
          className={className}
          // Computed: tone colour and inset clip polygon from props.
          style={{ backgroundColor: colors.fill, clipPath: inner, borderRadius: innerRadius } as object}
        >
          {children}
        </View>
      </View>
    </View>
  );
}
