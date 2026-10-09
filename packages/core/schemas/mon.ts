import { z } from 'zod';
import { isStoredMonName, MON_NAME_MAX_LENGTH } from '../sim/mon-name.ts';
import { LifecycleStageSchema } from './lifecycle.ts';
import { EpochMsSchema, IdSchema, UnitIntervalSchema } from './primitives.ts';
import { ActiveHoursSchema, HabitatTagSchema, OriginBlockIdSchema } from './spatial.ts';

/**
 * A stored Mon nickname: the M09 rule (`validateMonName`) minus the reserved
 * and block lists, in trimmed NFC form, at most 16 UTF-16 code units.
 */
export const MonNameSchema = z
  .string()
  .min(1)
  .max(MON_NAME_MAX_LENGTH)
  .refine(isStoredMonName, { message: 'Mon name fails the M09 name rule' });

/** One individual Mon. Evolution keeps the same `monInstanceId` (Bible v11 §Lifecycle). */
export const MonInstanceSchema = z.object({
  monInstanceId: IdSchema,
  speciesId: IdSchema,
  /** Named at the naming ceremony (M09, after the hatch); null until then. */
  // Saves from the pre-M09 app allowed arbitrary 1–64 character nicknames.
  // Preserve those on migration and re-save; only *new* naming input is
  // constrained by MonNameSchema and validateMonName.
  nickname: z.union([MonNameSchema, z.string().min(1).max(64)]).nullable(),
  callerId: IdSchema,
  hatchedAt: EpochMsSchema,
  bond: UnitIntervalSchema,
  stage: LifecycleStageSchema,
  /** Reserved for VoiceStudio; one lineage per individual for life. Null in Phase 1. */
  voiceLineageId: IdSchema.nullable(),
  /** Phase 2: the block this Mon comes from. Null in Phase 1; a save without the key parses to null. */
  originBlock: OriginBlockIdSchema.nullable().default(null),
  /** Phase 2: habitats the Mon favours. Empty in Phase 1; a save without the key parses to []. */
  habitatTags: z.array(HabitatTagSchema).default([]),
  /** Phase 2: the Mon's active window. Null in Phase 1; a save without the key parses to null. */
  activeHours: ActiveHoursSchema.nullable().default(null),
});
