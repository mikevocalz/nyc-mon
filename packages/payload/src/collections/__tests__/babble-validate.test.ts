import { MON_BABBLE_SEED_ROWS } from '@acme/content/lingo';
import { describe, expect, it } from 'vitest';
import { validateBabbleSound } from '../LanguageLexicon.ts';

describe('language-lexicon babble rows (Decision 32)', () => {
  it('accepts every seeded babble sound', () => {
    for (const row of MON_BABBLE_SEED_ROWS) expect(validateBabbleSound(row.canonicalText, row.subcategory), row.key).toBe(true);
  });

  it('refuses a real word, a long or non-letter sound, and a missing subcategory', () => {
    expect(validateBabbleSound('hi', 'syllable')).not.toBe(true);
    expect(validateBabbleSound('mama', 'family-sound')).not.toBe(true);
    expect(validateBabbleSound('hungry', 'egg-sound')).not.toBe(true);
    expect(validateBabbleSound('bwagunyami', 'syllable')).not.toBe(true);
    expect(validateBabbleSound('say hi', 'family-sound')).not.toBe(true);
    expect(validateBabbleSound('ba', null)).not.toBe(true);
  });
});
