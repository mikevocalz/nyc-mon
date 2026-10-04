import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload';
import { nobody, type StaffRole, staffRoles } from './access/roles.ts';
import { CareStateSchema, IdSchema } from './core.ts';
import { RecordError } from './errors.ts';
import { asRecord, assertUnchanged, mergeWrite, parseRecord, refuseDelete } from './guards.ts';
import { MON_INSTANCES_SLUG } from './MonInstances.ts';

export const CARE_STATES_SLUG = 'care-states';

export const CARE_READERS: readonly StaffRole[] = ['ops', 'support'];

/**
 * Maps a stored row to `CareState`. Payload owns `updatedAt` (an ISO date it
 * rewrites on every update), so the core sim-time `updatedAt` is stored as
 * `updatedAtMs`.
 */
export function toCareState(doc: Record<string, unknown>): unknown {
  return {
    monInstanceId: doc.monInstanceId,
    energy: doc.energy,
    fullness: doc.fullness,
    social: doc.social,
    updatedAt: doc.updatedAtMs,
    lastFedAt: doc.lastFedAt ?? null,
    lastRestedAt: doc.lastRestedAt ?? null,
    lastSocialAt: doc.lastSocialAt ?? null,
    activity: doc.activity,
    sluggishUntil: doc.sluggishUntil ?? null,
    pendingRequest: doc.pendingRequest ?? null,
  };
}

/**
 * Parses `lastSeqByDevice` (`ServerCareRecord.lastSeqByDevice` in
 * `packages/core/sim/queue.ts`): device id → highest applied `seq`.
 */
export function parseLastSeqByDevice(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RecordError('INVALID_RECORD', 'care.lastSeqByDevice must be an object of device id to seq');
  }
  const out: Record<string, number> = {};
  for (const [deviceId, seq] of Object.entries(value)) {
    if (!IdSchema.safeParse(deviceId).success || typeof seq !== 'number' || !Number.isInteger(seq) || seq < 0) {
      throw new RecordError('INVALID_RECORD', 'care.lastSeqByDevice holds an invalid device id or seq');
    }
    out[deviceId] = seq;
  }
  return out;
}

/**
 * Law 5 on every write: the row parses as `CareState`; the Mon exists; a
 * device's applied `seq` never goes backwards (ADR 0002: the server ignores
 * `seq <= lastApplied`, so lowering it would replay writes).
 */
export const validateCareState: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req }) => {
  const incoming = asRecord(data);
  const stored = asRecord(originalDoc);
  if (operation === 'update') assertUnchanged(['monInstanceId'], incoming, stored, 'care');
  const merged = mergeWrite(incoming, stored);
  const care = parseRecord(CareStateSchema, toCareState(merged), 'care');
  const seqs = parseLastSeqByDevice(merged.lastSeqByDevice ?? {});
  if (operation === 'update' && stored !== undefined) {
    const previous = parseLastSeqByDevice(stored.lastSeqByDevice ?? {});
    for (const [deviceId, seq] of Object.entries(previous)) {
      const next = seqs[deviceId];
      if (next === undefined || next < seq) {
        throw new RecordError('INVALID_TRANSITION', 'care.lastSeqByDevice never decreases or drops a device');
      }
    }
  }
  if (operation === 'create') {
    const mons = await req.payload.count({
      collection: MON_INSTANCES_SLUG,
      where: { monInstanceId: { equals: care.monInstanceId } },
      overrideAccess: true,
      req,
    });
    if (mons.totalDocs !== 1) throw new RecordError('MON_NOT_FOUND', `mon ${care.monInstanceId} does not exist`);
  }
  return data;
};

/**
 * Authoritative care state per Mon (`CareStateSchema` + per-device applied
 * seq), written by `PUT /v1/mons/:id/care`. One row per Mon; never deleted
 * (Law 8: there is no HP, sickness or death field to clear).
 */
export const CareStates: CollectionConfig = {
  slug: CARE_STATES_SLUG,
  admin: { hidden: true, useAsTitle: 'monInstanceId' },
  access: {
    read: staffRoles(CARE_READERS),
    create: nobody,
    update: nobody,
    delete: nobody,
  },
  hooks: {
    beforeChange: [validateCareState],
    beforeDelete: [refuseDelete('care')],
  },
  fields: [
    { name: 'monInstanceId', type: 'text', required: true, unique: true, maxLength: 128 },
    { name: 'energy', type: 'number', required: true, min: 0, max: 1 },
    { name: 'fullness', type: 'number', required: true, min: 0, max: 1 },
    { name: 'social', type: 'number', required: true, min: 0, max: 1 },
    { name: 'updatedAtMs', type: 'number', required: true },
    { name: 'lastFedAt', type: 'number' },
    { name: 'lastRestedAt', type: 'number' },
    { name: 'lastSocialAt', type: 'number' },
    // `CareActivitySchema` / `CareRequestSchema`: small discriminated objects, parsed above.
    { name: 'activity', type: 'json', required: true },
    { name: 'sluggishUntil', type: 'number' },
    { name: 'pendingRequest', type: 'json' },
    { name: 'lastSeqByDevice', type: 'json', required: true, defaultValue: {} },
  ],
};
