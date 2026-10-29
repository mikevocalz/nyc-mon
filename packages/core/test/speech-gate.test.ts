import { describe, expect, it } from 'vitest';
import {
  type BabbleInventory,
  checkLimitedSpeech,
  enforceBabble,
  enforceLimitedSpeech,
  enforceVoiceStage,
  isBabble,
  isBabbleToken,
  makeBabble,
  REAL_WORD_BLOCKLIST,
  speechTokens,
} from '../sim/speech-gate.ts';

const INV: BabbleInventory = { syllables: ['ba', 'bwa', 'gu', 'nya', 'mi', 'bu', 'wa', 'lu'], sounds: ['skree', 'chk'] };

/** Common words a model reaches for when told to babble, and words the syllables could spell. */
const REAL_WORDS = [
  'hi', 'hello', 'bye', 'yes', 'no', 'food', 'hungry', 'bet', 'again', 'caller', 'callah', 'mama', 'dada', 'papa', 'baby',
  'love', 'you', 'me', 'i', 'up', 'play', 'eat', 'sleep', 'goo', 'gaga', 'wawa', 'lulu', 'bubu', 'baba', 'mimi', 'mine', 'wane',
];

describe('speechTokens', () => {
  it('drops stage directions, audio tags and punctuation, keeps apostrophes, lowercases', () => {
    expect(speechTokens("*giggles* [happily] Bwa-gu! I'm  HUNGRY?")).toEqual(['bwa-gu', "i'm", 'hungry']);
    expect(speechTokens('  ...!? ')).toEqual([]);
  });
});

describe('babble', () => {
  it('accepts syllable chains and family sounds', () => {
    expect(isBabbleToken('bwagu', INV)).toBe(true);
    expect(isBabbleToken('bwa-gu-nya', INV)).toBe(true);
    expect(isBabbleToken('skree', INV)).toBe(true);
    expect(isBabble('Bwa-gu! Minya? *giggles* skree.', INV)).toBe(true);
  });

  it('rejects every real word, including ones the syllables can spell', () => {
    for (const word of [...REAL_WORDS, ...REAL_WORD_BLOCKLIST]) expect(isBabbleToken(word, INV), word).toBe(false);
    expect(isBabble('Bwagu hi', INV)).toBe(false);
    expect(isBabble('', INV)).toBe(false);
    expect(isBabble('*giggles*', INV)).toBe(false);
  });

  it('rejects a doubled syllable (mama, gaga) and chains longer than three syllables', () => {
    expect(isBabbleToken('baba', INV)).toBe(false);
    expect(isBabbleToken('bwagunyami', INV)).toBe(false);
  });

  it('makeBabble is deterministic per seed, varied across seeds, and always passes the gate', () => {
    expect(makeBabble('mon_1:hello', INV)).toBe(makeBabble('mon_1:hello', INV));
    const lines = new Set(Array.from({ length: 40 }, (_, i) => makeBabble(`seed-${i}`, INV)));
    expect(lines.size).toBeGreaterThan(20);
    for (const line of lines) expect(isBabble(line, INV), line).toBe(true);
  });

  it('enforceBabble keeps babble, replaces anything with a real word', () => {
    expect(enforceBabble('Bwa-gu!', INV, 's')).toEqual({ text: 'Bwa-gu!', replaced: false });
    const leaked = enforceBabble('Bwa-gu, I love you Callah!', INV, 's');
    expect(leaked.replaced).toBe(true);
    expect(isBabble(leaked.text, INV)).toBe(true);
    expect(leaked.text).not.toMatch(/love|you|callah/i);
  });

  it('enforceBabble strips stage directions and tags from what it returns', () => {
    const kept = enforceBabble('*whispers secret words* [shouts] Minya~', INV, 's');
    expect(kept.text).toBe('Minya~');
  });

  it('an empty inventory still yields babble from the built-in syllables', () => {
    const out = enforceBabble('hello', { syllables: [], sounds: [] }, 's');
    expect(out.replaced).toBe(true);
    expect(out.text).not.toBe('');
  });

  it('ignores inventory entries that are real words or not letters', () => {
    const tainted: BabbleInventory = { syllables: ['ba', 'hi', 'no', 'b a', 'x'.repeat(20)], sounds: ['food'] };
    expect(isBabbleToken('hi', tainted)).toBe(false);
    expect(isBabbleToken('food', tainted)).toBe(false);
    expect(isBabble(makeBabble('t', tainted), tainted)).toBe(true);
  });
});

describe('limited speech (Q32: family sound plus at most two words, never a sentence, no Callah)', () => {
  it('allows the canon Squeaklet lines and the family sound', () => {
    for (const line of ['Bet!', 'Food?', 'Again!', '*chuckle* Bet!', 'Skree! Food?', 'Bet. Food?']) {
      expect(checkLimitedSpeech(line, INV), line).toEqual({ ok: true });
    }
  });

  it('refuses a third word', () => {
    expect(checkLimitedSpeech('Food now please', INV)).toEqual({ ok: false, reason: 'too-many-words' });
  });

  it('refuses Callah and Caller in any spelling', () => {
    expect(checkLimitedSpeech('Callah!', INV)).toEqual({ ok: false, reason: 'callah' });
    expect(checkLimitedSpeech('Bet, CALLER', INV)).toEqual({ ok: false, reason: 'callah' });
    expect(checkLimitedSpeech('Call-uh!', INV)).toEqual({ ok: false, reason: 'callah' });
  });

  it('refuses a two-word sentence (a pronoun or a contraction makes a clause)', () => {
    expect(checkLimitedSpeech("I'm hungry.", INV)).toEqual({ ok: false, reason: 'sentence' });
    expect(checkLimitedSpeech('You good?', INV)).toEqual({ ok: false, reason: 'sentence' });
  });

  it('refuses nothing to say', () => {
    expect(checkLimitedSpeech('*chuckle*', INV)).toEqual({ ok: false, reason: 'empty' });
  });

  it('enforceLimitedSpeech keeps a good line and falls back otherwise', () => {
    expect(enforceLimitedSpeech('Bet!', INV, 'Skree!')).toEqual({ text: 'Bet!', replaced: false });
    expect(enforceLimitedSpeech("Yeah Callah, I'm good.", INV, 'Skree!')).toEqual({ text: 'Skree!', replaced: true });
  });

  it('a fallback that itself breaks the rule becomes babble', () => {
    const out = enforceLimitedSpeech('Hello there my friend', INV, 'Hello there my friend');
    expect(out.replaced).toBe(true);
    expect(isBabble(out.text, INV)).toBe(true);
  });
});

describe('enforceVoiceStage', () => {
  it('routes by stage: babble, limited, or the line untouched', () => {
    expect(isBabble(enforceVoiceStage('Hey!', 'baby-talk', INV, { seed: 's' }).text, INV)).toBe(true);
    expect(enforceVoiceStage('Food?', 'limited', INV, { seed: 's' }).text).toBe('Food?');
    expect(enforceVoiceStage('Food now please', 'limited', INV, { seed: 's', limitedFallback: 'Food?' }).text).toBe('Food?');
    expect(enforceVoiceStage('Yeah Callah, I am good.', 'full', INV, { seed: 's' })).toEqual({ text: 'Yeah Callah, I am good.', replaced: false });
  });
});
