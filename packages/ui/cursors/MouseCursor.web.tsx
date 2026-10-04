'use client';

import { Follower, useFinePointer } from './follower.web';
import { MouseFace } from './shapes';
import type { MouseCursorProps } from './types';

/**
 * NeonBlade's FoxCursor with a mouse face. The geometric mouse is centred on
 * the pointer and moves exactly with it: no chase, no lag, no hover effects.
 * Position lives in Reanimated shared values (see Follower), so moving the
 * mouse never re-renders React. Hides the OS cursor on the page, or only
 * inside `containerRef` when given. Mouse and pen only; touch screens keep
 * their native behaviour. Nothing animates, so reduced motion changes nothing.
 */
export function MouseCursor({
  color = 'orange',
  glowColor,
  size = 64,
  strokeWidth = 2,
  glowIntensity = 'medium',
  fillOpacity = 0,
  hideNativeCursor = true,
  disabled = false,
  containerRef,
}: MouseCursorProps) {
  const fine = useFinePointer();
  if (disabled || !fine) return null;
  return (
    <Follower
      anchor={{ x: size / 2, y: size / 2 }}
      size={size}
      hideNativeCursor={hideNativeCursor}
      containerRef={containerRef}
      interactive={false}
    >
      {() => (
        <MouseFace
          size={size}
          color={color}
          glowColor={glowColor}
          strokeWidth={strokeWidth}
          glowIntensity={glowIntensity}
          fillOpacity={fillOpacity}
        />
      )}
    </Follower>
  );
}
