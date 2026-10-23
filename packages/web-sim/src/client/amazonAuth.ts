/**
 * Login with Amazon through the NYC-MON Better Auth server (AUTH_ISSUER).
 *
 * Amazon is registered there as a `genericOAuth` provider with id `amazon`
 * (packages/payload/src/auth/amazon.ts), so sign-in goes through
 * `POST /sign-in/social`, the endpoint `authClient.signIn.social` calls.
 * The session cookie is set on the issuer's origin; the simulator reads it
 * back with a credentialed `GET /get-session`. Both calls need the simulator
 * origin in the issuer's trusted origins and CORS list.
 */

const AUTH_PATH = '/payload-api/auth';

export interface AmazonUser {
  readonly name: string;
  readonly email: string;
}

/** Starts the Amazon redirect. Resolves only if the server refuses. */
export async function startAmazonSignIn(issuer: string, returnTo: string): Promise<void> {
  const res = await fetch(`${issuer}${AUTH_PATH}/sign-in/social`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'amazon', callbackURL: returnTo, errorCallbackURL: returnTo }),
  });
  const body = (await res.json().catch(() => null)) as { url?: unknown; message?: unknown } | null;
  if (!res.ok || typeof body?.url !== 'string') {
    throw new Error(typeof body?.message === 'string' ? body.message : `Amazon sign-in is unavailable (HTTP ${res.status}).`);
  }
  window.location.assign(body.url);
}

/** The signed-in user on the issuer, or null. */
export async function getAmazonUser(issuer: string): Promise<AmazonUser | null> {
  const res = await fetch(`${issuer}${AUTH_PATH}/get-session`, { credentials: 'include' });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { user?: { name?: unknown; email?: unknown } } | null;
  const user = body?.user;
  if (!user || typeof user.email !== 'string') return null;
  return { name: typeof user.name === 'string' ? user.name : '', email: user.email };
}

/** Better Auth sends `?error=` back to the error callback URL. */
export function amazonErrorFromUrl(search: string): string | null {
  const error = new URLSearchParams(search).get('error');
  if (!error) return null;
  return error === 'signup_disabled' || error === 'user_not_found'
    ? 'That Amazon account isn’t linked to a NYC-MON account yet. Link Amazon from your NYC-MON settings first.'
    : `Amazon sign-in failed (${error}).`;
}

/** Ends the issuer session. */
export async function signOutAmazon(issuer: string): Promise<void> {
  const res = await fetch(`${issuer}${AUTH_PATH}/sign-out`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error('Sign-out failed. Please try again.');
}
