/** Stable codes returned by the ops console endpoints to the typed client. */
export type ConsoleErrorCode =
  | 'FORBIDDEN_ROLE'
  | 'NOT_FOUND'
  | 'AUDIT_WRITE_FAILED'
  | 'CONFIRM_MISMATCH'
  | 'ALREADY_SCHEDULED'
  | 'NOT_SCHEDULED'
  | 'RECORD_CHANGED'
  | 'RESEND_LOCKED'
  | 'NOT_PENDING'
  | 'EMAIL_DISABLED'
  | 'NOT_REVIEWABLE'
  | 'RUN_IN_PROGRESS'
  | 'LAST_OPS'
  | 'NOT_STAFF'
  | 'INVALID_RECORD';
