# ADR 0006: OAuth 2.1 + PKCE (S256) + RFC 9728 on the MCP server

- **Status:** Accepted (2026-10-06, scaffold)
- **Date:** 2026-10-06
- **Deciders:** Mike (creator) directed the extension; the `platform` agent implements
- **Spec:** `docs/nyc-mon-alexa-plus-build-prompt.md` ("OAuth 2.1 + PKCE (S256) with Protected Resource Metadata (RFC 9728)"); OAuth 2.1 https://oauth.net/2.1/ ; RFC 9728 https://www.rfc-editor.org/rfc/rfc9728 ; RFC 7636 https://www.rfc-editor.org/rfc/rfc7636 ; MCP authorization spec https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- **Builds on:** `docs/adr/0001-auth-and-identity.md` (Better Auth owns identity), `docs/adr/0003-admin-app-split.md` (auth host)
- **Code:** `packages/mcp-server/src/auth/`

## Context

MCP 2025-11-25 makes the server a protected resource: an MCP client (Alexa+, the simulator, Inspector) discovers authorization requirements from the resource itself. The mechanism is RFC 9728 — a `WWW-Authenticate: Bearer resource_metadata=…` challenge on 401s plus a `GET /.well-known/oauth-protected-resource` document pointing at the authorization server.

Our authorization server is Better Auth inside Payload (ADR 0001). Alexa+ account linking needs an OAuth 2.1 authorization-code flow with PKCE — and OAuth 2.1 requires S256 (`plain` is gone). The open question is where the authorization endpoint terminates: Better Auth's OIDC-provider plugin (not yet installed) or a thin adapter that proxies the MCP-facing OAuth handshake to Better Auth sessions.

## Decision

1. **The MCP server is the protected resource.** It validates bearer tokens and publishes the PRM document. It does not mint long-lived credentials for itself.
2. **PKCE S256 is mandatory** on every authorization-code flow the server participates in. The middleware skeleton (`src/auth/oauth.ts`) verifies `code_challenge_method=S256` and never accepts `plain` or an absent verifier. Public clients (the simulator, the Alexa add-on) get authorization-code + PKCE; there is no implicit or password grant.
3. **RFC 9728 is implemented in the server**, at `/.well-known/oauth-protected-resource`, advertising `resource`, `authorization_servers` (the admin-vite/Better Auth origin), `bearer_methods_supported: ['header']` and the MCP scopes we define. The 401 challenge is emitted by `prm.ts`'s challenge helper so the well-known URL is never hand-maintained in two places.
4. **Account linking resolves to the Better Auth user id.** The access token's subject is the existing `callerId` (ADR 0001). Voice surfaces and `/v1` agree on identity by construction — "a device session is a surface" extends to a voice session.
5. **Scopes are coarse:** `mcp:care` (read status, non-mutating familiar actions), `mcp:caller` (full Caller actions). The permission matrix (trainer / familiar / unknown, per-person grants) is enforced inside tools from `FamiliarPerson` records — it is a *data* rule, not an OAuth scope, because it changes per household without re-linking.
6. **Token validation in the scaffold is a seam, not an implementation.** `verifyAccessToken` is a typed stub that must be bound to either Better Auth's OIDC-provider plugin output or introspection against the auth host before any non-local use. It currently accepts nothing.

## Consequences

- The simulator and Inspector can exercise the full OAuth dance locally once an authorization-server endpoint exists; until then `OAUTH_DEV_BYPASS` (a documented env flag, default off outside dev) injects a fixed Caller context so tool development isn't blocked.
- Better Auth needs the OIDC-provider plugin (or equivalent) to act as the authorization server. That's a `packages/payload` change and its own migration; it is deliberately out of this scaffold's scope.
- Scopes must stay coarse — a `PERMISSION_DENIED_NOT_CALLER` refusal is a *feature* the demo depends on, and it only exists if familiar voices share the Caller-scoped token's reach and are refused by data, not by OAuth.
- RFC 9728 metadata becomes certification-relevant: Alexa's account-linking check reads it, so the document's accuracy is a pre-submission item.
