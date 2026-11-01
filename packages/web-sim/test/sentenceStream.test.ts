import { describe, expect, it } from 'vitest';
import { createSentenceSplitter, splitSentences } from '../src/client/sentenceStream.ts';

/** Feeds `text` one character at a time, the worst case for a streamed reply. */
function streamed(text: string): string[] {
  const s = createSentenceSplitter();
  const out: string[] = [];
  for (const ch of text) out.push(...s.push(ch));
  out.push(...s.flush());
  return out;
}

describe('sentence splitter', () => {
  it('splits on . ! ? and flushes the tail', () => {
    expect(splitSentences('Hey there, friend. Want a snack? I do! Maybe later')).toEqual([
      'Hey there, friend.',
      'Want a snack?',
      // "I do!" is too short to voice alone, so it rides with the tail.
      'I do! Maybe later',
    ]);
  });

  it('gives the same sentences however the text is chunked', () => {
    const text = 'Your Mon is sleepy. It ate 2.5 slices at 3 p.m. today! Dr. Ratti says hi… Okay? *yawn* Night night.';
    expect(streamed(text)).toEqual(splitSentences(text));
  });

  it('does not split on abbreviations, initials or decimals', () => {
    expect(splitSentences('Mr. Ratti met Dr. Pigeon on St. Marks at 3.75 p.m. sharp. Then J. R. left.')).toEqual([
      'Mr. Ratti met Dr. Pigeon on St. Marks at 3.75 p.m. sharp.',
      'Then J. R. left.',
    ]);
  });

  it('keeps e.g. and i.e. inside the sentence', () => {
    expect(splitSentences('Snacks, e.g. pizza, are good. Naps, i.e. sleep, too.')).toEqual([
      'Snacks, e.g. pizza, are good.',
      'Naps, i.e. sleep, too.',
    ]);
  });

  it('splits after an ellipsis only when a new sentence starts', () => {
    expect(splitSentences('Well... maybe. Hmm… Fine, I’ll eat.')).toEqual(['Well... maybe.', 'Hmm… Fine, I’ll eat.']);
  });

  it('splits on newlines and drops blank lines', () => {
    expect(splitSentences('First line\n\nSecond line\nthird')).toEqual(['First line', 'Second line', 'third']);
  });

  it('keeps a stage direction with the sentence that follows it', () => {
    expect(splitSentences('That tickles. *chuckle* Do it again! *huff* Okay, enough.')).toEqual([
      'That tickles.',
      '*chuckle* Do it again!',
      '*huff* Okay, enough.',
    ]);
  });

  it('never splits inside a stage direction', () => {
    expect(splitSentences('*sighs. deeply* Fine, fine. You win.')).toEqual(['*sighs. deeply* Fine, fine.', 'You win.']);
  });

  it('keeps closing quotes and brackets on the sentence they close', () => {
    expect(splitSentences('It said "feed me!" Then it slept.')).toEqual(['It said "feed me!"', 'Then it slept.']);
  });

  it('emits a sentence as soon as the next one starts, before the reply ends', () => {
    const s = createSentenceSplitter();
    expect(s.push('Hi there, Caller.')).toEqual([]);
    expect(s.push(' Y')).toEqual(['Hi there, Caller.']);
    expect(s.push('ou look tired')).toEqual([]);
    expect(s.flush()).toEqual(['You look tired']);
    expect(s.flush()).toEqual([]);
  });

  it('merges a fragment too short to voice on its own into the next sentence', () => {
    expect(splitSentences('Oh! Hey, you came back.')).toEqual(['Oh! Hey, you came back.']);
  });
});
