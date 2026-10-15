import type { HatchState } from '@acme/core/types';

/** A presentation phase of the hatch (`HATCH_PRESENTATION_PHASES`). */
export type HatchPhase = Extract<HatchState, { kind: 'presenting' }>['phase'];

/**
 * Phase lengths in ms (M12 03-direction.md "Sequence" and "Reduced motion").
 * `attention` is the lean-in length; a hesitation stays open until the Caller
 * holds the trackpad or presses "Stay close".
 */
export const PHASE_MS: Record<'full' | 'reduced', Record<HatchPhase, number>> = {
  full: { 'case-open': 1000, scanner: 800, crack: 2400, burst: 500, emerge: 1800, attention: 1500 },
  reduced: { 'case-open': 300, scanner: 400, crack: 450, burst: 300, emerge: 400, attention: 1500 },
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
