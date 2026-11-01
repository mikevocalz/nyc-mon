import { describe, expect, it } from 'vitest';
import { revokeRefreshToken } from '../src/shared/auth.ts';
import { loadNvidiaEnv, nvidiaPublicConfig } from '../server/nvidia-env.ts';

// Gate 4 on the hosted companion: after "Sign out" the page forgot its tokens,
// but the refresh token it had held still minted new access tokens for 90 days.
// Sign-out now revokes it at the authorization server (RFC 7009).
const ISSUER = 'https://auth.example';
const META = `${ISSUER}/.well-known/oauth-authorization-server`;
const REVOKE = `${ISSUER}/payload-api/auth/oauth2/revoke`;

function fakeFetch(routes: Record<string, () => Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const route = routes[url];
    if (!route) throw new TypeError('network down');
    return route();
  };
  return { calls, fetch: fetch as typeof globalThis.fetch };
}

describe('revokeRefreshToken', () => {
  it('posts the refresh token to the revocation endpoint the issuer advertises', async () => {
    const f = fakeFetch({
      [META]: () => Response.json({ issuer: ISSUER, revocation_endpoint: REVOKE }),
      [REVOKE]: () => new Response(null, { status: 200 }),
    });
    expect(await revokeRefreshToken({ issuer: ISSUER, clientId: 'nyc-mon-sim', refreshToken: 'rt-1', fetch: f.fetch })).toBe('revoked');
    const post = f.calls.find((c) => c.url === REVOKE)!;
    expect(post.init?.method).toBe('POST');
    expect(new URLSearchParams(String(post.init?.body))).toEqual(
      new URLSearchParams({ token: 'rt-1', token_type_hint: 'refresh_token', client_id: 'nyc-mon-sim' }),
    );
  });

  it('does nothing without a refresh token', async () => {
    const f = fakeFetch({});
    expect(await revokeRefreshToken({ issuer: ISSUER, clientId: 'nyc-mon-sim', refreshToken: undefined, fetch: f.fetch })).toBe('none');
    expect(f.calls).toHaveLength(0);
  });

  it('never sends the token to a revocation endpoint on another origin', async () => {
    const f = fakeFetch({ [META]: () => Response.json({ issuer: ISSUER, revocation_endpoint: 'https://evil.example/revoke' }) });
    expect(await revokeRefreshToken({ issuer: ISSUER, clientId: 'nyc-mon-sim', refreshToken: 'rt-1', fetch: f.fetch })).toBe('failed');
    expect(f.calls.map((c) => c.url)).toEqual([META]);
  });

  it('reports failure instead of throwing when the server is down or refuses', async () => {
    expect(await revokeRefreshToken({ issuer: ISSUER, clientId: 'c', refreshToken: 'rt', fetch: fakeFetch({}).fetch })).toBe('failed');
    const refused = fakeFetch({
      [META]: () => Response.json({ revocation_endpoint: REVOKE }),
      [REVOKE]: () => new Response('{"error":"invalid_client"}', { status: 401 }),
    });
    expect(await revokeRefreshToken({ issuer: ISSUER, clientId: 'c', refreshToken: 'rt', fetch: refused.fetch })).toBe('failed');
  });
});

describe('companion public config', () => {
  it('names the issuer so sign-out can find the revocation endpoint', () => {
    const env = loadNvidiaEnv({ NODE_ENV: 'test', NEBIUS_API_KEY: 'k', AUTH_ISSUER: 'https://auth.example/', SIM_MCP_URL: 'https://mcp.example/mcp',
      V1_BASE_URL: 'https://auth.example', V1_MCP_SERVICE_KEY: 's'.repeat(40) });
    expect(nvidiaPublicConfig(env).issuer).toBe('https://auth.example');
  });
});

describe('simulator public config', () => {
  it('names the issuer too, for the same sign-out', async () => {
    const { loadSimEnv, publicConfig } = await import('../server/env.ts');
    expect(publicConfig(loadSimEnv({ AUTH_ISSUER: 'https://auth.example/' })).issuer).toBe('https://auth.example');
  });
});
