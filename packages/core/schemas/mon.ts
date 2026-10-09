import { z } from 'zod';
import { LifecycleStageSchema } from './lifecycle.ts';
import { EpochMsSchema, IdSchema, UnitIntervalSchema } from './primitives.ts';
import { ActiveHoursSchema, HabitatTagSchema, OriginBlockIdSchema } from './spatial.ts';

/** One individual Mon. Evolution keeps the same `monInstanceId` (Bible v11 §Lifecycle). */
export const MonInstanceSchema = z.object({
  monInstanceId: IdSchema,
  speciesId: IdSchema,
  /** Named at the naming ceremony; null until then. */
  nickname: z.string().min(1).max(64).nullable(),
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
