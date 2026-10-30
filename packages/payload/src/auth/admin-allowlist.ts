// Developer-only staff-console allowlist. The console (admin.nyc-mon.city)
// narrows sign-in to the accounts named in ADMIN_ALLOWED_EMAILS, on top of
// the staff-role gate (ADR 0004 §8). Caller sign-in, the OAuth linking flow
// judges use (/oauth/sign-in -> consent -> /v1, MCP) and the public /v1
// routes never read it: they share the /sign-in/email endpoint with the
// console's form, so the boundary keys on the surface header the console
// sends and leaves every other client alone.
import { APIError, createAuthMiddleware } from 'better-auth/api';
import type { AuthMiddleware } from 'better-auth/api';
import type { BasePayload } from 'payload';
import { readStaffRole } from '../collections/access/roles.ts';
import { readAuthEnv } from './env';
import { SURFACE_HEADER } from './surface';

/**
 * Case-insensitive allowlist check; `allowed` is injectable for tests. The
 * default reads the env at call time, never empty (see env.ts).
 */
export function isAllowedAdminEmail(email: unknown, allowed: readonly string[] = readAuthEnv().adminAllowedEmails): boolean {
  if (typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return normalized !== '' && allowed.some((entry) => entry.trim().toLowerCase() === normalized);
}

function userEmail(user: unknown): unknown {
  return typeof user === 'object' && user !== null ? (user as Record<string, unknown>).email : undefined;
}

/**
 * Console access needs BOTH a staff role and an allowlisted email. The role
 * check stays in roles.ts (hasStaffRole) because the OAuth judges hold staff
 * roles for the MCP endpoint — the allowlist must never reach their surface,
 * so it lives here rather than inside the shared role helpers.
 */
export function hasConsoleAccess(user: unknown): boolean {
  return readStaffRole(user) !== undefined && isAllowedAdminEmail(userEmail(user));
}

/**
 * The console's sign-in form names the admin surface on its credential POST.
 * The header can never mint an 'admin' session label — requestedSurface
 * refuses it — so it is safe to read as intent: the gate reacts only to deny,
 * never to grant. Every other client (the OAuth linking page, the app, /v1)
 * sends no such header and skips the gate.
 */
export function isConsoleSignIn(path: string, headers: Headers | undefined): boolean {
  return path === '/sign-in/email' && headers?.get(SURFACE_HEADER) === 'admin';
}

/** The exact failure the endpoint returns for a wrong password: no tell, no enumeration. */
function invalidCredentials(): APIError {
  return APIError.from('UNAUTHORIZED', { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' });
}

/**
 * Better Auth before-hook for the console credential sign-in, composed ahead
 * of the options.ts hook in payload.config.ts (createAuth has the live
 * Payload instance, so denials log through payload.logger). A denied attempt
 * reads exactly like a wrong password at the form; a passkey, OAuth or
 * pre-existing session that slips past it is still refused by the
 * hasConsoleAccess checks on the console itself.
 */
export function consoleSignInGate(inner: AuthMiddleware | undefined, payload: BasePayload): AuthMiddleware {
  return createAuthMiddleware(async (ctx) => {
    if (isConsoleSignIn(ctx.path, ctx.headers ?? ctx.request?.headers)) {
      const body: unknown = ctx.body;
      const email = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).email : undefined;
      if (!isAllowedAdminEmail(email)) {
        payload.logger.warn(`[auth] console sign-in denied: ${typeof email === 'string' ? email : 'unknown'} is not in ADMIN_ALLOWED_EMAILS`);
        throw invalidCredentials();
      }
    }
    return inner === undefined ? undefined : inner(ctx);
  });
}
