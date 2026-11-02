import { describe, expect, it, vi } from 'vitest';
import { SimOAuthProvider, type KeyValueStore } from '../src/shared/auth.ts';
import { createAuthorize, REFRESH_WINDOW_MS } from '../src/client/freshToken.ts';

/** The authorization server's user access-token lifetime (packages/payload auth/oauth/plugins.ts). */
const USER_TOKEN_TTL_S = 600;

function memory(): KeyValueStore {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

describe('the companion with 10-minute access tokens (Gate 4)', () => {
  it('refreshes before each token lapses, so a long session never sees a 401 or a sign-out', async () => {
    let clock = 1_000_000;
    const provider = new SimOAuthProvider({
      clientId: 'nyc-mon-sim',
      store: memory(),
      redirectUrl: 'http://localhost:5180/oauth/callback',
      navigate: () => {},
      now: () => clock,
    });
    provider.saveTokens({ access_token: 'access-1', token_type: 'Bearer', expires_in: USER_TOKEN_TTL_S, refresh_token: 'refresh-1' });
    let n = 1;
    const refresh = vi.fn(async (refreshToken: string) => {
      expect(refreshToken).toBe(`refresh-${n}`);
      n += 1;
      return { access_token: `access-${n}`, token_type: 'Bearer', expires_in: USER_TOKEN_TTL_S, refresh_token: `refresh-${n}` };
    });
    const authorize = createAuthorize({ store: provider, refresh, now: () => clock });
    // The MCP-side rule: a token is good for 600 s after it was issued.
    const issuedAt = new Map<string, number>([['access-1', clock]]);
    const statuses: number[] = [];
    // An hour of turns, one every 4 minutes.
    for (let turn = 0; turn < 15; turn += 1) {
      const res = await authorize(async (token) => {
        if (token !== undefined && !issuedAt.has(token)) issuedAt.set(token, clock);
        const age = token === undefined ? Infinity : clock - (issuedAt.get(token) ?? -Infinity);
        return new Response(null, { status: age < USER_TOKEN_TTL_S * 1000 ? 200 : 401 });
      });
      statuses.push(res.status);
      clock += 4 * 60_000;
    }
    expect(statuses.every((status) => status === 200)).toBe(true);
    // Each token covers three 4-minute turns, so the hour takes four silent refreshes.
    expect(refresh).toHaveBeenCalledTimes(4);
    expect(REFRESH_WINDOW_MS).toBeLessThan(USER_TOKEN_TTL_S * 1000);
  });
});
