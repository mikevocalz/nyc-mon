import { MON_LINGO_CATEGORIES, MON_LINGO_SEED_ROWS } from '@acme/content/lingo';
import { describe, expect, it } from 'vitest';
import { MON_LINGO_SEED_SHA256, monLingoSeedHash } from '../migrations/20261028_200000_mon_lingo_seed.ts';

describe('migration 20261028_200000_mon_lingo_seed', () => {
  it('writes the seed it was written for: a changed seed needs a new migration', () => {
    expect(monLingoSeedHash()).toBe(MON_LINGO_SEED_SHA256);
  });

  it('seeds every row with a source citation, a unique key and a voice category or story canon', () => {
    const keys = MON_LINGO_SEED_ROWS.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(MON_LINGO_SEED_ROWS.filter((row) => !row.sourceBasis?.trim()).map((row) => row.key)).toEqual([]);
    const categories = new Set<string>([...MON_LINGO_CATEGORIES, 'story-canon']);
    expect(MON_LINGO_SEED_ROWS.filter((row) => !categories.has(row.category)).map((row) => row.key)).toEqual([]);
  });

  it('uses the entry types Mike named: call_response lines, pronunciation_rule for Call-uh, style_rule for voice rules', () => {
    const byCategory = (category: string) => new Set(MON_LINGO_SEED_ROWS.filter((row) => row.category === category).map((row) => row.entryType));
    expect(byCategory('mon-line')).toEqual(new Set(['call_response']));
    expect(byCategory('pronunciation')).toEqual(new Set(['pronunciation_rule']));
    expect(byCategory('voice-rule')).toEqual(new Set(['style_rule']));
    expect(MON_LINGO_SEED_ROWS.find((row) => row.key === 'pronunciation.caller')?.spokenForm).toBe('Call-uh');
  });
});
