// §1.5 age gate. The consent rule lives in @acme/core (`isConsentRequired`)
// so M04, M03's create guard and the server share one line (ADR 0001, "Age and
// consent"; COPPA: https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312).
// This file only narrows untrusted input before it reaches that rule, which
// throws on a non-integer year.
import { MIN_BIRTH_YEAR } from '@acme/core/schemas';

/** Narrows an unknown sign-up value to a plausible birth year, or `undefined`. */
export function parseBirthYear(value: unknown, currentYear: number): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) return undefined;
  if (value < MIN_BIRTH_YEAR || value > currentYear) return undefined;
  return value;
}
