import type { AuthError } from './AuthError.ts';

/**
 * Outcome of a sign-in, sign-up or sign-out call. Better Auth's client
 * resolves with `{ data, error }` instead of throwing, so a `try/catch` would
 * miss every failure; this union makes the caller branch on `ok`.
 */
export type AuthResult = { ok: true } | { ok: false; error: AuthError };
