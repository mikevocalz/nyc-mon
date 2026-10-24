import { deriveVoiceLineageId, LIFECYCLE_STAGES, MON_GENDERS, MON_MOODS, parseVoiceLineageId, VOICE_SLOTS_PER_GENDER } from '@acme/core';
import { describe, expect, it } from 'vitest';
import { bloodlines, hoodRattiBloodline } from '../index.ts';
import { resolveVoice, stageDirectionsToTags, voiceDelivery, voicePitchFactor, voicePools, webSpeechPitch } from '../voices.ts';

const RATTI_KEY = hoodRattiBloodline.chain.speciesId;

describe('voice registry', () => {
  it('has one pool entry per bloodline, keyed by the Egg form', () => {
    expect(voicePools.map((p) => p.bloodlineId)).toEqual(bloodlines.map((b) => b.bloodlineId));
    expect(voicePools.map((p) => p.lineKey)).toEqual(bloodlines.map((b) => b.chain.speciesId));
  });

  it('fills both Hood Ratti pools to the slot count, with distinct ElevenLabs voices', () => {
    const ratti = voicePools.find((p) => p.lineKey === RATTI_KEY);
    for (const gender of MON_GENDERS) {
      expect(ratti?.pools[gender]).toHaveLength(VOICE_SLOTS_PER_GENDER);
    }
    const ids = MON_GENDERS.flatMap((g) => ratti?.pools[g].map((v) => v.elevenLabsVoiceId) ?? []);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every entry the lineage id of its own slot', () => {
    for (const line of voicePools) {
      for (const gender of MON_GENDERS) {
        line.pools[gender].forEach((voice, i) => {
          expect(voice.lineageId).toBe(`${line.lineKey}/${gender}/${i + 1}`);
          expect(parseVoiceLineageId(voice.lineageId)).toBeDefined();
        });
      }
    }
  });

  it('resolves every lineage a Hood Ratti egg can mint to a voice of the same gender', () => {
    for (let i = 0; i < 200; i++) {
      const lineage = deriveVoiceLineageId({ eggId: `egg-${i}`, speciesId: RATTI_KEY });
      const voice = resolveVoice(lineage);
      expect(voice?.lineageId).toBe(lineage);
      const gender = parseVoiceLineageId(lineage)?.gender;
      const pool = voicePools.find((p) => p.lineKey === RATTI_KEY)?.pools[gender ?? 'female'];
      expect(pool).toContain(voice);
    }
  });

  it('resolves to null for a line without voices, an unknown line, or a malformed id', () => {
    const bodega = bloodlines[1]?.chain.speciesId ?? '';
    expect(resolveVoice(`${bodega}/female/1`)).toBeNull();
    expect(resolveVoice('dex-999/male/1')).toBeNull();
    expect(resolveVoice('not-a-lineage')).toBeNull();
  });

  it('keeps the Egg silent and lowers the voice as the Mon grows', () => {
    expect(voicePitchFactor('Egg')).toBeNull();
    const rates = LIFECYCLE_STAGES.filter((s) => s !== 'Egg').map(voicePitchFactor);
    expect(rates).toEqual([1.3, 1.15, 1, 0.92]);
    for (const stage of LIFECYCLE_STAGES) {
      const pitch = webSpeechPitch(stage);
      if (stage === 'Egg') expect(pitch).toBeNull();
      else expect(pitch).toBeGreaterThanOrEqual(0);
      if (pitch !== null) expect(pitch).toBeLessThanOrEqual(2);
    }
  });

  it('gives every mood a documented audio tag and in-range settings, steadier when tired', () => {
    for (const mood of MON_MOODS) {
      const { tag, settings } = voiceDelivery(mood);
      expect(tag).toMatch(/^\[[a-z ]+\]$/);
      expect(settings.stability).toBeGreaterThanOrEqual(0);
      expect(settings.stability).toBeLessThanOrEqual(1);
      expect(settings.similarity_boost).toBe(0.8);
    }
    expect(voiceDelivery('content').settings.stability).toBeLessThan(voiceDelivery('asleep').settings.stability);
    expect(voiceDelivery('asleep').tag).toBe('[whispers]');
    expect(voiceDelivery(undefined).tag).toBeUndefined();
  });

  it('maps known stage directions to audio tags and drops the rest', () => {
    expect(stageDirectionsToTags('Hey *short huff* you')).toBe('Hey [sighs] you');
    expect(stageDirectionsToTags('*chuckles* hi')).toBe('[laughs] hi');
    expect(stageDirectionsToTags('*whispers* secret')).toBe('[whispers] secret');
    expect(stageDirectionsToTags('Hi *scritchy chirp* there')).toBe('Hi there');
    expect(stageDirectionsToTags('stray * star')).toBe('stray star');
    expect(stageDirectionsToTags('no directions')).toBe('no directions');
  });
});
