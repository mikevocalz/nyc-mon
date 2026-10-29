'use client';
import '../rn-globals-shim';
import Animated, { css as reanimatedCss, type CSSAnimationKeyframes } from 'react-native-reanimated';
import { led } from '@acme/theme';
import { Text, View } from '../tw';
import { hiddenA11y } from '../hlynk/a11y';
import { resolveLedRhythm } from '../hlynk/led-rhythm';

export interface CallLampProps {
  /** `call` and `false-call` light it the same way, on purpose (Mon Space: telling them apart is the Caller's job). */
  state: 'off' | 'call' | 'false-call';
  /** Spoken, e.g. "Status light on: Squeaklet is calling". */
  accessibilityLabel: string;
  reducedMotion: boolean;
  /** Lens diameter, pt. @default 20 */
  size?: number;
  testID?: string;
}

const NEEDS = resolveLedRhythm('needsYou', false);
const BLINK =
  NEEDS.kind === 'blink'
    ? {
        animationName: reanimatedCss.keyframes(
          Object.fromEntries(NEEDS.stops.map((s) => [`${s.offsetPct.toFixed(3)}%`, { opacity: s.opacity }])),
        ) as unknown as CSSAnimationKeyframes,
        animationDuration: `${NEEDS.cycleMs}ms`,
        animationTimingFunction: 'linear' as const,
        animationIterationCount: 'infinite' as const,
      }
    : { opacity: 1 };

/**
 * The Mon Space attention lamp: a red emitter in a black lens, the H-Lynk's
 * status-light rhythm without the H-Lynk (`motion-led-blink-needs-you`, three
 * 150 ms blinks every 10 s, never more than three flashes a second). Under
 * reduced motion it is steady with the exclamation dot. Dark while off. The
 * status line always says why it is lit; this element only speaks its label.
 */
export function CallLamp({ state, accessibilityLabel, reducedMotion, size = 20, testID }: CallLampProps) {
  const lit = state !== 'off';
  const steady = resolveLedRhythm('needsYou', true);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      aria-label={accessibilityLabel}
      aria-live="polite"
      className="items-center justify-center rounded-full bg-hlynk-core-black"
      style={{ width: size + 8, height: size + 8 }}
    >
      <View {...(hiddenA11y(true) as object)} className="overflow-hidden rounded-full" style={{ width: size, height: size, backgroundColor: led.off }}>
        {lit ? (
          reducedMotion ? (
            <View className="flex-1 items-center justify-center" style={{ backgroundColor: led.on }}>
              {steady.kind === 'steady' && steady.cue === 'exclamation-dot' ? (
                <Text className="font-display text-type-label text-hlynk-core-black" style={{ lineHeight: size }}>!</Text>
              ) : null}
            </View>
          ) : (
            <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: led.on }, BLINK]} />
          )
        ) : null}
      </View>
    </View>
  );
}
