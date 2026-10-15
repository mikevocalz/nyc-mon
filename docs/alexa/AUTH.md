# Alexa+ authorization server: contract for the MCP server

How admin-vite issues tokens for Alexa+ account linking, and what `packages/mcp-server` checks before it trusts one. The decision record is ADR 0016; the Amazon requirements are in `PLATFORM-DOCS.md` §2.3–2.5.

Everything below was checked by `packages/payload/src/auth/oauth/__tests__/provider.test.ts`, which drives the real `@better-auth/oauth-provider` 1.7.7 endpoints with an in-memory database. Nothing has been run against Amazon or a deployed host.

## Endpoints

`{issuer}` is the admin-vite origin: `AUTH_ISSUER`, else the origin of `BETTER_AUTH_URL` (local: `http://localhost:5174`).

| What | URL |
|---|---|
| RFC 8414 metadata | `{issuer}/.well-known/oauth-authorization-server` |
| Authorization | `{issuer}/payload-api/auth/oauth2/authorize` |
| Token | `{issuer}/payload-api/auth/oauth2/token` |
| JWKS | `{issuer}/payload-api/auth/jwks` |
| Introspection (RFC 7662) | `{issuer}/payload-api/auth/oauth2/introspect` |
| Revocation (RFC 7009) | `{issuer}/payload-api/auth/oauth2/revoke` |

The PRM document's `authorization_servers` must be `["{issuer}"]`, with no path and no trailing slash. `/.well-known/openid-configuration` answers 404: there is no OIDC.

## Access tokens

JWTs signed by Better Auth's `jwt` plugin.

| Part | Value |
|---|---|
| header `alg` | `EdDSA` (Ed25519) |
| header `typ` | `at+jwt` (RFC 9068) |
| header `kid` | a key in the JWKS |
| `iss` | `{issuer}` |
| `aud` | `MCP_RESOURCE_URI`, as a single string. Compare it exactly; a trailing slash is a different resource. |
| `exp` | at most 3600 s after `iat` |
| `scope` | space-separated string |
| `client_id`, `azp` | `alexa` or `nyc-mon-sim` |
| `sub` | the Better Auth user id (the Caller id, ADR 0006 §4) for user tokens; the client id for client-credentials tokens |
| `birth_year` | integer, user tokens only. The token was refused if the holder failed the 18+ rule at issue time, but re-check `/v1` data anyway. |
| `jti`, `iat` | standard |

Verify with any JOSE library, for example `jose`: `jwtVerify(token, createRemoteJWKSet(new URL(JWKS)), { issuer, audience: MCP_RESOURCE_URI, algorithms: ['EdDSA'] })`. Cache the JWKS. Keys rotate only if someone rotates them in the `jwks` table.

## Scopes

| Scope | Grant | Meaning for the MCP server |
|---|---|---|
| `mcp:service` | client_credentials only | `initialize`, `tools/list`, health. No user; never allow a user tool on it. |
| `mcp:caller` | authorization_code | Act as the Caller (`sub`). |
| `mcp:care` | authorization_code | Read status and non-mutating care. |
| `offline_access` | authorization_code | Added to every user request so a refresh token comes back. Ignore it. |

A user tool called with no token, an expired token or an `mcp:service` token answers 401 (no `WWW-Authenticate` header for Alexa, PLATFORM-DOCS §2.3). That 401 is what starts linking.

## What the server enforces

- `resource` is required on the authorization request and on the `authorization_code` and `client_credentials` token requests, and must equal `MCP_RESOURCE_URI`; anything else gets `invalid_target`. Refresh requests carry no `resource` and keep the original audience.
- PKCE S256 only. `plain` or a missing challenge redirects back with `invalid_request`.
- The token endpoint takes HTTP Basic for `alexa`. Credentials in the query string get `invalid_request`. A wrong secret or unknown client gets 401 `invalid_client`.
- Refresh tokens rotate on every use. Reusing an old one fails with `invalid_grant` and revokes the rest of that family.
- 18+ (ADR 0015 §1): `birthYear` from the Users collection with `currentYear - birthYear > 18`, and `consentStatus` must be `not-required`. Checked before consent (refusal page), on consent, and on every code exchange and refresh.

## Env

| Name | Used by |
|---|---|
| `AUTH_ISSUER` | both: admin-vite's issuer, the MCP server's expected `iss` |
| `MCP_RESOURCE_URI` | both: the resource admin-vite accepts, the `aud` the MCP server expects |
| `OAUTH_ALEXA_CLIENT_ID`, `OAUTH_ALEXA_CLIENT_SECRET`, `OAUTH_ALEXA_REDIRECT_URIS` | admin-vite |
| `OAUTH_SIM_CLIENT_ID`, `OAUTH_SIM_CLIENT_SECRET`, `OAUTH_SIM_REDIRECT_URIS` | admin-vite |
| `AUTH_JWKS_URL` | MCP server: `{issuer}/payload-api/auth/jwks` |

## Known gaps

- The linking page signs in with email and password (plus TOTP). Passkey and Apple/Google accounts cannot link from it yet.
- Migration `20261008_181202_alexa_oauth` is generated but not applied anywhere.
- Not checked against Amazon: whether Better Auth's origin checks accept Amazon's server-to-server token request.
