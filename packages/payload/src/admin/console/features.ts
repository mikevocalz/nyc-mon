// Feature flags and policy numbers that gate parts of the ops console and the
// guardian-consent flow until counsel or canon decides them.
//
// These constants are safe to import in both server and browser bundles: they
// are plain values and do not pull in Payload, the database or mailers.

/** How long a guardian-consent request stays open before it is deleted (COPPA 16 CFR 312.5(c)(1)). */
// TODO(counsel): confirm the retention window before launch; 7 days is a placeholder.
export const CONSENT_RETENTION_DAYS = 7;

/** Minimum milliseconds between manual resends of a consent email from the console. */
// TODO(counsel): confirm the resend lockout before launch; 5 minutes is a placeholder.
export const CONSENT_RESEND_LOCKOUT_MS = 5 * 60 * 1000;

/**
 * Whether staff may approve or deny a guardian-consent request from the
 * console. The consent method (email-plus vs a stronger 312.5(b) method) is
 * counsel's decision (M05 B1); until it is approved, the decision endpoint
 * returns 404 so no staff action can be taken.
 */
export const CONSENT_DECISIONS_ENABLED: boolean =
  (typeof process !== 'undefined' && process.env?.CONSOLE_CONSENT_DECISIONS_ENABLED === 'true') || false;
