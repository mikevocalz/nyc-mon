'use client';
/**
 * Reusable motion primitives (@legendapp/motion) — universal: RN Animated on
 * native, react-native-web's Animated in the browser.
 *
 * - motion(Component): the custom-components pattern from Legend's docs
 *   (createMotionAnimatedComponent) + the kit's className shim — turn ANY
 *   component into a Motion component in one call. The component must accept
 *   a style prop (and forward refs for the native-driver fast path).
 * - MotionView / MotionText: motion versions of the kit's view/text. They sit
 *   on Animated.View/Animated.Text (ref-forwarding, native-driver capable) —
 *   on web these render the same react-native-web elements the tw wrappers
 *   compile to, and MotionText carries tw.Text's default text color.
 * - FadeIn / ScaleIn / SlideUp: entrance presets components compose; pass
 *   `delay` to stagger and `reducedMotion` for the authored reduced sibling
 *   (motionTokens in @acme/theme). Override any Motion prop as needed.
 */
import { useSyncExternalStore } from 'react';
import { Easing } from 'react-native';
import { motion as motionScale, motionTokens, type MotionEasing } from '@acme/theme';
import {
  Motion,
  AnimatePresence,
  createMotionComponent,
  createMotionAnimatedComponent,
} from '@legendapp/motion';
import { css } from './html/css';

export { Motion, AnimatePresence, createMotionComponent, createMotionAnimatedComponent };

// SSR safety: server HTML must render CONTENT VISIBLE (no opacity-0 initial
// state — if hydration is slow or fails the page would be blank). Presets
// render statically until hydration, then remount WITH the entrance so the
// animation runs. On native and CSR the snapshot is true from the first
// render: animated immediately, no remount. (External-store read, not state.)
const noopSubscribe = () => () => {};
export const useHydrated = () =>
  useSyncExternalStore(noopSubscribe, () => true, () => false);

type CN = { className?: string };

/** Make a className-capable Motion version of any style-accepting component. */
export function motion<P extends object>(
  Component: React.ComponentType<P>,
  displayName = Component.displayName ?? Component.name ?? 'Component',
) {
  const M = createMotionAnimatedComponent(Component as React.ComponentType<{ style?: unknown }>);
  return css(M as React.ComponentType<object>, `Motion(${displayName})`);
}

export type MotionViewProps = React.ComponentProps<typeof Motion.View> & CN;

export const MotionView = css(
  Motion.View as React.ComponentType<object>,
  'Motion.View',
) as React.FC<MotionViewProps>;

export type MotionTextProps = React.ComponentProps<typeof Motion.Text> & CN;

const MotionTextBase = css(Motion.Text as React.ComponentType<object>, 'Motion.Text');

// Parity with tw.Text: the base-layer default color adapts to the theme;
// explicit text-* classes still override.
export const MotionText = ({ className, ...props }: MotionTextProps) => (
  <MotionTextBase className={`text-body-default ${className ?? ''}`} {...props} />
);
MotionText.displayName = 'CSS(Motion.Text)';

/** Parse a {@linkcode motionScale.easing} token (`cubic-bezier(a, b, c, d)`) into an easing function. */
function tokenEasing(name: MotionEasing): (t: number) => number {
  const [x1 = 0, y1 = 0, x2 = 1, y2 = 1] = (motionScale.easing[name].match(/-?\d*\.?\d+/g) ?? []).map(Number);
  return Easing.bezier(x1, y1, x2, y2);
}

/**
 * The reduced-motion sibling of a preset, read from {@linkcode motionTokens}.
 * Every reduced sibling the presets use is a fade (no travel, no scale); the
 * token decides its duration and easing, so the preset never derives one by
 * zeroing the full animation (§0A.2).
 */
function reducedFade(token: 'motion-enter' | 'motion-step') {
  const step = motionTokens[token].reduced;
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { type: 'timing' as const, duration: step.durationMs, easing: tokenEasing(step.easing) },
  };
}

/**
 * Props for {@linkcode FadeIn}, {@linkcode ScaleIn} and {@linkcode SlideUp}.
 * Any Motion prop overrides the preset.
 */
export interface MotionPresetProps extends MotionViewProps {
  /** Delay in ms: stagger sibling entrances. */
  delay?: number;
  /**
   * Play the authored reduced-motion sibling instead of the full entrance: a
   * fade with no travel or scale, timed by the preset's motion token
   * (`motion-enter` for FadeIn and ScaleIn, `motion-step` for SlideUp).
   * Callers pass the app's reduced-motion setting; the preset never reads
   * the OS itself.
   * @default false
   */
  reducedMotion?: boolean;
}

/** Shared body of the presets: SSR-safe keying plus the full or reduced step. */
function Preset({
  delay,
  reducedMotion,
  full,
  reducedToken,
  ...props
}: MotionPresetProps & {
  full: Pick<MotionViewProps, 'initial' | 'animate' | 'transition'>;
  reducedToken: 'motion-enter' | 'motion-step';
}) {
  const hydrated = useHydrated();
  const step = reducedMotion ? reducedFade(reducedToken) : full;
  return (
    <MotionView
      key={hydrated ? `hydrated-${reducedMotion ? 'reduced' : 'full'}` : 'ssr'}
      initial={hydrated ? step.initial : undefined}
      animate={hydrated ? step.animate : undefined}
      transition={{ ...step.transition, delay } as MotionViewProps['transition']}
      {...props}
    />
  );
}

/** Soft rise entrance: content blocks, empty states, list headers. Reduced: `motion-enter` fade. */
export const FadeIn = ({ delay = 0, reducedMotion = false, ...props }: MotionPresetProps) => (
  <Preset
    delay={delay}
    reducedMotion={reducedMotion}
    reducedToken="motion-enter"
    full={{ initial: { y: 12 }, animate: { y: 0 }, transition: { type: 'timing', duration: 280, ease: 'easeOut' } }}
    {...props}
  />
);

/** Pop entrance: dialog cards, badges, confirmation moments. Reduced: `motion-enter` fade, no scale. */
export const ScaleIn = ({ delay = 0, reducedMotion = false, ...props }: MotionPresetProps) => (
  <Preset
    delay={delay}
    reducedMotion={reducedMotion}
    reducedToken="motion-enter"
    full={{ initial: { scale: 0.94 }, animate: { scale: 1 }, transition: { type: 'spring', damping: 18, stiffness: 260 } }}
    {...props}
  />
);

/** Docked-surface entrance: toasts, tab-bar accessories, bottom docks. Reduced: `motion-step` fade. */
export const SlideUp = ({ delay = 0, reducedMotion = false, ...props }: MotionPresetProps) => (
  <Preset
    delay={delay}
    reducedMotion={reducedMotion}
    reducedToken="motion-step"
    full={{ initial: { y: 24 }, animate: { y: 0 }, transition: { type: 'spring', damping: 20, stiffness: 300 } }}
    {...props}
  />
);
