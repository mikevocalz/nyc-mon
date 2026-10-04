import type { AgeAnswer } from '../types/index.ts';
import { isConsentRequired } from './consent.ts';

/**
 * Where a "new player" intent goes, from M02 "Get started", M03 "New here?"
 * or a resumed boot. Produced by {@linkcode resolveCreateEntry}.
 *
 * - `age-gate`: no stored answer; show M04.
 * - `create-account`: 13 and over; M03 with the create intent.
 * - `guardian-consent`: a year that could be under 13; M05. No account, no child identity.
 */
export type CreateEntry =
  | { readonly kind: 'age-gate' }
  | { readonly kind: 'create-account'; readonly birthYear: number }
  | { readonly kind: 'guardian-consent'; readonly birthYear: number };

/** Input to {@linkcode resolveCreateEntry}. */
export interface CreateEntryInput {
  /** The stored M04 answer, parsed with `AgeAnswerSchema`; `undefined` when M04 has not been answered. */
  readonly ageAnswer: AgeAnswer | undefined;
  /** Epoch ms used for the consent rule's current year. */
  readonly nowMs: number;
}

/**
 * The P1 guard (docs/design/DECISIONS.md): the create intent passes the
 * birth-year gate before any sign-in provider. `create-account` is returned
 * only when an age answer is stored and {@linkcode isConsentRequired} is false,
 * so an under-13's Apple, Google or email identity is never collected first
 * (ADR 0001).
 */
export function resolveCreateEntry({ ageAnswer, nowMs }: CreateEntryInput): CreateEntry {
  if (ageAnswer === undefined) return { kind: 'age-gate' };
  const { birthYear } = ageAnswer;
  return isConsentRequired({ birthYear, nowMs })
    ? { kind: 'guardian-consent', birthYear }
    : { kind: 'create-account', birthYear };
}
