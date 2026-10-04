'use client';
// First: Reanimated reads __DEV__ at module load, and web bundlers don't define it.
import '../rn-globals-shim';

import Animated from 'react-native-reanimated';
import { neonColor } from '../neon/colors';
import { neonTextGlow } from '../neon/glow';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import { Text as TWText, View } from '../tw';
import { GLOW_RADIUS, type EffectTextProps } from './types';

const PULSE = {
  from: { opacity: 0.35 },
  to: { opacity: 1 },
};

/**
 * NeonBlade's NeonGlow, NYC-MON style. The letters are solid first: the face
 * colour over a stack of solid drop layers (each extra colour steps down and
 * right, the way jersey lettering stacks orange on royal on night). The glow
 * is an accent on its own layer behind the face, and `animate` pulses only
 * that layer. Reduced motion holds the glow steady.
 */
export function NeonGlowText({
  children,
  className,
  accessibilityLabel,
  colors = 'orange',
  glowColor,
  glowIntensity = 'normal',
  animate = false,
}: EffectTextProps) {
  const reduced = useReducedMotion();
  const stack = (Array.isArray(colors) ? colors : [colors]).map((c) => neonColor(c).base);
  const face = stack[0] ?? neonColor('orange').base;
  const glow = GLOW_RADIUS[glowIntensity];
  const glowTint = glowColor ? neonColor(glowColor).base : face;
  const pulse = animate && !reduced;

  return (
    <View className="relative self-start" aria-label={accessibilityLabel}>
      {stack
        .slice(1)
        .map((color, i) => ({ color, step: (i + 1) * 3 }))
        .reverse()
        .map(({ color, step }) => (
          <View
            key={step}
            aria-hidden
            className="absolute inset-0"
            // Computed geometry: each drop layer steps by its index.
            style={{ transform: [{ translateX: step }, { translateY: step }] }}
          >
            <TWText className={className} style={{ color }}>
              {children}
            </TWText>
          </View>
        ))}
      {glow ? (
        <View aria-hidden className="absolute inset-0">
          <Animated.View
            // Reanimated CSS animation on the glow layer only.
            style={
              pulse
                ? { animationName: PULSE, animationDuration: 1600, animationIterationCount: 'infinite', animationDirection: 'alternate', animationTimingFunction: 'ease-in-out' }
                : undefined
            }
          >
            {/* Glow colour and radius are runtime props. */}
            <TWText className={className} style={{ color: face, ...neonTextGlow(glowTint, glow) }}>
              {children}
            </TWText>
          </Animated.View>
        </View>
      ) : null}
      <TWText className={className} style={{ color: face }}>
        {children}
      </TWText>
    </View>
  );
}
