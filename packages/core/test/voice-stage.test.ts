import { describe, expect, it } from 'vitest';
import { createEggRecord, mintMonInstance } from '../sim/hatch.ts';
import { applyEvolution } from '../sim/evolution.ts';
import { BABY_TALK_MS, babyTalkEndsAt, capVoiceStage, voiceStage } from '../sim/voice-stage.ts';
import { HOUR, T0 } from './harness.ts';

const HATCHED = T0 + 30 * 60_000;
const baby = { stage: 'Baby' as const, hatchedAt: HATCHED };

describe('voiceStage (Decision 32: egg and first day babble)', () => {
  it('an Egg babbles, whatever the clock says', () => {
    expect(voiceStage({ stage: 'Egg' }, T0)).toBe('baby-talk');
    expect(voiceStage({ stage: 'Egg', hatchedAt: null }, Number.NaN)).toBe('baby-talk');
  });

  it('a Baby babbles for its first 24 hours, then speaks limited', () => {
    expect(voiceStage(baby, HATCHED)).toBe('baby-talk');
    expect(voiceStage(baby, HATCHED + 23 * HOUR)).toBe('baby-talk');
    expect(voiceStage(baby, HATCHED + BABY_TALK_MS - 1)).toBe('baby-talk');
    expect(voiceStage(baby, HATCHED + BABY_TALK_MS)).toBe('limited');
    expect(voiceStage(baby, HATCHED + 30 * 24 * HOUR)).toBe('limited');
  });

  it('a device clock set back before the hatch still babbles (never jumps ahead)', () => {
    expect(voiceStage(baby, HATCHED - 5 * 24 * HOUR)).toBe('baby-talk');
  });

  it('a device clock moved forward ends babble early only on that device; the answer follows the clock it is given', () => {
    const deviceAhead = HATCHED + 2 * HOUR + 2 * 24 * HOUR;
    expect(voiceStage(baby, deviceAhead)).toBe('limited');
    expect(voiceStage(baby, HATCHED + 2 * HOUR)).toBe('baby-talk');
  });

  it('a Baby with no hatch time, or an unusable clock, speaks limited (never stuck babbling)', () => {
    expect(voiceStage({ stage: 'Baby' }, HATCHED)).toBe('limited');
    expect(voiceStage({ stage: 'Baby', hatchedAt: null }, HATCHED)).toBe('limited');
    expect(voiceStage({ stage: 'Baby', hatchedAt: Number.NaN }, HATCHED)).toBe('limited');
    expect(voiceStage(baby, Number.NaN)).toBe('limited');
    expect(voiceStage(baby, Number.POSITIVE_INFINITY)).toBe('limited');
  });

  it('later forms speak in full', () => {
    for (const stage of ['Small', 'Mid', 'Max'] as const) {
      expect(voiceStage({ stage, hatchedAt: HATCHED }, HATCHED)).toBe('full');
      expect(voiceStage({ stage }, HATCHED)).toBe('full');
    }
  });

  it('reads the hatch time the sim stores: mintMonInstance sets hatchedAt to the incubation end', () => {
    const egg = createEggRecord({
      eggId: 'egg-voice-stage',
      speciesId: 'dex-001',
      hatchesIntoSpeciesId: 'dex-002',
      callerId: 'caller-1',
      nickname: null,
      incubationMinutes: 30,
      createdAt: T0,
    });
    const mon = mintMonInstance(egg);
    expect(voiceStage(mon, egg.incubationEndsAt)).toBe('baby-talk');
    expect(voiceStage(mon, egg.incubationEndsAt + BABY_TALK_MS)).toBe('limited');
  });

  it('evolution keeps the voice lineage and moves to full speech', () => {
    const egg = createEggRecord({
      eggId: 'egg-voice-evolve',
      speciesId: 'dex-001',
      hatchesIntoSpeciesId: 'dex-002',
      callerId: 'caller-1',
      nickname: null,
      incubationMinutes: 30,
      createdAt: T0,
    });
    const mon = { ...mintMonInstance(egg), bond: 1 };
    const result = applyEvolution(
      mon,
      { eventId: 'evo', speciesId: mon.speciesId, fromStage: 'Baby', toStage: 'Small', toSpeciesId: 'dex-003', minBond: 0 } as never,
      { evolutionEnabled: true },
    );
    if (result.kind !== 'evolved') throw new Error(result.reason);
    const evolved = result.mon;
    expect(evolved.voiceLineageId).toBe(mon.voiceLineageId);
    expect(voiceStage(evolved, egg.incubationEndsAt)).toBe('full');
  });
});

describe('babyTalkEndsAt', () => {
  it('is the hatch time plus 24 hours for a Baby, null otherwise', () => {
    expect(babyTalkEndsAt(baby)).toBe(HATCHED + BABY_TALK_MS);
    expect(babyTalkEndsAt({ stage: 'Baby' })).toBeNull();
    expect(babyTalkEndsAt({ stage: 'Egg' })).toBeNull();
    expect(babyTalkEndsAt({ stage: 'Small', hatchedAt: HATCHED })).toBeNull();
  });
});

describe('capVoiceStage', () => {
  it('never grants more speech than the lifecycle stage allows', () => {
    expect(capVoiceStage('Egg', 'full')).toBe('baby-talk');
    expect(capVoiceStage('Baby', 'full')).toBe('limited');
    expect(capVoiceStage('Baby', 'baby-talk')).toBe('baby-talk');
    expect(capVoiceStage('Baby')).toBe('limited');
    expect(capVoiceStage('Small')).toBe('full');
    expect(capVoiceStage('Max', 'limited')).toBe('limited');
  });
});
