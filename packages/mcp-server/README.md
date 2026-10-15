# @acme/mcp-server

The NYC-MON MCP server for Alexa+ and the web simulator. Streamable HTTP on the `@modelcontextprotocol/server` 2.x SDK, stateless, one `/mcp` endpoint. It holds no model and makes no model calls, so a tool call is one or two `/v1` round trips (Alexa's budget is 500 ms). Scope and rules: ADR 0015, `docs/alexa/PLATFORM-DOCS.md`, ADRs 0005–0009.

## Run

```sh
pnpm --filter @acme/mcp-server dev        # builds the MCP Apps views, then serves on :8788
pnpm --filter @acme/mcp-server test       # vitest
pnpm --filter @acme/mcp-server typecheck
```

`dev` and `start` run `build:ui` first, because the `ui://` views are read from `dist/ui`.

## Endpoints

- `POST /mcp`: JSON-RPC. Initialize with `2025-11-25`, `2025-06-18` or `2025-03-26` (Alexa sends 2025-03-26) and the server answers with the same version.
- `GET /.well-known/oauth-protected-resource` and `…/oauth-protected-resource/mcp`: RFC 9728 metadata. `resource` is the exact `MCP_RESOURCE_URI`.
- `GET /healthz`.

An `Origin` header that is not the resource's own origin or listed in `MCP_ALLOWED_ORIGINS` gets 403. A request with no `Origin` passes, which is how Alexa calls.

## Auth

Tokens come from the issuer on admin-vite (lane B, `docs/alexa/AUTH.md`) and are checked against its JWKS (`MCP_TOKEN_VERIFIER=jwt`, the default) or by RFC 7662 introspection. `iss` must equal `AUTH_ISSUER` and `aud` must contain `MCP_RESOURCE_URI`.

| Token | Allowed | Otherwise |
|---|---|---|
| none or invalid | nothing | 401 |
| `mcp:service` (client_credentials) | initialize, tools/list, resources, notifications | `tools/call` → 401, which starts account linking |
| `mcp:caller` | read tools | care tools → 403 |
| `mcp:care` | feed, rest, wake, play | read tools → 403 |

No 401 or 403 carries `WWW-Authenticate`, per Amazon. Clients find the metadata at the well-known path.

Accounts must be 18 or older. A token whose `birth_year` claim says otherwise gets an `adults-only` result before any `/v1` call. `/v1` enforces the same rule from the Users record on every on-behalf-of request, so a token without the claim is still checked.

The server never forwards the Alexa token. It calls `/v1` with its own key (`X-NYC-MON-Service-Key`, the same value as admin-vite's `V1_MCP_SERVICE_KEY`) and names the Caller in `X-NYC-MON-On-Behalf-Of`.

`OAUTH_DEV_BYPASS=1` acts as a fixed adult `dev-caller` with no token check. The server refuses to start with it unless `NODE_ENV` is set to `development` or `test` and `MCP_RESOURCE_URI` is loopback, and it then listens on 127.0.0.1 only.

## Tools

Every build: `get_mon_status`, `check_on_mon`, `check_incubation`, `talk_to_mon`, `feed_mon` (Share a meal, no item), `rest_mon`, `wake_mon`, `play_with_mon` (optional `quality`, 0 to 1). Each has an output schema. A care action the Mon would decline (feeding it while asleep, say) returns `applied: false` with the reason and writes nothing. Care writes go to `PUT /v1/mons/:id/care` under a per-Caller device id with a clock-based seq that stays monotonic across restarts. The `Idempotency-Key` is a hash of the Caller, Mon, action and JSON-RPC request id, so a resent `tools/call` reuses the key, seq and time and `/v1` replays it instead of applying it twice. If a PUT times out, the server re-reads the Mon: a write that landed is reported normally, and one that can't be confirmed says so instead of failing blindly.

Dev and simulator mode only (`MCP_DEV_MODE=1`): `get_familiar_people`, `get_present_people`, `get_person_relationship`, `get_shared_memories`, `acknowledge_person`, `inject_presence_event`. They run on seeded fictional people (James, Dana). There are no voiceprints and no real enrollment (ADR 0015 §2). In this mode the care tools and `talk_to_mon` also accept `speakerHint`. A hinted person counts only with a fresh presence event; otherwise the turn may talk but not give care.

Failures come back with `isError: true`, a plain sentence with a next step in `content`, and `{ error: { reason, message, nextStep } }` in `structuredContent`. No API codes or ids appear in the text.

## MCP Apps views

Lane C's `mcpAppsRegistration()` (`src/ui`) registers the `ui://nyc-mon/…` resources and links `get_mon_status` and the four care tools to the Mon card, with `visibility: ['model', 'app']` so the card's buttons can call them. The seam type is `McpAppsRegistration` in `src/mcp/ui-seam.ts`. If the views are not built, the server logs a warning and serves data only.

## Env

`MCP_PORT` (8788) · `MCP_RESOURCE_URI` (`http://localhost:8788/mcp`) · `MCP_ALLOWED_ORIGINS` · `AUTH_ISSUER` · `MCP_TOKEN_VERIFIER` (`jwt` | `introspection`) · `AUTH_JWKS_URL` · `AUTH_INTROSPECTION_URL` / `_CLIENT_ID` / `_CLIENT_SECRET` · `V1_BASE_URL` · `V1_MCP_SERVICE_KEY` (32+ chars) · `V1_TIMEOUT_MS` (400) · `OAUTH_DEV_BYPASS` · `MCP_DEV_MODE`. `src/env.ts` validates them at startup and names every missing value.
