import { z } from 'zod';
import { isStoredMonName, LEGACY_MON_NAME_MAX_LENGTH, MON_NAME_MAX_LENGTH } from '../sim/mon-name.ts';
import { LifecycleStageSchema } from './lifecycle.ts';
import { MonGenderSchema } from './seams.ts';
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

/**
 * The nickname on a stored Mon record: an M09 name, or a name a pre-M09 save
 * already held (1 to 64 characters, any content). Read-side only. A new name
 * goes through `validateMonName`, and a write that changes a stored nickname is
 * checked with `isAllowedMonNicknameWrite`, both capped at 16.
 */
export const StoredMonNicknameSchema = z.union([MonNameSchema, z.string().min(1).max(LEGACY_MON_NAME_MAX_LENGTH)]);

/** One individual Mon. Evolution keeps the same `monInstanceId` (Bible v11 §Lifecycle). */
export const MonInstanceSchema = z.object({
  monInstanceId: IdSchema,
  speciesId: IdSchema,
  /** Named at the naming ceremony (M09, after the hatch); null until then. */
  // Saves from the pre-M09 app allowed arbitrary 1–64 character nicknames.
  // Preserve those on migration and re-save; only *new* naming input is
  // constrained by MonNameSchema and validateMonName.
  nickname: StoredMonNicknameSchema.nullable(),
  callerId: IdSchema,
  hatchedAt: EpochMsSchema,
  bond: UnitIntervalSchema,
  stage: LifecycleStageSchema,
  /** Assigned at hatch from the egg id (Bible v11 ¶54). Null for a Mon hatched before genders; a save without the key parses to null. */
  gender: MonGenderSchema.nullable().default(null),
  /**
   * One voice for life (Bible v11 ¶56): set at hatch and never changed, so the
   * voice matures with the Mon instead of switching actors at each evolution.
   * Null for a Mon hatched before lineages were assigned.
   */
  voiceLineageId: IdSchema.nullable(),
  /** Phase 2: the block this Mon comes from. Null in Phase 1; a save without the key parses to null. */
  originBlock: OriginBlockIdSchema.nullable().default(null),
  /** Phase 2: habitats the Mon favours. Empty in Phase 1; a save without the key parses to []. */
  habitatTags: z.array(HabitatTagSchema).default([]),
  /** Phase 2: the Mon's active window. Null in Phase 1; a save without the key parses to null. */
  activeHours: ActiveHoursSchema.nullable().default(null),
});
