// "Fresh session" for the handoff, merge and device-approval steps (ADR 0004 §3, §9).
// Better Auth's own `session.freshAge` is global and also gates
// `/list-sessions`, so tightening it would make the devices list ask for a
// new sign-in. These steps check their own, shorter window instead.
import { APIError } from 'better-auth/api';

/** How recent a sign-in must be for handoff, merge and device approval. */
export const FRESH_SIGN_IN_MS = 10 * 60 * 1000;

/** The session fields the check reads. */
export interface SessionAge {
  createdAt: Date | string;
}

/** True when the session was created within {@link FRESH_SIGN_IN_MS} of `nowMs`. */
export function isFreshSession(session: SessionAge, nowMs: number): boolean {
  const createdMs = new Date(session.createdAt).getTime();
  return Number.isFinite(createdMs) && nowMs - createdMs < FRESH_SIGN_IN_MS;
}

/** @throws {APIError} 403 `SESSION_NOT_FRESH` when the sign-in is older than the window. */
export function assertFreshSession(session: SessionAge, nowMs: number = Date.now()): void {
  if (!isFreshSession(session, nowMs)) {
    throw APIError.from('FORBIDDEN', {
      code: 'SESSION_NOT_FRESH',
      message: 'Sign in again to continue.',
    });
  }
}
