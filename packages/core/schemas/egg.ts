import { z } from 'zod';
import { EpochMsSchema, IdSchema } from './primitives.ts';

/** Bible v11: 15-minute, 30-minute or 1-hour incubation. */
export const INCUBATION_MINUTES = [15, 30, 60] as const;

export const IncubationMinutesSchema = z.union([z.literal(15), z.literal(30), z.literal(60)]);

/**
 * One egg in the capture case. `monInstanceId` is reserved at creation and is
 * always `deriveMonInstanceId(eggId)`, so offline and server mints agree.
 */
export const EggRecordSchema = z.object({
  eggId: IdSchema,
  monInstanceId: IdSchema,
  speciesId: IdSchema,
  callerId: IdSchema,
  nickname: z.string().min(1).max(64).nullable(),
  incubationMinutes: IncubationMinutesSchema,
  createdAt: EpochMsSchema,
  incubationEndsAt: EpochMsSchema,
});
