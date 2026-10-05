import type { CollectionAfterChangeHook, CollectionBeforeChangeHook, CollectionConfig } from 'payload';
import { nobody, STAFF_ROLES, staffRoles } from './access/roles.ts';
import { writeAuditEvent } from './audit/writeAuditEvent.ts';
import { RecordError } from './errors.ts';
import { asRecord, refuseDelete } from './guards.ts';

export const INTEGRITY_RUNS_SLUG = 'integrity-runs';

/** The Law 6 checks a run counts (01-research.md risk 4). */
export const INTEGRITY_COUNTS = ['sharedEgg', 'idMismatch', 'orphans', 'staleReady'] as const;

/** A run's result is fixed once written; counts are non-negative integers. */
export const guardIntegrityRun: CollectionBeforeChangeHook = ({ data, operation }) => {
  if (operation !== 'create') throw new RecordError('APPEND_ONLY', 'integrity runs are append-only');
  const run = asRecord(data);
  for (const field of INTEGRITY_COUNTS) {
    const value = run?.[field];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      throw new RecordError('INVALID_RECORD', `integrity.${field} must be a non-negative integer`);
    }
  }
  return data;
};

export const auditIntegrityRun: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  const run = asRecord(doc);
  if (operation === 'create' && run !== undefined) {
    await writeAuditEvent(req, { action: 'integrity.check_run', targetType: 'integrity', targetId: String(run.id) });
  }
  return doc;
};

/**
 * Results of the read-only Law 6 integrity check. The Overview band reads the
 * latest row. Written only by server code; append-only.
 */
export const IntegrityRuns: CollectionConfig = {
  slug: INTEGRITY_RUNS_SLUG,
  admin: {
    hidden: true,
    components: {
      views: {
        list: { Component: { path: './admin/console/Redirects#CollectionRedirect', clientProps: { to: '/admin/integrity' } } },
        edit: { root: { Component: { path: './admin/console/Redirects#CollectionRedirect', clientProps: { to: '/admin/integrity' } } } },
      },
    },
  },
  access: {
    read: staffRoles(STAFF_ROLES),
    create: nobody,
    update: nobody,
    delete: nobody,
  },
  hooks: {
    beforeChange: [guardIntegrityRun],
    afterChange: [auditIntegrityRun],
    beforeDelete: [refuseDelete('integrity')],
  },
  fields: [
    { name: 'at', type: 'date', required: true, index: true },
    { name: 'trigger', type: 'select', required: true, options: ['manual', 'scheduled'] },
    { name: 'actor', type: 'relationship', relationTo: 'users' },
    { name: 'sharedEgg', type: 'number', required: true, min: 0 },
    { name: 'idMismatch', type: 'number', required: true, min: 0 },
    { name: 'orphans', type: 'number', required: true, min: 0 },
    { name: 'staleReady', type: 'number', required: true, min: 0 },
  ],
};
