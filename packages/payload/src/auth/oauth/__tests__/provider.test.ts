// Drives the real @better-auth/oauth-provider 1.7.7 endpoints, configured by
// alexaOAuthPlugins, against Better Auth's in-memory adapter. No Payload and
// no database: the provider, jwt plugin and our guards are the code under test.
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { linkRefusal } from '../adult';
import { checkResource, withOfflineAccess } from '../guards';
import { readOAuthConfig } from '../config';
import { loadLinkPage } from '../pages';
import { alexaOAuthPlugins, OAUTH_PAGES } from '../plugins';

const ORIGIN = 'http://localhost:5174';
const BASE = `${ORIGIN}/payload-api/auth`;
const RESOURCE = 'https://mcp.nyc-mon.test/mcp';
const ALEXA_REDIRECT = 'https://pitangui.amazon.com/api/skill/link/TEST';
const SIM_REDIRECT = 'http://localhost:5180/oauth/callback';
const ALEXA_SECRET = 'alexa-secret-for-tests-only-0123456789';
const NOW = Date.UTC(2026, 9, 8, 12);
const ADULT_YEAR = 1990;
const MINOR_YEAR = 2026 - 17;

type Db = Record<string, Record<string, unknown>[]>;

/** Every model the core, the jwt plugin and the provider write to. */
const MODELS = [
  'user', 'session', 'account', 'verification', 'rateLimit', 'jwks',
  'oauthClient', 'oauthResource', 'oauthClientResource', 'oauthRefreshToken',
  'oauthAccessToken', 'oauthConsent', 'oauthClientAssertion',
];

function emptyDb(): Db {
  return Object.fromEntries(MODELS.map((model) => [model, []]));
}

const SECRET = 'test-secret-test-secret-test-secret-0123';
const CONFIG = readOAuthConfig({
  BETTER_AUTH_URL: ORIGIN,
  MCP_RESOURCE_URI: RESOURCE,
  OAUTH_ALEXA_CLIENT_SECRET: ALEXA_SECRET,
  OAUTH_ALEXA_REDIRECT_URIS: ALEXA_REDIRECT,
  OAUTH_SIM_REDIRECT_URIS: SIM_REDIRECT,
});

function makeAuth() {
  const db = emptyDb();
  const config = CONFIG;
  const auth = betterAuth({
    baseURL: ORIGIN,
    basePath: '/payload-api/auth',
    secret: SECRET,
    database: memoryAdapter(db),
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: false },
    user: {
      additionalFields: {
        birthYear: { type: 'number', required: false, input: true },
        consentStatus: { type: 'string', required: false, input: false },
      },
    },
    plugins: alexaOAuthPlugins(config, () => NOW),
  });
  return { auth, db };
}

type Auth = ReturnType<typeof makeAuth>['auth'];

function basic(id: string, secret: string): string {
  return `Basic ${Buffer.from(`${encodeURIComponent(id)}:${encodeURIComponent(secret)}`).toString('base64')}`;
}

async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: Buffer.from(digest).toString('base64url') };
}

async function signUp(auth: Auth, email: string, birthYear: number): Promise<string> {
  const response = await auth.handler(
    new Request(`${BASE}/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email, password: 'correct-horse-battery', name: 'Test', birthYear }),
    }),
  );
  expect(response.status).toBe(200);
  const cookies = response.headers.getSetCookie().map((cookie) => cookie.split(';')[0]);
  return cookies.join('; ');
}

function authorizeUrl(params: Record<string, string>): string {
  const url = new URL(`${BASE}/oauth2/authorize`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

async function authorize(auth: Auth, cookie: string, params: Record<string, string>): Promise<Response> {
  return auth.handler(new Request(authorizeUrl(params), { headers: { cookie } }));
}

function alexaAuthorizeParams(challenge: string, overrides: Record<string, string> = {}): Record<string, string> {
  return {
    response_type: 'code',
    client_id: 'alexa',
    redirect_uri: ALEXA_REDIRECT,
    scope: 'mcp:caller mcp:care',
    state: 'state-123',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    resource: RESOURCE,
    ...overrides,
  };
}

/** Runs authorize + consent for an adult and returns the authorization code. */
async function obtainCode(auth: Auth, cookie: string, challenge: string): Promise<string> {
  const first = await authorize(auth, cookie, alexaAuthorizeParams(challenge));
  expect(first.status).toBe(302);
  const consentUrl = new URL(first.headers.get('location') ?? '', ORIGIN);
  expect(consentUrl.pathname).toBe(OAUTH_PAGES.consent);
  const consent = await auth.handler(
    new Request(`${BASE}/oauth2/consent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: ORIGIN },
      body: JSON.stringify({ accept: true, oauth_query: consentUrl.search.slice(1) }),
    }),
  );
  expect(consent.status).toBe(200);
  const body = (await consent.json()) as { url: string };
  const redirect = new URL(body.url);
  expect(redirect.origin + redirect.pathname).toBe(ALEXA_REDIRECT);
  expect(redirect.searchParams.get('state')).toBe('state-123');
  const code = redirect.searchParams.get('code');
  expect(code).toBeTruthy();
  return code ?? '';
}

async function token(auth: Pick<Auth, 'handler'>, form: Record<string, string>, authorization?: string, query = ''): Promise<Response> {
  return auth.handler(
    new Request(`${BASE}/oauth2/token${query}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        ...(authorization === undefined ? {} : { authorization }),
      },
      body: new URLSearchParams(form).toString(),
    }),
  );
}

/** Verifies an access token against the published JWKS, the way the MCP server does. */
async function verifyAccessToken(auth: Auth, jwt: string): Promise<Record<string, unknown>> {
  const jwks = (await (await auth.handler(new Request(`${BASE}/jwks`))).json()) as { keys: (JsonWebKey & { kid: string })[] };
  const [rawHeader, rawBody, rawSignature] = jwt.split('.') as [string, string, string];
  const header = JSON.parse(Buffer.from(rawHeader, 'base64url').toString('utf8')) as { alg: string; kid: string; typ: string };
  expect(header.alg).toBe('EdDSA');
  expect(header.typ).toBe('at+jwt');
  const jwk = jwks.keys.find((key) => key.kid === header.kid);
  expect(jwk).toBeDefined();
  const key = await crypto.subtle.importKey('jwk', { kty: jwk?.kty, crv: jwk?.crv, x: jwk?.x }, { name: 'Ed25519' }, false, ['verify']);
  const valid = await crypto.subtle.verify('Ed25519', key, Buffer.from(rawSignature, 'base64url'), new TextEncoder().encode(`${rawHeader}.${rawBody}`));
  expect(valid).toBe(true);
  return JSON.parse(Buffer.from(rawBody, 'base64url').toString('utf8')) as Record<string, unknown>;
}

describe('Alexa+ authorization server', () => {
  let auth: Auth;
  let db: Db;

  beforeEach(async () => {
    ({ auth, db } = makeAuth());
    await auth.$context;
  });

  it('seeds the two static clients and links them to the MCP resource', () => {
    const ids = db.oauthClient?.map((row) => row.clientId);
    expect(ids).toEqual(['alexa', 'nyc-mon-sim']);
    const alexa = db.oauthClient?.find((row) => row.clientId === 'alexa');
    expect(alexa?.clientSecret).not.toBe(ALEXA_SECRET);
    expect(alexa?.tokenEndpointAuthMethod).toBe('client_secret_basic');
    expect(db.oauthClient?.find((row) => row.clientId === 'nyc-mon-sim')?.tokenEndpointAuthMethod).toBe('none');
    expect(db.oauthClientResource?.map((row) => [row.clientId, row.resourceId])).toEqual([
      ['alexa', RESOURCE],
      ['nyc-mon-sim', RESOURCE],
    ]);
  });

  it('publishes RFC 8414 metadata Amazon accepts, with no OIDC', async () => {
    const metadata = (await auth.api.getOAuthServerConfig()) as unknown as Record<string, unknown>;
    expect(metadata.issuer).toBe(ORIGIN);
    expect(metadata.authorization_endpoint).toBe(`${BASE}/oauth2/authorize`);
    expect(metadata.token_endpoint).toBe(`${BASE}/oauth2/token`);
    expect(metadata.jwks_uri).toBe(`${BASE}/jwks`);
    expect(metadata.grant_types_supported).toEqual(expect.arrayContaining(['authorization_code', 'client_credentials', 'refresh_token']));
    expect(metadata.code_challenge_methods_supported).toEqual(['S256']);
    expect(metadata.token_endpoint_auth_methods_supported).toContain('client_secret_basic');
    expect(metadata.scopes_supported).toEqual(expect.arrayContaining(['mcp:service', 'mcp:caller', 'mcp:care']));
    expect(metadata.scopes_supported).not.toContain('openid');
    expect(metadata.registration_endpoint).toBeUndefined();
    await expect(auth.api.getOpenIdConfig()).rejects.toThrow();
  });

  describe('client_credentials', () => {
    it('issues an mcp:service JWT for the MCP resource and no refresh token', async () => {
      const response = await token(auth, { grant_type: 'client_credentials', scope: 'mcp:service', resource: RESOURCE }, basic('alexa', ALEXA_SECRET));
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toContain('no-store');
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.token_type).toBe('Bearer');
      expect(body.expires_in).toBe(3600);
      expect(body.refresh_token).toBeUndefined();
      const claims = await verifyAccessToken(auth, String(body.access_token));
      expect(claims).toMatchObject({ iss: ORIGIN, aud: RESOURCE, sub: 'alexa', client_id: 'alexa', scope: 'mcp:service' });
    });

    it('refuses a wrong secret with 401 invalid_client', async () => {
      const response = await token(auth, { grant_type: 'client_credentials', scope: 'mcp:service', resource: RESOURCE }, basic('alexa', 'wrong'));
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: 'invalid_client' });
    });

    it('refuses an unknown client', async () => {
      const response = await token(auth, { grant_type: 'client_credentials', resource: RESOURCE }, basic('stranger', 'whatever'));
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: 'invalid_client' });
    });

    it('refuses a user scope', async () => {
      const response = await token(auth, { grant_type: 'client_credentials', scope: 'mcp:caller', resource: RESOURCE }, basic('alexa', ALEXA_SECRET));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: 'invalid_scope' });
    });

    it('refuses a missing or foreign resource', async () => {
      for (const resource of [undefined, 'https://evil.test/mcp']) {
        const form: Record<string, string> = { grant_type: 'client_credentials', scope: 'mcp:service' };
        if (resource !== undefined) form.resource = resource;
        const response = await token(auth, form, basic('alexa', ALEXA_SECRET));
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: 'invalid_target' });
      }
    });

    it('refuses credentials in the query string', async () => {
      const response = await token(
        auth,
        { grant_type: 'client_credentials', scope: 'mcp:service', resource: RESOURCE },
        basic('alexa', ALEXA_SECRET),
        `?client_secret=${ALEXA_SECRET}`,
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: 'invalid_request' });
    });
  });

  describe('authorization_code + PKCE', () => {
    it('links an adult: code exchange returns a user JWT and a refresh token, and refresh rotates', async () => {
      const cookie = await signUp(auth, 'adult@example.com', ADULT_YEAR);
      const { verifier, challenge } = await pkcePair();
      const code = await obtainCode(auth, cookie, challenge);

      const exchanged = await token(
        auth,
        { grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: ALEXA_REDIRECT, resource: RESOURCE },
        basic('alexa', ALEXA_SECRET),
      );
      expect(exchanged.status).toBe(200);
      const first = (await exchanged.json()) as Record<string, unknown>;
      expect(typeof first.refresh_token).toBe('string');
      const claims = await verifyAccessToken(auth, String(first.access_token));
      expect(claims).toMatchObject({ iss: ORIGIN, aud: RESOURCE, client_id: 'alexa', birth_year: ADULT_YEAR });
      expect(String(claims.scope).split(' ')).toEqual(expect.arrayContaining(['mcp:caller', 'mcp:care', 'offline_access']));
      expect(claims.sub).toBe(String(db.user?.[0]?.id));

      // Refresh carries no resource (PLATFORM-DOCS §2.5) and rotates the token.
      const refreshed = await token(auth, { grant_type: 'refresh_token', refresh_token: String(first.refresh_token) }, basic('alexa', ALEXA_SECRET));
      expect(refreshed.status).toBe(200);
      const second = (await refreshed.json()) as Record<string, unknown>;
      expect(second.refresh_token).not.toBe(first.refresh_token);
      expect(await verifyAccessToken(auth, String(second.access_token))).toMatchObject({ aud: RESOURCE });

      // The rotated-out token is dead, and reusing it revokes the family.
      const reused = await token(auth, { grant_type: 'refresh_token', refresh_token: String(first.refresh_token) }, basic('alexa', ALEXA_SECRET));
      expect(reused.status).toBe(400);
      expect(await reused.json()).toMatchObject({ error: 'invalid_grant' });
      const afterReuse = await token(auth, { grant_type: 'refresh_token', refresh_token: String(second.refresh_token) }, basic('alexa', ALEXA_SECRET));
      expect(afterReuse.status).toBe(400);

      // A code works once; a replay is refused.
      const replayed = await token(
        auth,
        { grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: ALEXA_REDIRECT, resource: RESOURCE },
        basic('alexa', ALEXA_SECRET),
      );
      expect(replayed.status).toBe(400);
    });

    it('refuses a wrong code_verifier', async () => {
      const cookie = await signUp(auth, 'adult2@example.com', ADULT_YEAR);
      const { challenge } = await pkcePair();
      const code = await obtainCode(auth, cookie, challenge);
      const response = await token(
        auth,
        { grant_type: 'authorization_code', code, code_verifier: 'x'.repeat(43), redirect_uri: ALEXA_REDIRECT, resource: RESOURCE },
        basic('alexa', ALEXA_SECRET),
      );
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    });

    it('refuses the plain challenge method and a missing challenge', async () => {
      const cookie = await signUp(auth, 'adult3@example.com', ADULT_YEAR);
      const plain = await authorize(auth, cookie, alexaAuthorizeParams('a'.repeat(43), { code_challenge_method: 'plain' }));
      expect(plain.status).toBe(302);
      const plainLocation = new URL(plain.headers.get('location') ?? '');
      expect(plainLocation.origin + plainLocation.pathname).toBe(ALEXA_REDIRECT);
      expect(plainLocation.searchParams.get('error')).toBe('invalid_request');

      const params = alexaAuthorizeParams('unused');
      delete (params as Partial<Record<string, string>>).code_challenge;
      delete (params as Partial<Record<string, string>>).code_challenge_method;
      const missing = await authorize(auth, cookie, params);
      expect(new URL(missing.headers.get('location') ?? '').searchParams.get('error')).toBe('invalid_request');
    });

    it('refuses a missing or foreign resource at authorize, and a changed resource at the token endpoint', async () => {
      const cookie = await signUp(auth, 'adult4@example.com', ADULT_YEAR);
      const { verifier, challenge } = await pkcePair();
      for (const resource of ['', 'https://evil.test/mcp']) {
        const response = await authorize(auth, cookie, alexaAuthorizeParams(challenge, { resource }));
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: 'invalid_target' });
      }
      const code = await obtainCode(auth, cookie, challenge);
      const response = await token(
        auth,
        { grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: ALEXA_REDIRECT, resource: 'https://evil.test/mcp' },
        basic('alexa', ALEXA_SECRET),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: 'invalid_target' });
    });

    it('refuses an unknown client and an unregistered redirect_uri without redirecting to them', async () => {
      const cookie = await signUp(auth, 'adult5@example.com', ADULT_YEAR);
      const { challenge } = await pkcePair();
      for (const overrides of [{ client_id: 'stranger' }, { redirect_uri: 'https://evil.test/cb' }] as Record<string, string>[]) {
        const response = await authorize(auth, cookie, alexaAuthorizeParams(challenge, overrides));
        const location = response.headers.get('location') ?? '';
        expect(location.startsWith('https://evil.test')).toBe(false);
        expect(location.startsWith(ALEXA_REDIRECT)).toBe(false);
      }
    });

    it('lets the public simulator client link with PKCE and no secret', async () => {
      const cookie = await signUp(auth, 'sim@example.com', ADULT_YEAR);
      const { verifier, challenge } = await pkcePair();
      const first = await authorize(auth, cookie, alexaAuthorizeParams(challenge, { client_id: 'nyc-mon-sim', redirect_uri: SIM_REDIRECT }));
      const consentUrl = new URL(first.headers.get('location') ?? '', ORIGIN);
      const consent = await auth.handler(
        new Request(`${BASE}/oauth2/consent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie, origin: ORIGIN },
          body: JSON.stringify({ accept: true, oauth_query: consentUrl.search.slice(1) }),
        }),
      );
      const code = new URL(((await consent.json()) as { url: string }).url).searchParams.get('code') ?? '';
      const response = await token(auth, {
        grant_type: 'authorization_code',
        client_id: 'nyc-mon-sim',
        code,
        code_verifier: verifier,
        redirect_uri: SIM_REDIRECT,
        resource: RESOURCE,
      });
      expect(response.status).toBe(200);
    });
  });

  describe('18+ gate', () => {
    it('sends an under-18 account to the refusal page instead of consent', async () => {
      const cookie = await signUp(auth, 'teen@example.com', MINOR_YEAR);
      const { challenge } = await pkcePair();
      const response = await authorize(auth, cookie, alexaAuthorizeParams(challenge));
      expect(response.status).toBe(302);
      expect(new URL(response.headers.get('location') ?? '', ORIGIN).pathname).toBe(OAUTH_PAGES.refused);
    });

    it('refuses consent for an under-18 account even with a signed query', async () => {
      const adultCookie = await signUp(auth, 'parent@example.com', ADULT_YEAR);
      const { challenge } = await pkcePair();
      const first = await authorize(auth, adultCookie, alexaAuthorizeParams(challenge));
      const consentUrl = new URL(first.headers.get('location') ?? '', ORIGIN);
      const teenCookie = await signUp(auth, 'teen2@example.com', MINOR_YEAR);
      const consent = await auth.handler(
        new Request(`${BASE}/oauth2/consent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie: teenCookie, origin: ORIGIN },
          body: JSON.stringify({ accept: true, oauth_query: consentUrl.search.slice(1) }),
        }),
      );
      expect(consent.status).toBe(403);
      expect(await consent.json()).toMatchObject({ error: 'access_denied' });
    });

    it('refuses token issuance once the account no longer passes the rule', async () => {
      const cookie = await signUp(auth, 'later@example.com', ADULT_YEAR);
      const { verifier, challenge } = await pkcePair();
      const code = await obtainCode(auth, cookie, challenge);
      const row = db.user?.find((user) => user.email === 'later@example.com');
      if (row === undefined) throw new Error('user row missing');
      row.birthYear = MINOR_YEAR;
      const response = await token(
        auth,
        { grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: ALEXA_REDIRECT, resource: RESOURCE },
        basic('alexa', ALEXA_SECRET),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: 'invalid_grant' });
    });
  });
});

describe('token endpoint rate limit', () => {
  it("is covered by Better Auth's limiter through the provider's /oauth2/token rule (20 per 60 s)", async () => {
    const auth = betterAuth({
      baseURL: ORIGIN,
      basePath: '/payload-api/auth',
      secret: SECRET,
      database: memoryAdapter(emptyDb()),
      emailAndPassword: { enabled: true },
      rateLimit: { enabled: true, storage: 'memory' },
      user: {
        additionalFields: {
          birthYear: { type: 'number', required: false, input: true },
          consentStatus: { type: 'string', required: false, input: false },
        },
      },
      plugins: alexaOAuthPlugins(CONFIG, () => NOW),
    });
    await auth.$context;
    const statuses: number[] = [];
    for (let i = 0; i < 21; i += 1) {
      const response = await token(auth, { grant_type: 'client_credentials', scope: 'mcp:service', resource: RESOURCE }, basic('alexa', 'wrong'));
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 20).every((status) => status === 401)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});

describe('linking page data', () => {
  it('is served only for a query the provider signed', async () => {
    const { auth } = makeAuth();
    await auth.$context;
    const cookie = await signUp(auth, 'pages@example.com', ADULT_YEAR);
    const { challenge } = await pkcePair();
    const first = await authorize(auth, cookie, alexaAuthorizeParams(challenge));
    const consentUrl = new URL(first.headers.get('location') ?? '', ORIGIN);
    const options = { config: CONFIG, secret: SECRET };

    expect(await loadLinkPage('consent', consentUrl.search, options)).toEqual({
      kind: 'consent',
      clientName: 'Alexa',
      scopes: ['mcp:caller', 'mcp:care', 'offline_access'],
    });
    expect(await loadLinkPage('sign-in', consentUrl.search, options)).toEqual({ kind: 'sign-in', clientName: 'Alexa' });

    const forged = new URL(consentUrl);
    forged.searchParams.set('redirect_uri', 'https://evil.test/cb');
    expect(await loadLinkPage('consent', forged.search, options)).toEqual({ kind: 'expired' });
    expect(await loadLinkPage('sign-in', forged.search, options)).toEqual({ kind: 'expired' });
    expect(await loadLinkPage('refused', forged.search, options)).toEqual({ kind: 'refused', clientName: undefined, backHref: undefined });
    expect(await loadLinkPage('consent', '', options)).toEqual({ kind: 'expired' });
  });

  it('gives a refused account a way back to the app with access_denied', async () => {
    const { auth } = makeAuth();
    await auth.$context;
    const cookie = await signUp(auth, 'teen-page@example.com', MINOR_YEAR);
    const { challenge } = await pkcePair();
    const response = await authorize(auth, cookie, alexaAuthorizeParams(challenge));
    const refusedUrl = new URL(response.headers.get('location') ?? '', ORIGIN);
    const data = await loadLinkPage('refused', refusedUrl.search, { config: CONFIG, secret: SECRET });
    if (data.kind !== 'refused' || data.backHref === undefined) throw new Error('expected a refusal with a way back');
    const back = new URL(data.backHref);
    expect(back.origin + back.pathname).toBe(ALEXA_REDIRECT);
    expect(back.searchParams.get('error')).toBe('access_denied');
    expect(back.searchParams.get('state')).toBe('state-123');
  });
});

describe('linkRefusal', () => {
  it('reads birthYear and consentStatus from the user row', () => {
    expect(linkRefusal({ birthYear: 2007, consentStatus: 'not-required' }, NOW)).toBe(undefined);
    expect(linkRefusal({ birthYear: 2008 }, NOW)).toBe('under-18');
    expect(linkRefusal({ birthYear: 1990, consentStatus: 'approved' }, NOW)).toBe('guardian-account');
    expect(linkRefusal({}, NOW)).toBe('no-birth-year');
    expect(linkRefusal(null, NOW)).toBe('no-birth-year');
  });
});

describe('guard helpers', () => {
  it('checkResource requires the exact MCP URI', () => {
    expect(checkResource(RESOURCE, RESOURCE, true)).toBe(undefined);
    expect(checkResource(undefined, RESOURCE, true)).toBe('invalid_target');
    expect(checkResource(undefined, RESOURCE, false)).toBe(undefined);
    expect(checkResource([RESOURCE, 'https://other.test'], RESOURCE, true)).toBe('invalid_target');
    expect(checkResource(`${RESOURCE}/`, RESOURCE, true)).toBe('invalid_target');
    expect(checkResource(RESOURCE, undefined, true)).toBe('server_error');
  });

  it('withOfflineAccess adds offline_access to user requests only', () => {
    expect(withOfflineAccess('mcp:caller')).toBe('mcp:caller offline_access');
    expect(withOfflineAccess('mcp:caller offline_access')).toBe('mcp:caller offline_access');
    expect(withOfflineAccess('mcp:service')).toBe('mcp:service');
  });
});

describe('readOAuthConfig', () => {
  it('registers alexa only with a long enough secret and https redirect URIs, and warns otherwise', () => {
    const warn = vi.fn();
    expect(readOAuthConfig({ OAUTH_ALEXA_REDIRECT_URIS: ALEXA_REDIRECT }, warn).clients).toEqual([]);
    expect(warn).toHaveBeenLastCalledWith(expect.stringContaining('OAUTH_ALEXA_CLIENT_SECRET is not'));
    expect(readOAuthConfig({ OAUTH_ALEXA_CLIENT_SECRET: 'short', OAUTH_ALEXA_REDIRECT_URIS: ALEXA_REDIRECT }, warn).clients).toEqual([]);
    expect(warn).toHaveBeenLastCalledWith(expect.stringContaining('shorter than 32'));
    expect(readOAuthConfig({ OAUTH_ALEXA_CLIENT_SECRET: ALEXA_SECRET }, warn).clients).toEqual([]);
    expect(warn).toHaveBeenLastCalledWith(expect.stringContaining('REDIRECT_URIS is empty'));
    warn.mockClear();
    expect(readOAuthConfig({ OAUTH_ALEXA_CLIENT_SECRET: ALEXA_SECRET, OAUTH_ALEXA_REDIRECT_URIS: ALEXA_REDIRECT }, warn).clients).toHaveLength(1);
    expect(warn).not.toHaveBeenCalled();
    expect(() => readOAuthConfig({ OAUTH_ALEXA_CLIENT_SECRET: 's', OAUTH_ALEXA_REDIRECT_URIS: 'http://amazon.test/cb' })).toThrow(/https/);
    expect(() => readOAuthConfig({ OAUTH_SIM_REDIRECT_URIS: 'https://sim.test/cb#frag' })).toThrow(/fragment/);
  });

  it('takes the issuer origin from AUTH_ISSUER, then BETTER_AUTH_URL', () => {
    expect(readOAuthConfig({ BETTER_AUTH_URL: 'https://admin.test/some/path' }).issuer).toBe('https://admin.test');
    expect(readOAuthConfig({ AUTH_ISSUER: 'https://auth.test', BETTER_AUTH_URL: 'https://admin.test' }).issuer).toBe('https://auth.test');
  });
});
