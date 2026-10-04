// §1.5 age gate. A birth year cannot separate 12 from 13, so any year that
// could belong to an under-13 Caller takes the guardian-consent path
// (ADR 0001, "Age and consent"; COPPA: https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312).

export const MIN_BIRTH_YEAR = 1900;

/** True when `birthYear` could belong to someone under 13 in `currentYear`. */
export function needsGuardianConsent(birthYear: number, currentYear: number): boolean {
  return currentYear - birthYear <= 13;
}

/** Narrows an unknown sign-up value to a plausible birth year, or `undefined`. */
export function parseBirthYear(value: unknown, currentYear: number): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) return undefined;
  if (value < MIN_BIRTH_YEAR || value > currentYear) return undefined;
  return value;
}
