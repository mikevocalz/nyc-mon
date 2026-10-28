import { describe, expect, it } from 'vitest';
import { MonInstanceSchema } from '../schemas/index.ts';
import { createEggRecord, mintMonInstance } from '../sim/hatch.ts';
import {
  deriveMonGender,
  deriveVoiceLineageId,
  parseVoiceLineageId,
  VOICE_SLOTS_PER_GENDER,
} from '../sim/voice.ts';
import { T0 } from './harness.ts';

const eggFor = (eggId: string, speciesId = 'dex-001') =>
  createEggRecord({
    eggId,
    speciesId,
    hatchesIntoSpeciesId: 'dex-002',
    callerId: 'caller-1',
    nickname: null,
    incubationMinutes: 30,
    createdAt: T0,
  });

const SAMPLE = Array.from({ length: 400 }, (_, i) => `egg-${i}`);

describe('per-individual gender and voice lineage', () => {
  it('derives the same gender and lineage from the same egg id, every time', () => {
    for (const id of SAMPLE.slice(0, 50)) {
      expect(deriveMonGender(id)).toBe(deriveMonGender(id));
      expect(deriveVoiceLineageId(eggFor(id))).toBe(deriveVoiceLineageId(eggFor(id)));
    }
  });

  it('reaches both genders and every voice slot over a sample of eggs', () => {
    const genders = new Set(SAMPLE.map(deriveMonGender));
    expect(genders).toEqual(new Set(['female', 'male']));
    const slots = new Set(SAMPLE.map((id) => parseVoiceLineageId(deriveVoiceLineageId(eggFor(id)))?.slot));
    expect(slots).toEqual(new Set(Array.from({ length: VOICE_SLOTS_PER_GENDER }, (_, i) => i + 1)));
  });

  it('splits genders roughly evenly, so neither is a rare roll', () => {
    const female = SAMPLE.filter((id) => deriveMonGender(id) === 'female').length;
    expect(female / SAMPLE.length).toBeGreaterThan(0.4);
    expect(female / SAMPLE.length).toBeLessThan(0.6);
  });

  it('keeps gender and voice slot independent of each other', () => {
    for (const gender of ['female', 'male'] as const) {
      const slots = new Set(
        SAMPLE.filter((id) => deriveMonGender(id) === gender).map(
          (id) => parseVoiceLineageId(deriveVoiceLineageId(eggFor(id)))?.slot,
        ),
      );
      expect(slots.size).toBe(VOICE_SLOTS_PER_GENDER);
    }
  });

  it('names the line by the egg form, so the lineage id says which pool to read', () => {
    const lineage = deriveVoiceLineageId(eggFor('egg-7'));
    const parsed = parseVoiceLineageId(lineage);
    expect(parsed).toEqual({ lineKey: 'dex-001', gender: deriveMonGender('egg-7'), slot: expect.any(Number) });
    expect(lineage).toBe(`dex-001/${parsed?.gender}/${parsed?.slot}`);
  });

  it('rejects strings that are not lineage ids', () => {
    for (const bad of ['', 'dex-001', 'dex-001/female', 'dex-001/other/1', 'dex-001/male/0', 'dex-001/male/x', '/male/1']) {
      expect(parseVoiceLineageId(bad)).toBeUndefined();
    }
  });

  it('mints the gender and lineage into the Mon, and the mint stays a pure function of the egg', () => {
    const egg = eggFor('egg-42');
    const mon = mintMonInstance(egg);
    expect(MonInstanceSchema.parse(mon)).toEqual(mon);
    expect(mon.gender).toBe(deriveMonGender('egg-42'));
    expect(mon.voiceLineageId).toBe(deriveVoiceLineageId(egg));
    expect(mintMonInstance(egg)).toEqual(mon);
  });

  it('keeps the lineage across evolution: it never reads the stage or species of the Mon', () => {
    const egg = eggFor('egg-9');
    const mon = mintMonInstance(egg);
    const evolved = MonInstanceSchema.parse({ ...mon, speciesId: 'dex-004', stage: 'Mid' });
    expect(evolved.voiceLineageId).toBe(mon.voiceLineageId);
    expect(evolved.gender).toBe(mon.gender);
  });

  it('parses a save from before gender existed as gender null', () => {
    const { gender: _gender, ...legacy } = mintMonInstance(eggFor('egg-3'));
    expect(MonInstanceSchema.parse({ ...legacy, voiceLineageId: null }).gender).toBeNull();
  });
});
