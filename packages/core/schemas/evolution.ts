import { z } from 'zod';
import { LifecycleStageSchema } from './lifecycle.ts';
import { IdSchema } from './primitives.ts';

/** Weight bands the classic care layer reports (`careHistoryOf`). */
export const WEIGHT_BANDS = ['under', 'normal', 'over'] as const;
export const WeightBandSchema = z.enum(WEIGHT_BANDS);

export const EvolutionCareConditionsSchema = z.object({
  /** Care mistakes in the current stage at most this many. */
  maxMistakes: z.number().int().nonnegative().optional(),
  /** Care mistakes in the current stage at least this many. */
  minMistakes: z.number().int().nonnegative().optional(),
  /** Discipline quarters (0..4) at least this many. */
  minDiscipline: z.number().int().min(0).max(4).optional(),
  /** The weight band must be one of these. */
  weightBands: z.array(WeightBandSchema).min(1).optional(),
  /** Lower wins among matching branches; ties go to authored order. */
  priority: z.number().int().optional(),
});

/**
 * An authored evolution (Law 7). The schema exists for the full game; Phase 1
 * ships no events and the apply path is feature-flagged off.
 */
export const EvolutionEventSchema = z.object({
  eventId: IdSchema,
  speciesId: IdSchema,
  fromStage: LifecycleStageSchema,
  toStage: LifecycleStageSchema,
  /** Branching evolution may change the species line. Null keeps the line. */
  toSpeciesId: IdSchema.nullable(),
  /** TODO(canon): conditions (bond, personality) are named in v11 but not specified. */
  minBond: z.number().min(0).max(1),
  /**
   * Care-history conditions for branching (v12 `GAMEPLAY_BIBLE_V12.md:64`,
   * Decision 12). Every condition present must hold. An event with no
   * conditions is the authored default branch. Absent in older content, which
   * parses to `{}`.
   */
  care: EvolutionCareConditionsSchema.default({}),
});
