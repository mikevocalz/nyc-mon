import { deriveVoiceLineageId, LIFECYCLE_STAGES, MON_MOODS, type MonMood } from '@acme/core';
import { describe, expect, it } from 'vitest';
import { FALLBACK_MON_LINGO, MON_LINGO_SEED_ROWS, MON_VOICES_SEED, monLingoFromRows, parseMonLingo } from '../lingo/index.ts';
import { MON_LINE_OCCASIONS, monLine } from '../mon-lines.ts';
import { allSpecies, bloodlines } from '../mons/index.ts';
import { captionText } from '../captions.ts';
import { planMonUtterance, type MonVoiceRef } from '../mon-voice.ts';
import { stageDirectionsToTags, pronounceForVoice } from '../voices.ts';
import * as legacyCaptions from './legacy/captions.ts';
import * as legacyLines from './legacy/mon-lines.ts';
import * as legacyVoice from './legacy/mon-voice.ts';
import * as legacyVoices from './legacy/voices.ts';

/**
 * Moving the lines and lingo into Payload must not change a single plan. The
 * legacy/ folder is packages/content as it was on 2026-10-28, before the move
 * (hard-coded tables). Every plan the planner makes from the seed (and from
 * the seed after a JSON round trip, which is what a client receives from
 * `GET /v1/mon-lingo`) must serialize byte for byte like the legacy plan.
 */

export const PARITY_TEXTS: readonly string[] = [
  '',
  'Bet!',
  'Food?',
  'Again!',
  "Yeah Callah, I'm good.",
  'Say less, Callah.',
  'Hold up… Yo James!',
  'That hit. Again. Bet.',
  '*chuckle* Ayy, Callah!',
  '*laughs* Y’all again? Bet.',
  '*huff* *Squeaklet turns back to the Caller.* Only the Caller can share a meal.',
  '*yawn* *soft purr* Kittee Cee is asleep.',
  '*whisper* Shh.',
  '*murmurs softly* ok',
  '*yells* HOLD UP',
  '*clears its throat* Callers, listen.',
  '*clear throat* *ahem* *snickers* *giggling* *cackles* *sighs deeply*',
  'CALLER! CALLAH! callah, callers, Callahs, cALLer, CALLers.',
  'The Caller’s Mon. Recaller. Callery. Callahan.',
  '"Say less, Caller." That hit.”',
  '“Yeah Callah, I’m good.”',
  'Line one.\n\nLine two *beat* end',
  '*',
  '*not closed',
  `${'Callah, '.repeat(80)}done`,
];

function legacyRefs(): (MonVoiceRef | undefined)[] {
  const lineages = new Set<string>(['dex-001/female/1', 'dex-001/male/9', 'dex-008/female/1', 'not-a-lineage', '']);
  for (const pools of legacyVoices.voicePools) for (const pool of Object.values(pools.pools)) for (const voice of pool) lineages.add(voice.lineageId);
  for (const bloodline of bloodlines) for (let i = 0; i < 40; i++) lineages.add(deriveVoiceLineageId({ eggId: `egg-${i}`, speciesId: bloodline.chain.speciesId }));
  const refs: (MonVoiceRef | undefined)[] = [undefined];
  for (const lineageId of lineages) {
    for (const stage of LIFECYCLE_STAGES) {
      refs.push({ lineageId, stage });
      for (const mood of MON_MOODS) refs.push({ lineageId, stage, mood });
    }
  }
  return refs;
}

describe('lingo parity: seed tables vs the hard-coded tables they replaced', () => {
  const served = parseMonLingo(JSON.parse(JSON.stringify(FALLBACK_MON_LINGO)));

  it('the served JSON parses back', () => {
    expect(served).toBeDefined();
    expect(monLingoFromRows(MON_LINGO_SEED_ROWS, MON_VOICES_SEED)).toEqual(FALLBACK_MON_LINGO);
  });

  it('plans every text for every lineage, stage and mood byte-identically', () => {
    let compared = 0;
    for (const ref of legacyRefs()) {
      for (const text of PARITY_TEXTS) {
        const legacy = JSON.stringify(legacyVoice.planMonUtterance(text, ref));
        expect(JSON.stringify(planMonUtterance(text, ref)), `${ref?.lineageId}/${ref?.stage}/${ref?.mood} ${text}`).toBe(legacy);
        expect(JSON.stringify(planMonUtterance(text, ref, served))).toBe(legacy);
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(20_000);
  });

  it('captions, pronunciations and stage directions match', () => {
    for (const text of PARITY_TEXTS) {
      expect(captionText(text)).toBe(legacyCaptions.captionText(text));
      expect(captionText(text, served)).toBe(legacyCaptions.captionText(text));
      expect(pronounceForVoice(text, served)).toBe(legacyVoices.pronounceForVoice(text));
      expect(stageDirectionsToTags(text, served)).toBe(legacyVoices.stageDirectionsToTags(text));
    }
  });

  it('gives every form the same canon line on every occasion', () => {
    for (const species of allSpecies) {
      for (const stage of LIFECYCLE_STAGES) {
        for (const occasion of MON_LINE_OCCASIONS) {
          for (const mood of [undefined, ...MON_MOODS] as (MonMood | undefined)[]) {
            const mon = { speciesId: species.speciesId, stage, ...(mood ? { mood } : {}) };
            expect(monLine(occasion, mon, served)).toBe(legacyLines.monLine(occasion, mon));
          }
        }
      }
    }
  });
});
