import type { CollectionAfterChangeHook, CollectionBeforeChangeHook, CollectionConfig, PayloadRequest } from 'payload';
import { nobody, type StaffRole, staffRoles } from './access/roles.ts';
import { auditReveal, revealOnly } from './audit/reveal.ts';
import { writeAuditEvent } from './audit/writeAuditEvent.ts';
import { deriveMonInstanceId, MonInstanceSchema } from './core.ts';
import { EGGS_SLUG } from './Eggs.ts';
import { RecordError } from './errors.ts';
import { asRecord, assertUnchanged, mergeWrite, parseRecord, refuseDelete } from './guards.ts';

export const MON_INSTANCES_SLUG = 'mon-instances';

export const MON_READERS: readonly StaffRole[] = ['ops', 'support'];

/**
 * Stages a stored Mon can hold. `LIFECYCLE_STAGES` minus `Egg`: a Mon is minted
 * as a Baby and is never turned back into an egg (Law 8), so the column's enum
 * cannot hold `Egg` at all. Order is the evolution order.
 */
export const MON_STAGES = ['Baby', 'Small', 'Mid', 'Max'] as const;

export const MON_IMMUTABLE_FIELDS = ['monInstanceId', 'eggId', 'hatchedAt'] as const;

export function toMonInstance(doc: Record<string, unknown>): unknown {
  return {
    monInstanceId: doc.monInstanceId,
    speciesId: doc.speciesId,
    nickname: doc.nickname ?? null,
    callerId: doc.callerId,
    hatchedAt: doc.hatchedAt,
    bond: doc.bond,
    stage: doc.stage,
    voiceLineageId: doc.voiceLineageId ?? null,
  };
}

function stageRank(stage: unknown): number {
  return MON_STAGES.findIndex((s) => s === stage);
}

async function findEgg(req: PayloadRequest, eggId: string): Promise<Record<string, unknown> | undefined> {
  const result = await req.payload.find({
    collection: EGGS_SLUG,
    where: { eggId: { equals: eggId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  });
  return asRecord(result.docs[0]);
}

/**
 * Law 5, 6 and 8 on every write. On create the Mon must be exactly what
 * `mintMonInstance(egg)` produces for a stored egg: the egg's reserved id, its
 * Caller, its Baby form, hatched at the incubation end. The unique indexes on
 * `monInstanceId` and `eggId` stop a second Mon for the same egg even when two
 * hatches race past this check (ADR 0001, "the backstop").
 */
export const validateMonInstance: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req }) => {
  const incoming = asRecord(data);
  const stored = asRecord(originalDoc);
  if (operation === 'update') {
    assertUnchanged(MON_IMMUTABLE_FIELDS, incoming, stored, 'mon');
    if (incoming !== undefined && 'stage' in incoming && stageRank(incoming.stage) < stageRank(stored?.stage)) {
      throw new RecordError('INVALID_TRANSITION', 'a Mon never moves back a lifecycle stage');
    }
  }
  const merged = mergeWrite(incoming, stored);
  const mon = parseRecord(MonInstanceSchema, toMonInstance(merged), 'mon');
  if (mon.stage === 'Egg') {
    throw new RecordError('INVALID_TRANSITION', 'a Mon is never turned back into an egg');
  }
  const eggId = merged.eggId;
  if (typeof eggId !== 'string' || mon.monInstanceId !== deriveMonInstanceId(eggId)) {
    throw new RecordError('MON_ID_MISMATCH', `mon ${mon.monInstanceId} is not the id derived from its egg`);
  }
  if (operation === 'create') {
    const egg = await findEgg(req, eggId);
    if (egg === undefined) throw new RecordError('EGG_NOT_FOUND', `egg ${eggId} does not exist`);
    if (egg.monInstanceId !== mon.monInstanceId || egg.callerId !== mon.callerId) {
      throw new RecordError('MON_ID_MISMATCH', `mon ${mon.monInstanceId} does not match the reservation on egg ${eggId}`);
    }
    if (egg.hatchesIntoSpeciesId !== mon.speciesId || egg.incubationEndsAt !== mon.hatchedAt || mon.stage !== 'Baby') {
      throw new RecordError('INVALID_RECORD', `mon ${mon.monInstanceId} must be minted from egg ${eggId} as its Baby form`);
    }
  }
  return data;
};

/**
 * Create marks the egg hatched in the same transaction. Update audits an
 * ownership move (account merge, Decision #15).
 */
export const afterMonChange: CollectionAfterChangeHook = async ({ doc, operation, previousDoc, req }) => {
  const after = asRecord(doc);
  if (after === undefined) return doc;
  if (operation === 'create') {
    const egg = await findEgg(req, String(after.eggId));
    if (egg !== undefined && egg.hatched !== true && (typeof egg.id === 'string' || typeof egg.id === 'number')) {
      await req.payload.update({
        collection: EGGS_SLUG,
        id: egg.id,
        data: { hatched: true },
        depth: 0,
        overrideAccess: true,
        req,
      });
    }
    return doc;
  }
  const before = asRecord(previousDoc);
  if (before !== undefined && before.callerId !== after.callerId) {
    await writeAuditEvent(req, { action: 'mon.caller_changed', targetType: 'mon', targetId: String(after.monInstanceId) });
  }
  return doc;
};

/**
 * Hatched individuals (ADR 0001 `/v1`, `MonInstanceSchema`). One per egg, ever.
 * Written only by server code; read-only in the console (D-A5); never deleted
 * (Law 8). Consent denial and account merges move `callerId`.
 */
export const MonInstances: CollectionConfig = {
  slug: MON_INSTANCES_SLUG,
  admin: {
    hidden: true,
    useAsTitle: 'monInstanceId',
    components: {
      views: {
        list: { Component: { path: './admin/console/Redirects#CollectionRedirect', clientProps: { to: '/admin/mons' } } },
        edit: { root: { Component: { path: './admin/console/Redirects#CollectionRedirect', clientProps: { to: '/admin/mons' } } } },
      },
    },
  },
  access: {
    read: staffRoles(MON_READERS),
    create: nobody,
    update: nobody,
    delete: nobody,
  },
  indexes: [{ fields: ['monInstanceId', 'eggId'], unique: true }],
  hooks: {
    beforeChange: [validateMonInstance],
    afterChange: [afterMonChange],
    afterRead: [
      auditReveal({
        collection: MON_INSTANCES_SLUG,
        maskedFields: ['nickname'],
        action: 'mon.value_shown',
        targetType: 'mon',
        targetIdOf: (doc) => String(doc.monInstanceId),
      }),
    ],
    beforeDelete: [refuseDelete('mon')],
  },
  fields: [
    // Law 6 backstop: each id once, each egg once.
    { name: 'monInstanceId', type: 'text', required: true, unique: true, maxLength: 128 },
    { name: 'eggId', type: 'text', required: true, unique: true, maxLength: 128 },
    { name: 'speciesId', type: 'text', required: true, maxLength: 128 },
    {
      name: 'nickname',
      type: 'text',
      maxLength: 64,
      access: { read: revealOnly(MON_INSTANCES_SLUG, 'nickname', MON_READERS) },
    },
    { name: 'callerId', type: 'text', required: true, index: true, maxLength: 128 },
    { name: 'hatchedAt', type: 'number', required: true },
    { name: 'bond', type: 'number', required: true, min: 0, max: 1 },
    { name: 'stage', type: 'select', required: true, options: [...MON_STAGES] },
    { name: 'voiceLineageId', type: 'text', maxLength: 128 },
    { name: 'serverConfirmedAt', type: 'date' },
  ],
};
