import { z } from 'zod';
import { CallerProfileSchema } from './caller.ts';
import { CareStateSchema } from './care.ts';
import { EggRecordSchema } from './egg.ts';
import { HatchStateSchema } from './hatch.ts';
import { MonInstanceSchema } from './mon.ts';
import { EpochMsSchema, IdSchema } from './primitives.ts';
import { CareWriteSchema } from './server.ts';

/** Every save blob starts with this envelope so the migrator can read the version first. */
export const SaveEnvelopeSchema = z.object({ version: z.number().int().positive() });

export const WriteQueueSchema = z.object({
  deviceId: IdSchema,
  nextSeq: z.number().int().positive(),
  entries: z.array(CareWriteSchema),
});

/** Save blob v1: the single MMKV value (§1.2). */
export const SaveV1Schema = z.object({
  version: z.literal(1),
  savedAt: EpochMsSchema,
  caller: CallerProfileSchema.nullable(),
  eggs: z.array(EggRecordSchema),
  hatches: z.array(HatchStateSchema),
  mons: z.array(MonInstanceSchema),
  care: z.array(CareStateSchema),
  queue: WriteQueueSchema,
});

export const CURRENT_SAVE_VERSION = 1;
export const SaveCurrentSchema = SaveV1Schema;
