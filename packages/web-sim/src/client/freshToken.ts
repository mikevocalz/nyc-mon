import {
  discoverOAuthServerInfo,
  OAuthError,
  refreshAuthorization,
  resourceUrlFromServerUrl,
  type OAuthClientProvider,
  type OAuthTokens,
} from '@modelcontextprotocol/client';

/**
 * One way to call the simulator's own endpoints (/api/model, /api/tts,
 * /api/tts/face) with the person's MCP access token, refreshed when it is
 * about to lapse or has.
 *
 * The MCP SDK refreshes on MCP calls by itself, but these endpoints took the
 * raw access token from the provider. After the token's lifetime a /api/model
 * 401 signed the person out mid-turn although the stored tokens carried a
 * refresh token. Now a request whose token is within REFRESH_WINDOW_MS of
 * expiry refreshes first; a 401 refreshes and retries once; and only a
 * refresh the authorization server refuses (invalid_grant) signs out. One
 * refresh runs at a time, so parallel TTS prefetches share it.
 */

/** Refresh this long before `expires_in` runs out, so a request never leaves with a token that dies in flight. */
export const REFRESH_WINDOW_MS = 60_000;

/** The refresh token was refused: the person has to sign in again. */
export class AuthExpiredError extends Error {
  override readonly name = 'AuthExpiredError';
  constructor() {
    super('Your sign-in expired. Sign in again to keep talking.');
  }
}

export interface TokenStore {
  tokens(): (OAuthTokens & { readonly refresh_token?: string }) | undefined;
  saveTokens(tokens: OAuthTokens): void;
  /** Epoch ms the access token lapses, or null when unknown. */
  expiresAt(): number | null;
  invalidateCredentials(scope: 'tokens'): void;
  clientInformation: OAuthClientProvider['clientInformation'];
}

export type Refresh = (refreshToken: string) => Promise<OAuthTokens>;

/** Runs `call` with a usable token (undefined when signed out or in dev-bypass); see the module note. */
export type Authorize = (call: (token: string | undefined) => Promise<Response>) => Promise<Response>;

/** No sign-in (dev-bypass, tests): every call goes without a token. */
export const noAuthorize: Authorize = (call) => call(undefined);

/** The SDK's refresh grant against the MCP server's authorization server, with the same resource the sign-in used. */
export function sdkRefresh(serverUrl: string, store: TokenStore, fetchFn?: typeof fetch): Refresh {
  let info: ReturnType<typeof discoverOAuthServerInfo> | null = null;
  return async (refreshToken) => {
    info ??= discoverOAuthServerInfo(serverUrl, fetchFn ? { fetchFn } : undefined);
    let server;
    try {
      server = await info;
    } catch (err) {
      info = null; // discovery failed (offline): try again next time
      throw err;
    }
    const clientInformation = await store.clientInformation();
    if (!clientInformation) throw new OAuthError('invalid_client', 'No client registration for the simulator.');
    const resource = server.resourceMetadata?.resource ? new URL(server.resourceMetadata.resource) : resourceUrlFromServerUrl(serverUrl);
    return refreshAuthorization(server.authorizationServerUrl, {
      ...(server.authorizationServerMetadata ? { metadata: server.authorizationServerMetadata } : {}),
      clientInformation,
      refreshToken,
      resource,
      ...(fetchFn ? { fetchFn } : {}),
    });
  };
}

/** Errors that mean the grant is gone, not that the network blinked. */
function isRefused(err: unknown): boolean {
  return OAuthError.isInstance(err) && (err.code === 'invalid_grant' || err.code === 'invalid_client' || err.code === 'unauthorized_client');
}

export interface FreshTokenOptions {
  readonly store: TokenStore;
  readonly refresh: Refresh;
  readonly now?: () => number;
  /** Called once when a refused refresh signs the person out. */
  readonly onSignedOut?: () => void;
}

export function createAuthorize(opts: FreshTokenOptions): Authorize {
  const now = opts.now ?? Date.now;
  let inFlight: Promise<string> | null = null;

  /** One refresh at a time; everyone waiting gets its result. */
  const refreshOnce = (): Promise<string> => {
    inFlight ??= (async () => {
      const refreshToken = opts.store.tokens()?.refresh_token;
      if (!refreshToken) throw new AuthExpiredError();
      try {
        const tokens = await opts.refresh(refreshToken);
        // The SDK keeps the old refresh token when the server sends none.
        opts.store.saveTokens(tokens);
        return tokens.access_token;
      } catch (err) {
        // The MCP SDK refreshes on its own calls; if it spent this refresh
        // token first, the store already holds its new pair, so use that.
        const latest = opts.store.tokens();
        if (isRefused(err) && latest?.refresh_token && latest.refresh_token !== refreshToken && latest.access_token) return latest.access_token;
        if (isRefused(err)) {
          opts.store.invalidateCredentials('tokens');
          opts.onSignedOut?.();
          throw new AuthExpiredError();
        }
        throw err;
      }
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  return async (call) => {
    const stored = opts.store.tokens();
    if (!stored?.access_token) return call(undefined);
    const expiresAt = opts.store.expiresAt();
    const canRefresh = Boolean(stored.refresh_token);
    let token = stored.access_token;
    if (canRefresh && expiresAt !== null && expiresAt - now() <= REFRESH_WINDOW_MS) token = await refreshOnce();
    const res = await call(token);
    if (res.status !== 401 || !canRefresh) return res;
    // The server says no to a token we thought good (clock skew, revoked): refresh once and retry.
    const latest = opts.store.tokens()?.access_token;
    const next = latest && latest !== token ? latest : await refreshOnce();
    return call(next);
  };
}

/** `Authorization` header for a token, or nothing. */
export function bearer(token: string | undefined): Record<string, string> {
  return token ? { authorization: `Bearer ${token}` } : {};
}
