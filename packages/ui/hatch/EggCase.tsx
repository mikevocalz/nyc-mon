'use client';
import '../rn-globals-shim';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import {
  Easing, runOnJS, useDerivedValue, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { View } from '../tw';
import { padGlowAt } from '../hlynk/breath-clock';
import { useLedBreathPhase } from '../hlynk/use-led-breath-phase';
import { CaseDrawing } from './CaseDrawing';
import { LID_OPEN_DEG } from './hatch-model';
import { easingPoints, tokenMs } from './motion-curves';

/** Case close / open, full motion (M10 handoff "Motion"): 700 ms `emphasized`. */
export const CASE_TRANSITION_MS = 700;
/** Reduced: a 200 ms cross-fade to the end frame (`motion-enter` reduced). */
const CASE_REDUCED_MS = tokenMs('motion-enter', true);
/** The pad lights at 90% of the close. */
const PAD_LIGHTS_AT = 0.9;

/** The single-egg case of M10 (V11 ¶65): square metal halves, internal hinge, top handle, rounded-square pad on the lid. */
export interface EggCaseProps {
  state: 'open' | 'closing' | 'closed' | 'opening';
  /** Pad glows red (led-on on a black inset). */
  padLit: boolean;
  /** Breath in step with the H-Lynk LED (M11). @default 'steady' */
  padRhythm?: 'steady' | 'breath';
  /** Fires from the animation's end callback, never a JS timer, so a sheet never rises on a half-shut case. */
  onTransitionEnd?: (state: 'closed' | 'open') => void;
  reducedMotion: boolean;
  /** One image to assistive tech, e.g. `m10.case.a11y.closed`. */
  accessibilityLabel?: string;
  /** The egg, visible while open. */
  children?: ReactNode;
  /** Side of the square footprint. @default 193 */
  sizePt?: number;
  scheme?: 'daylit' | 'night';
  testID?: string;
}

const EMPHASIZED = easingPoints('emphasized');

/**
 * `EggCase` (M10): the same drawing as `CaptureCase`, driven by a state
 * instead of a phase clock. `closing` and `opening` animate on the UI thread
 * (`withTiming` with the `emphasized` curve) and report their end through
 * `onTransitionEnd`. Under reduced motion the lid cross-fades in 200 ms. The
 * pad lights at 90% of the close; with `padRhythm="breath"` it reads the
 * shared breath clock so it pulses with the LED.
 */
export function EggCase({
  state, padLit, padRhythm = 'steady', onTransitionEnd, reducedMotion, accessibilityLabel, children,
  sizePt = 193, scheme = 'daylit', testID,
}: EggCaseProps) {
  const gradientId = `eggcase-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // 1 = fully open, 0 = shut.
  const openness = useSharedValue(state === 'open' || state === 'closing' ? 1 : 0);
  const latest = useRef(onTransitionEnd);
  useEffect(() => {
    latest.current = onTransitionEnd;
  });
  const report = (end: 'closed' | 'open') => latest.current?.(end);

  useEffect(() => {
    if (state === 'open' || state === 'closed') {
      openness.set(state === 'open' ? 1 : 0);
      return;
    }
    const target = state === 'closing' ? 0 : 1;
    const end: 'closed' | 'open' = state === 'closing' ? 'closed' : 'open';
    openness.set(
      withTiming(
        target,
        reducedMotion
          ? { duration: CASE_REDUCED_MS }
          : { duration: CASE_TRANSITION_MS, easing: Easing.bezier(...EMPHASIZED) },
        (finished) => {
          'worklet';
          if (finished) runOnJS(report)(end);
        },
      ),
    );
    // `report` reads a ref, so the effect runs per state change only.
  }, [state, reducedMotion, openness]);

  const breathing = padLit && padRhythm === 'breath' && !reducedMotion && state === 'closed';
  const phase = useLedBreathPhase(breathing);
  const lidDeg = useDerivedValue(() => openness.get() * LID_OPEN_DEG);
  const padGlow = useDerivedValue(() => {
    if (!padLit) return 0;
    // Lights at 90% of the close (openness 0.1 or less).
    if (openness.get() > 1 - PAD_LIGHTS_AT) return 0;
    return breathing ? padGlowAt(phase.get(), false) : 1;
  });

  return (
    <View
      testID={testID}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      role={accessibilityLabel ? 'img' : undefined}
      accessibilityLabel={accessibilityLabel}
      aria-label={accessibilityLabel}
    >
      <CaseDrawing
        sizePt={sizePt}
        lidDeg={lidDeg}
        padGlow={padGlow}
        seamLit={false}
        scheme={scheme}
        reducedMotion={reducedMotion}
        gradientId={gradientId}
      >
        {children}
      </CaseDrawing>
    </View>
  );
}
