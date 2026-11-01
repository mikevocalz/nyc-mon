import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/**
 * The /api/model gate in OAuth mode: the request must carry the person's MCP
 * access token, verified the way the MCP server verifies it
 * (packages/mcp-server/src/auth/verifier.ts, docs/alexa/AUTH.md): signature
 * against the issuer's JWKS, `iss`, `aud` = the MCP resource, a live `exp`, a
 * user scope and a `sub`. It must also have been issued to this simulator's
 * client, so another client's token can't spend the simulator's model budget.
 */

/** User scopes, as the MCP server's PRM lists them (mcp:service is client-credentials only). */
export const USER_SCOPES: readonly string[] = ['mcp:caller', 'mcp:care'];

export class ModelAuthError extends Error {
  override readonly name = 'ModelAuthError';
}

export interface ModelAuthOptions {
  readonly issuer: string;
  /** The MCP resource URL: the token's audience. */
  readonly audience: string;
  readonly clientId: string;
  readonly jwks: string | JWTVerifyGetKey;
}

export type ModelAuthCheck = (authorization: string | null) => Promise<{ callerId: string }>;

function scopesOf(claims: Record<string, unknown>): string[] {
  if (typeof claims.scope === 'string') return claims.scope.split(' ').filter((s) => s !== '');
  if (Array.isArray(claims.scp)) return claims.scp.filter((s): s is string => typeof s === 'string');
  return [];
}

export function createModelAuth(options: ModelAuthOptions): ModelAuthCheck {
  const keys: JWTVerifyGetKey =
    typeof options.jwks === 'string' ? createRemoteJWKSet(new URL(options.jwks), { timeoutDuration: 2_000 }) : options.jwks;
  return async (authorization) => {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
    if (!token) throw new ModelAuthError('missing bearer token');
    let claims: Record<string, unknown>;
    try {
      ({ payload: claims } = await jwtVerify(token, keys, {
        issuer: options.issuer,
        audience: options.audience,
        algorithms: ['RS256', 'ES256', 'EdDSA', 'PS256'],
        requiredClaims: ['exp'],
      }));
    } catch (err) {
      throw new ModelAuthError(err instanceof Error ? err.message : 'token verification failed');
    }
    if (!scopesOf(claims).some((s) => USER_SCOPES.includes(s))) throw new ModelAuthError('token carries no user scope');
    const sub = claims.sub;
    if (typeof sub !== 'string' || sub === '') throw new ModelAuthError('token has no sub');
    const client = typeof claims.client_id === 'string' ? claims.client_id : typeof claims.azp === 'string' ? claims.azp : '';
    if (client !== options.clientId) throw new ModelAuthError('token was issued to another client');
    return { callerId: sub };
  };
}
