import type { HatchState } from '@acme/core/types';

/** A presentation phase of the hatch (`HATCH_PRESENTATION_PHASES`). */
export type HatchPhase = Extract<HatchState, { kind: 'presenting' }>['phase'];

/**
 * Phase lengths in ms (M12 03-direction.md "Sequence" and "Reduced motion").
 * `stir` and `pressure` keep the timings of the case beats they replace
 * (Decision 29), so the hatch still runs about eight seconds.
 * `attention` is the lean-in length; a hesitation stays open until the Caller
 * holds the trackpad or presses "Stay close".
 */
export const PHASE_MS: Record<'full' | 'reduced', Record<HatchPhase, number>> = {
  full: { stir: 1000, pressure: 800, crack: 2400, burst: 500, emerge: 1800, attention: 1500 },
  reduced: { stir: 300, pressure: 400, crack: 450, burst: 300, emerge: 400, attention: 1500 },
};

/** The skip control appears this long after `open`, never before (M12 copy, 03-direction.md). */
export const SKIP_AFTER_MS = 2000;
/** The hesitate hint caption appears after this long without input; nothing times out. */
export const HESITATE_HINT_MS = 8000;

/** Crack beats inside `crack`, as shares of its length (`CRACK_AT` in the kit). */
export const CRACK_BEATS = [0.25, 0.55, 0.85] as const;

/** Where the M12 route is, derived from the stored hatch state and how the route was entered. */
export type HatchEntry =
  | { readonly kind: 'already' }
  | { readonly kind: 'unknown-egg' }
  | { readonly kind: 'early' }
  | { readonly kind: 'pre' }
  | { readonly kind: 'open-now' }
  | { readonly kind: 'resume'; readonly phase: HatchPhase };

/**
 * M12 "Route, entry and states". Pure: the screen performs the effect.
 * `hatch` is the stored state for the egg (or a fresh one), `undefined` when
 * the save has no such egg.
 */
export function resolveHatchEntry(input: {
  readonly hatch: HatchState | undefined;
  readonly incubationEndsAt: number | undefined;
  readonly hasMon: boolean;
  readonly fromM11: boolean;
  readonly nowMs: number;
}): HatchEntry {
  const { hatch } = input;
  if (hatch === undefined) return input.hasMon ? { kind: 'already' } : { kind: 'unknown-egg' };
  switch (hatch.kind) {
    case 'hatched':
      return { kind: 'already' };
    case 'presenting':
      return { kind: 'resume', phase: hatch.phase };
    case 'incubating':
      if (input.incubationEndsAt === undefined || input.nowMs < input.incubationEndsAt) return { kind: 'early' };
      return input.fromM11 ? { kind: 'open-now' } : { kind: 'pre' };
    case 'ready':
      return input.fromM11 ? { kind: 'open-now' } : { kind: 'pre' };
  }
}

/**
 * The egg's own movement before it cracks (Decision 29). `stir` and
 * `pressure` are each phase's 0–1 progress. Stir: two nudges from inside,
 * the second stronger, back to rest by the phase end. Pressure: the shell
 * swells in two pulses that grow, back to rest size when `crack` starts.
 * Reduced motion: no wobble; the egg holds a slightly fuller pose through
 * pressure, the authored still for that beat. A worklet, so the screen reads
 * it on the UI thread.
 */
export function eggPrecrackPose(stir: number, pressure: number, reducedMotion: boolean): { rotateDeg: number; scale: number } {
  'worklet';
  const s = stir <= 0 ? 0 : stir >= 1 ? 1 : stir;
  const p = pressure <= 0 ? 0 : pressure >= 1 ? 1 : pressure;
  if (reducedMotion) return { rotateDeg: 0, scale: p > 0 && p < 1 ? 1.02 : 1 };
  const rotateDeg = 3 * Math.sin(s * Math.PI * 3) * Math.sin(s * Math.PI) * (s < 0.5 ? 0.6 : 1);
  const scale = 1 + 0.03 * p * (0.5 + 0.5 * Math.sin(p * Math.PI * 4 - Math.PI / 2));
  return { rotateDeg, scale };
}
