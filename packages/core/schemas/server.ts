import { z } from 'zod';
import { CareActionSchema, CareStateSchema } from './care.ts';
import { IncubationMinutesSchema } from './egg.ts';
import { MonInstanceSchema } from './mon.ts';
import { EpochMsSchema, IdSchema } from './primitives.ts';

/** §1.4 server contract, version 1. Every payload is zod-parsed on both sides. */
export const SERVER_CONTRACT_VERSION = 'v1';

/** POST /v1/eggs */
export const CreateEggRequestSchema = z.object({
  /** Client-generated id so an offline egg keeps its id after reconnect. */
  eggId: IdSchema,
  /** The Egg form's Dex record. */
  speciesId: IdSchema,
  /** The Baby form it hatches into. The server checks this pair against content. */
  hatchesIntoSpeciesId: IdSchema,
  nickname: z.string().min(1).max(64).nullable(),
  incubationMinutes: IncubationMinutesSchema,
});
export const CreateEggResponseSchema = z.object({
  eggId: IdSchema,
  monInstanceId: IdSchema,
  incubationEndsAt: EpochMsSchema,
});

/** POST /v1/eggs/:id/hatch — idempotent, same MonInstance on every retry. */
export const HatchEggResponseSchema = z.object({ mon: MonInstanceSchema });

/** GET /v1/me/mons */
export const ListMyMonsResponseSchema = z.object({ mons: z.array(MonInstanceSchema) });

/** One queued care write. `seq` is monotonic per device. */
export const CareWriteSchema = z.object({
  deviceId: IdSchema,
  seq: z.number().int().positive(),
  monInstanceId: IdSchema,
  at: EpochMsSchema,
  action: CareActionSchema,
});

/** PUT /v1/mons/:id/care */
export const PutCareRequestSchema = z.object({ writes: z.array(CareWriteSchema) });
export const PutCareResponseSchema = z.object({
  mon: MonInstanceSchema,
  care: CareStateSchema,
  /** Highest seq the server has applied for the requesting device. */
  ackedSeq: z.number().int().nonnegative(),
});
