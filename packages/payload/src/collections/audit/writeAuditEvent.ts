import type { PayloadRequest } from 'payload';
import { readStaffRole } from '../access/roles.ts';
import { type AuditAction, type AuditReasonCode, type AuditTargetType, isAuditReasonCode } from './codes.ts';

/**
 * Server code that changes a record on a staff member's behalf passes the
 * staff-chosen reason as `context: { [AUDIT_REASON_CONTEXT_KEY]: reasonCode }`;
 * the collection hooks copy it onto the audit event they write.
 */
export const AUDIT_REASON_CONTEXT_KEY = 'nycmonAuditReason';

/** The reason code on the request context, if it is one of the fixed codes. */
export function readAuditReason(context: PayloadRequest['context'] | undefined): AuditReasonCode | undefined {
  const raw: unknown = context?.[AUDIT_REASON_CONTEXT_KEY];
  return isAuditReasonCode(raw) ? raw : undefined;
}

/** One audit event as server code describes it. Never carries a personal value. */
export interface AuditEntry {
  action: AuditAction;
  targetType: AuditTargetType;
  /** Record id (consent id, `eggId`, `monInstanceId`, user id). Never an email or name. */
  targetId: string;
  reasonCode?: AuditReasonCode;
}

/** Role snapshot stored on the event: a staff role, `caller`, or `system` when no one is signed in. */
export function actorRoleOf(user: unknown): string {
  const staff = readStaffRole(user);
  if (staff !== undefined) return staff;
  return user === null || user === undefined ? 'system' : 'caller';
}

/** `users` ids are Payload's default serial integers on Postgres. */
function actorIdOf(user: unknown): number | null {
  if (typeof user !== 'object' || user === null || !('id' in user)) return null;
  const id = user.id;
  return typeof id === 'number' ? id : null;
}

const MAX_REQUEST_ID = 128;

function requestIdOf(req: PayloadRequest): string | null {
  const raw = req.headers.get('x-request-id') ?? req.headers.get('x-vercel-id');
  return raw === null || raw === '' ? null : raw.slice(0, MAX_REQUEST_ID);
}

/**
 * Appends one audit event inside the caller's transaction (`req` is threaded
 * through, so a failed audit write rolls back the change it describes).
 */
export async function writeAuditEvent(req: PayloadRequest, entry: AuditEntry): Promise<void> {
  await req.payload.create({
    collection: 'audit-events',
    data: {
      at: new Date().toISOString(),
      actor: actorIdOf(req.user),
      actorRole: actorRoleOf(req.user),
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      reasonCode: entry.reasonCode ?? readAuditReason(req.context) ?? null,
      requestId: requestIdOf(req),
    },
    depth: 0,
    overrideAccess: true,
    req,
  });
}
