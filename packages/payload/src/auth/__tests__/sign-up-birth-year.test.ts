// POST /sign-up/email must answer the same birth-year question the linking
// form asks (link-form.ts): required, a plausible four-digit year. A raw post
// without one used to mint an account that could never pass the adults gate
// at OAuth linking. Drives the real `betterAuthOptions` (hooks.before and the
// user.create.before gate) on Better Auth's in-memory adapter: no Payload,
// no database.
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { describe, expect, it } from 'vitest';
import { betterAuthOptions } from '../options.ts';

const ORIGIN = 'http://localhost:5174';
const BASE = `${ORIGIN}/payload-api/auth`;
const SECRET = 'test-secret-test-secret-test-secret-0123';
const ADULT_YEAR = 1990;

/** Every model the core and the configured plugins write to. */
const MODELS = [
  'user', 'session', 'account', 'verification', 'rateLimit', 'jwks',
  'oauthClient', 'oauthResource', 'oauthClientResource', 'oauthRefreshToken',
  'oauthAccessToken', 'oauthConsent', 'oauthClientAssertion',
];

function makeAuth() {
  const db: Record<string, Record<string, unknown>[]> = Object.fromEntries(MODELS.map((model) => [model, []]));
  const auth = betterAuth({ ...betterAuthOptions, secret: SECRET, database: memoryAdapter(db) });
  return { auth, db };
}

type Auth = ReturnType<typeof makeAuth>['auth'];

function postSignUp(auth: Auth, body: Record<string, unknown>): Promise<Response> {
  return auth.handler(
    new Request(`${BASE}/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email: 'caller@example.com', password: 'correct-horse-battery', name: 'Caller', ...body }),
    }),
  );
}

describe('POST /sign-up/email birth-year gate', () => {
  it('rejects a sign-up with no birthYear and creates no account', async () => {
    const { auth, db } = makeAuth();
    const response = await postSignUp(auth, {});
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'BIRTH_YEAR_REQUIRED' });
    expect(db.user).toHaveLength(0);
  });

  it.each([
    ['a string', 'abc'],
    ['a year under 1900', 1899],
    ['a year in the future', new Date().getUTCFullYear() + 1],
    ['a fractional year', 1990.5],
  ])('rejects %s as a birth year', async (_name, birthYear) => {
    const { auth, db } = makeAuth();
    const response = await postSignUp(auth, { birthYear });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_BIRTH_YEAR' });
    expect(db.user).toHaveLength(0);
  });

  it('creates the account when the year is plausible', async () => {
    const { auth, db } = makeAuth();
    const response = await postSignUp(auth, { birthYear: ADULT_YEAR });
    expect(response.status).toBe(200);
    expect(db.user?.[0]?.birthYear).toBe(ADULT_YEAR);
  });

  it('still routes an under-13 year to the guardian gate', async () => {
    const { auth, db } = makeAuth();
    const response = await postSignUp(auth, { birthYear: new Date().getUTCFullYear() - 10 });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'GUARDIAN_CONSENT_REQUIRED' });
    expect(db.user).toHaveLength(0);
  });
});
