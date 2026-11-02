// Developer-only game-app sign-in allowlist (APP_ALLOWED_EMAILS), the app
// surface's counterpart to admin-allowlist.ts. The app's own sign-in calls
// (packages/auth createAuth: email, passkey, social and sign-up — web and
// mobile share them) carry `x-nycmon-surface: app`. That value is not a
// session Surface label at all, so it can never mint privilege: the gate
// only ever uses it to deny. Requests without it — the OAuth linking flow
// the judges use, /v1, the staff console — never see the gate.
import { addOAuthServerContext, createAuthMiddleware, getOAuthState } from 'better-auth/api';
import type { AuthMiddleware } from 'better-auth/api';
import type { BasePayload } from 'payload';
import { emailInList, invalidCredentials } from './admin-allowlist.ts';
import { readAuthEnv } from './env';
import { SURFACE_HEADER } from './surface';

/**
 * The marker value the game app's sign-in requests carry. Deliberately not a
 * member of SURFACES: `requestedSurface` maps it to 'web' like any unknown
 * value, so the header can only ever deny, never claim a label.
 * Must match `APP_SURFACE` in `packages/auth/src/paths.ts`.
 */
export const APP_SURFACE = 'app';

/**
 * OAuth state serverContext flag marking that a /sign-in/social call came
 * from the app. The provider callback returns without the app's headers, so
 * the flag rides the state the way SOCIAL_BIRTH_YEAR_KEY does (options.ts),
 * letting the session and user hooks still recognise the gated flow.
 */
export const APP_SIGN_IN_STATE_KEY = 'nycmon.app_sign_in';

function readField(record: unknown, field: string): unknown {
  return typeof record === 'object' && record !== null && field in record ? (record as Record<string, unknown>)[field] : undefined;
}

/**
 * Case-insensitive allowlist check; `allowed` is injectable for tests. The
 * default reads the env at call time, never empty (see env.ts).
 */
export function isAllowedAppEmail(email: unknown, allowed: readonly string[] = readAuthEnv().appAllowedEmails): boolean {
  return emailInList(email, allowed);
}

/** True when the request headers carry the game app's sign-in marker. */
export function isAppSignIn(headers: Headers | undefined): boolean {
  return headers?.get(SURFACE_HEADER) === APP_SURFACE;
}

/**
 * True when this request belongs to a gated app sign-in: it carries the
 * app's surface marker directly, or it is a provider callback whose
 * /sign-in/social request flagged the OAuth state. Anything else — judges'
 * linking sign-ins, /v1, console sign-ins — is not an app sign-in attempt.
 */
export async function appSignInAttempt(ctx: { headers?: Headers; request?: { headers?: Headers } } | null | undefined): Promise<boolean> {
  if (ctx === null || ctx === undefined) return false;
  if (isAppSignIn(ctx.headers ?? ctx.request?.headers)) return true;
  try {
    const state = await getOAuthState();
    return readField(state?.serverContext, APP_SIGN_IN_STATE_KEY) === true;
  } catch {
    return false;
  }
}

/**
 * Better Auth before-hook for the app's credential sign-in, composed with
 * the console gate and the shared hook in payload.config.ts (createAuth has
 * the live Payload, so denials log through payload.logger). Email sign-in
 * and sign-up are checked here because the email is in the body; a denied
 * attempt reads exactly like a wrong password at the form. Social sign-in
 * has no email yet — the state flag is set so the session and user hooks in
 * options.ts apply the same list at creation time, which is also where
 * marked passkey sign-ins are refused.
 */
export function appSignInGate(inner: AuthMiddleware | undefined, payload: BasePayload): AuthMiddleware {
  return createAuthMiddleware(async (ctx) => {
    if (isAppSignIn(ctx.headers ?? ctx.request?.headers)) {
      if (ctx.path === '/sign-in/email' || ctx.path === '/sign-up/email') {
        const email = readField(ctx.body, 'email');
        if (!isAllowedAppEmail(email)) {
          payload.logger.warn(`[auth] app sign-in denied: ${typeof email === 'string' ? email : 'unknown'} is not in APP_ALLOWED_EMAILS`);
          throw invalidCredentials();
        }
      } else if (ctx.path === '/sign-in/social') {
        try {
          await addOAuthServerContext({ [APP_SIGN_IN_STATE_KEY]: true });
        } catch {
          payload.logger.warn('[auth] app sign-in flag could not be stored in the oauth state');
        }
      }
    }
    return inner === undefined ? undefined : inner(ctx);
  });
}
