// Server half of the Alexa+ linking pages (ADR 0016). @better-auth/oauth-provider
// redirects to /oauth/sign-in, /oauth/consent and /oauth/refused with a signed
// copy of the authorization request (`oauth_query`). This module checks that
// signature with the provider's own `verifyOAuthQueryParams` and returns the
// little each page shows. It runs only on the server (admin-vite calls it from
// a server function); the React pages in LinkPages.tsx render the result with
// the kit. Sign-in, consent and the 18+ checks all run in Better Auth
// (plugins.ts, guards.ts), never here.
import { oauthProviderAuthServerMetadata, verifyOAuthQueryParams } from '@better-auth/oauth-provider';
import { readAuthEnv } from '../env';
import type { OAuthServerConfig, StaticClient } from './config';
import { readOAuthConfig, SERVICE_SCOPE, USER_SCOPES } from './config';
import { OAUTH_PAGES } from './plugins';

/** Which linking page is being rendered. */
export type LinkPageKind = 'sign-in' | 'consent' | 'refused';

/** What a linking page renders. `expired` covers a missing, forged or expired `oauth_query`. */
export type LinkPageData =
  | { kind: 'expired' }
  | { kind: 'sign-in'; clientName: string; clientKind: StaticClient['kind']; amazonEnabled: boolean; passwordResetEnabled: boolean }
  | { kind: 'consent'; clientName: string; clientKind: StaticClient['kind']; scopes: string[] }
  | { kind: 'refused'; clientName: string | undefined; backHref: string | undefined };

export { LINK_PAGE_HEADERS } from './link-page-headers';

export interface LinkPageOptions {
  config: OAuthServerConfig;
  /** Better Auth's secret; the provider signs `oauth_query` with it. Defaults to BETTER_AUTH_SECRET. */
  secret?: string | undefined;
  /** Lets tests or alternate hosts override whether Login with Amazon is available. */
  amazonEnabled?: boolean | undefined;
  /**
   * Whether "Forgot password?" can work: Better Auth only gets
   * `sendResetPassword` when a mail sender is configured (auth/options.ts).
   * Defaults to RESEND_API_KEY and AUTH_EMAIL_FROM both being set.
   */
  passwordResetEnabled?: boolean | undefined;
}

function mailConfigured(): boolean {
  const env = readAuthEnv();
  return env.resendApiKey !== undefined && env.emailFrom !== undefined;
}

/** Returns the signed query, or `undefined` when it is missing, forged or expired. */
async function signedQuery(search: string, secret: string | undefined): Promise<URLSearchParams | undefined> {
  if (secret === undefined) return undefined;
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (raw === '' || !(await verifyOAuthQueryParams(raw, secret))) return undefined;
  return new URLSearchParams(raw);
}

function findClient(config: OAuthServerConfig, clientId: string | null): StaticClient | undefined {
  return config.clients.find((client) => client.clientId === clientId);
}

/** The link back to the app with `access_denied`, on the redirect URI the provider already validated. */
function refusalHref(query: URLSearchParams, issuer: string): string | undefined {
  const redirectUri = query.get('redirect_uri');
  if (redirectUri === null) return undefined;
  const url = new URL(redirectUri);
  url.searchParams.set('error', 'access_denied');
  url.searchParams.set('error_description', 'Linking NYC-MON is for adults only.');
  const state = query.get('state');
  if (state !== null) url.searchParams.set('state', state);
  url.searchParams.set('iss', issuer);
  return url.toString();
}

/**
 * Checks the raw query string the provider redirected with and returns the
 * page's data. Pass the request's own `search` (not a re-serialized one): the
 * signature covers the exact parameters.
 */
export async function loadLinkPage(kind: LinkPageKind, search: string, options: LinkPageOptions): Promise<LinkPageData> {
  const secret = options.secret ?? readAuthEnv().secret;
  const query = await signedQuery(search, secret);
  if (query === undefined) {
    // The refusal page still says why, even without a way back.
    return kind === 'refused' ? { kind, clientName: undefined, backHref: undefined } : { kind: 'expired' };
  }
  const client = findClient(options.config, query.get('client_id'));
  const clientName = client?.name ?? 'Alexa';
  const clientKind = client?.kind ?? 'alexa';
  switch (kind) {
    case 'sign-in':
      return {
        kind,
        clientName,
        clientKind,
        amazonEnabled: options.amazonEnabled ?? readAuthEnv().amazon !== undefined,
        passwordResetEnabled: options.passwordResetEnabled ?? mailConfigured(),
      };
    case 'consent':
      return { kind, clientName, clientKind, scopes: (query.get('scope') ?? '').split(' ').filter((scope) => scope !== '') };
    case 'refused':
      return { kind, clientName: client?.name, backHref: refusalHref(query, options.config.issuer) };
  }
}

/** Path of each page, so admin-vite's routes and the provider config share one list. */
export const OAUTH_PAGE_PATHS = OAUTH_PAGES;

/**
 * `/.well-known/oauth-authorization-server` at the origin root (RFC 8414 for
 * an issuer with no path; Amazon reads it there). The provider builds the
 * document; this only serves it outside Better Auth's base path.
 *
 * The document is public, so any origin may read it. A browser MCP client
 * sends `MCP-Protocol-Version` with the GET, which makes the browser send a
 * preflight `OPTIONS` first; that answers 204 here instead of reaching the app.
 */
const JWT_ALGS = ['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512', 'EdDSA'];
const CLIENT_AUTH_METHODS = ['client_secret_basic', 'client_secret_post', 'private_key_jwt'];

function fallbackAuthServerMetadata(auth: Parameters<typeof oauthProviderAuthServerMetadata>[0]): Record<string, unknown> {
  const config = readOAuthConfig();
  const issuer = (auth.options?.baseURL ?? config.issuer).replace(/\/+$/, '');
  const base = `${issuer}${auth.options?.basePath ?? '/api/auth'}`;
  const scopes = [SERVICE_SCOPE, ...USER_SCOPES, 'offline_access'];
  return {
    scopes_supported: scopes,
    issuer,
    authorization_endpoint: `${base}/oauth2/authorize`,
    token_endpoint: `${base}/oauth2/token`,
    jwks_uri: `${base}/jwks`,
    introspection_endpoint: `${base}/oauth2/introspect`,
    revocation_endpoint: `${base}/oauth2/revoke`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'client_credentials', 'refresh_token'],
    token_endpoint_auth_methods_supported: CLIENT_AUTH_METHODS,
    token_endpoint_auth_signing_alg_values_supported: JWT_ALGS,
    introspection_endpoint_auth_methods_supported: CLIENT_AUTH_METHODS,
    introspection_endpoint_auth_signing_alg_values_supported: JWT_ALGS,
    revocation_endpoint_auth_methods_supported: CLIENT_AUTH_METHODS,
    revocation_endpoint_auth_signing_alg_values_supported: JWT_ALGS,
    code_challenge_methods_supported: ['S256'],
    authorization_response_iss_parameter_supported: true,
    dpop_signing_alg_values_supported: ['EdDSA', 'ES256', 'ES512', 'PS256', 'RS256'],
    backchannel_logout_supported: true,
    backchannel_logout_session_supported: true,
  };
}

export function createAuthServerMetadataHandler(auth: Parameters<typeof oauthProviderAuthServerMetadata>[0]) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'OPTIONS') {
      // On the bundled runtime the api invoker answers a serialized
      // {headers, response} envelope instead of the document; when that shape
      // (no `issuer`) comes back, serve the same RFC 8414 document built from
      // the server config rather than forwarding the envelope.
      const primary = (await auth.api.getOAuthServerConfig()) as Record<string, unknown> | undefined;
      const body = primary?.issuer ? primary : fallbackAuthServerMetadata(auth);
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      });
    }
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'mcp-protocol-version, accept, content-type',
        'Access-Control-Max-Age': '600',
      },
    });
  };
}
