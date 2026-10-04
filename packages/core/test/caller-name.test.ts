import { describe, expect, it } from 'vitest';
import { CallerProfileSchema } from '../schemas/index.ts';
import {
  CALLER_NAME_MAX_LENGTH,
  type CallerNameRejection,
  callerNameErrorCopyId,
  validateCallerName,
} from '../sim/caller-name.ts';
import { forAll, T0 } from './harness.ts';

const noBlocks = { isBlocked: () => false };
const check = (raw: string) => validateCallerName(raw, noBlocks);

describe('validateCallerName (M07)', () => {
  it('the limit is 16', () => {
    expect(CALLER_NAME_MAX_LENGTH).toBe(16);
  });

  it.each([
    'Dee',
    'Ratti',
    'Mary-Kate',
    "D'Angelo",
    'D’Angelo',
    'J. Lo',
    'Zoë',
    'José',
    'Ñandú',
    'François',
    'Nguyễn',
    'Ọlálékan',
    'Αλέξης',
    'Дмитрий',
    'سارة',
    'שירה',
    'अनुराधा',
    'ไพลิน',
    '美玲',
    'さくら',
    '지민',
    'ʻIolani',
  ])('accepts %s', (raw) => {
    expect(check(raw)).toEqual({ ok: true, name: raw.normalize('NFC') });
  });

  it('returns the trimmed name', () => {
    expect(check('  Dee  ')).toEqual({ ok: true, name: 'Dee' });
  });

  it('returns the NFC form, so a decomposed é is stored once', () => {
    const decomposed = 'Zoë';
    expect(check(decomposed)).toEqual({ ok: true, name: 'Zoë' });
  });

  it.each(['', '   ', '\t\n', '--', "'.", ' . '])('blank: %j', (raw) => {
    expect(check(raw)).toEqual({ ok: false, reason: 'blank' });
  });

  it('16 characters pass, 17 are too long', () => {
    expect(check('A'.repeat(16))).toEqual({ ok: true, name: 'A'.repeat(16) });
    expect(check('A'.repeat(17))).toEqual({ ok: false, reason: 'too-long' });
  });

  it('length is measured after trimming', () => {
    expect(check(`   ${'A'.repeat(16)}   `)).toEqual({ ok: true, name: 'A'.repeat(16) });
  });

  it.each(['Dani2', 'D3e', 'Dee 😀', 'Dee!', 'Dee_D', 'Dee@home', 'Dee D', 'Dee—D'])('characters: %j', (raw) => {
    expect(check(raw)).toEqual({ ok: false, reason: 'characters' });
  });

  it('blocked names come from the caller-supplied filter, checked on the trimmed name', () => {
    const seen: string[] = [];
    const result = validateCallerName('  Badname ', {
      isBlocked: (name) => {
        seen.push(name);
        return name === 'Badname';
      },
    });
    expect(result).toEqual({ ok: false, reason: 'blocked' });
    expect(seen).toEqual(['Badname']);
  });

  it('error order: blank, then too long, then characters, then blocked', () => {
    const blockAll = { isBlocked: () => true };
    expect(validateCallerName('1234', blockAll)).toEqual({ ok: false, reason: 'blank' });
    expect(validateCallerName(`${'A'.repeat(16)}1`, blockAll)).toEqual({ ok: false, reason: 'too-long' });
    expect(validateCallerName('Dee1', blockAll)).toEqual({ ok: false, reason: 'characters' });
    expect(validateCallerName('Dee', blockAll)).toEqual({ ok: false, reason: 'blocked' });
  });

  it('the filter is not consulted for a name that already failed', () => {
    let calls = 0;
    validateCallerName('Dee1', {
      isBlocked: () => {
        calls++;
        return false;
      },
    });
    expect(calls).toBe(0);
  });

  it.each([
    ['blank', 'm07.error.blank'],
    ['too-long', 'm07.error.too_long'],
    ['characters', 'm07.error.characters'],
    ['blocked', 'm07.error.blocked'],
  ] as const)('reason %s maps to %s', (reason: CallerNameRejection, id) => {
    expect(callerNameErrorCopyId(reason)).toBe(id);
  });

  it('property: an accepted name is trimmed NFC, 1..16 long, and contains a letter', () => {
    const alphabet = ['a', 'Z', 'é', 'ñ', 'Ж', 'ש', '美', ' ', '-', "'", '.', '1', '😀', '!', '́'];
    forAll(
      10_000,
      (random) => {
        const length = Math.floor(random() * 22);
        let raw = '';
        for (let i = 0; i < length; i++) raw += alphabet[Math.floor(random() * alphabet.length)];
        return raw;
      },
      (raw) => {
        const result = check(raw);
        if (!result.ok) return;
        expect(result.name).toBe(result.name.normalize('NFC').trim());
        expect(result.name.length).toBeGreaterThanOrEqual(1);
        expect(result.name.length).toBeLessThanOrEqual(16);
        expect(result.name).toMatch(/\p{L}/u);
        expect(check(result.name)).toEqual(result);
      },
    );
  });
});

describe('CallerProfileSchema.callerName agrees with the M07 rule', () => {
  const profile = (callerName: string) => ({
    callerId: 'caller-1',
    callerName,
    birthYear: 2010,
    consentStatus: 'not-required',
    createdAt: T0,
  });

  it.each(['Dee', 'Mary-Kate', 'Zoë', 'A'.repeat(16), '지민'])('accepts %j', (name) => {
    expect(CallerProfileSchema.safeParse(profile(name)).success).toBe(true);
  });

  it.each(['', '   ', 'A'.repeat(17), 'A'.repeat(32), 'Dani2', 'Dee 😀', ' Dee', 'Zoë', '--'])(
    'rejects %j',
    (name) => {
      expect(CallerProfileSchema.safeParse(profile(name)).success).toBe(false);
    },
  );

  it('property: every name validateCallerName accepts, the schema stores', () => {
    const alphabet = ['a', 'é', 'Ж', ' ', '-', "'", '.', '1', '!'];
    forAll(
      5_000,
      (random) => {
        const length = Math.floor(random() * 20);
        let raw = '';
        for (let i = 0; i < length; i++) raw += alphabet[Math.floor(random() * alphabet.length)];
        return raw;
      },
      (raw) => {
        const result = check(raw);
        if (result.ok) expect(CallerProfileSchema.safeParse(profile(result.name)).success).toBe(true);
        else if (result.reason !== 'blocked') expect(CallerProfileSchema.safeParse(profile(raw.trim())).success).toBe(false);
      },
    );
  });
});
