import type { CollectionAfterChangeHook, CollectionBeforeChangeHook, CollectionConfig } from 'payload';
import { nobody, type StaffRole, staffRoles } from './access/roles.ts';
import { auditReveal, revealOnly } from './audit/reveal.ts';
import { writeAuditEvent } from './audit/writeAuditEvent.ts';
import { deriveMonInstanceId, EggRecordSchema } from './core.ts';
import { RecordError } from './errors.ts';
import { asRecord, assertUnchanged, mergeWrite, parseRecord, refuseDelete } from './guards.ts';

export const EGGS_SLUG = 'eggs';

/** Who may read eggs in the console (08-handoff.md §4). */
export const EGG_READERS: readonly StaffRole[] = ['ops', 'support'];

/** Set at creation (`POST /v1/eggs`) and fixed for life; `callerId` and `hatched` are the only fields that move. */
export const EGG_IMMUTABLE_FIELDS = [
  'eggId',
  'monInstanceId',
  'speciesId',
  'hatchesIntoSpeciesId',
  'incubationMinutes',
  'createdAtMs',
  'incubationEndsAt',
] as const;

/**
 * Maps a stored egg to `EggRecord`. Payload owns `createdAt` (an ISO date on
 * every collection with timestamps), so the core `createdAt` epoch value is
 * stored as `createdAtMs`.
 */
export function toEggRecord(doc: Record<string, unknown>): unknown {
  return {
    eggId: doc.eggId,
    monInstanceId: doc.monInstanceId,
    speciesId: doc.speciesId,
    hatchesIntoSpeciesId: doc.hatchesIntoSpeciesId,
    callerId: doc.callerId,
    nickname: doc.nickname ?? null,
    incubationMinutes: doc.incubationMinutes,
    createdAt: doc.createdAtMs,
    incubationEndsAt: doc.incubationEndsAt,
  };
}

/**
 * Law 5 and Law 6 on every write, `overrideAccess` or not: the egg parses as
 * `EggRecord`, reserves exactly `deriveMonInstanceId(eggId)`, keeps its
 * identity fields, and never goes from hatched back to unhatched (Law 8).
 */
export const validateEgg: CollectionBeforeChangeHook = ({ data, operation, originalDoc }) => {
  const incoming = asRecord(data);
  const stored = asRecord(originalDoc);
  if (operation === 'update') {
    assertUnchanged(EGG_IMMUTABLE_FIELDS, incoming, stored, 'egg');
    if (stored?.hatched === true && incoming !== undefined && 'hatched' in incoming && incoming.hatched !== true) {
      throw new RecordError('INVALID_TRANSITION', 'a hatched egg never becomes unhatched');
    }
  }
  const merged = mergeWrite(incoming, stored);
  const egg = parseRecord(EggRecordSchema, toEggRecord(merged), 'egg');
  if (egg.monInstanceId !== deriveMonInstanceId(egg.eggId)) {
    throw new RecordError('MON_ID_MISMATCH', `egg ${egg.eggId} must reserve the derived monInstanceId`);
  }
  if (egg.incubationEndsAt !== egg.createdAt + egg.incubationMinutes * 60_000) {
    throw new RecordError('INVALID_RECORD', `egg ${egg.eggId} incubationEndsAt must be createdAt + incubationMinutes`);
  }
  return data;
};

/** Ownership moves (account merge, Decision #15) leave an audit event. */
export const auditEggOwnerChange: CollectionAfterChangeHook = async ({ doc, operation, previousDoc, req }) => {
  if (operation !== 'update') return doc;
  const before = asRecord(previousDoc);
  const after = asRecord(doc);
  if (before === undefined || after === undefined || before.callerId === after.callerId) return doc;
  await writeAuditEvent(req, { action: 'egg.caller_changed', targetType: 'egg', targetId: String(after.eggId) });
  return doc;
};

/**
 * Eggs in Callers' capture cases (ADR 0001 `/v1`). Written only by server code;
 * read-only in the console (D-A5); never deleted (Law 8).
 */
export const Eggs: CollectionConfig = {
  slug: EGGS_SLUG,
  admin: { hidden: true, useAsTitle: 'eggId' },
  access: {
    read: staffRoles(EGG_READERS),
    create: nobody,
    update: nobody,
    delete: nobody,
  },
  hooks: {
    beforeChange: [validateEgg],
    afterChange: [auditEggOwnerChange],
    afterRead: [
      auditReveal({
        collection: EGGS_SLUG,
        maskedFields: ['nickname'],
        action: 'egg.value_shown',
        targetType: 'egg',
        targetIdOf: (doc) => String(doc.eggId),
      }),
    ],
    beforeDelete: [refuseDelete('egg')],
  },
  fields: [
    // Law 6 backstop: one row per eggId, and one reserved id per egg.
    { name: 'eggId', type: 'text', required: true, unique: true, maxLength: 128 },
    { name: 'monInstanceId', type: 'text', required: true, unique: true, maxLength: 128 },
    { name: 'speciesId', type: 'text', required: true, maxLength: 128 },
    { name: 'hatchesIntoSpeciesId', type: 'text', required: true, maxLength: 128 },
    { name: 'callerId', type: 'text', required: true, index: true, maxLength: 128 },
    {
      // Caller-authored text, which may hold a child's name: masked (D-A1).
      name: 'nickname',
      type: 'text',
      maxLength: 64,
      access: { read: revealOnly(EGGS_SLUG, 'nickname', EGG_READERS) },
    },
    { name: 'incubationMinutes', type: 'number', required: true },
    { name: 'createdAtMs', type: 'number', required: true },
    { name: 'incubationEndsAt', type: 'number', required: true, index: true },
    { name: 'hatched', type: 'checkbox', required: true, defaultValue: false, index: true },
  ],
};
