import type { Access, CollectionBeforeChangeHook, CollectionConfig } from 'payload';
import { nobody, readStaffId, readStaffRole } from './access/roles.ts';
import { AUDIT_ACTIONS, AUDIT_REASON_CODES, AUDIT_TARGET_TYPES } from './audit/codes.ts';
import { IdSchema } from './core.ts';
import { RecordError } from './errors.ts';
import { asRecord, refuseDelete } from './guards.ts';

export const AUDIT_EVENTS_SLUG = 'audit-events';

/** Ops reads every event; any other staff role reads only its own (08-handoff.md §4). */
export const readAuditEvents: Access = ({ req }) => {
  const role = readStaffRole(req.user);
  if (role === undefined) return false;
  if (role === 'ops') return true;
  const id = readStaffId(req.user);
  return id === undefined ? false : { actor: { equals: id } };
};

const ACTOR_ROLE = /^[a-z][a-z-]{0,31}$/;
// An id never looks like an email; refusing `@` keeps a stray address out of the log.
const looksLikeEmail = (value: string): boolean => value.includes('@');

/**
 * Append-only, enforced below access control so server code with
 * `overrideAccess: true` cannot edit history either. A new event must carry
 * ids and codes only.
 */
export const guardAuditEvent: CollectionBeforeChangeHook = ({ data, operation }) => {
  if (operation !== 'create') throw new RecordError('APPEND_ONLY', 'audit events are append-only');
  const event = asRecord(data);
  const targetId = event?.targetId;
  if (typeof targetId !== 'string' || !IdSchema.safeParse(targetId).success || looksLikeEmail(targetId)) {
    throw new RecordError('INVALID_RECORD', 'audit.targetId must be a record id');
  }
  if (typeof event?.actorRole !== 'string' || !ACTOR_ROLE.test(event.actorRole)) {
    throw new RecordError('INVALID_RECORD', 'audit.actorRole must be a role code');
  }
  const requestId = event.requestId;
  if (requestId !== undefined && requestId !== null && (typeof requestId !== 'string' || looksLikeEmail(requestId))) {
    throw new RecordError('INVALID_RECORD', 'audit.requestId must be a request id');
  }
  return data;
};

/**
 * Staff actions and sensitive reads (01-research.md risk 3). Written only by
 * `writeAuditEvent` inside the transaction of the change it records. No role
 * may update or delete an event, the owner included. Never stores an email,
 * name, birth year or revealed value.
 */
export const AuditEvents: CollectionConfig = {
  slug: AUDIT_EVENTS_SLUG,
  admin: {
    hidden: true,
    components: {
      views: {
        list: { Component: { path: './admin/console/Redirects#CollectionRedirect', clientProps: { to: '/admin/audit' } } },
        edit: { root: { Component: { path: './admin/console/Redirects#CollectionRedirect', clientProps: { to: '/admin/audit' } } } },
      },
    },
  },
  access: {
    read: readAuditEvents,
    create: nobody,
    update: nobody,
    delete: nobody,
  },
  hooks: {
    beforeChange: [guardAuditEvent],
    beforeDelete: [refuseDelete('audit')],
  },
  fields: [
    { name: 'at', type: 'date', required: true, index: true },
    { name: 'actor', type: 'relationship', relationTo: 'users', index: true },
    { name: 'actorRole', type: 'text', required: true, maxLength: 32 },
    { name: 'action', type: 'select', required: true, index: true, options: [...AUDIT_ACTIONS] },
    { name: 'targetType', type: 'select', required: true, options: [...AUDIT_TARGET_TYPES] },
    { name: 'targetId', type: 'text', required: true, index: true, maxLength: 128 },
    { name: 'reasonCode', type: 'select', options: [...AUDIT_REASON_CODES] },
    { name: 'requestId', type: 'text', maxLength: 128 },
  ],
};
