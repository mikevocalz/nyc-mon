import type {
  OAuthClientMetadata,
  OAuthClientProvider,
  StoredOAuthClientInformation,
  StoredOAuthTokens,
} from '@modelcontextprotocol/client';

/**
 * Sign-in for the simulator: OAuth 2.1 authorization code + PKCE (S256) as the
 * static public client `nyc-mon-sim`, against the authorization server the MCP
 * server names in its RFC 9728 metadata (admin-vite, lane B). The MCP SDK does
 * discovery, PKCE and the token exchange; this provider only stores things.
 *
 * Tokens live in sessionStorage: they survive a reload in the same tab and go
 * away with it. The transcript (localStorage) never holds a token.
 */

export type AuthMode = 'oauth' | 'dev-bypass';

/**
 * Scopes a person signs in with: everything the MCP server's PRM lists except
 * `mcp:service`, which is the machine-to-machine scope for client_credentials
 * only (Amazon's two-tier model, PLATFORM-DOCS §2.4).
 */
export const SERVICE_ONLY_SCOPES: ReadonlySet<string> = new Set(['mcp:service']);

export function userScopes(supported: readonly string[] | undefined): string | undefined {
  const picked = (supported ?? []).filter((s) => !SERVICE_ONLY_SCOPES.has(s));
  return picked.length > 0 ? picked.join(' ') : undefined;
}

export type AuthState =
  | { readonly kind: 'dev-bypass' }
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'signing-in' }
  | { readonly kind: 'signed-in'; readonly expiresAt: number | null }
  | { readonly kind: 'error'; readonly message: string };

/** The subset of the Web Storage API the provider needs (testable). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY = {
  tokens: 'nyc-mon-sim.oauth.tokens',
  savedAt: 'nyc-mon-sim.oauth.saved-at',
  verifier: 'nyc-mon-sim.oauth.verifier',
  state: 'nyc-mon-sim.oauth.state',
} as const;

export interface SimOAuthProviderOptions {
  /** The static client id, from the server's config (OAUTH_SIM_CLIENT_ID). */
  readonly clientId: string;
  readonly store: KeyValueStore;
  readonly redirectUrl: string;
  readonly navigate: (url: URL) => void;
  readonly randomState?: () => string;
  readonly now?: () => number;
}

function defaultRandomState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export class SimOAuthProvider implements OAuthClientProvider {
  readonly #clientId: string;
  readonly #store: KeyValueStore;
  readonly #redirectUrl: string;
  readonly #navigate: (url: URL) => void;
  readonly #randomState: () => string;
  readonly #now: () => number;

  constructor(opts: SimOAuthProviderOptions) {
    this.#clientId = opts.clientId;
    this.#store = opts.store;
    this.#redirectUrl = opts.redirectUrl;
    this.#navigate = opts.navigate;
    this.#randomState = opts.randomState ?? defaultRandomState;
    this.#now = opts.now ?? Date.now;
  }

  get redirectUrl(): string {
    return this.#redirectUrl;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'NYC-MON simulator',
      redirect_uris: [this.#redirectUrl],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      // Public client: PKCE stands in for a secret, which a browser can't keep.
      token_endpoint_auth_method: 'none',
    };
  }

  /** Static registration: the client id is fixed, never registered dynamically. */
  clientInformation(): StoredOAuthClientInformation {
    return { client_id: this.#clientId } as StoredOAuthClientInformation;
  }

  state(): string {
    const value = this.#randomState();
    this.#store.setItem(KEY.state, value);
    return value;
  }

  /** True once, for the state this tab sent; a replayed callback fails. */
  consumeState(returned: string | null): boolean {
    const expected = this.#store.getItem(KEY.state);
    this.#store.removeItem(KEY.state);
    return expected !== null && returned !== null && expected === returned;
  }

  tokens(): StoredOAuthTokens | undefined {
    const raw = this.#store.getItem(KEY.tokens);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as StoredOAuthTokens;
    } catch {
      this.#store.removeItem(KEY.tokens);
      return undefined;
    }
  }

  saveTokens(tokens: StoredOAuthTokens): void {
    this.#store.setItem(KEY.tokens, JSON.stringify(tokens));
    this.#store.setItem(KEY.savedAt, String(this.#now()));
  }

  redirectToAuthorization(authorizationUrl: URL): void {
    this.#navigate(authorizationUrl);
  }

  saveCodeVerifier(codeVerifier: string): void {
    this.#store.setItem(KEY.verifier, codeVerifier);
  }

  codeVerifier(): string {
    const v = this.#store.getItem(KEY.verifier);
    if (!v) throw new Error('Sign-in was interrupted. Start it again.');
    return v;
  }

  invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'): void {
    if (scope === 'all' || scope === 'tokens') {
      this.#store.removeItem(KEY.tokens);
      this.#store.removeItem(KEY.savedAt);
    }
    if (scope === 'all' || scope === 'verifier') this.#store.removeItem(KEY.verifier);
    if (scope === 'all') this.#store.removeItem(KEY.state);
  }

  signOut(): void {
    this.invalidateCredentials('all');
  }

  /** Expiry in epoch ms, from `expires_in` and the time the tokens were saved. */
  expiresAt(): number | null {
    const tokens = this.tokens() as { expires_in?: number } | undefined;
    const savedAt = Number(this.#store.getItem(KEY.savedAt));
    if (!tokens?.expires_in || !Number.isFinite(savedAt) || savedAt <= 0) return null;
    return savedAt + tokens.expires_in * 1000;
  }
}

/**
 * Where the session stands before connecting. A token past its expiry still
 * counts as signed in when a refresh token exists; the SDK refreshes it on the
 * next 401.
 */
export function resolveAuthState(mode: AuthMode, provider: SimOAuthProvider, now: number = Date.now()): AuthState {
  if (mode === 'dev-bypass') return { kind: 'dev-bypass' };
  const tokens = provider.tokens() as { access_token?: string; refresh_token?: string } | undefined;
  if (!tokens?.access_token) return { kind: 'signed-out' };
  const expiresAt = provider.expiresAt();
  if (expiresAt !== null && expiresAt <= now && !tokens.refresh_token) {
    provider.invalidateCredentials('tokens');
    return { kind: 'signed-out' };
  }
  return { kind: 'signed-in', expiresAt };
}

/** Read `code`/`state`/`error` off the OAuth redirect. */
export function parseCallback(search: string):
  | { readonly ok: true; readonly code: string; readonly state: string | null; readonly iss: string | null }
  | { readonly ok: false; readonly message: string } {
  const params = new URLSearchParams(search);
  const error = params.get('error');
  if (error) {
    const description = params.get('error_description');
    return {
      ok: false,
      message:
        error === 'access_denied'
          ? 'Sign-in was cancelled. Sign in again to talk to your Mon.'
          : `Sign-in failed (${description ?? error}). Try again.`,
    };
  }
  const code = params.get('code');
  if (!code) return { ok: false, message: 'Sign-in returned without a code. Try again.' };
  return { ok: true, code, state: params.get('state'), iss: params.get('iss') };
}
