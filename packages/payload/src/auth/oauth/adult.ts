// The Alexa+ 18+ rule (ADR 0015 §1). Linking reads `birthYear` and
// `consentStatus` from the Users collection (collections/Users.ts). A birth
// year cannot separate 17 from 18, so any year that could belong to someone
// under 18 is refused, the same way isConsentRequired treats 13
// (packages/core/sim/consent.ts).
import { utcYearFromEpochMs } from '@acme/core/sim';

/** The Alexa+ age line in years. */
export const LINKING_AGE_YEARS = 18;

/** Why an account cannot link, or `undefined` when it can. */
export type LinkRefusal = 'no-birth-year' | 'under-18' | 'guardian-account';

/**
 * Checks a Better Auth user row (`birthYear`, `consentStatus` are additional
 * fields in auth/options.ts). Refuses when the birth year is missing, when
 * `currentYear - birthYear <= 18`, or when the account ever went through
 * guardian consent (`consentStatus` other than `not-required`).
 */
export function linkRefusal(user: Record<string, unknown> | null | undefined, nowMs: number): LinkRefusal | undefined {
  if (user === null || user === undefined) return 'no-birth-year';
  const consentStatus = user.consentStatus;
  if (consentStatus !== undefined && consentStatus !== null && consentStatus !== 'not-required') return 'guardian-account';
  const birthYear = user.birthYear;
  if (typeof birthYear !== 'number' || !Number.isInteger(birthYear)) return 'no-birth-year';
  const currentYear = utcYearFromEpochMs(Math.trunc(nowMs));
  if (currentYear - birthYear <= LINKING_AGE_YEARS) return 'under-18';
  return undefined;
}

export function isLinkableAdult(user: Record<string, unknown> | null | undefined, nowMs: number): boolean {
  return linkRefusal(user, nowMs) === undefined;
}
