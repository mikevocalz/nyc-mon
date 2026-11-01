import { OAuthError } from '@modelcontextprotocol/client';
import { describe, expect, it, vi } from 'vitest';
import { SimOAuthProvider, type KeyValueStore } from '../src/shared/auth.ts';
import { AuthExpiredError, createAuthorize, REFRESH_WINDOW_MS, sdkRefresh } from '../src/client/freshToken.ts';
import { httpModelClient, ModelAuthExpiredError } from '../src/client/modelClient.ts';

const MCP = 'http://localhost:8788/mcp';
const ISSUER = 'http://localhost:3000/api/auth';

function memory(): KeyValueStore {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

/**
 * A fake MCP resource + authorization server: protected-resource metadata,
 * authorization-server metadata, and a token endpoint that answers the
 * refresh grant. `grant` decides the token endpoint's answer.
 */
function fakeServers(grant: (body: URLSearchParams) => Response) {
  const tokenCalls: URLSearchParams[] = [];
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    if (url.pathname.startsWith('/.well-known/oauth-protected-resource')) {
      return Response.json({ resource: MCP, authorization_servers: [ISSUER], scopes_supported: ['mcp:caller', 'mcp:care', 'offline_access'] });
    }
    if (url.pathname.startsWith('/.well-known/oauth-authorization-server') || url.pathname.startsWith('/.well-known/openid-configuration')) {
      return Response.json({
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/oauth2/authorize`,
        token_endpoint: `${ISSUER}/oauth2/token`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        token_endpoint_auth_methods_supported: ['none'],
        code_challenge_methods_supported: ['S256'],
      });
    }
    if (url.pathname === '/api/auth/oauth2/token') {
      const body = new URLSearchParams(String(init?.body ?? ''));
      tokenCalls.push(body);
      return grant(body);
    }
    return new Response('not found', { status: 404 });
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, tokenCalls };
}

function signedIn(now: number, expiresInS: number, refresh = 'refresh-1') {
  let clock = now;
  const provider = new SimOAuthProvider({ clientId: 'sim-client', store: memory(), redirectUrl: 'http://localhost:5180/oauth/callback', navigate: () => {}, now: () => clock });
  provider.saveTokens({ access_token: 'access-1', token_type: 'Bearer', expires_in: expiresInS, refresh_token: refresh });
  return { provider, advance: (ms: number) => (clock += ms), now: () => clock };
}

const issued = (n: number) => Response.json({ access_token: `access-${n}`, token_type: 'Bearer', expires_in: 3600, refresh_token: `refresh-${n}` });

describe('createAuthorize', () => {
  it('an expired token is refreshed through the token endpoint and the request retried once', async () => {
    const t0 = 1_000_000;
    const { provider, advance, now } = signedIn(t0, 3600);
    let n = 1;
    const servers = fakeServers((body) => {
      expect(body.get('grant_type')).toBe('refresh_token');
      // Rotated: each refresh spends the refresh token the last one issued.
      expect(body.get('refresh_token')).toBe(`refresh-${n}`);
      expect(body.get('client_id')).toBe('sim-client');
      expect(body.get('resource')).toBe(MCP);
      return issued(++n);
    });
    const authorize = createAuthorize({ store: provider, refresh: sdkRefresh(MCP, provider, servers.fetchFn), now });
    // The server rejects the first token (it lapsed early); the retry carries the refreshed one.
    const seen: (string | undefined)[] = [];
    const res = await authorize(async (token) => {
      seen.push(token);
      return new Response(null, { status: token === 'access-1' ? 401 : 200 });
    });
    expect(res.status).toBe(200);
    expect(seen).toEqual(['access-1', 'access-2']);
    expect(provider.tokens()?.access_token).toBe('access-2');
    expect(provider.tokens()?.refresh_token).toBe('refresh-2');
    // A token within a minute of expiry is refreshed before the request leaves.
    advance(3600_000 - REFRESH_WINDOW_MS / 2);
    const before: (string | undefined)[] = [];
    await authorize(async (token) => {
      before.push(token);
      return new Response(null, { status: 200 });
    });
    expect(before).toEqual(['access-3']);
    expect(servers.tokenCalls).toHaveLength(2);
  });

  it('a refused refresh (invalid_grant) signs out; a network failure does not', async () => {
    const t0 = 1_000_000;
    const { provider, now } = signedIn(t0, 30);
    const onSignedOut = vi.fn();
    const servers = fakeServers(() => Response.json({ error: 'invalid_grant', error_description: 'refresh token revoked' }, { status: 400 }));
    const authorize = createAuthorize({ store: provider, refresh: sdkRefresh(MCP, provider, servers.fetchFn), now, onSignedOut });
    await expect(authorize(async () => new Response(null, { status: 200 }))).rejects.toBeInstanceOf(AuthExpiredError);
    expect(onSignedOut).toHaveBeenCalledOnce();
    expect(provider.tokens()).toBeUndefined();

    const second = signedIn(t0, 30);
    const offline = createAuthorize({ store: second.provider, refresh: async () => Promise.reject(new TypeError('Failed to fetch')), now: second.now, onSignedOut });
    await expect(offline(async () => new Response(null, { status: 200 }))).rejects.toBeInstanceOf(TypeError);
    expect(second.provider.tokens()?.refresh_token).toBe('refresh-1');
    expect(onSignedOut).toHaveBeenCalledOnce();
  });

  it('parallel requests (TTS prefetches) share one refresh', async () => {
    const { provider, now } = signedIn(1_000_000, 10);
    let n = 1;
    const servers = fakeServers(() => issued(++n));
    const authorize = createAuthorize({ store: provider, refresh: sdkRefresh(MCP, provider, servers.fetchFn), now });
    const tokens = await Promise.all(
      [1, 2, 3, 4].map(() =>
        authorize(async (token) => new Response(token ?? '', { status: 200 })).then((r) => r.text()),
      ),
    );
    expect(tokens).toEqual(['access-2', 'access-2', 'access-2', 'access-2']);
    expect(servers.tokenCalls).toHaveLength(1);
  });

  it('signed out or dev-bypass: no token, no refresh', async () => {
    const provider = new SimOAuthProvider({ clientId: 'c', store: memory(), redirectUrl: 'http://x/cb', navigate: () => {} });
    const refresh = vi.fn();
    const authorize = createAuthorize({ store: provider, refresh });
    const seen: (string | undefined)[] = [];
    await authorize(async (t) => {
      seen.push(t);
      return new Response(null, { status: 401 });
    });
    expect(seen).toEqual([undefined]);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('/api/model with a refreshing token', () => {
  const turn = { messages: [{ role: 'user' as const, content: 'hi' }], tools: [] };

  it('a 401 refreshes and the turn goes through; only a refused refresh asks for a new sign-in', async () => {
    const { provider, now } = signedIn(1_000_000, 3600);
    let n = 1;
    const servers = fakeServers(() => issued(++n));
    const authorize = createAuthorize({ store: provider, refresh: sdkRefresh(MCP, provider, servers.fetchFn), now });
    const sse = `data: ${JSON.stringify({ type: 'text', delta: 'Yo.' })}\n\ndata: ${JSON.stringify({ type: 'message', message: { id: 'm', type: 'message', role: 'assistant', model: 'x', content: [{ type: 'text', text: 'Yo.' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } })}\n\n`;
    const api = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get('authorization');
      return auth === 'Bearer access-1' ? new Response('{"error":"Sign in again to keep talking."}', { status: 401 }) : new Response(sse, { status: 200 });
    }) as typeof fetch;
    const deltas: string[] = [];
    await httpModelClient('/api/model', api, authorize).streamTurn(turn, (d) => deltas.push(d));
    expect(deltas.join('')).toBe('Yo.');

    const refused = signedIn(1_000_000, 3600);
    const bad = fakeServers(() => Response.json({ error: 'invalid_grant' }, { status: 400 }));
    const denied = createAuthorize({ store: refused.provider, refresh: sdkRefresh(MCP, refused.provider, bad.fetchFn), now: refused.now });
    await expect(httpModelClient('/api/model', api, denied).streamTurn(turn, () => {})).rejects.toBeInstanceOf(ModelAuthExpiredError);
  });
});

describe('two refreshers', () => {
  it('when the MCP SDK spent the refresh token first, the refused refresh uses its new pair instead of signing out', async () => {
    const { provider, now } = signedIn(1_000_000, 10);
    const onSignedOut = vi.fn();
    const authorize = createAuthorize({
      store: provider,
      refresh: async () => {
        // The SDK's own refresh lands while ours is in flight.
        provider.saveTokens({ access_token: 'access-sdk', token_type: 'Bearer', expires_in: 3600, refresh_token: 'refresh-sdk' });
        throw new OAuthError('invalid_grant', 'refresh token already used');
      },
      now,
      onSignedOut,
    });
    const res = await authorize(async (token) => new Response(token ?? '', { status: 200 }));
    expect(await res.text()).toBe('access-sdk');
    expect(onSignedOut).not.toHaveBeenCalled();
  });
});
