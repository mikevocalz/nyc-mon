'use client';
// First: Reanimated reads __DEV__ at module load, and web bundlers don't define it.
import '../rn-globals-shim';

import Animated, { type CSSAnimationKeyframes } from 'react-native-reanimated';
import { View } from '../tw';

/** What the mouse is doing: scurrying after the pointer, or sitting with its pizza. */
export type MousePose = 'run' | 'idle';

export interface CityMouseProps {
  /** Width of the drawing in px; height is 0.75 of it. Default 48. */
  size?: number;
  pose?: MousePose;
  /** Mirror it to face left. */
  facingLeft?: boolean;
  /** Hold every part still (reduced motion). */
  still?: boolean;
  /** The slice it carries. Default true. */
  pizza?: boolean;
}

// Reanimated 4 CSS keyframes. Module constants, so re-renders never restart them.
const LEG_A: CSSAnimationKeyframes = {
  '0%': { transform: [{ rotate: '-35deg' }] },
  '50%': { transform: [{ rotate: '35deg' }] },
  '100%': { transform: [{ rotate: '-35deg' }] },
};
const LEG_B: CSSAnimationKeyframes = {
  '0%': { transform: [{ rotate: '35deg' }] },
  '50%': { transform: [{ rotate: '-35deg' }] },
  '100%': { transform: [{ rotate: '35deg' }] },
};
const BOB: CSSAnimationKeyframes = {
  '0%': { transform: [{ translateY: 0 }] },
  '50%': { transform: [{ translateY: -2 }] },
  '100%': { transform: [{ translateY: 0 }] },
};
const WAG: CSSAnimationKeyframes = {
  '0%': { transform: [{ rotate: '-14deg' }] },
  '50%': { transform: [{ rotate: '14deg' }] },
  '100%': { transform: [{ rotate: '-14deg' }] },
};
const TWITCH: CSSAnimationKeyframes = {
  '0%': { transform: [{ rotate: '0deg' }] },
  '84%': { transform: [{ rotate: '0deg' }] },
  '90%': { transform: [{ rotate: '-18deg' }] },
  '96%': { transform: [{ rotate: '4deg' }] },
  '100%': { transform: [{ rotate: '0deg' }] },
};
const NIBBLE: CSSAnimationKeyframes = {
  '0%': { transform: [{ translateY: 0 }, { rotate: '0deg' }] },
  '20%': { transform: [{ translateY: -1.5 }, { rotate: '-6deg' }] },
  '40%': { transform: [{ translateY: 0 }, { rotate: '0deg' }] },
  '60%': { transform: [{ translateY: -1.5 }, { rotate: '-6deg' }] },
  '100%': { transform: [{ translateY: 0 }, { rotate: '0deg' }] },
};

// Tail segments, rump to tip: [left, top, width, rotation] in grid units.
const TAIL: readonly (readonly [number, number, number, number])[] = [
  [8, 19.5, 7, 0],
  [4.6, 18, 6, -28],
  [2.2, 14.8, 6, -58],
  [1.2, 10.8, 5.5, -84],
  [2, 7, 5, -112],
];

type Loop = { name: CSSAnimationKeyframes; ms: number; origin: string } | null;

/**
 * One moving part. Geometry comes from the size prop (u = size / 48), so it
 * is inline; colours and shapes are classes. The CSS animation runs only
 * when `loop` is set, so a still mouse costs nothing.
 */
function Part({ box, loop, className, children }: {
  box: { left: number; top: number; width: number; height: number };
  loop: Loop;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Animated.View
      // Computed geometry (scaled from `size`) and a Reanimated CSS animation per part.
      style={[
        { position: 'absolute', ...box },
        loop
          ? {
              transformOrigin: loop.origin,
              animationName: loop.name,
              animationDuration: loop.ms,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'ease-in-out',
            }
          : null,
      ]}
    >
      <View className={`h-full w-full ${className ?? ''}`}>{children}</View>
    </Animated.View>
  );
}

/**
 * The NYC-MON city mouse, side on: a solid orange body on a royal keyline
 * (the wordmark's build), round ears with apple-red insides, a long tail and
 * a slice of pizza in its mouth. Running, its legs scurry, its body bobs and
 * its tail wags fast. Idle, it sits: the tail sways slowly, an ear twitches
 * now and then, and it nibbles the slice. Built from kit Views, so it draws
 * the same on web and native.
 */
export function CityMouse({ size = 48, pose = 'idle', facingLeft = false, still = false, pizza = true }: CityMouseProps) {
  const u = size / 48;
  const run = pose === 'run' && !still;
  const idle = pose === 'idle' && !still;
  const b = (left: number, top: number, width: number, height: number) => ({ left: left * u, top: top * u, width: width * u, height: height * u });

  return (
    <View
      aria-hidden
      // Computed geometry: drawing size from the prop; the mirror is a transform.
      style={{ width: size, height: size * 0.75, transform: [{ scaleX: facingLeft ? -1 : 1 }] }}
    >
      {/* Tail: overlapping blocks curling up from the rump; wags from its base. */}
      <Part box={b(0, 4, 15, 24)} loop={run ? { name: WAG, ms: 260, origin: '90% 85%' } : idle ? { name: WAG, ms: 1800, origin: '90% 85%' } : null}>
        {TAIL.map(([l, t, w, deg], k) => (
          <View
            key={k}
            className="absolute rounded-full bg-orange-700"
            // Computed geometry: tail segment scaled from `size`.
            style={{ left: l * u, top: t * u, width: w * u, height: 2.8 * u, transform: [{ rotate: `${deg}deg` }] }}
          />
        ))}
      </Part>

      {/* Back leg, then front leg: they swap while running. */}
      <Part box={b(14, 27, 4.5, 8)} loop={run ? { name: LEG_A, ms: 220, origin: '50% 10%' } : null} className="rounded-full bg-royal-700" />
      <Part box={b(27, 27, 4.5, 8)} loop={run ? { name: LEG_B, ms: 220, origin: '50% 10%' } : null} className="rounded-full bg-royal-700" />

      {/* Body, head, ears and face bob together. */}
      <Part box={b(0, 0, 48, 36)} loop={run ? { name: BOB, ms: 220, origin: '50% 50%' } : null}>
        <View className="absolute rounded-full border-2 border-royal-700 bg-orange-500" style={{ left: 9 * u, top: 12 * u, width: 26 * u, height: 18 * u }} />
        <View className="absolute rounded-full bg-orange-300" style={{ left: 15 * u, top: 22 * u, width: 14 * u, height: 5 * u }} />

        {/* Back ear twitches when idle. Big round ears are the mouse's silhouette. */}
        <Part box={b(22, 0, 13, 13)} loop={idle ? { name: TWITCH, ms: 3200, origin: '70% 100%' } : null} className="rounded-full border-2 border-royal-700 bg-orange-600">
          <View className="absolute rounded-full bg-apple-300" style={{ left: 2.6 * u, top: 2.6 * u, width: 6 * u, height: 6 * u }} />
        </Part>

        <View className="absolute rounded-full border-2 border-royal-700 bg-orange-500" style={{ left: 27 * u, top: 9 * u, width: 15 * u, height: 14 * u }} />
        {/* Snout tapers to the nose. */}
        <View className="absolute rounded-full border-2 border-royal-700 bg-orange-400" style={{ left: 37 * u, top: 14 * u, width: 9.5 * u, height: 6.5 * u, transform: [{ rotate: '8deg' }] }} />
        <View className="absolute rounded-full bg-apple-500" style={{ left: 44.2 * u, top: 15 * u, width: 3.8 * u, height: 3.8 * u }} />
        <View className="absolute rounded-full bg-ink-950" style={{ left: 35 * u, top: 11 * u, width: 3.6 * u, height: 3.6 * u }}>
          <View className="absolute rounded-full bg-white" style={{ left: 0.6 * u, top: 0.4 * u, width: 1.3 * u, height: 1.3 * u }} />
        </View>
        {/* Whiskers. */}
        <View className="absolute bg-ink-50" style={{ left: 40 * u, top: 19.5 * u, width: 7 * u, height: Math.max(1, 0.6 * u), transform: [{ rotate: '12deg' }] }} />
        <View className="absolute bg-ink-50" style={{ left: 40 * u, top: 17.5 * u, width: 7 * u, height: Math.max(1, 0.6 * u), transform: [{ rotate: '-8deg' }] }} />

        {/* Front ear, still. */}
        <View className="absolute rounded-full border-2 border-royal-700 bg-orange-500" style={{ left: 28.5 * u, top: -1 * u, width: 13 * u, height: 13 * u }}>
          <View className="absolute rounded-full bg-apple-300" style={{ left: 2.6 * u, top: 2.6 * u, width: 6 * u, height: 6 * u }} />
        </View>

        {/* The slice: crust on top, cheese wedge, one pepperoni. Nibbled when idle. */}
        {pizza ? (
          <Part box={b(38, 20, 9, 12)} loop={idle ? { name: NIBBLE, ms: 1400, origin: '50% 0%' } : null}>
            <View className="absolute rounded-sm bg-orange-800" style={{ left: 0, top: 0, width: 9 * u, height: 2.4 * u }} />
            <View
              className="absolute border-l-transparent border-r-transparent border-t-orange-200"
              style={{ left: 0, top: 2 * u, width: 0, height: 0, borderLeftWidth: 4.5 * u, borderRightWidth: 4.5 * u, borderTopWidth: 9 * u }}
            />
            <View className="absolute rounded-full bg-apple-500" style={{ left: 3.2 * u, top: 3.4 * u, width: 2.6 * u, height: 2.6 * u }} />
          </Part>
        ) : null}
      </Part>
    </View>
  );
}

/** Where the nose tip sits in the drawing, px from its top left (facing right). */
export function mouseNose(size: number, facingLeft: boolean) {
  const u = size / 48;
  return { x: facingLeft ? size - 48 * u : 48 * u, y: 16.5 * u };
}
