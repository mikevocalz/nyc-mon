import { z } from 'zod';
import { IdSchema, UnitIntervalSchema } from './primitives.ts';

/**
 * One authored idle vignette a species (or an individual) can perform.
 * Weight at runtime is `baseWeight + bondWeight * bond`, gated by `minBond`.
 */
export const IdleVignetteDefSchema = z.object({
  vignetteId: IdSchema,
  baseWeight: z.number().nonnegative(),
  bondWeight: z.number().nonnegative(),
  minBond: UnitIntervalSchema,
  activity: z.enum(['awake', 'asleep', 'any']),
});

/**
 * Content schema for a species line (e.g. the line the Bible calls Hood Ratti).
 * No species data lives in core; `content/` supplies records that parse through this.
 */
export const MonSpeciesDefSchema = z.object({
  speciesId: IdSchema,
  /** TODO(canon): stable Dex id from the v8 Dex + v11 overrides; null until transcribed. */
  dexId: z.number().int().positive().nullable(),
  lineLabel: z.string().min(1),
  /** Food classes this anatomy can eat. Ids resolve against `content/food`. */
  foodClassIds: z.array(IdSchema).min(1),
  /** Size against the 1 m ground disc (§3.2 relative-scale rule). */
  scaleMeters: z.number().positive(),
  rigDefinitionId: IdSchema,
  idleVignettes: z.array(IdleVignetteDefSchema),
  /** TODO(canon): eight-Affinity names are not yet authored in v11. */
  affinityId: IdSchema.nullable(),
  /** TODO(canon): combat Class is a v11 concept without a published list. */
  classId: IdSchema.nullable(),
});
