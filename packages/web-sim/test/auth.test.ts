import { describe, expect, it } from 'vitest';
import { SimOAuthProvider, parseCallback, resolveAuthState, userScopes, type KeyValueStore } from '../src/shared/auth.ts';
import { jwksUrl, loadSimEnv, publicConfig } from '../server/env.ts';

function store(): KeyValueStore & { dump(): Record<string, string> } {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

function provider(s = store(), now = () => 1_000_000) {
  const navigated: URL[] = [];
  const p = new SimOAuthProvider({
    clientId: 'nyc-mon-sim',
    store: s,
    redirectUrl: 'http://localhost:5180/oauth/callback',
    navigate: (u) => navigated.push(u),
    randomState: () => 'state-abc',
    now,
  });
  return { p, s, navigated };
}

describe('SimOAuthProvider', () => {
  it('is the static public client nyc-mon-sim with PKCE and no secret', () => {
    const { p } = provider();
    expect(p.clientInformation()).toEqual({ client_id: 'nyc-mon-sim' });
    expect(p.clientMetadata.token_endpoint_auth_method).toBe('none');
    expect(p.clientMetadata.redirect_uris).toEqual(['http://localhost:5180/oauth/callback']);
    expect(p.clientMetadata.grant_types).toContain('refresh_token');
  });

  it('stores tokens and the PKCE verifier, and clears them on sign-out', () => {
    const { p, s } = provider();
    p.saveCodeVerifier('verifier-1');
    p.saveTokens({ access_token: 'at', token_type: 'Bearer', expires_in: 3600, refresh_token: 'rt' } as never);
    expect(p.codeVerifier()).toBe('verifier-1');
    expect(p.tokens()).toMatchObject({ access_token: 'at' });
    expect(p.expiresAt()).toBe(1_000_000 + 3_600_000);
    p.signOut();
    expect(s.dump()).toEqual({});
    expect(() => p.codeVerifier()).toThrow(/Start it again/);
  });

  it('accepts the returned state exactly once', () => {
    const { p } = provider();
    expect(p.state()).toBe('state-abc');
    expect(p.consumeState('wrong')).toBe(false);
    p.state();
    expect(p.consumeState('state-abc')).toBe(true);
    expect(p.consumeState('state-abc')).toBe(false);
  });

  it('sends the browser to the authorization URL', () => {
    const { p, navigated } = provider();
    p.redirectToAuthorization(new URL('https://admin.example/oauth/authorize?client_id=nyc-mon-sim'));
    expect(navigated[0]?.href).toContain('client_id=nyc-mon-sim');
  });

  it('survives corrupt stored tokens', () => {
    const s = store();
    s.setItem('nyc-mon-sim.oauth.tokens', '{oops');
    const { p } = provider(s);
    expect(p.tokens()).toBeUndefined();
  });
});

describe('userScopes', () => {
  it('drops the client-credentials-only service scope', () => {
    expect(userScopes(['mcp:service', 'mcp:caller', 'mcp:care'])).toBe('mcp:caller mcp:care');
    expect(userScopes(['mcp:service'])).toBeUndefined();
    expect(userScopes(undefined)).toBeUndefined();
  });
});

describe('resolveAuthState', () => {
  it('dev-bypass needs no tokens', () => {
    expect(resolveAuthState('dev-bypass', provider().p)).toEqual({ kind: 'dev-bypass' });
  });
  it('signed out without tokens', () => {
    expect(resolveAuthState('oauth', provider().p)).toEqual({ kind: 'signed-out' });
  });
  it('signed in with a live token', () => {
    const { p } = provider();
    p.saveTokens({ access_token: 'at', token_type: 'Bearer', expires_in: 60 } as never);
    expect(resolveAuthState('oauth', p, 1_000_000 + 1000)).toEqual({ kind: 'signed-in', expiresAt: 1_060_000 });
  });
  it('an expired token with no refresh token means signed out, and is dropped', () => {
    const { p } = provider();
    p.saveTokens({ access_token: 'at', token_type: 'Bearer', expires_in: 60 } as never);
    expect(resolveAuthState('oauth', p, 1_000_000 + 61_000)).toEqual({ kind: 'signed-out' });
    expect(p.tokens()).toBeUndefined();
  });
  it('an expired token with a refresh token stays signed in for the SDK to refresh', () => {
    const { p } = provider();
    p.saveTokens({ access_token: 'at', token_type: 'Bearer', expires_in: 60, refresh_token: 'rt' } as never);
    expect(resolveAuthState('oauth', p, 1_000_000 + 61_000).kind).toBe('signed-in');
  });
});

describe('parseCallback', () => {
  it('reads code, state and iss', () => {
    expect(parseCallback('?code=c1&state=s1&iss=https%3A%2F%2Fadmin.example')).toEqual({
      ok: true,
      code: 'c1',
      state: 's1',
      iss: 'https://admin.example',
    });
  });
  it('explains a cancelled sign-in and other errors', () => {
    expect(parseCallback('?error=access_denied')).toEqual({ ok: false, message: expect.stringMatching(/cancelled/) });
    expect(parseCallback('?error=server_error&error_description=down')).toEqual({ ok: false, message: expect.stringContaining('down') });
    expect(parseCallback('')).toEqual({ ok: false, message: expect.stringMatching(/without a code/) });
  });
});

describe('server env', () => {
  it('defaults to OAuth; dev-bypass is an explicit flag', () => {
    expect(loadSimEnv({}).SIM_AUTH_MODE).toBe('oauth');
    expect(loadSimEnv({ SIM_AUTH_MODE: 'dev-bypass', NODE_ENV: 'development' }).SIM_AUTH_MODE).toBe('dev-bypass');
    expect(() => loadSimEnv({ SIM_AUTH_MODE: 'yes' })).toThrow();
  });
  it('allows dev-bypass only when NODE_ENV is development or test', () => {
    expect(loadSimEnv({ SIM_AUTH_MODE: 'dev-bypass', NODE_ENV: 'test' }).SIM_AUTH_MODE).toBe('dev-bypass');
    expect(() => loadSimEnv({ SIM_AUTH_MODE: 'dev-bypass', NODE_ENV: 'production' })).toThrow(/development or test/);
    expect(() => loadSimEnv({ SIM_AUTH_MODE: 'dev-bypass' })).toThrow(/development or test/);
    expect(() => loadSimEnv({ SIM_AUTH_MODE: 'dev-bypass', NODE_ENV: 'staging' })).toThrow(/development or test/);
  });
  it('refuses a sandbox on the same origin as the page', () => {
    expect(() => loadSimEnv({ SIM_SANDBOX_ORIGIN: 'http://localhost:5180' })).toThrow(/different origin/);
  });
  it('tells the browser nothing secret, and the client id from one variable', () => {
    const cfg = publicConfig(loadSimEnv({ AWS_REGION: 'us-east-1', SIM_SKILL_PATH: 'x', OAUTH_SIM_CLIENT_ID: 'sim-staging' }));
    expect(Object.keys(cfg).sort()).toEqual(['authMode', 'clientId', 'devMode', 'mcpUrl', 'modelBackend', 'modelLabel', 'sandboxOrigin']);
    expect(cfg.clientId).toBe('sim-staging');
    expect(publicConfig(loadSimEnv({})).clientId).toBe('nyc-mon-sim');
  });
  it('derives the JWKS URL from the issuer unless set', () => {
    expect(jwksUrl(loadSimEnv({ AUTH_ISSUER: 'https://admin.example/' }))).toBe('https://admin.example/payload-api/auth/jwks');
    expect(jwksUrl(loadSimEnv({ AUTH_JWKS_URL: 'https://keys.example/jwks' }))).toBe('https://keys.example/jwks');
  });
});
