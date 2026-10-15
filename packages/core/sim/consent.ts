// §1.5 age gate. A birth year cannot separate 12 from 13, so any year that
// could belong to an under-13 Caller takes the guardian-consent path.
// ADR 0001, "Age and consent": docs/adr/0001-auth-and-identity.md
// COPPA rule: https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312

/**
 * The COPPA age line in years. {@linkcode isConsentRequired} sends every birth
 * year with `currentYear - birthYear <= CONSENT_AGE_YEARS` to guardian consent.
 */
export const CONSENT_AGE_YEARS = 13;

const MS_PER_DAY = 86_400_000;
const DAYS_PER_ERA = 146_097;
/** Days from 0000-03-01 to 1970-01-01 in the proleptic Gregorian calendar. */
const EPOCH_SHIFT_DAYS = 719_468;

/**
 * The UTC calendar year of an epoch-millisecond timestamp, computed with
 * integer math so the sim never constructs a `Date` (Law 3). Same result as
 * `new Date(epochMs).getUTCFullYear()`.
 *
 * Algorithm: `civil_from_days`, https://howardhinnant.github.io/date_algorithms.html#civil_from_days
 *
 * @throws {RangeError} if `epochMs` is not an integer.
 */
export function utcYearFromEpochMs(epochMs: number): number {
  if (!Number.isInteger(epochMs)) throw new RangeError(`epochMs must be an integer, got ${epochMs}`);
  const z = Math.floor(epochMs / MS_PER_DAY) + EPOCH_SHIFT_DAYS;
  const era = Math.floor(z / DAYS_PER_ERA);
  const dayOfEra = z - era * DAYS_PER_ERA;
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36_524) - Math.floor(dayOfEra / 146_096)) / 365,
  );
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const shiftedMonth = Math.floor((5 * dayOfYear + 2) / 153);
  // Shifted months 10 and 11 are January and February of the next civil year.
  return yearOfEra + era * 400 + (shiftedMonth >= 10 ? 1 : 0);
}

/** Input to {@linkcode isConsentRequired}. */
export interface ConsentCheck {
  /** The year the Caller gave at M04. An integer; the M04 store and the server parse it first. */
  readonly birthYear: number;
  /** The time of the check, epoch ms. The rule uses its UTC year, as the server hook does. */
  readonly nowMs: number;
}

/**
 * True when `birthYear` could belong to someone under 13 at `nowMs`, which
 * sends the Caller to guardian consent (M05) instead of account creation.
 * The rule is ADR 0001's `currentYear - birthYear <= 13`, with the current
 * year taken in UTC. A birth year after the current year also returns true.
 *
 * One rule for M04, M03's create guard (`resolveCreateEntry`) and
 * the server sign-up hook.
 *
 * @throws {RangeError} if `birthYear` is not an integer, so a bad value can
 *   never fall through to "no consent needed".
 */
export function isConsentRequired({ birthYear, nowMs }: ConsentCheck): boolean {
  if (!Number.isInteger(birthYear)) throw new RangeError(`birthYear must be an integer, got ${birthYear}`);
  return utcYearFromEpochMs(nowMs) - birthYear <= CONSENT_AGE_YEARS;
}

/**
 * True when the Caller must be treated as under 13: guardian consent is (or
 * was) part of their account (`consentStatus` other than `not-required`), or
 * their stored birth year could still belong to someone under 13 at `nowMs`.
 * Errs toward under-13, the protective side. Reads `CallerProfile.birthYear`
 * and `consentStatus` from the save (`packages/core/schemas/caller.ts`).
 */
export function isCallerUnder13(
  caller: { readonly birthYear: number; readonly consentStatus: string },
  nowMs: number,
): boolean {
  return caller.consentStatus !== 'not-required' || isConsentRequired({ birthYear: caller.birthYear, nowMs });
}
