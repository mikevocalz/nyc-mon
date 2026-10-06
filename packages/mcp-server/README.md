# @acme/mcp-server

The NYC-MON × Alexa+ add-on: a self-hosted MCP server over **Streamable HTTP** (MCP spec **2025-11-25**), OAuth 2.1 + PKCE (S256) + RFC 9728 Protected Resource Metadata, exposing the care loop, Familiar People, and presence tools to Alexa+ and to the web simulator (`packages/web-sim`, TODO).

Contract: `docs/alexa-plus-brief.md`. Design: `docs/architecture/system-design.md`, ADRs 0005–0009. This is an **extension of the existing stack** — auth stays Better Auth on admin-vite, Mon data stays behind `/v1` + Payload, sim state stays `@acme/core`, bloodlines stay `@acme/content`.

## Dev entrypoints

```sh
pnpm --filter @acme/mcp-server dev        # run on :8788, loads root .env/.env.local
pnpm --filter @acme/mcp-server typecheck  # tsc --noEmit
```

Env (see `src/env.ts`): `MCP_PORT` (default 8788) · `MCP_RESOURCE_ORIGIN` · `AUTH_SERVER_ORIGIN` (admin-vite, default :5174) · `V1_BASE_URL` · `OAUTH_DEV_BYPASS=1` (dev only — injects a fixed Caller context, no token validation) · `MCP_DEV_MODE=1` (enables `inject_presence_event`) · `SUPABASE_URL` / `SUPABASE_ANON_KEY` (presence, not yet used).

Endpoints: `POST|GET|DELETE /mcp` (Streamable HTTP) · `GET /.well-known/oauth-protected-resource` (RFC 9728) · `GET /healthz`.

## What's wired vs what's a seam

- **Real now:** tool registry + zod schemas (`src/mcp/`), the trainer/familiar/unknown permission gate (`PERMISSION_DENIED_NOT_CALLER`), the in-process Familiar Presence Service with confidence tiers (`src/presence/`), the PKCE S256 verifier, the PRM document + 401 challenge, the James-scene dev hook.
- **Seams (explicit TODOs):**
  - `@modelcontextprotocol/sdk` is **not installed** — the lockfile had no copy and we don't pin blind. `src/types/mcp-sdk.d.ts` is an ambient stand-in for `server/mcp.js` + `server/streamableHttp.js`; **delete it** when the dependency lands and reconcile types in `src/mcp/server.ts` (session transport, `server.connect(transport)`).
  - `src/data/caller.ts` — `CallerData` interface only; bind to `/v1` (prod) or fixtures (demo).
  - `src/auth/oauth.ts` `verifyAccessToken` — needs Better Auth OIDC-provider (a `packages/payload` change) or introspection.
  - Supabase Realtime subscription in `src/presence/service.ts`.
  - Supabase project + Realtime channel; `familiar-people` / `speaker-embeddings` / shared-memories Payload collections (design-only per system-design §3).

## What stays external

- **AWS creds** — Bedrock/Strands personality layer (AWS Builder mini-challenge) is not in this package; tools return structured context a model renders.
- **Alexa preview access** — `alexa-ai` CLI + MCP Toolkit are private-preview; the `packages/alexa-addon` manifest waits on access.
- **Deployed HTTPS** — Alexa needs a reachable HTTPS origin; localhost dev is HTTP.
- **Echo audio** — never exists, by design (ADR 0007). Presence comes from the NYC-Mon app over Supabase Realtime.
- **The model** — the Agent Skill (`.devin/skills/nyc-mon-alexa/SKILL.md`) + a real LLM carry character and tool routing; this server is deliberately characterless.
