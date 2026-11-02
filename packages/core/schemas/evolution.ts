import { z } from 'zod';
import { LifecycleStageSchema } from './lifecycle.ts';
import { IdSchema } from './primitives.ts';

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
});
