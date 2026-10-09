import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import { authenticateRequest, decideAccess, isAdultByBirthYear } from '../auth/request-auth.ts';
import { createIntrospectionVerifier, createJwtVerifier, InvalidTokenError } from '../auth/verifier.ts';
import { listenHostFor, loadEnv } from '../env.ts';

const ISSUER = 'https://admin.nyc-mon.test';
const AUDIENCE = 'https://mcp.nyc-mon.test/mcp';

async function keys() {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'ES256' };
  return { privateKey, jwks: createLocalJWKSet({ keys: [jwk] }) };
}

async function sign(privateKey: CryptoKey, claims: Record<string, unknown>, aud = AUDIENCE, iss = ISSUER) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
    .setIssuer(iss)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(privateKey);
}

describe('JWT verifier', () => {
  it('maps an authorization-code token to a user', async () => {
    const { privateKey, jwks } = await keys();
    const verifier = createJwtVerifier({ issuer: ISSUER, audience: AUDIENCE, jwks });
    const token = await sign(privateKey, { sub: 'user-1', scope: 'mcp:caller mcp:care', client_id: 'alexa', birth_year: 1990 });
    expect(await verifier.verify(token)).toMatchObject({ kind: 'user', callerId: 'user-1', birthYear: 1990, clientId: 'alexa' });
  });

  it('maps a client_credentials token to a service token', async () => {
    const { privateKey, jwks } = await keys();
    const verifier = createJwtVerifier({ issuer: ISSUER, audience: AUDIENCE, jwks });
    const token = await sign(privateKey, { sub: 'alexa', scope: 'mcp:service', client_id: 'alexa' });
    expect(await verifier.verify(token)).toMatchObject({ kind: 'service', clientId: 'alexa' });
  });

  it('rejects a token minted for another audience, issuer, or with no MCP scope', async () => {
    const { privateKey, jwks } = await keys();
    const verifier = createJwtVerifier({ issuer: ISSUER, audience: AUDIENCE, jwks });
    await expect(verifier.verify(await sign(privateKey, { sub: 'u', scope: 'mcp:caller mcp:care' }, 'https://mcp.nyc-mon.test'))).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
    await expect(verifier.verify(await sign(privateKey, { sub: 'u', scope: 'mcp:caller mcp:care' }, AUDIENCE, 'https://evil'))).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
    await expect(verifier.verify(await sign(privateKey, { sub: 'u', scope: 'openid' }))).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('rejects a token signed by another key', async () => {
    const { jwks } = await keys();
    const other = await keys();
    const verifier = createJwtVerifier({ issuer: ISSUER, audience: AUDIENCE, jwks });
    await expect(verifier.verify(await sign(other.privateKey, { sub: 'u', scope: 'mcp:caller mcp:care' }))).rejects.toBeInstanceOf(InvalidTokenError);
  });
});

describe('introspection verifier', () => {
  const base = { url: 'https://admin.test/introspect', clientId: 'mcp', clientSecret: 'secret', issuer: ISSUER, audience: AUDIENCE };

  it('accepts an active token for this audience, using HTTP Basic client auth', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ active: true, iss: ISSUER, aud: AUDIENCE, sub: 'user-1', scope: 'mcp:caller mcp:care', exp: Math.floor(Date.now() / 1000) + 60 }),
    );
    const verifier = createIntrospectionVerifier({ ...base, fetch: fetchImpl as unknown as typeof fetch });
    expect(await verifier.verify('opaque')).toMatchObject({ kind: 'user', callerId: 'user-1' });
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(new Headers(init.headers).get('authorization')).toBe(`Basic ${Buffer.from('mcp:secret').toString('base64')}`);
  });

  it('accepts an active token without exp, bounded by the max age from iat', async () => {
    const now = Math.floor(Date.now() / 1000);
    const answer = (iat?: number) => (async () =>
      Response.json({ active: true, iss: ISSUER, aud: [AUDIENCE], sub: 'user-1', scope: 'mcp:caller', ...(iat === undefined ? {} : { iat }) })) as typeof fetch;
    const fresh = createIntrospectionVerifier({ ...base, fetch: answer(now - 60), maxAgeSecondsWithoutExp: 600 });
    expect(await fresh.verify('t')).toMatchObject({ kind: 'user', callerId: 'user-1', expiresAt: now + 540 });
    const noIat = createIntrospectionVerifier({ ...base, fetch: answer() });
    expect((await noIat.verify('t')).expiresAt).toBeGreaterThanOrEqual(now + 3_600);
    const stale = createIntrospectionVerifier({ ...base, fetch: answer(now - 700), maxAgeSecondsWithoutExp: 600 });
    await expect(stale.verify('t')).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('rejects a malformed introspection response instead of trusting it', async () => {
    const malformed = createIntrospectionVerifier({
      ...base,
      fetch: (async () => Response.json({ active: 'yes', aud: AUDIENCE, sub: 'u', scope: 'mcp:caller' })) as typeof fetch,
    });
    await expect(malformed.verify('t')).rejects.toThrow(/malformed/);
  });

  it('still requires exp on a JWT', async () => {
    const { privateKey, jwks } = await keys();
    const verifier = createJwtVerifier({ issuer: ISSUER, audience: AUDIENCE, jwks });
    const noExp = await new SignJWT({ sub: 'u', scope: 'mcp:caller' })
      .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .sign(privateKey);
    await expect(verifier.verify(noExp)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('rejects inactive tokens and other audiences', async () => {
    const inactive = createIntrospectionVerifier({ ...base, fetch: (async () => Response.json({ active: false })) as typeof fetch });
    await expect(inactive.verify('t')).rejects.toBeInstanceOf(InvalidTokenError);
    const wrongAud = createIntrospectionVerifier({
      ...base,
      fetch: (async () =>
        Response.json({ active: true, aud: 'https://other/mcp', sub: 'u', scope: 'mcp:caller mcp:care', exp: Math.floor(Date.now() / 1000) + 60 })) as typeof fetch,
    });
    await expect(wrongAud.verify('t')).rejects.toBeInstanceOf(InvalidTokenError);
  });
});

describe('request auth', () => {
  const verifier = { verify: async () => ({ kind: 'service' as const, clientId: 'a', scopes: ['mcp:service'], expiresAt: 0 }) };

  it('reads only a Bearer header', async () => {
    expect(await authenticateRequest(undefined, verifier)).toEqual({ kind: 'none' });
    expect(await authenticateRequest('Basic abc', verifier)).toEqual({ kind: 'invalid' });
    expect((await authenticateRequest('Bearer abc', verifier)).kind).toBe('service');
  });

  it('allows a service token discovery and notifications but not tools/call, even inside a batch', () => {
    const service = { kind: 'service' as const, clientId: 'a', scopes: ['mcp:service'], expiresAt: 0 };
    expect(decideAccess(service, { method: 'initialize' })).toBe('allow');
    expect(decideAccess(service, { method: 'notifications/initialized' })).toBe('allow');
    expect(decideAccess(service, { method: 'resources/read' })).toBe('allow');
    expect(decideAccess(service, { method: 'tools/call' })).toBe(401);
    expect(decideAccess(service, [{ method: 'tools/list' }, { method: 'tools/call' }])).toBe(401);
  });

  it('needs mcp:care for care tools and mcp:caller for every other tool', () => {
    const user = (scopes: string[]) => ({ kind: 'user' as const, clientId: 'a', callerId: 'u', scopes, expiresAt: 0, birthYear: 1990 });
    const call = (name: string) => ({ method: 'tools/call', params: { name } });
    expect(decideAccess(user(['mcp:caller']), call('get_mon_status'))).toBe('allow');
    expect(decideAccess(user(['mcp:caller']), call('feed_mon'))).toBe(403);
    expect(decideAccess(user(['mcp:care']), call('play_with_mon'))).toBe('allow');
    expect(decideAccess(user(['mcp:care']), call('check_incubation'))).toBe(403);
    expect(decideAccess({ kind: 'none' }, { method: 'initialize' })).toBe(401);
  });

  it('judges 18+ from a birth year, erring toward under 18', () => {
    const now = Date.UTC(2026, 9, 8);
    expect(isAdultByBirthYear(2008, now)).toBe(false);
    expect(isAdultByBirthYear(2007, now)).toBe(true);
  });
});

describe('env', () => {
  it('refuses OAUTH_DEV_BYPASS unless NODE_ENV is explicitly development or test', () => {
    expect(() => loadEnv({ NODE_ENV: 'production', OAUTH_DEV_BYPASS: '1' })).toThrow(/NODE_ENV set to development or test/);
    expect(() => loadEnv({ NODE_ENV: 'staging', OAUTH_DEV_BYPASS: '1' })).toThrow(/NODE_ENV set to development or test/);
    expect(() => loadEnv({ OAUTH_DEV_BYPASS: '1' })).toThrow(/NODE_ENV set to development or test/);
    expect(loadEnv({ NODE_ENV: 'test', OAUTH_DEV_BYPASS: '1' }).OAUTH_DEV_BYPASS).toBe('1');
  });

  it('refuses OAUTH_DEV_BYPASS when MCP_RESOURCE_URI is not loopback', () => {
    const dev = { NODE_ENV: 'development', OAUTH_DEV_BYPASS: '1' };
    expect(() => loadEnv({ ...dev, MCP_RESOURCE_URI: 'https://mcp.nyc-mon.app/mcp' })).toThrow(/loopback MCP_RESOURCE_URI/);
    expect(() => loadEnv({ ...dev, MCP_RESOURCE_URI: 'http://192.168.1.20:8788/mcp' })).toThrow(/loopback MCP_RESOURCE_URI/);
    for (const uri of ['http://localhost:8788/mcp', 'http://127.0.0.1:8788/mcp', 'http://[::1]:8788/mcp']) {
      expect(loadEnv({ ...dev, MCP_RESOURCE_URI: uri }).MCP_RESOURCE_URI).toBe(uri);
    }
  });

  it('binds the listener to 127.0.0.1 under the bypass and to all interfaces otherwise', () => {
    expect(listenHostFor({ OAUTH_DEV_BYPASS: '1' })).toBe('127.0.0.1');
    expect(listenHostFor({ OAUTH_DEV_BYPASS: '0' })).toBeUndefined();
  });

  it('allows the bypass in development with no auth server config', () => {
    expect(loadEnv({ NODE_ENV: 'development', OAUTH_DEV_BYPASS: '1' }).OAUTH_DEV_BYPASS).toBe('1');
  });

  it('needs a JWKS URL and a /v1 service key when tokens are verified', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(/AUTH_JWKS_URL/);
    expect(() => loadEnv({ NODE_ENV: 'production', AUTH_JWKS_URL: 'https://a.test/jwks' })).toThrow(/V1_MCP_SERVICE_KEY/);
    const env = loadEnv({ NODE_ENV: 'production', AUTH_JWKS_URL: 'https://a.test/jwks', V1_MCP_SERVICE_KEY: 'k'.repeat(32) });
    expect(env.MCP_RESOURCE_URI).toBe('http://localhost:8788/mcp');
  });
});
