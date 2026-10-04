import type { CollectionAfterReadHook, FieldAccess, PayloadRequest } from 'payload';
import { hasStaffRole, type StaffRole } from '../access/roles.ts';
import { type AuditAction, type AuditReasonCode, type AuditTargetType, isAuditReasonCode } from './codes.ts';
import { writeAuditEvent } from './writeAuditEvent.ts';

/**
 * Reveal-and-log (D-A1, `docs/design/admin/03-direction.md`). Sensitive fields
 * are hidden from every staff read by field access. The console's reveal
 * endpoint reads one record with
 *
 *   context: { [REVEAL_CONTEXT_KEY]: { collection, field, reasonCode } },
 *   user: req.user, overrideAccess: false, req
 *
 * which unhides exactly that field for a permitted role, and the collection's
 * `afterRead` hook writes the audit event in the same request. If the audit
 * write throws, the read throws and the value is never returned.
 */
export const REVEAL_CONTEXT_KEY = 'nycmonReveal';

export interface RevealRequest {
  collection: string;
  field: string;
  reasonCode: AuditReasonCode;
}

/** Parses `req.context[REVEAL_CONTEXT_KEY]`; anything malformed reveals nothing. */
export function readRevealRequest(context: PayloadRequest['context'] | undefined): RevealRequest | undefined {
  const raw: unknown = context?.[REVEAL_CONTEXT_KEY];
  if (typeof raw !== 'object' || raw === null) return undefined;
  if (!('collection' in raw) || !('field' in raw) || !('reasonCode' in raw)) return undefined;
  const { collection, field, reasonCode } = raw;
  if (typeof collection !== 'string' || typeof field !== 'string' || !isAuditReasonCode(reasonCode)) return undefined;
  return { collection, field, reasonCode };
}

/**
 * Field read access for a masked field: visible only to `roles`, and only when
 * the request names this collection and field as a reveal with a reason code.
 * Server code with `overrideAccess: true` skips field access entirely.
 */
export function revealOnly(collection: string, field: string, roles: readonly StaffRole[]): FieldAccess {
  return ({ req }) => {
    if (!hasStaffRole(req, roles)) return false;
    const reveal = readRevealRequest(req.context);
    return reveal !== undefined && reveal.collection === collection && reveal.field === field;
  };
}

export interface RevealAuditOptions {
  collection: string;
  /** Fields that are masked by {@link revealOnly}. */
  maskedFields: readonly string[];
  action: AuditAction;
  targetType: AuditTargetType;
  /** The record id the audit event points at; never a personal value. */
  targetIdOf: (doc: Record<string, unknown>) => string;
}

/** `afterRead` hook that logs a reveal of one masked field. */
export function auditReveal(options: RevealAuditOptions): CollectionAfterReadHook {
  return async ({ doc, req }) => {
    const reveal = readRevealRequest(req.context);
    if (reveal === undefined || reveal.collection !== options.collection) return doc;
    if (!options.maskedFields.includes(reveal.field)) return doc;
    // Field access dropped the value: nothing was shown, nothing to log.
    if (!(reveal.field in doc)) return doc;
    await writeAuditEvent(req, {
      action: options.action,
      targetType: options.targetType,
      targetId: options.targetIdOf(doc),
      reasonCode: reveal.reasonCode,
    });
    return doc;
  };
}
