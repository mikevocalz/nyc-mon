'use client';

import { neonColor } from '../neon/colors';
import { neonTextGlow } from '../neon/glow';
import { Text as TWText, View } from '../tw';
import { useHot } from './hover';
import { GLOW_RADIUS, type EffectTextProps } from './types';

/** Offsets around the letter for an outline of width w: 8 directions, 16 past 3px. */
function ring(w: number) {
  const steps = w > 3 ? 16 : 8;
  return Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return { x: Math.round(Math.cos(a) * w * 100) / 100, y: Math.round(Math.sin(a) * w * 100) / 100 };
  });
}

/**
 * NeonBlade's OutlineText as badge lettering: by default an orange fill with
 * a thick royal outline, exactly the wordmark's build. `fillColor:
 * "transparent"` gives NeonBlade's outline-only look. The outline is solid
 * copies of the text ringed around the face, which draws the same on web,
 * iOS and Android (React Native has no text stroke). Hover or press swaps to
 * the hover colours and lights the glow.
 */
export function OutlineText({
  children,
  className,
  accessibilityLabel,
  strokeColor = 'royal',
  fillColor = 'orange',
  strokeWidth = 3,
  hoverStrokeColor,
  hoverFillColor,
  glowColor,
  glowIntensity = 'normal',
}: EffectTextProps) {
  const { hot, handlers } = useHot();
  const stroke = neonColor(hot && hoverStrokeColor ? hoverStrokeColor : strokeColor).base;
  const fillInput = hot && hoverFillColor ? hoverFillColor : fillColor;
  const fill = fillInput === 'transparent' ? 'transparent' : neonColor(fillInput).base;
  const glow = hot ? GLOW_RADIUS[glowIntensity] : 0;
  const offsets = ring(strokeWidth);

  return (
    <View className="relative self-start" aria-label={accessibilityLabel} {...handlers}>
      {offsets.map(({ x, y }, i) => (
        <View
          key={i}
          aria-hidden
          className="absolute inset-0"
          // Computed geometry: one ring step of the outline.
          style={{ transform: [{ translateX: x }, { translateY: y }] }}
        >
          {/* Outline colour is a runtime prop; the glow rides on the first copy only. */}
          <TWText className={className} style={{ color: stroke, ...(i === 0 && glow ? neonTextGlow(glowColor ?? stroke, glow) : null) }}>
            {children}
          </TWText>
        </View>
      ))}
      {fill === 'transparent' ? (
        // Outline only: knock the face out with the surface behind it.
        <TWText className={`${className} text-surface`}>{children}</TWText>
      ) : (
        <TWText className={className} style={{ color: fill }}>
          {children}
        </TWText>
      )}
    </View>
  );
}
