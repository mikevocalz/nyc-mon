'use client';

import { useSyncExternalStore } from 'react';
import { neonColor } from '../neon/colors';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import { Text as TWText, View } from '../tw';
import { useHot } from './hover';
import type { EffectTextProps } from './types';

const HOVER = '(hover: hover)';
const subscribe = (cb: () => void) => {
  const list = window.matchMedia(HOVER);
  list.addEventListener('change', cb);
  return () => list.removeEventListener('change', cb);
};

/**
 * NeonBlade's BlurText on web: soft until the pointer reaches it, then sharp.
 * Only where the device can hover; a touch-only screen gets sharp text, since
 * nothing there could ever unblur it. Reduced motion swaps without easing.
 */
export function BlurText({ children, className, accessibilityLabel, colors }: EffectTextProps) {
  const canHover = useSyncExternalStore(subscribe, () => window.matchMedia(HOVER).matches, () => false);
  const reduced = useReducedMotion();
  const { hot, handlers } = useHot();
  const color = neonColor(Array.isArray(colors) ? colors[0] ?? 'white' : colors ?? 'white').base;
  const blurred = canHover && !hot;
  return (
    <View className="self-start" aria-label={accessibilityLabel} {...handlers}>
      <TWText
        className={className}
        // Web-only CSS filter driven by hover state; colour is a runtime prop.
        style={{
          color,
          filter: blurred ? 'blur(4px)' : 'blur(0px)',
          transitionProperty: reduced ? 'none' : 'filter',
          transitionDuration: '300ms',
        } as object}
      >
        {children}
      </TWText>
    </View>
  );
}
