import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import { authenticateRequest, decideAccess } from '../auth/request-auth.ts';
import { createJwtVerifier } from '../auth/verifier.ts';

const ISSUER = 'https://admin.nyc-mon.test';
const AUDIENCE = 'https://mcp.nyc-mon.test/mcp';
/** The authorization server's user access-token lifetime (packages/payload auth/oauth/plugins.ts). */
const USER_TOKEN_TTL_S = 600;

async function setup() {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'k1', alg: 'ES256' }] });
  const verifier = createJwtVerifier({ issuer: ISSUER, audience: AUDIENCE, jwks });
  const issueAt = (iatS: number) =>
    new SignJWT({ sub: 'caller-1', client_id: 'nyc-mon-sim', scope: 'mcp:caller mcp:care offline_access', birth_year: 1990 })
      .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(iatS)
      .setExpirationTime(iatS + USER_TOKEN_TTL_S)
      .sign(privateKey);
  return { verifier, issueAt };
}

const toolCall = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_mon_status', arguments: {} } };

describe('a 10-minute user access token at the MCP server (Gate 4)', () => {
  it('is accepted while fresh and gets 401 once it is older than 10 minutes', async () => {
    const { verifier, issueAt } = await setup();
    const nowS = Math.floor(Date.now() / 1000);
    const fresh = await issueAt(nowS - 60);
    expect(decideAccess(await authenticateRequest(`Bearer ${fresh}`, verifier), toolCall)).toBe('allow');

    const lapsed = await issueAt(nowS - USER_TOKEN_TTL_S - 1);
    expect(decideAccess(await authenticateRequest(`Bearer ${lapsed}`, verifier), toolCall)).toBe(401);
  });

  it('a token minted just before sign-out stops working within 10 minutes with no network check', async () => {
    const { verifier, issueAt } = await setup();
    const signOutS = Math.floor(Date.now() / 1000);
    const token = await issueAt(signOutS);
    vi.useFakeTimers();
    try {
      vi.setSystemTime((signOutS + USER_TOKEN_TTL_S + 1) * 1000);
      expect(decideAccess(await authenticateRequest(`Bearer ${token}`, verifier), toolCall)).toBe(401);
    } finally {
      vi.useRealTimers();
    }
  });
});
