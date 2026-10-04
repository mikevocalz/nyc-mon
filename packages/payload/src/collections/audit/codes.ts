/**
 * Audit action codes. The first group is the copy deck's "Action labels"
 * (`docs/design/admin/05-copy.md`). The second group is written by the X1
 * collection hooks and still needs labels in the copy deck.
 */
export const AUDIT_ACTIONS = [
  'caller.value_shown',
  'caller.deletion_scheduled',
  'caller.deletion_cancelled',
  'caller.deleted',
  'caller.signed_out_everywhere',
  'consent.email_sent',
  'consent.approved',
  'consent.denied',
  'consent.expired',
  'consent.deleted',
  'integrity.check_run',
  'staff.added',
  'staff.role_changed',
  'staff.removed',
  'audit.exported',
  // TODO(copy): labels for these in 05-copy.md "Action labels".
  'consent.requested',
  'consent.value_shown',
  'egg.value_shown',
  'egg.caller_changed',
  'mon.value_shown',
  'mon.caller_changed',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Human-readable labels for every audit action; keys match `05-copy.md`. */
export const AUDIT_ACTION_LABELS: Readonly<Record<AuditAction, string>> = {
  'caller.value_shown': 'Showed a hidden value',
  'caller.deletion_scheduled': 'Scheduled deletion',
  'caller.deletion_cancelled': 'Cancelled deletion',
  'caller.deleted': 'Deleted account',
  'caller.signed_out_everywhere': 'Signed out everywhere',
  'consent.email_sent': 'Sent consent email',
  'consent.approved': 'Approved consent',
  'consent.denied': 'Denied consent',
  'consent.expired': 'Consent expired',
  'consent.deleted': 'Deleted consent record',
  'integrity.check_run': 'Ran integrity check',
  'staff.added': 'Added staff',
  'staff.role_changed': 'Changed staff role',
  'staff.removed': 'Removed staff',
  'audit.exported': 'Exported audit log',
  'consent.requested': 'Requested guardian consent',
  'consent.value_shown': 'Showed a hidden consent value',
  'egg.value_shown': 'Showed a hidden egg value',
  'egg.caller_changed': 'Moved egg to another Caller',
  'mon.value_shown': 'Showed a hidden Mon value',
  'mon.caller_changed': 'Moved Mon to another Caller',
};

/** What an audit event is about (08-handoff.md §4). */
export const AUDIT_TARGET_TYPES = ['caller', 'consent', 'mon', 'egg', 'staff', 'audit', 'integrity'] as const;

export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

/** Fixed reason codes (D-A2: no free-text reasons), from 05-copy.md `admin.reason.*`. */
export const AUDIT_REASON_CODES = [
  'support_request',
  'parent_request',
  'deletion_check',
  'legal',
  'caller_request',
  'parent_withdrew',
  'sent_in_error',
] as const;

export type AuditReasonCode = (typeof AUDIT_REASON_CODES)[number];

export function isAuditReasonCode(value: unknown): value is AuditReasonCode {
  return typeof value === 'string' && (AUDIT_REASON_CODES as readonly string[]).includes(value);
}
