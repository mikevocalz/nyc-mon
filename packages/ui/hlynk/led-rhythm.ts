import { motionTokens, type MotionStep, type MotionTokenName } from '@acme/theme';
import { assertNever } from './tier.ts';

/**
 * What the scanner LED is reporting. `off`: no egg and no Mon. `boot`: the
 * M01 power-on. The other three carry meaning and always travel with a text
 * label (see `HLynkStatus` in shell-types.ts).
 * @see ScannerLedProps
 */
export type LedState = 'off' | 'boot' | 'incubating' | 'ready' | 'needsYou';

/** The static shape that replaces a rhythm under reduced motion. */
export type SteadyCue = 'progress-ticks' | 'filled-dot' | 'exclamation-dot';

/** One stop of a blink cycle: emitter opacity at `offsetPct` of the cycle. */
export interface LedStop {
  /** 0–100 */
  offsetPct: number;
  /** 0 shows the unlit lens, 1 the lit emitter */
  opacity: number;
}

/**
 * How the LED is drawn for one state and motion setting, resolved from
 * {@linkcode motionTokens}. Produced by {@linkcode resolveLedRhythm}.
 */
export type LedRhythm =
  | { kind: 'dark' }
  | { kind: 'steady'; cue: SteadyCue | undefined }
  | { kind: 'ramp'; durationMs: number }
  | { kind: 'breathe'; periodMs: number; minOpacity: number; maxOpacity: number }
  | { kind: 'blink'; cycleMs: number; stops: readonly LedStop[] };

const STATE_TOKEN: Record<Exclude<LedState, 'off'>, MotionTokenName> = {
  boot: 'motion-power-on',
  incubating: 'motion-led-breath',
  ready: 'motion-led-blink-ready',
  needsYou: 'motion-led-blink-needs-you',
};

/** The LED's drawing for `state`, full or reduced. Pure. */
export function resolveLedRhythm(state: LedState, reducedMotion: boolean): LedRhythm {
  if (state === 'off') return { kind: 'dark' };
  const token = motionTokens[STATE_TOKEN[state]];
  return fromStep(reducedMotion ? token.reduced : token.full);
}

function fromStep(step: MotionStep): LedRhythm {
  switch (step.kind) {
    case 'tween':
      return { kind: 'ramp', durationMs: step.durationMs };
    case 'breathe':
      return { kind: 'breathe', periodMs: step.periodMs, minOpacity: step.minOpacity, maxOpacity: step.maxOpacity };
    case 'blink':
      return { kind: 'blink', cycleMs: step.intervalMs, stops: blinkStops(step) };
    case 'steady':
      return { kind: 'steady', cue: step.cue };
    case 'instant':
      return { kind: 'steady', cue: undefined };
    case 'absent':
      return { kind: 'dark' };
    default:
      return assertNever(step);
  }
}

/** Width of a hard edge in a keyframe list, in percent of the cycle. */
const EDGE_PCT = 0.01;

/**
 * A burst of `count` blinks at the start of each cycle, then steady light for
 * the rest. Each blink is `offMs` dark followed by `onMs` lit. Hard edges are
 * two stops `EDGE_PCT` apart so a linear timing function reads as a switch.
 */
export function blinkStops(step: Extract<MotionStep, { kind: 'blink' }>): LedStop[] {
  const pct = (ms: number) => (ms / step.intervalMs) * 100;
  const stops: LedStop[] = [{ offsetPct: 0, opacity: 1 }];
  for (let i = 0; i < step.count; i += 1) {
    const offAt = pct(i * (step.onMs + step.offMs));
    const onAt = offAt + pct(step.offMs);
    stops.push(
      { offsetPct: offAt + EDGE_PCT, opacity: 0 },
      { offsetPct: onAt, opacity: 0 },
      { offsetPct: onAt + EDGE_PCT, opacity: 1 },
    );
  }
  stops.push({ offsetPct: 100, opacity: 1 });
  return stops;
}

/**
 * The most dark-to-lit transitions inside any one-second window of a
 * repeating blink cycle (WCAG 2.3.1 counts a flash as a pair of opposing
 * changes; each relit edge closes one). Used by the tests to hold every LED
 * rhythm at three flashes a second or fewer.
 */
export function maxFlashesPerSecond(rhythm: LedRhythm): number {
  if (rhythm.kind !== 'blink') return 0;
  const relitMs: number[] = [];
  for (let i = 1; i < rhythm.stops.length; i += 1) {
    const prev = rhythm.stops[i - 1]!;
    const next = rhythm.stops[i]!;
    if (prev.opacity === 0 && next.opacity === 1) relitMs.push((next.offsetPct / 100) * rhythm.cycleMs);
  }
  // Two cycles back to back so a window that wraps the cycle is counted.
  const all = [...relitMs, ...relitMs.map((t) => t + rhythm.cycleMs)];
  let max = 0;
  for (const start of all) {
    const inWindow = all.filter((t) => t >= start && t < start + 1000).length;
    if (inWindow > max) max = inWindow;
  }
  return max;
}
