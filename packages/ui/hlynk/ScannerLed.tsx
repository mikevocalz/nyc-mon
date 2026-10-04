'use client';
// RN globals (__DEV__) must exist before Reanimated evaluates on web.
import '../rn-globals-shim';
import { css as reanimatedCss, type CSSAnimationKeyframes } from 'react-native-reanimated';
import { motionTokens } from '@acme/theme';
import { AnimatedView } from '../progress/motion';
import { View } from '../tw';
import { hiddenA11y } from './a11y';
import { ledAccessibilityLabel } from './copy';
import { resolveLedRhythm, type LedRhythm, type LedState, type SteadyCue } from './led-rhythm';
import { HLYNK_GEOMETRY } from './layout';
import { ScannerFan } from './ScannerFan';
import type { ScannerLedProps } from './ScannerLed.types';
import { resolveTier } from './tier';

export type { ScannerLedProps };

/** Lens and fan placement for each head size, in points. */
const HEAD = {
  standard: { heightPt: HLYNK_GEOMETRY.headPt, lensW: 44, lensH: 8, lensTop: 22, fanW: 76, cuePt: 8 },
  compact: { heightPt: HLYNK_GEOMETRY.headCompactPt, lensW: 32, lensH: 6, lensTop: 12, fanW: 48, cuePt: 6 },
} as const;
const TICKS = 5;

// One style object per state and motion setting, so a re-render hands
// Reanimated the same keyframes and never restarts the rhythm.
const styleCache = new Map<string, object>();
function lensStyleFor(state: LedState, reducedMotion: boolean): object {
  const key = `${state}:${reducedMotion ? 'reduced' : 'full'}`;
  let style = styleCache.get(key);
  if (!style) {
    style = rhythmStyle(resolveLedRhythm(state, reducedMotion));
    styleCache.set(key, style);
  }
  return style;
}

/** Reanimated CSS animation style for a rhythm, or a static opacity. */
function rhythmStyle(rhythm: LedRhythm): object {
  switch (rhythm.kind) {
    case 'dark':
      return { opacity: 0 };
    case 'steady':
      return { opacity: 1 };
    case 'ramp':
      return {
        animationName: reanimatedCss.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } }) as unknown as CSSAnimationKeyframes,
        animationDuration: `${rhythm.durationMs}ms`,
        animationTimingFunction: 'ease-out',
        animationIterationCount: 1,
        animationFillMode: 'both',
      };
    case 'breathe':
      return {
        animationName: reanimatedCss.keyframes({
          '0%': { opacity: rhythm.maxOpacity },
          '50%': { opacity: rhythm.minOpacity },
          '100%': { opacity: rhythm.maxOpacity },
        }) as unknown as CSSAnimationKeyframes,
        animationDuration: `${rhythm.periodMs}ms`,
        animationTimingFunction: 'ease-in-out',
        animationIterationCount: 'infinite',
      };
    case 'blink': {
      const frames: Record<string, { opacity: number }> = {};
      for (const s of rhythm.stops) frames[`${s.offsetPct.toFixed(3)}%`] = { opacity: s.opacity };
      return {
        animationName: reanimatedCss.keyframes(frames) as unknown as CSSAnimationKeyframes,
        animationDuration: `${rhythm.cycleMs}ms`,
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite',
      };
    }
    default:
      return rhythm satisfies never;
  }
}

const FAN = motionTokens['motion-scan-fan'].full;
const FAN_SWEEP = reanimatedCss.keyframes({
  '0%': { opacity: 0, transform: [{ scaleY: 0.2 }] },
  '45%': { opacity: 1, transform: [{ scaleY: 1 }] },
  '100%': { opacity: 0, transform: [{ scaleY: 1 }] },
}) as unknown as CSSAnimationKeyframes;

/** The static shape standing in for a rhythm under reduced motion. Drawn in emitter red on black. */
function Cue({ cue, progress, sizePt }: { cue: SteadyCue; progress: number; sizePt: number }) {
  switch (cue) {
    case 'progress-ticks': {
      const lit = Math.round(Math.min(1, Math.max(0, progress)) * TICKS);
      return (
        <View className="flex-row items-end gap-0.5">
          {Array.from({ length: TICKS }, (_, i) => (
            <View
              key={i}
              className={i < lit ? 'bg-led-on' : 'bg-led-off'}
              style={{ width: 3, height: sizePt }}
            />
          ))}
        </View>
      );
    }
    case 'filled-dot':
      return <View className="rounded-full bg-led-on" style={{ width: sizePt, height: sizePt }} />;
    case 'exclamation-dot':
      return (
        <View className="items-center justify-center rounded-full bg-led-on" style={{ width: sizePt + 4, height: sizePt + 4 }}>
          <View className="bg-hlynk-core-black" style={{ width: 2, height: (sizePt + 4) * 0.4 }} />
          <View className="mt-px bg-hlynk-core-black" style={{ width: 2, height: 2 }} />
        </View>
      );
    default:
      return cue satisfies never;
  }
}

/**
 * The H-Lynk scanner head: a black band carrying the red emitter lens that
 * reports the egg's or the Mon's state by rhythm, never by colour alone
 * (DIRECTION.md "The scanner LED is a status light"). Rhythms come from
 * `motionTokens`; under reduced motion each becomes steady light plus a
 * static cue, and the fan is absent. Blinks stay at three a second or fewer
 * (WCAG 2.3.1, checked in hlynk.test.ts).
 *
 * The lens is decorative while `off` or `boot`; in a meaningful state it is an
 * image named "Status light: {label}" in a polite live region, so a change is
 * announced without interrupting.
 */
export function ScannerLed(props: ScannerLedProps) {
  const { tier = 'core', fan = false, reducedMotion, size = 'standard', testID } = props;
  resolveTier(tier, 'ScannerLed');
  const head = HEAD[size];
  const rhythm = resolveLedRhythm(props.state, reducedMotion);
  const lensStyle = lensStyleFor(props.state, reducedMotion);
  const label = props.state === 'off' || props.state === 'boot' ? undefined : props.label;
  const progress = props.state === 'incubating' ? props.progress : 0;
  const cue = rhythm.kind === 'steady' ? rhythm.cue : undefined;
  const showFan = fan && !reducedMotion && motionTokens['motion-scan-fan'].reduced.kind === 'absent';

  return (
    <View
      testID={testID}
      className="relative w-full overflow-hidden bg-hlynk-core-black"
      style={{ height: head.heightPt }}
    >
      {showFan ? (
        <AnimatedView
          {...hiddenA11y(true)}
          className="absolute"
          style={{
            pointerEvents: 'none',
            right: 16 + head.lensW / 2 - head.fanW / 2,
            top: 0,
            transformOrigin: 'bottom',
            animationName: FAN_SWEEP,
            animationDuration: `${FAN.kind === 'tween' ? FAN.durationMs : 400}ms`,
            animationTimingFunction: 'ease-out',
            animationIterationCount: 1,
            animationFillMode: 'both',
          } as object}
        >
          <ScannerFan widthPt={head.fanW} heightPt={head.lensTop} />
        </AnimatedView>
      ) : null}
      <View
        className="absolute flex-row items-center gap-2"
        style={{ right: 16, top: head.lensTop - (head.cuePt + 4 - head.lensH) / 2, height: head.cuePt + 4 }}
        {...(label
          ? { role: 'img' as const, 'aria-label': ledAccessibilityLabel(label), 'aria-live': 'polite' as const }
          : hiddenA11y(true))}
      >
        {cue ? <Cue cue={cue} progress={progress} sizePt={head.cuePt} /> : null}
        <View className="overflow-hidden rounded-full bg-led-off" style={{ width: head.lensW, height: head.lensH }}>
          <AnimatedView
            key={`${props.state}-${reducedMotion ? 'r' : 'f'}`}
            className="absolute inset-0 bg-led-on"
            style={lensStyle}
          />
        </View>
      </View>
    </View>
  );
}
