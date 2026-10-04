'use client';

import Animated, { steps } from 'react-native-reanimated';
import { neonColor } from '../neon/colors';
import { neonTextGlow } from '../neon/glow';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import { Text as TWText, View } from '../tw';
import { useHot } from './hover';
import { GLOW_RADIUS, type EffectTextProps, type GlitchIntensity, type GlitchSpeed } from './types';

const OFFSET: Record<GlitchIntensity, number> = { subtle: 1, normal: 2, heavy: 4, chaos: 6 };
// Hold each keyframe, then jump: a slip, not a slide.
const HOLD = steps(1);
const DURATION: Record<GlitchSpeed, number> = { slow: 2000, normal: 1000, fast: 450, frenzy: 200 };

type Keyframes = Record<string, { transform: ({ translateX: number } | { translateY: number } | { skewX: string })[] }>;

/**
 * Misregistration jitter: the layer sits at its print offset most of the
 * loop and jumps in short bursts, like a screen print slipping on the press.
 * `sign` mirrors layer B against layer A.
 */
function jitter(o: number, sign: 1 | -1, chaos: boolean): Keyframes {
  const at = (x: number, y: number, skew = 0) => ({
    transform: [{ translateX: sign * x }, { translateY: sign * y }, { skewX: `${chaos ? sign * skew : 0}deg` }],
  });
  return {
    '0%': at(-o, 0),
    '8%': at(-o * 2, o / 2, 8),
    '12%': at(o, -o / 2),
    '16%': at(-o, 0),
    '52%': at(-o, 0),
    '56%': at(o * 1.5, o / 2, -6),
    '60%': at(-o / 2, -o),
    '64%': at(-o, 0),
    '100%': at(-o, 0),
  };
}

const FRAMES = new Map<string, Keyframes>();
function frames(intensity: GlitchIntensity, sign: 1 | -1) {
  const key = `${intensity}:${sign}`;
  let f = FRAMES.get(key);
  if (!f) {
    f = jitter(OFFSET[intensity], sign, intensity === 'chaos');
    FRAMES.set(key, f);
  }
  return f;
}

/**
 * NeonBlade's GlitchText, printed rather than projected: two solid copies in
 * colorA and colorB sit misregistered behind a solid face and jump in bursts
 * (Reanimated CSS keyframes, web and native). Hover mode plays while hovered
 * or a finger is down. Reduced motion keeps the static misprint and never
 * animates. The copies are hidden from assistive tech.
 */
export function GlitchText({
  children,
  className,
  accessibilityLabel,
  mode = 'hover',
  colorA = 'pink',
  colorB = 'cyan',
  intensity = 'normal',
  speed = 'normal',
  colors,
  glowColor,
  glowIntensity = 'none',
}: EffectTextProps) {
  const reduced = useReducedMotion();
  const { hot, handlers } = useHot();
  const face = neonColor(Array.isArray(colors) ? colors[0] ?? 'white' : colors ?? 'white').base;
  const a = neonColor(colorA).base;
  const b = neonColor(colorB).base;
  const o = OFFSET[intensity];
  const playing = !reduced && (mode === 'active' || hot);
  const glow = GLOW_RADIUS[glowIntensity];

  const layer = (color: string, sign: 1 | -1) => (
    <View aria-hidden className="absolute inset-0">
      <Animated.View
        // Reanimated CSS animation: per-frame transforms can't be classes.
        style={
          reduced
            ? { transform: [{ translateX: sign * -o }] }
            : {
                transform: [{ translateX: sign * -o }],
                animationName: frames(intensity, sign),
                animationDuration: DURATION[speed],
                animationIterationCount: 'infinite',
                animationTimingFunction: HOLD,
                animationPlayState: playing ? 'running' : 'paused',
              }
        }
      >
        {/* Layer colour is a runtime prop. */}
        <TWText className={className} style={{ color }}>
          {children}
        </TWText>
      </Animated.View>
    </View>
  );

  return (
    <View className="relative self-start" aria-label={accessibilityLabel} {...handlers}>
      {layer(a, 1)}
      {layer(b, -1)}
      {/* Face colour and glow are runtime props. */}
      <TWText className={className} style={{ color: face, ...(glow ? neonTextGlow(glowColor ?? face, glow) : null) }}>
        {children}
      </TWText>
    </View>
  );
}
