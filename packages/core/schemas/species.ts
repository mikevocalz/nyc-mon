import { z } from 'zod';
import { LifecycleStageSchema } from './lifecycle.ts';
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
 * A Dex family, called a Bloodline in UI and data (docs/canon/DECISIONS.md #11).
 * The id is the roster's family number: `F01`, `F02`, … `F19`.
 */
export const BloodlineIdSchema = z.string().regex(/^F\d{2}$/);

/**
 * Content schema for one Dex record: a single form of a Bloodline at one
 * lifecycle stage (e.g. #002 Squeaklet, Baby, Hood Ratti Bloodline). No species
 * data lives in core; `@acme/content` supplies records that parse through this.
 *
 * Every nullable field means TODO(canon): the source has not settled it yet.
 * Null is never a default to render; consumers must handle it explicitly.
 */
export const MonSpeciesDefSchema = z.object({
  speciesId: IdSchema,
  /**
   * Dex number from roster v11.1 (DECISIONS.md #9). Null only for a creature
   * the roster has not promoted to a permanent Dex ID.
   */
  dexId: z.number().int().positive().nullable(),
  bloodlineId: BloodlineIdSchema,
  /** The roster's family name, verbatim. UI renders `${bloodlineName} Bloodline`. */
  bloodlineName: z.string().min(1),
  /** Registered form name. Null where the roster marks the name [OPEN] (e.g. #110). */
  formName: z.string().min(1).nullable(),
  stage: LifecycleStageSchema,
  /** TODO(canon) when null. Food classes this anatomy can eat; ids resolve against `content/food`. */
  foodClassIds: z.array(IdSchema).min(1).nullable(),
  /** TODO(canon) when null. Size against the 1 m ground disc (§3.2 relative-scale rule). */
  scaleMeters: z.number().positive().nullable(),
  /** TODO(canon) when null. No rig is authored before body data is canon. */
  rigDefinitionId: IdSchema.nullable(),
  /** TODO(canon) when null. Species-card culture note; culture belongs to the individual (V11 ¶44). */
  cultureNote: z.string().min(1).nullable(),
  idleVignettes: z.array(IdleVignetteDefSchema),
  /** TODO(canon): eight-Affinity names are not yet authored in v11. */
  affinityId: IdSchema.nullable(),
  /** TODO(canon): combat Class is a v11 concept without a published list. */
  classId: IdSchema.nullable(),
});
