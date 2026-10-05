import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { bearerChallenge } from './prm.ts';

/**
 * OAuth 2.1 + PKCE (S256) middleware skeleton (ADR 0006).
 *
 * The MCP server is the *protected resource*: it validates bearer tokens whose
 * subject is the Better Auth user id (callerId). The authorization server is
 * Better Auth on the admin-vite host — wiring that up needs its OIDC-provider
 * plugin, which is a packages/payload change and deliberately out of scope
 * here.
 *
 * What IS implemented: the PKCE S256 verifier (self-contained, testable),
 * the 401 + RFC 9728 challenge, and the auth-context seam every tool uses.
 */

/** Identity attached to a request after token validation. */
export interface AuthContext {
  readonly callerId: string;
  readonly scopes: readonly string[];
  /** Token expiry, epoch ms — the presence freshness checks key off "now". */
  readonly expiresAt: number;
}

export class UnauthorizedError extends Error {
  override readonly name = 'UnauthorizedError';
}

/**
 * RFC 7636 §4.6: verify code_verifier against a stored S256 challenge.
 * OAuth 2.1 forbids `plain` — this function is S256-only by construction.
 */
export function verifyPkceS256(codeVerifier: string, codeChallenge: string): boolean {
  const digest = createHash('sha256').update(codeVerifier, 'ascii').digest();
  const expected = Buffer.from(codeChallenge, 'base64url');
  return digest.length === expected.length && timingSafeEqual(digest, expected);
}

/**
 * TODO(auth-server): validate the bearer token against the authorization
 * server — either Better Auth OIDC-provider JWT verification (JWKS from the
 * admin-vite origin) or token introspection. Until then this accepts NOTHING;
 * the only way through locally is the dev bypass below.
 */
export async function verifyAccessToken(_token: string): Promise<AuthContext> {
  throw new UnauthorizedError('token validation not wired to the auth server yet');
}

/**
 * Dev bypass (ADR 0006 consequences): when OAUTH_DEV_BYPASS=1 — never default
 * in a deployed env — a fixed Caller context is injected so tool development
 * and the simulator work before account linking exists.
 */
export function devBypassContext(): AuthContext {
  return {
    callerId: 'dev-caller',
    scopes: ['mcp:care', 'mcp:caller'],
    expiresAt: Date.now() + 3_600_000,
  };
}

/**
 * Request-level gate for the /mcp endpoint. Returns the AuthContext or writes
 * the 401 + PRM challenge and returns null.
 */
export async function authenticate(
  req: IncomingMessage,
  res: ServerResponse,
  opts: { resourceOrigin: string; devBypass: boolean },
): Promise<AuthContext | null> {
  if (opts.devBypass) return devBypassContext();

  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
  if (token) {
    try {
      return await verifyAccessToken(token);
    } catch {
      // fall through to challenge
    }
  }

  res.writeHead(401, {
    'content-type': 'application/json',
    'www-authenticate': bearerChallenge(opts.resourceOrigin),
  });
  res.end(JSON.stringify({ error: 'unauthorized' }));
  return null;
}
