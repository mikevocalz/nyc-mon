import { describe, expect, it } from 'vitest';
import { AgeAnswerSchema, MIN_BIRTH_YEAR } from '../schemas/index.ts';
import { CONSENT_AGE_YEARS, isConsentRequired, utcYearFromEpochMs } from '../sim/consent.ts';
import { resolveCreateEntry } from '../sim/onboarding.ts';
import { forAll, T0 } from './harness.ts';

const at = (year: number, month = 0, day = 1, hour = 0): number => Date.UTC(year, month, day, hour);

describe('utcYearFromEpochMs', () => {
  it('matches Date#getUTCFullYear on the boundaries of a year', () => {
    expect(utcYearFromEpochMs(at(2026))).toBe(2026);
    expect(utcYearFromEpochMs(at(2026) - 1)).toBe(2025);
    expect(utcYearFromEpochMs(at(2025, 11, 31, 23) + 59 * 60_000 + 59_999)).toBe(2025);
    expect(utcYearFromEpochMs(0)).toBe(1970);
    expect(utcYearFromEpochMs(at(2000, 1, 29, 12))).toBe(2000);
    expect(utcYearFromEpochMs(at(2100, 1, 28, 12))).toBe(2100);
  });

  it('agrees with Date#getUTCFullYear across 1900..2400', () => {
    const lo = at(1900);
    const hi = at(2400);
    forAll(
      10_000,
      (random) => Math.floor(lo + random() * (hi - lo)),
      (ms) => expect(utcYearFromEpochMs(ms)).toBe(new Date(ms).getUTCFullYear()),
    );
  });

  it('rejects a non-integer timestamp', () => {
    expect(() => utcYearFromEpochMs(Number.NaN)).toThrow(RangeError);
    expect(() => utcYearFromEpochMs(1.5)).toThrow(RangeError);
  });
});

describe('isConsentRequired (ADR 0001: currentYear - birthYear <= 13)', () => {
  const nowMs = at(2026, 9, 4);

  it('the threshold is 13 years', () => {
    expect(CONSENT_AGE_YEARS).toBe(13);
  });

  // 2013: 2026 - 2013 = 13, which could still be a 12-year-old, so it takes the consent path.
  it.each([
    [2026, true],
    [2014, true],
    [2013, true],
    [2012, false],
    [1990, false],
    [1900, false],
  ])('birth year %i in 2026 -> %s', (birthYear, expected) => {
    expect(isConsentRequired({ birthYear, nowMs })).toBe(expected);
  });

  it('uses the UTC year, like the server hook', () => {
    // 2027-01-01T00:30Z is still 2026 in New York; the rule follows UTC.
    expect(isConsentRequired({ birthYear: 2013, nowMs: at(2027, 0, 1) + 30 * 60_000 })).toBe(false);
    expect(isConsentRequired({ birthYear: 2013, nowMs: at(2027) - 1 })).toBe(true);
  });

  it('a year after now (impossible input) fails closed', () => {
    expect(isConsentRequired({ birthYear: 2030, nowMs })).toBe(true);
  });

  it('rejects a non-integer birth year instead of failing open', () => {
    expect(() => isConsentRequired({ birthYear: Number.NaN, nowMs })).toThrow(RangeError);
    expect(() => isConsentRequired({ birthYear: 2010.5, nowMs })).toThrow(RangeError);
  });

  it('property: equals the ADR 0001 formula for every year 1900..current', () => {
    forAll(
      5_000,
      (random) => {
        const ms = Math.floor(at(1990) + random() * (at(2100) - at(1990)));
        const year = new Date(ms).getUTCFullYear();
        return { ms, year, birthYear: MIN_BIRTH_YEAR + Math.floor(random() * (year - MIN_BIRTH_YEAR + 1)) };
      },
      ({ ms, year, birthYear }) => {
        expect(isConsentRequired({ birthYear, nowMs: ms })).toBe(year - birthYear <= 13);
      },
    );
  });

  it('property: monotone, a later birth year never needs less consent', () => {
    forAll(
      2_000,
      (random) => ({ a: 1900 + Math.floor(random() * 130), d: Math.floor(random() * 20) }),
      ({ a, d }) => {
        if (isConsentRequired({ birthYear: a, nowMs })) {
          expect(isConsentRequired({ birthYear: a + d, nowMs })).toBe(true);
        }
      },
    );
  });
});

describe('AgeAnswerSchema (the stored M04 answer)', () => {
  it('parses a stored answer', () => {
    expect(AgeAnswerSchema.parse({ birthYear: 2010, answeredAtMs: T0 })).toEqual({ birthYear: 2010, answeredAtMs: T0 });
  });

  it.each([{ birthYear: 1899, answeredAtMs: T0 }, { birthYear: 2010.5, answeredAtMs: T0 }, { birthYear: 2010 }, {}])(
    'rejects %o',
    (value) => {
      expect(AgeAnswerSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe('resolveCreateEntry (P1: create passes the age gate first)', () => {
  const nowMs = at(2026, 9, 4);

  it('without a stored answer the only entry is the age gate', () => {
    expect(resolveCreateEntry({ ageAnswer: undefined, nowMs })).toEqual({ kind: 'age-gate' });
  });

  it('13 and over goes to account creation', () => {
    expect(resolveCreateEntry({ ageAnswer: { birthYear: 2000, answeredAtMs: T0 }, nowMs })).toEqual({
      kind: 'create-account',
      birthYear: 2000,
    });
  });

  it('a year that could be under 13 goes to guardian consent, never to account creation', () => {
    expect(resolveCreateEntry({ ageAnswer: { birthYear: 2013, answeredAtMs: T0 }, nowMs })).toEqual({
      kind: 'guardian-consent',
      birthYear: 2013,
    });
  });

  it('property: create-account is returned only with a stored answer that needs no consent', () => {
    forAll(
      5_000,
      (random) => ({
        ageAnswer: random() < 0.2 ? undefined : { birthYear: 1900 + Math.floor(random() * 140), answeredAtMs: T0 },
      }),
      ({ ageAnswer }) => {
        const entry = resolveCreateEntry({ ageAnswer, nowMs });
        if (entry.kind === 'create-account') {
          expect(ageAnswer).toBeDefined();
          expect(isConsentRequired({ birthYear: entry.birthYear, nowMs })).toBe(false);
        }
        if (ageAnswer === undefined) expect(entry.kind).toBe('age-gate');
      },
    );
  });
});
