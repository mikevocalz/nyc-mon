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
import type { OAuthServerConfig } from './config';
import { OAUTH_PAGES } from './plugins';

/** Which linking page is being rendered. */
export type LinkPageKind = 'sign-in' | 'consent' | 'refused';

/** What a linking page renders. `expired` covers a missing, forged or expired `oauth_query`. */
export type LinkPageData =
  | { kind: 'expired' }
  | { kind: 'sign-in'; clientName: string }
  | { kind: 'consent'; clientName: string; scopes: string[] }
  | { kind: 'refused'; clientName: string | undefined; backHref: string | undefined };

export { LINK_PAGE_HEADERS } from './link-page-headers';

export interface LinkPageOptions {
  config: OAuthServerConfig;
  /** Better Auth's secret; the provider signs `oauth_query` with it. Defaults to BETTER_AUTH_SECRET. */
  secret?: string | undefined;
}

/** Returns the signed query, or `undefined` when it is missing, forged or expired. */
async function signedQuery(search: string, secret: string | undefined): Promise<URLSearchParams | undefined> {
  if (secret === undefined) return undefined;
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (raw === '' || !(await verifyOAuthQueryParams(raw, secret))) return undefined;
  return new URLSearchParams(raw);
}

function clientName(config: OAuthServerConfig, clientId: string | null): string | undefined {
  return config.clients.find((client) => client.clientId === clientId)?.name;
}

/** The link back to the app with `access_denied`, on the redirect URI the provider already validated. */
function refusalHref(query: URLSearchParams, issuer: string): string | undefined {
  const redirectUri = query.get('redirect_uri');
  if (redirectUri === null) return undefined;
  const url = new URL(redirectUri);
  url.searchParams.set('error', 'access_denied');
  url.searchParams.set('error_description', 'NYC-MON on Alexa is for adults only.');
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
  const name = clientName(options.config, query.get('client_id'));
  switch (kind) {
    case 'sign-in':
      return { kind, clientName: name ?? 'Alexa' };
    case 'consent':
      return { kind, clientName: name ?? 'Alexa', scopes: (query.get('scope') ?? '').split(' ').filter((scope) => scope !== '') };
    case 'refused':
      return { kind, clientName: name, backHref: refusalHref(query, options.config.issuer) };
  }
}

/** Path of each page, so admin-vite's routes and the provider config share one list. */
export const OAUTH_PAGE_PATHS = OAUTH_PAGES;

/**
 * `GET /.well-known/oauth-authorization-server` at the origin root (RFC 8414
 * for an issuer with no path; Amazon reads it there). The provider builds the
 * document; this only serves it outside Better Auth's base path.
 */
export function createAuthServerMetadataHandler(auth: Parameters<typeof oauthProviderAuthServerMetadata>[0]) {
  return oauthProviderAuthServerMetadata(auth, { headers: { 'Access-Control-Allow-Origin': '*' } });
}
