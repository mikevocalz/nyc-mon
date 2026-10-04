import { describe, expect, it } from 'vitest';
import { isFreshSession } from '../plugins/fresh.ts';
import { checkMergeEligibility, normaliseMergeCode, planAccounts, survivingBirthYear } from '../plugins/merge-rules.ts';

const adult = (id: string, birthYear: number | null = 2000) => ({ id, birthYear, consentStatus: 'not-required' });

describe('merge eligibility (ADR 0004 §3)', () => {
  it('allows two 13+ accounts with the same or a missing birth year', () => {
    expect(checkMergeEligibility(adult('1'), adult('2'))).toBeUndefined();
    expect(checkMergeEligibility(adult('1'), adult('2', null))).toBeUndefined();
  });

  it('refuses the same account, consented accounts and differing years', () => {
    expect(checkMergeEligibility(adult('1'), adult('1'))).toBe('MERGE_SAME_ACCOUNT');
    expect(checkMergeEligibility(adult('1'), { ...adult('2'), consentStatus: 'approved' })).toBe('MERGE_CONSENT_ACCOUNT');
    expect(checkMergeEligibility(adult('1', 2000), adult('2', 2001))).toBe('MERGE_BIRTH_YEAR_MISMATCH');
  });

  it('keeps the survivor year, or the merged one when the survivor had none', () => {
    expect(survivingBirthYear(adult('1', 1999), adult('2', 1999))).toBe(1999);
    expect(survivingBirthYear(adult('1', null), adult('2', 2001))).toBe(2001);
    expect(survivingBirthYear(adult('1', null), adult('2', null))).toBeUndefined();
  });
});

describe('sign-in method plan', () => {
  it('moves new providers, drops a second password, stops on a shared social provider', () => {
    const plan = planAccounts(
      [
        { id: 's1', providerId: 'credential' },
        { id: 's2', providerId: 'google' },
      ],
      [
        { id: 'm1', providerId: 'credential' },
        { id: 'm2', providerId: 'apple' },
        { id: 'm3', providerId: 'google' },
      ],
    );
    expect(plan).toEqual({ move: ['m2'], drop: ['m1'], conflicts: ['google'] });
  });
});

describe('merge codes and freshness', () => {
  it('normalises typed codes', () => {
    expect(normaliseMergeCode(' abcd-efgh ')).toBe('ABCDEFGH');
  });

  it('treats a sign-in older than 10 minutes as stale', () => {
    const now = Date.UTC(2026, 9, 4, 12);
    expect(isFreshSession({ createdAt: new Date(now - 9 * 60_000) }, now)).toBe(true);
    expect(isFreshSession({ createdAt: new Date(now - 11 * 60_000).toISOString() }, now)).toBe(false);
    expect(isFreshSession({ createdAt: 'not a date' }, now)).toBe(false);
  });
});
