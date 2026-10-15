import { z } from 'zod';
import { CallerProfileSchema } from './caller.ts';
import { CareStateSchema } from './care.ts';
import { EggRecordSchema } from './egg.ts';
import { HatchStateSchema } from './hatch.ts';
import { JournalEntrySchema } from './journal.ts';
import { MonInstanceSchema } from './mon.ts';
import { EpochMsSchema, IdSchema, UnitIntervalSchema } from './primitives.ts';
import { CareWriteSchema, CreateEggRequestSchema } from './server.ts';

/** Every save blob starts with this envelope so the migrator can read the version first. */
export const SaveEnvelopeSchema = z.object({ version: z.number().int().positive() });

/**
 * v1's care action: `feed` carried `foodClassId` and `nutrition` at the top
 * level. v2 nests them in an optional `food` (D-15e). Frozen; read only by
 * {@linkcode SaveV1Schema}.
 */
const CareActionV1Schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('feed'), foodClassId: IdSchema, nutrition: UnitIntervalSchema }),
  z.object({ kind: z.literal('rest') }),
  z.object({ kind: z.literal('wake') }),
  z.object({ kind: z.literal('play'), quality: UnitIntervalSchema }),
]);

const CareWriteV1Schema = CareWriteSchema.extend({ action: CareActionV1Schema });

/** v1's write queue: care writes only. Frozen. */
export const WriteQueueV1Schema = z.object({
  deviceId: IdSchema,
  nextSeq: z.number().int().positive(),
  entries: z.array(CareWriteV1Schema),
});

/**
 * An egg creation waiting for `POST /v1/eggs` (M10 B4). Kept apart from the
 * care `entries` so the care endpoint's `ackedSeq` can never drop it. The
 * request is replayed unchanged, same `eggId`, until the server answers;
 * the endpoint is idempotent by `eggId`.
 */
export const QueuedEggCreateSchema = z.object({
  queuedAt: EpochMsSchema,
  request: CreateEggRequestSchema,
});

/** The offline write queue (§1.4): care writes by `seq`, egg creations by `eggId`. */
export const WriteQueueSchema = z.object({
  deviceId: IdSchema,
  nextSeq: z.number().int().positive(),
  entries: z.array(CareWriteSchema),
  eggCreates: z.array(QueuedEggCreateSchema),
});

/** Save blob v1: the single MMKV value (§1.2). Frozen; v1 blobs migrate to v2 on load. */
export const SaveV1Schema = z.object({
  version: z.literal(1),
  savedAt: EpochMsSchema,
  caller: CallerProfileSchema.nullable(),
  eggs: z.array(EggRecordSchema),
  hatches: z.array(HatchStateSchema),
  mons: z.array(MonInstanceSchema),
  care: z.array(CareStateSchema),
  queue: WriteQueueV1Schema,
});

/**
 * Save blob v2: v1 plus the journal (M18) and queued egg creations (M10).
 * Feed writes nest their food (D-15e).
 */
export const SaveV2Schema = z.object({
  version: z.literal(2),
  savedAt: EpochMsSchema,
  caller: CallerProfileSchema.nullable(),
  eggs: z.array(EggRecordSchema),
  hatches: z.array(HatchStateSchema),
  mons: z.array(MonInstanceSchema),
  care: z.array(CareStateSchema),
  queue: WriteQueueSchema,
  /** Every Mon's journal entries, in append order. Never edited or removed. */
  journal: z.array(JournalEntrySchema),
});

export const CURRENT_SAVE_VERSION = 2;
export const SaveCurrentSchema = SaveV2Schema;
