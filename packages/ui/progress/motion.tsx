'use client';
// RN globals (__DEV__) must exist before Reanimated evaluates on web.
import '../rn-globals-shim';
import type React from 'react';
import Animated, {
  css as reanimatedCss, steps, type CSSAnimationKeyframes, type CSSAnimationTimingFunction,
} from 'react-native-reanimated';
import { css } from '../html/css';

export { steps };

/**
 * Shared Reanimated 4 CSS animation pieces for the progress loaders and the
 * NYC-MON elements. Every loop here is a declarative CSS animation: no shared
 * values, no per-frame JS. Callers pass `reduced` from useReducedMotion and
 * get `undefined` back, which leaves the element at its static resting state.
 */

/** Reanimated's Animated.View with the kit's className support (Uniwind on native, react-native-css on web). */
export const AnimatedView = css(
  Animated.View as unknown as React.ComponentType<React.ComponentProps<typeof Animated.View>>,
  'AnimatedView',
);

export const KEYFRAMES = {
  /** A block rising out of the ground. Pair with transformOrigin 'bottom'. */
  rise: reanimatedCss.keyframes({
    from: { transform: [{ scaleY: 0 }] },
    to: { transform: [{ scaleY: 1 }] },
  }),
  /** Construction wave: a lot rises and falls back. */
  build: reanimatedCss.keyframes({
    '0%': { transform: [{ scaleY: 0.12 }] },
    '45%': { transform: [{ scaleY: 1 }] },
    '70%': { transform: [{ scaleY: 1 }] },
    '100%': { transform: [{ scaleY: 0.12 }] },
  }),
  /** Window lights filling a tower floor by floor, then switching off. */
  windows: reanimatedCss.keyframes({
    '0%': { transform: [{ scaleY: 0 }], opacity: 1 },
    '70%': { transform: [{ scaleY: 1 }], opacity: 1 },
    '86%': { transform: [{ scaleY: 1 }], opacity: 1 },
    '100%': { transform: [{ scaleY: 1 }], opacity: 0 },
  }),
  /** A chevron lighting in sequence, like a platform arrival board. */
  march: reanimatedCss.keyframes({
    '0%': { opacity: 0.22 },
    '25%': { opacity: 1 },
    '55%': { opacity: 0.22 },
    '100%': { opacity: 0.22 },
  }),
  spin: reanimatedCss.keyframes({
    from: { transform: [{ rotate: '0deg' }] },
    to: { transform: [{ rotate: '360deg' }] },
  }),
  spinReverse: reanimatedCss.keyframes({
    from: { transform: [{ rotate: '360deg' }] },
    to: { transform: [{ rotate: '0deg' }] },
  }),
  pulse: reanimatedCss.keyframes({
    '0%': { opacity: 0.35 },
    '50%': { opacity: 1 },
    '100%': { opacity: 0.35 },
  }),
  ping: reanimatedCss.keyframes({
    from: { transform: [{ scale: 1 }], opacity: 0.7 },
    to: { transform: [{ scale: 2.2 }], opacity: 0 },
  }),
  flicker: reanimatedCss.keyframes({
    '0%': { opacity: 1 },
    '8%': { opacity: 0.4 },
    '10%': { opacity: 1 },
    '52%': { opacity: 1 },
    '54%': { opacity: 0.3 },
    '57%': { opacity: 1 },
    '100%': { opacity: 1 },
  }),
  /** Water level rocking in a rooftop tank. */
  slosh: reanimatedCss.keyframes({
    '0%': { transform: [{ scaleY: 0.3 }] },
    '50%': { transform: [{ scaleY: 0.85 }] },
    '100%': { transform: [{ scaleY: 0.3 }] },
  }),
  /** Entrance: rise 8px and fade in. */
  enter: reanimatedCss.keyframes({
    from: { opacity: 0, transform: [{ translateY: 8 }] },
    to: { opacity: 1, transform: [{ translateY: 0 }] },
  }),
} satisfies Record<string, ReturnType<typeof reanimatedCss.keyframes>>;

export type KeyframeName = keyof typeof KEYFRAMES;

export interface LoopOptions {
  delay?: number;
  timing?: CSSAnimationTimingFunction;
  iterations?: number | 'infinite';
  direction?: 'normal' | 'reverse' | 'alternate';
  fill?: 'none' | 'both' | 'forwards' | 'backwards';
}

/**
 * Style fragment for one CSS animation, or undefined under reduced motion.
 * It is a style object rather than a class because Reanimated's CSS
 * animations are configured through style props.
 */
export function cssAnimation(
  reduced: boolean,
  name: KeyframeName,
  durationMs: number,
  { delay = 0, timing = 'linear', iterations = 'infinite', direction = 'normal', fill = 'both' }: LoopOptions = {},
) {
  if (reduced) return undefined;
  return {
    animationName: KEYFRAMES[name] as unknown as CSSAnimationKeyframes,
    animationDuration: `${Math.max(1, Math.round(durationMs))}ms`,
    animationDelay: `${Math.round(delay)}ms`,
    // The web style type wants CSSTimingFunction; the native type wants
    // MaybeSharedValue<string>. The runtime takes CSSTimingFunction on both,
    // so the prop is a documented type hole (same as animationName above).
    animationTimingFunction: timing as never,
    animationIterationCount: iterations,
    animationDirection: direction,
    animationFillMode: fill,
  } as const;
}

/** A CSS transition on transform and opacity for value changes (fills, levels). */
export function cssTransition(reduced: boolean, durationMs = 320) {
  if (reduced) return undefined;
  return {
    transitionProperty: ['transform', 'opacity'],
    transitionDuration: `${durationMs}ms`,
    transitionTimingFunction: 'ease-out',
  } as const;
}
