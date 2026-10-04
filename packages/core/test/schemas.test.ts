import { describe, expect, it } from 'vitest';
import {
  CareActionSchema,
  CareStateSchema,
  CreateEggRequestSchema,
  HatchEggResponseSchema,
  LifecycleStageSchema,
  MonSpeciesDefSchema,
  PutCareResponseSchema,
  UnitIntervalSchema,
} from '../schemas/index.ts';
import { createInitialCareState } from '../sim/care.ts';
import { makeMon, T0 } from './harness.ts';

describe('boundary schemas (Law 5)', () => {
  it('covers all five lifecycle stages and nothing else', () => {
    expect(LifecycleStageSchema.options).toEqual(['Egg', 'Baby', 'Small', 'Mid', 'Max']);
    expect(LifecycleStageSchema.safeParse('Adult').success).toBe(false);
  });

  it('rejects out-of-range, NaN and infinite meter values', () => {
    for (const bad of [-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(UnitIntervalSchema.safeParse(bad).success).toBe(false);
    }
    expect(CareStateSchema.safeParse({ ...createInitialCareState('m', T0), energy: 2 }).success).toBe(false);
  });

  it('accepts only 15, 30 or 60 minute incubation', () => {
    const base = { eggId: 'e', speciesId: 's', nickname: null };
    expect(CreateEggRequestSchema.safeParse({ ...base, incubationMinutes: 30 }).success).toBe(true);
    expect(CreateEggRequestSchema.safeParse({ ...base, incubationMinutes: 45 }).success).toBe(false);
  });

  it('parses server payloads and rejects malformed ones', () => {
    expect(HatchEggResponseSchema.parse({ mon: makeMon() }).mon.stage).toBe('Baby');
    expect(HatchEggResponseSchema.safeParse({ mon: { ...makeMon(), stage: 'Teen' } }).success).toBe(false);
    expect(
      PutCareResponseSchema.safeParse({ mon: makeMon(), care: createInitialCareState('m', T0), ackedSeq: -1 }).success,
    ).toBe(false);
    expect(CareActionSchema.safeParse({ kind: 'heal' }).success).toBe(false);
  });

  describe('MonSpeciesDef', () => {
    const species = {
      speciesId: 'species-test',
      dexId: 999,
      bloodlineId: 'F99',
      bloodlineName: 'Test',
      formName: 'Test form',
      stage: 'Baby',
      foodClassIds: ['food-test'],
      scaleMeters: 0.3,
      rigDefinitionId: 'rig-test',
      cultureNote: 'Test note',
      idleVignettes: [],
      affinityId: null,
      classId: null,
    };

    it('parses a fully authored record', () => {
      expect(MonSpeciesDefSchema.safeParse(species).success).toBe(true);
    });

    it('accepts null for every TODO(canon) field', () => {
      const unknown = {
        ...species,
        dexId: null,
        formName: null,
        foodClassIds: null,
        scaleMeters: null,
        rigDefinitionId: null,
        cultureNote: null,
      };
      expect(MonSpeciesDefSchema.safeParse(unknown).success).toBe(true);
    });

    it('rejects an empty food list: unknown is null, never []', () => {
      expect(MonSpeciesDefSchema.safeParse({ ...species, foodClassIds: [] }).success).toBe(false);
    });

    it('rejects a zero scale, an empty culture note and a non-roster bloodline id', () => {
      expect(MonSpeciesDefSchema.safeParse({ ...species, scaleMeters: 0 }).success).toBe(false);
      expect(MonSpeciesDefSchema.safeParse({ ...species, cultureNote: '' }).success).toBe(false);
      for (const bad of ['F1', 'f01', 'F001', 'Hood Ratti']) {
        expect(MonSpeciesDefSchema.safeParse({ ...species, bloodlineId: bad }).success).toBe(false);
      }
    });

    it('requires a lifecycle stage from the five canon stages', () => {
      expect(MonSpeciesDefSchema.safeParse({ ...species, stage: 'Apex' }).success).toBe(false);
    });
  });
});
