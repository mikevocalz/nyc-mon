// OAuth authorization server settings for Alexa+ account linking (ADR 0016).
// Read from the environment; .env.example lists the names. Nothing here logs
// or returns a secret value.

/** Alexa's machine-to-machine scope for `initialize` and `tools/list`. client_credentials only. */
export const SERVICE_SCOPE = 'mcp:service';

/** Scopes a linked Caller grants. authorization_code only (ADR 0006 §5). */
export const USER_SCOPES = ['mcp:caller', 'mcp:care'] as const;

/**
 * The plugin issues a refresh token only when `offline_access` is in the
 * granted scopes (`createUserTokens` in @better-auth/oauth-provider 1.7.7,
 * dist/introspect-*.mjs). Amazon needs one with every access token, so the
 * authorize guard adds it (guards.ts).
 */
export const OFFLINE_ACCESS_SCOPE = 'offline_access';

/** Every scope the provider knows. No `openid`: the server is OAuth only, never OIDC. */
export const ALL_SCOPES = [SERVICE_SCOPE, ...USER_SCOPES, OFFLINE_ACCESS_SCOPE] as const;

export type ClientGrantType = 'authorization_code' | 'refresh_token' | 'client_credentials';

/** One statically registered client. Amazon supports no dynamic registration. */
export interface StaticClient {
  clientId: string;
  /** Shown on the consent page. */
  name: string;
  /** Absent for a public client: PKCE only, no client_credentials. */
  clientSecret: string | undefined;
  /** Exact-match list; the runtime `redirect_uri` must equal one entry. */
  redirectUris: readonly string[];
  grantTypes: readonly ClientGrantType[];
}

export interface OAuthServerConfig {
  /** RFC 8414 issuer and the `iss` of every access token; an origin, no path. */
  issuer: string;
  /** Canonical MCP server URI (RFC 8707 `resource`); tokens carry it as `aud`. */
  resource: string | undefined;
  clients: readonly StaticClient[];
}

export const DEFAULT_ALEXA_CLIENT_ID = 'alexa';

/** Shortest Alexa client secret accepted; Amazon's token call authenticates with it alone. */
export const MIN_CLIENT_SECRET_LENGTH = 32;
export const DEFAULT_SIM_CLIENT_ID = 'nyc-mon-sim';

function clean(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value.trim();
}

function list(raw: string | undefined): string[] {
  const value = clean(raw);
  if (value === undefined) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * https everywhere, plain http on loopback only, no fragment.
 *
 * @throws {Error} naming the env var when an entry fails.
 */
export function assertRedirectUri(uri: string, name: string): void {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error(`${name} contains a value that is not a URL.`);
  }
  if (parsed.hash !== '') throw new Error(`${name} entries must not carry a fragment.`);
  const loopbackHttp = parsed.protocol === 'http:' && LOOPBACK_HOSTS.has(parsed.hostname);
  if (parsed.protocol !== 'https:' && !loopbackHttp) {
    throw new Error(`${name} entries must use https (http is allowed on localhost only).`);
  }
}

function originOf(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

/**
 * Builds the server settings. `alexa` registers only when its redirect URIs
 * are set and its secret is at least 32 characters: Amazon's token request
 * always uses HTTP Basic. Any half-configured alexa client is skipped with a
 * warning (logged once, when auth/options.ts reads the config at boot).
 * `nyc-mon-sim` registers when its redirect URIs are set; without a secret
 * it is a public client.
 *
 * @throws {Error} when a redirect URI is malformed or not https, or the two client ids collide.
 */
export function readOAuthConfig(
  env: Record<string, string | undefined> = process.env,
  warn: (message: string) => void = (message) => console.warn(`[auth] ${message}`),
): OAuthServerConfig {
  const issuer = originOf(clean(env.AUTH_ISSUER)) ?? originOf(clean(env.BETTER_AUTH_URL)) ?? 'http://localhost:5174';
  const clients: StaticClient[] = [];

  const alexaSecret = clean(env.OAUTH_ALEXA_CLIENT_SECRET);
  const alexaRedirects = list(env.OAUTH_ALEXA_REDIRECT_URIS);
  for (const uri of alexaRedirects) assertRedirectUri(uri, 'OAUTH_ALEXA_REDIRECT_URIS');
  if (alexaRedirects.length > 0 && alexaSecret === undefined) {
    warn('OAUTH_ALEXA_REDIRECT_URIS is set but OAUTH_ALEXA_CLIENT_SECRET is not; the alexa client is not registered and Alexa+ linking will fail.');
  } else if (alexaSecret !== undefined && alexaSecret.length < MIN_CLIENT_SECRET_LENGTH) {
    warn(`OAUTH_ALEXA_CLIENT_SECRET is shorter than ${MIN_CLIENT_SECRET_LENGTH} characters; the alexa client is not registered.`);
  } else if (alexaSecret !== undefined && alexaRedirects.length === 0) {
    warn('OAUTH_ALEXA_CLIENT_SECRET is set but OAUTH_ALEXA_REDIRECT_URIS is empty; the alexa client is not registered.');
  }
  if (alexaSecret !== undefined && alexaSecret.length >= MIN_CLIENT_SECRET_LENGTH && alexaRedirects.length > 0) {
    clients.push({
      clientId: clean(env.OAUTH_ALEXA_CLIENT_ID) ?? DEFAULT_ALEXA_CLIENT_ID,
      name: 'Alexa',
      clientSecret: alexaSecret,
      redirectUris: alexaRedirects,
      grantTypes: ['authorization_code', 'refresh_token', 'client_credentials'],
    });
  }

  const simSecret = clean(env.OAUTH_SIM_CLIENT_SECRET);
  const simRedirects = list(env.OAUTH_SIM_REDIRECT_URIS);
  for (const uri of simRedirects) assertRedirectUri(uri, 'OAUTH_SIM_REDIRECT_URIS');
  if (simRedirects.length > 0) {
    clients.push({
      clientId: clean(env.OAUTH_SIM_CLIENT_ID) ?? DEFAULT_SIM_CLIENT_ID,
      name: 'NYC-MON simulator',
      clientSecret: simSecret,
      redirectUris: simRedirects,
      grantTypes:
        simSecret === undefined
          ? ['authorization_code', 'refresh_token']
          : ['authorization_code', 'refresh_token', 'client_credentials'],
    });
  }

  const ids = clients.map((client) => client.clientId);
  if (new Set(ids).size !== ids.length) throw new Error('OAUTH_ALEXA_CLIENT_ID and OAUTH_SIM_CLIENT_ID must differ.');

  return { issuer, resource: clean(env.MCP_RESOURCE_URI), clients };
}
