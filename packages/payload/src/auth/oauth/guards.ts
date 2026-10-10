// Request checks that @better-auth/oauth-provider 1.7.7 leaves to the host
// (ADR 0016). They run as Better Auth `hooks.before` on the plugin's own
// endpoints, so the provider still does every protocol step itself.
//
// 1. `resource` is required on /oauth2/authorize and on the token endpoint's
//    authorization_code and client_credentials grants, and must equal
//    MCP_RESOURCE_URI. Without it the provider issues an opaque token with no
//    `aud` (`resolveResourcePolicy`), which the MCP server cannot verify
//    against the JWKS.
// 2. `offline_access` is added to a user authorization request, because the
//    provider issues a refresh token only for that scope and Amazon requires
//    one with every access token (PLATFORM-DOCS §2.5).
// 3. Client credentials never ride in the query string (PLATFORM-DOCS §2.4).
// 4. An account that fails the 18+ rule cannot accept consent or continue
//    the flow. The postLogin redirect (plugins.ts) sends it to the refusal
//    page first; token issuance refuses it again (`customAccessTokenClaims`).
import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { linkRefusal } from './adult';
import { OFFLINE_ACCESS_SCOPE, USER_SCOPES } from './config';

/** An RFC 6749 §5.2 error body; the provider's own errors use the same shape. */
function oauthError(status: 'BAD_REQUEST' | 'FORBIDDEN' | 'INTERNAL_SERVER_ERROR', error: string, description: string): APIError {
  return new APIError(status, { error, error_description: description });
}

function toList(value: unknown): string[] {
  if (typeof value === 'string') return value === '' ? [] : [value];
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string' && entry !== '');
  return [];
}

/**
 * Checks an RFC 8707 `resource` value. `required` is true where Amazon always
 * sends it (authorization request, code exchange, client credentials); a
 * refresh request carries none.
 *
 * @returns an OAuth error code, or `undefined` when the value is acceptable.
 */
export function checkResource(value: unknown, expected: string | undefined, required: boolean): 'invalid_target' | 'server_error' | undefined {
  if (expected === undefined) return 'server_error';
  const resources = toList(value);
  if (resources.length === 0) return required ? 'invalid_target' : undefined;
  return resources.length === 1 && resources[0] === expected ? undefined : 'invalid_target';
}

/** Appends `offline_access` to a scope string that asks for a user scope. */
export function withOfflineAccess(scope: string): string {
  const scopes = scope.split(' ').filter((entry) => entry !== '');
  const asksForUser = scopes.some((entry) => (USER_SCOPES as readonly string[]).includes(entry));
  if (!asksForUser || scopes.includes(OFFLINE_ACCESS_SCOPE)) return scopes.join(' ');
  return [...scopes, OFFLINE_ACCESS_SCOPE].join(' ');
}

function resourceError(code: 'invalid_target' | 'server_error'): APIError {
  return code === 'server_error'
    ? oauthError('INTERNAL_SERVER_ERROR', 'server_error', 'The MCP resource is not configured.')
    : oauthError('BAD_REQUEST', 'invalid_target', 'resource must be the NYC-MON MCP server URI.');
}

const CREDENTIAL_QUERY_PARAMS = ['client_secret', 'client_assertion', 'code', 'code_verifier', 'refresh_token'];

/** Builds the guard plugin for one MCP resource URI. */
export function oauthGuards(options: { resource: string | undefined; nowMs?: () => number }) {
  const now = options.nowMs ?? Date.now;
  return {
    id: 'nycmon-oauth-guards',
    hooks: {
      before: [
        {
          matcher: (ctx: { path?: string }) => ctx.path === '/oauth2/authorize',
          handler: createAuthMiddleware(async (ctx) => {
            const query = (ctx.query ?? {}) as Record<string, unknown>;
            const problem = checkResource(query.resource, options.resource, true);
            if (problem !== undefined) throw resourceError(problem);
            if (typeof query.scope !== 'string') return;
            return { context: { query: { ...query, scope: withOfflineAccess(query.scope) } } };
          }),
        },
        {
          matcher: (ctx: { path?: string }) => ctx.path === '/oauth2/token',
          handler: createAuthMiddleware(async (ctx) => {
            const search = ctx.request === undefined ? undefined : new URL(ctx.request.url).searchParams;
            if (search !== undefined && CREDENTIAL_QUERY_PARAMS.some((name) => search.has(name))) {
              throw oauthError('BAD_REQUEST', 'invalid_request', 'Send credentials in the request body or Authorization header, never the query string.');
            }
            const body = (ctx.body ?? {}) as Record<string, unknown>;
            const required = body.grant_type === 'authorization_code' || body.grant_type === 'client_credentials';
            const problem = checkResource(body.resource, options.resource, required);
            if (problem !== undefined) throw resourceError(problem);
          }),
        },
        {
          matcher: (ctx: { path?: string }) => ctx.path === '/oauth2/consent' || ctx.path === '/oauth2/continue',
          handler: createAuthMiddleware(async (ctx) => {
            const body = (ctx.body ?? {}) as Record<string, unknown>;
            if (ctx.path === '/oauth2/consent' && body.accept !== true) return;
            const session = await getSessionFromCtx(ctx);
            if (!session) return;
            const refusal = linkRefusal(session.user as unknown as Record<string, unknown>, now());
            if (refusal !== undefined) {
              throw oauthError('FORBIDDEN', 'access_denied', 'NYC-MON on Alexa is for adults (18+) only.');
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
