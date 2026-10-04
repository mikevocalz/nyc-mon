'use client';

import { neonColor } from '../neon/colors';
import { neonDropShadowFilter } from '../neon/glow';
import { Follower, useFinePointer } from './follower.web';
import { CursorArrow } from './shapes';
import type { CursorGlow, PointerCursorProps } from './types';

const GLOW: Record<CursorGlow, number> = { none: 0, low: 6, medium: 10, high: 16 };

/**
 * The NYC-MON mouse pointer (in place of NeonBlade's FoxCursor): the solid
 * orange arrow on a royal outline follows the mouse, grows a little over
 * links and buttons and dips when pressed. Mouse and pen only; touch screens
 * keep their native behaviour. Reduced motion drops the springs.
 */
export function PointerCursor({
  color = 'orange',
  outlineColor = 'royal',
  glowColor = 'royal',
  glowIntensity = 'low',
  size = 28,
  hideNativeCursor = true,
  disabled = false,
  containerRef,
}: PointerCursorProps) {
  const fine = useFinePointer();
  if (disabled || !fine) return null;
  const glow = GLOW[glowIntensity];
  return (
    <Follower
      // The arrow's tip sits at (4, 2) of its 24-unit grid.
      anchor={{ x: (4 / 24) * size, y: (2 / 24) * size }}
      size={size}
      hideNativeCursor={hideNativeCursor}
      containerRef={containerRef}
      filter={glow ? neonDropShadowFilter(neonColor(glowColor).base, glow) : undefined}
    >
      {() => <CursorArrow size={size} color={color} outlineColor={outlineColor} />}
    </Follower>
  );
}
