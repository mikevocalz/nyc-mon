import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FALLBACK_MON_LINGO, MON_LINGO_SEED_ROWS } from '../lingo/index.ts';
import { stageDirectionsToTags } from '../voices.ts';

/**
 * skills/nyc-mon-companion/SKILL.md stays the human-readable version of the
 * Mon's lingo; Payload holds the data. Every seeded row that cites SKILL.md
 * must quote it verbatim, and the skill's word palette and stage-direction
 * words must match the seed, so the two cannot drift apart unnoticed.
 * A change to either side fails here until the other follows (a new seed
 * needs a new Payload migration).
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SKILL = readFileSync(resolve(ROOT, 'skills/nyc-mon-companion/SKILL.md'), 'utf8');
const BRIEF = readFileSync(resolve(ROOT, 'docs/alexa-plus-brief.md'), 'utf8');

function section(heading: string): string {
  const start = SKILL.indexOf(heading);
  expect(start, heading).toBeGreaterThanOrEqual(0);
  const next = SKILL.indexOf('\n#', start + heading.length);
  return SKILL.slice(start, next === -1 ? undefined : next);
}

describe('SKILL.md and the Payload seed say the same thing', () => {
  it('every row citing SKILL.md quotes it word for word', () => {
    // Palette words sit in a table with their own quote marks; the next test checks them.
    const citing = MON_LINGO_SEED_ROWS.filter((row) => row.sourceBasis?.includes('skills/nyc-mon-companion/SKILL.md') && row.category !== 'word-palette');
    expect(citing.length).toBeGreaterThan(25);
    const missing = citing.filter((row) => !SKILL.includes(row.responseText ?? row.canonicalText)).map((row) => `${row.key}: ${row.responseText ?? row.canonicalText}`);
    expect(missing).toEqual([]);
  });

  it('every voice rule citing only the brief quotes its Character voice rules word for word', () => {
    const rules = BRIEF.slice(BRIEF.indexOf('## Character voice rules'), BRIEF.indexOf('\n## ', BRIEF.indexOf('## Character voice rules') + 1));
    const citing = MON_LINGO_SEED_ROWS.filter((row) => row.sourceBasis?.startsWith('docs/alexa-plus-brief.md §Character voice rules'));
    expect(citing.map((row) => row.key).sort()).toEqual(['voice-rule.caller-term', 'voice-rule.nurse-nay-name', 'voice-rule.one-profile-per-character']);
    expect(citing.filter((row) => !rules.includes(row.canonicalText)).map((row) => row.key)).toEqual([]);
    // Every bullet in that section is seeded, so a new brief rule fails here until it is in Payload.
    const bullets = [...rules.matchAll(/^- (.+)$/gm)].map((m) => m[1]!.trim());
    expect(bullets.filter((bullet) => !citing.some((row) => row.canonicalText === bullet))).toEqual([]);
  });

  it('the word palette is the same set of words', () => {
    const table = section('#### Word palette');
    const features = [...table.matchAll(/^\| ([^|]+?) \| "/gm)].map((m) => m[1]!.replace(/"/g, '').trim()).filter((f) => f !== 'Feature');
    const seeded = MON_LINGO_SEED_ROWS.filter((row) => row.category === 'word-palette').map((row) => row.canonicalText);
    expect([...seeded].sort()).toEqual([...features].sort());
  });

  it('the skill’s six stage-direction words map as the voice performs them', () => {
    const delivery = section('## Delivery by mood');
    const words = [...delivery.slice(0, delivery.indexOf('|')).matchAll(/`\*([a-z]+)\*`/g)].map((m) => m[1]!);
    expect(words).toEqual(['laughs', 'sighs', 'chuckle', 'huff', 'yawn', 'whisper']);
    const performed = Object.fromEntries(words.map((word) => [word, stageDirectionsToTags(`*${word}*`, FALLBACK_MON_LINGO)]));
    // `*yawn*` has no audio tag in the lexicon, so the voice drops it (as it did
    // before the move). SKILL.md says all six become tags: an open gap for the
    // owner, pinned here so a fix shows up as a deliberate change.
    expect(performed).toEqual({ laughs: '[laughs]', sighs: '[sighs]', chuckle: '[laughs]', huff: '[sighs]', yawn: '', whisper: '[whispers]' });
  });

  it('the skill’s Caller pronunciation is the lexicon’s', () => {
    expect(SKILL).toContain('the voice says "Call-uh"');
    expect(FALLBACK_MON_LINGO.pronunciations).toEqual([
      { key: 'pronunciation.caller', written: 'Caller', variants: ['Callah'], spoken: 'Call-uh', spokenPlural: 'Call-uhz' },
    ]);
  });
});
