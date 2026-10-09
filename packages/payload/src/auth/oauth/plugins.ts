// The Alexa+ authorization server (ADR 0016): Better Auth's `jwt` plugin
// signs access tokens and serves the JWKS; `@better-auth/oauth-provider`
// runs the OAuth 2.1 endpoints. Both are the 1.7.7 releases that match the
// pinned better-auth. Our code only configures them, registers the two
// static clients, and adds the checks in guards.ts.
import { oauthProvider } from '@better-auth/oauth-provider';
import { APIError } from 'better-auth/api';
import { jwt } from 'better-auth/plugins/jwt';
import { linkRefusal } from './adult';
import { hashClientSecret, staticOAuthClients } from './clients';
import { ALL_SCOPES, type OAuthServerConfig } from './config';
import { oauthGuards } from './guards';

/** Where the provider sends the browser. admin-vite serves these pages (routes/oauth/*). */
export const OAUTH_PAGES = {
  signIn: '/oauth/sign-in',
  consent: '/oauth/consent',
  refused: '/oauth/refused',
} as const;

/** Amazon recommends `expires_in` of at most an hour. */
export const ACCESS_TOKEN_TTL_SECONDS = 3600;
/** A linked Alexa account refreshes for 90 days without re-linking. */
export const REFRESH_TOKEN_TTL_SECONDS = 90 * 24 * 3600;
export const AUTHORIZATION_CODE_TTL_SECONDS = 300;

/**
 * The plugins, in order: JWKS/signing, the provider, our request guards and
 * the static-client seed.
 */
export function alexaOAuthPlugins(config: OAuthServerConfig, nowMs: () => number = Date.now) {
  const resource = config.resource;
  return [
    jwt({
      // The issuer is the origin, so RFC 8414 metadata lives at the root
      // `/.well-known/oauth-authorization-server` where Amazon looks for it.
      jwt: { issuer: config.issuer },
      jwks: { keyPairConfig: { alg: 'EdDSA', crv: 'Ed25519' } },
      // No `set-auth-jwt` header on ordinary session calls.
      disableSettingJwtHeader: true,
    }),
    oauthProvider({
      // No `openid`, so the provider runs as a plain OAuth server: the
      // metadata is RFC 8414, `/.well-known/openid-configuration` answers 404
      // and no ID token is minted (Amazon: "OpenID Connect not supported").
      scopes: [...ALL_SCOPES],
      grantTypes: ['authorization_code', 'client_credentials', 'refresh_token'],
      loginPage: OAUTH_PAGES.signIn,
      consentPage: OAUTH_PAGES.consent,
      // 18+ gate, first layer: after sign-in and before consent the provider
      // calls postLogin.shouldRedirect (`authorize` in
      // dist/authorize-*.mjs); a refused account lands on the refusal page.
      postLogin: {
        page: OAUTH_PAGES.refused,
        shouldRedirect: ({ user }) => linkRefusal(user as unknown as Record<string, unknown>, nowMs()) !== undefined,
        consentReferenceId: () => undefined,
      },
      resources: resource === undefined ? [] : [{ identifier: resource, name: 'NYC-MON MCP server', allowedScopes: [...ALL_SCOPES] }],
      // Env is the source of truth for the one resource.
      resourceSeedMode: 'overwrite',
      enforcePerClientResources: true,
      cachedTrustedClients: new Set(config.clients.map((client) => client.clientId)),
      accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
      m2mAccessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
      codeExpiresIn: AUTHORIZATION_CODE_TTL_SECONDS,
      // Static registration only: no DCR, and no Caller or staff can create,
      // edit or list clients or resources over HTTP.
      allowDynamicClientRegistration: false,
      allowUnauthenticatedClientRegistration: false,
      clientPrivileges: () => false,
      resourcePrivileges: () => false,
      storeClientSecret: { hash: hashClientSecret },
      // 18+ gate, authoritative layer: runs for every access token the
      // provider mints (`resolveAccessTokenClaims` in dist/introspect-*.mjs),
      // so a code exchange or refresh for an account that fails the rule gets
      // invalid_grant. Client-credentials tokens have no user.
      customAccessTokenClaims: ({ user }) => {
        if (user === undefined) return {};
        const refusal = linkRefusal(user as unknown as Record<string, unknown> | null, nowMs());
        if (refusal !== undefined) {
          throw new APIError('BAD_REQUEST', {
            error: 'invalid_grant',
            error_description: 'NYC-MON on Alexa is for adults (18+) only.',
          });
        }
        const birthYear = (user as unknown as Record<string, unknown>).birthYear;
        return typeof birthYear === 'number' ? { birth_year: birthYear } : {};
      },
    }),
    oauthGuards({ resource, nowMs }),
    staticOAuthClients({ clients: config.clients, resource }),
  ];
}
