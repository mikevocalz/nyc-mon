import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import { SERVICE_SCOPE, USER_SCOPES } from './prm.ts';

/**
 * Access-token validation against the authorization server (lane B's issuer
 * on admin-vite). The MCP server only verifies; it never mints or forwards
 * tokens (MCP 2025-11-25 authorization: no token passthrough).
 *
 * Contract the issuer must meet, for either implementation:
 * - `aud` contains the exact MCP resource URL (`…/mcp`).
 * - `iss` equals AUTH_ISSUER.
 * - `scope` is a space-separated string (or `scp` an array).
 * - client_credentials tokens carry `mcp:service` only (`sub` = client id).
 * - authorization_code tokens carry `mcp:caller` and/or `mcp:care`, with
 *   `sub` = the Better Auth user id.
 * - Optional `birth_year` (integer) lets the server refuse a minor before any
 *   `/v1` call; `/v1` enforces the 18+ rule from the Users record regardless.
 */
export type VerifiedToken =
  | {
      readonly kind: 'service';
      readonly clientId: string;
      readonly scopes: readonly string[];
      /** Epoch seconds. */
      readonly expiresAt: number;
    }
  | {
      readonly kind: 'user';
      readonly clientId: string;
      readonly callerId: string;
      readonly scopes: readonly string[];
      readonly expiresAt: number;
      readonly birthYear: number | undefined;
    };

/** Thrown for any token that must be answered with 401. The message is for logs only. */
export class InvalidTokenError extends Error {
  override readonly name = 'InvalidTokenError';
}

/** Validates one bearer token. Implementations throw {@link InvalidTokenError} on any failure. */
export interface TokenVerifier {
  verify(token: string): Promise<VerifiedToken>;
}

function readScopes(claims: Record<string, unknown>): string[] {
  if (typeof claims.scope === 'string') return claims.scope.split(' ').filter((s) => s !== '');
  if (Array.isArray(claims.scp)) return claims.scp.filter((s): s is string => typeof s === 'string');
  return [];
}

function readAudiences(aud: unknown): string[] {
  if (typeof aud === 'string') return [aud];
  if (Array.isArray(aud)) return aud.filter((a): a is string => typeof a === 'string');
  return [];
}

/**
 * Maps validated claims (JWT payload or RFC 7662 response) to a
 * {@link VerifiedToken}. Audience and issuer are checked by the caller.
 */
export function tokenFromClaims(
  claims: Record<string, unknown>,
  nowSeconds: number,
  options: { readonly maxAgeSecondsWithoutExp?: number } = {},
): VerifiedToken {
  const exp = expiryOf(claims, nowSeconds, options.maxAgeSecondsWithoutExp);
  if (exp <= nowSeconds) throw new InvalidTokenError('token expired');
  const scopes = readScopes(claims);
  const clientId =
    typeof claims.client_id === 'string' ? claims.client_id : typeof claims.azp === 'string' ? claims.azp : '';
  if (USER_SCOPES.some((scope) => scopes.includes(scope))) {
    const sub = claims.sub;
    if (typeof sub !== 'string' || sub === '') throw new InvalidTokenError('user token has no sub');
    const birthYear = typeof claims.birth_year === 'number' && Number.isInteger(claims.birth_year) ? claims.birth_year : undefined;
    return { kind: 'user', clientId, callerId: sub, scopes, expiresAt: exp, birthYear };
  }
  if (scopes.includes(SERVICE_SCOPE)) {
    return { kind: 'service', clientId, scopes, expiresAt: exp };
  }
  throw new InvalidTokenError('token carries no MCP scope');
}

/**
 * The token's expiry in epoch seconds. A JWT must carry `exp`. RFC 7662 makes
 * `exp` optional in an introspection answer; then the token counts for
 * `maxAgeSecondsWithoutExp` from its `iat` (or from now when `iat` is absent
 * too, which is safe because introspection re-checks it on every request).
 */
function expiryOf(claims: Record<string, unknown>, nowSeconds: number, maxAgeSecondsWithoutExp: number | undefined): number {
  if (typeof claims.exp === 'number') return claims.exp;
  if (maxAgeSecondsWithoutExp === undefined) throw new InvalidTokenError('token has no exp');
  const issuedAt = typeof claims.iat === 'number' ? claims.iat : nowSeconds;
  return issuedAt + maxAgeSecondsWithoutExp;
}

export interface JwtVerifierOptions {
  readonly issuer: string;
  /** The exact MCP resource URL; must appear in `aud`. */
  readonly audience: string;
  /** Remote JWKS URL, or a key resolver (tests pass a local key set). */
  readonly jwks: string | JWTVerifyGetKey;
}

/** Verifies JWT access tokens against the issuer's JWKS (the default). */
export function createJwtVerifier(options: JwtVerifierOptions): TokenVerifier {
  const keys: JWTVerifyGetKey =
    typeof options.jwks === 'string' ? createRemoteJWKSet(new URL(options.jwks), { timeoutDuration: 2_000 }) : options.jwks;
  return {
    async verify(token) {
      let payload: JWTPayload;
      try {
        ({ payload } = await jwtVerify(token, keys, {
          issuer: options.issuer,
          audience: options.audience,
          algorithms: ['RS256', 'ES256', 'EdDSA', 'PS256'],
          requiredClaims: ['exp'],
        }));
      } catch (error) {
        throw new InvalidTokenError(error instanceof Error ? error.message : 'jwt verification failed');
      }
      return tokenFromClaims(payload, Math.floor(Date.now() / 1000));
    },
  };
}

export interface IntrospectionVerifierOptions {
  readonly url: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly issuer: string;
  readonly audience: string;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
  /**
   * How long an active token without `exp` counts, from its `iat`.
   * @default 3600 (Amazon's recommended access-token lifetime)
   */
  readonly maxAgeSecondsWithoutExp?: number;
}

/** RFC 7662 §2.2 response. Only `active` is required; unknown members pass through. */
const IntrospectionResponseSchema = z.looseObject({
  active: z.boolean(),
  scope: z.string().optional(),
  client_id: z.string().optional(),
  sub: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  iss: z.string().optional(),
  exp: z.number().int().optional(),
  iat: z.number().int().optional(),
  birth_year: z.number().int().optional(),
});

/** Verifies opaque tokens with RFC 7662 introspection (HTTP Basic client auth). */
export function createIntrospectionVerifier(options: IntrospectionVerifierOptions): TokenVerifier {
  const doFetch = options.fetch ?? fetch;
  const basic = Buffer.from(
    `${encodeURIComponent(options.clientId)}:${encodeURIComponent(options.clientSecret)}`,
  ).toString('base64');
  return {
    async verify(token) {
      let claims: z.infer<typeof IntrospectionResponseSchema>;
      try {
        const response = await doFetch(options.url, {
          method: 'POST',
          headers: {
            authorization: `Basic ${basic}`,
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
          },
          body: new URLSearchParams({ token, token_type_hint: 'access_token' }).toString(),
          signal: AbortSignal.timeout(options.timeoutMs ?? 2_000),
        });
        if (!response.ok) throw new InvalidTokenError(`introspection answered ${response.status}`);
        const parsed = IntrospectionResponseSchema.safeParse(await response.json());
        if (!parsed.success) throw new InvalidTokenError(`introspection response malformed: ${parsed.error.message}`);
        claims = parsed.data;
      } catch (error) {
        if (error instanceof InvalidTokenError) throw error;
        throw new InvalidTokenError(error instanceof Error ? error.message : 'introspection failed');
      }
      if (!claims.active) throw new InvalidTokenError('token inactive');
      if (claims.iss !== undefined && claims.iss !== options.issuer) throw new InvalidTokenError('wrong issuer');
      if (!readAudiences(claims.aud).includes(options.audience)) throw new InvalidTokenError('wrong audience');
      return tokenFromClaims(claims, Math.floor(Date.now() / 1000), {
        maxAgeSecondsWithoutExp: options.maxAgeSecondsWithoutExp ?? 3_600,
      });
    },
  };
}
