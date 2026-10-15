import { motionTokens } from '@acme/theme';

/**
 * The shared breath clock (M11 04-components.md "Shared breath clock"). The
 * scanner LED, the case pad glow and the warm haptic all read one phase so
 * they never drift apart. The phase is taken from the wall clock modulo the
 * period, so every reader that mounts at any time lands on the same beat.
 * Every function here is a worklet and pure, so the UI thread and the tests
 * run the same code.
 */

const BREATH = motionTokens['motion-led-breath'].full;

/** Period of the LED breath, from `motion-led-breath` (4000 ms). */
export const LED_BREATH_PERIOD_MS = BREATH.kind === 'breathe' ? BREATH.periodMs : 4000;
/** Dimmest LED opacity in the breath. */
export const LED_BREATH_MIN = BREATH.kind === 'breathe' ? BREATH.minOpacity : 0.35;
/** Brightest LED opacity in the breath. */
export const LED_BREATH_MAX = BREATH.kind === 'breathe' ? BREATH.maxOpacity : 1;

/** Phase 0–1 of the breath at `nowMs` (epoch ms). Phase 0 is the brightest point. */
export function breathPhaseAt(nowMs: number, periodMs: number = LED_BREATH_PERIOD_MS): number {
  'worklet';
  if (periodMs <= 0) return 0;
  const r = nowMs % periodMs;
  return (r < 0 ? r + periodMs : r) / periodMs;
}

/**
 * LED opacity at a phase: bright at 0 and 1, dimmest at 0.5, eased with a
 * cosine so it matches the LED's ease-in-out keyframes (max → min → max).
 */
export function breathIntensity(phase: number, min: number = LED_BREATH_MIN, max: number = LED_BREATH_MAX): number {
  'worklet';
  const k = 0.5 + 0.5 * Math.cos(phase * 2 * Math.PI);
  return min + (max - min) * k;
}

/** Pad glow while warming: `interpolate(breathPhase)` 0.25 → 1 (M11 handoff "Motion"). Reduced: steady 1. */
export function padGlowAt(phase: number, reducedMotion: boolean): number {
  'worklet';
  if (reducedMotion) return 1;
  const t = (breathIntensity(phase) - LED_BREATH_MIN) / (LED_BREATH_MAX - LED_BREATH_MIN);
  return 0.25 + 0.75 * t;
}

/**
 * True when the breath turned from exhale to inhale between two samples: the
 * phase passed 0.5, the dimmest point, where the light starts rising. The warm
 * haptic fires here, at most once per period.
 */
export function inhaleStarted(prevPhase: number, phase: number): boolean {
  'worklet';
  if (phase >= prevPhase) return prevPhase < 0.5 && phase >= 0.5;
  // Wrapped past 1 → 0 between samples.
  return prevPhase < 0.5 || phase >= 0.5;
}

/**
 * Gate for the warm haptic: never faster than once per period, even if
 * samples arrive late and two inhales seem to land close together.
 */
export function canPulse(lastPulseMs: number | undefined, nowMs: number, periodMs: number = LED_BREATH_PERIOD_MS): boolean {
  'worklet';
  return lastPulseMs === undefined || nowMs - lastPulseMs >= periodMs;
}
