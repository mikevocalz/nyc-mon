'use client';

import { neonColor } from '../neon/colors';
import { neonDropShadowFilter } from '../neon/glow';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import { Follower, useFinePointer } from './follower.web';
import { ReticleShape } from './shapes';
import type { CrosshairProps, CursorGlow } from './types';

const GLOW: Record<CursorGlow, number> = { none: 0, low: 6, medium: 10, high: 16 };

/**
 * NeonBlade's Crosshair as the NYC-MON reticle: a rounded square of corner
 * brackets with a counter-rotating diamond and a centre dot, centred on the
 * pointer. Over links and buttons it takes `hotColor` and grows; pressed, it
 * tightens. Mouse and pen only. Reduced motion stops the spin.
 */
export function Crosshair({
  color = 'orange',
  hotColor = 'carolina',
  outlineColor = 'royal',
  accentColor = 'carolina',
  glowIntensity = 'low',
  size = 44,
  animated = true,
  outerSpeed = 8,
  innerSpeed = 5,
  hideNativeCursor = true,
  disabled = false,
  containerRef,
}: CrosshairProps) {
  const fine = useFinePointer();
  const reduced = useReducedMotion();
  if (disabled || !fine) return null;
  const glow = GLOW[glowIntensity];
  return (
    <Follower
      anchor={{ x: size / 2, y: size / 2 }}
      size={size}
      hideNativeCursor={hideNativeCursor}
      containerRef={containerRef}
      filter={glow ? neonDropShadowFilter(neonColor(outlineColor).base, glow) : undefined}
    >
      {({ hot }) => (
        <ReticleShape
          size={size}
          color={hot ? hotColor : color}
          outlineColor={outlineColor}
          accentColor={hot ? color : accentColor}
          animated={animated && !reduced}
          outerSpeed={outerSpeed}
          innerSpeed={innerSpeed}
        />
      )}
    </Follower>
  );
}
