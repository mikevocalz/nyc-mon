import { z } from 'zod';
import { CareActionSchema, CareStateSchema } from './care.ts';
import { IncubationMinutesSchema } from './egg.ts';
import { LifecycleStageSchema } from './lifecycle.ts';
import { MonInstanceSchema, MonNameSchema } from './mon.ts';
import { EpochMsSchema, IdSchema, UnitIntervalSchema } from './primitives.ts';
import { MonGenderSchema } from './seams.ts';

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
  /** Null from M10 (naming happens after the hatch, D-16f). */
  nickname: MonNameSchema.nullable(),
  incubationMinutes: IncubationMinutesSchema,
});
export const CreateEggResponseSchema = z.object({
  eggId: IdSchema,
  monInstanceId: IdSchema,
  incubationEndsAt: EpochMsSchema,
});

/** POST /v1/eggs/:id/hatch — idempotent, same MonInstance on every retry. */
export const HatchEggResponseSchema = z.object({ mon: MonInstanceSchema });

/** GET /v1/me/mons — the caller's Mons and their authoritative care states for restore. */
export const MonWithCareSchema = z.object({ mon: MonInstanceSchema, care: CareStateSchema });
export const ListMyMonsResponseSchema = z.object({
  mons: z.array(MonWithCareSchema),
  /**
   * The Mon the Caller chose as their companion (`users.activeMonInstanceId`),
   * or null when none is set. Absent from servers that predate the field.
   * It may name a Mon not in `mons` (a stale pointer); clients check.
   */
  activeMonInstanceId: IdSchema.nullable().optional(),
});

/** One queued care write. `seq` is monotonic per device. */
export const CareWriteSchema = z.object({
  deviceId: IdSchema,
  seq: z.number().int().positive(),
  monInstanceId: IdSchema,
  at: EpochMsSchema,
  action: CareActionSchema,
});

/**
 * PUT /v1/mons/:id/care. The body is the queued writes themselves: each one
 * names an action, and the server replays it through the same sim the client
 * ran (`applyCareWrites`). A write never carries meter values or deltas, so a
 * client cannot set its own meters.
 */
export const PutCareRequestSchema = z.object({ writes: z.array(CareWriteSchema) });
export const PutCareResponseSchema = z.object({
  mon: MonInstanceSchema,
  care: CareStateSchema,
  /** Highest seq the server has applied for the requesting device. */
  ackedSeq: z.number().int().nonnegative(),
  /**
   * How many writes in this request the server applied. The rest it set
   * aside: their `seq` was already at or below the device's last applied seq.
   * Absent from servers that predate the field.
   */
  applied: z.number().int().nonnegative().optional(),
});

/**
 * POST /v1/mons/adopt: puts a Mon that exists only on this device onto the
 * server (its egg was never sent, or the server lost it). The server checks
 * every field against content and the egg-derived ids, so the client chooses
 * no ids. `care` is the device's state after its queued writes through
 * `appliedThroughSeq`; the server records that seq for `deviceId`, so those
 * writes are not applied a second time.
 */
export const AdoptMonRequestSchema = z.object({
  egg: z.object({
    eggId: IdSchema,
    speciesId: IdSchema,
    hatchesIntoSpeciesId: IdSchema,
    incubationMinutes: IncubationMinutesSchema,
    createdAt: EpochMsSchema,
  }),
  mon: z.object({
    monInstanceId: IdSchema,
    speciesId: IdSchema,
    stage: LifecycleStageSchema,
    bond: UnitIntervalSchema,
    nickname: MonNameSchema.nullable(),
    gender: MonGenderSchema.nullable(),
    voiceLineageId: IdSchema.nullable(),
  }),
  care: CareStateSchema,
  deviceId: IdSchema,
  appliedThroughSeq: z.number().int().nonnegative(),
});
export const AdoptMonResponseSchema = z.object({
  mon: MonInstanceSchema,
  care: CareStateSchema,
  /** Highest seq the server holds for the requesting device on this Mon. */
  ackedSeq: z.number().int().nonnegative(),
  /** False when the server already had this Mon; it is returned unchanged. */
  adopted: z.boolean(),
});
