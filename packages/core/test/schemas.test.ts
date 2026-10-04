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

  it('species content needs at least one food class and allows TODO(canon) nulls', () => {
    const species = {
      speciesId: 'species-test',
      dexId: null,
      lineLabel: 'Test line',
      foodClassIds: ['food-test'],
      scaleMeters: 0.3,
      rigDefinitionId: 'rig-test',
      idleVignettes: [],
      affinityId: null,
      classId: null,
    };
    expect(MonSpeciesDefSchema.safeParse(species).success).toBe(true);
    expect(MonSpeciesDefSchema.safeParse({ ...species, foodClassIds: [] }).success).toBe(false);
  });
});
