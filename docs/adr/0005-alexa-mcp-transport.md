# ADR 0005: Streamable HTTP MCP is the only Alexa+ integration surface

- **Status:** Accepted (2026-10-06, scaffold)
- **Date:** 2026-10-06
- **Deciders:** Mike (creator) directed the extension; the `platform` agent implements
- **Spec:** `docs/nyc-mon-alexa-plus-build-prompt.md` (Alexa+ track: "a working MCP integration built on the open standards for Agent Skills and Streamable HTTP transport"); MCP spec 2025-11-25, https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#streamable-http
- **Builds on:** `docs/adr/0001-auth-and-identity.md`, `docs/adr/0003-admin-app-split.md`
- **Code:** `packages/mcp-server` (`@acme/mcp-server`)

## Context

The hackathon's Alexa+ track defines the deliverable as an MCP integration on two open standards: Streamable HTTP transport at spec 2025-11-25 or newer, and an Agent Skill that carries behaviour. Amazon's own add-on path (`alexa-ai` CLI + MCP Toolkit, private preview) consumes the same shape: it introspects an MCP server's tools and generates the add-on manifest.

The alternatives all fail the brief or the architecture: a classic Alexa Skills Kit custom skill needs an intent model, a separate endpoint and Amazon-hosted certification plumbing we don't control; bolting Alexa onto `/v1` would leak game-API semantics into a voice surface and skip the track's judged requirement entirely.

## Decision

One MCP server — `@acme/mcp-server` — is the single integration surface for Alexa+, for the web simulator, and for any future MCP-capable host.

1. **Transport:** Streamable HTTP only, per spec 2025-11-25. One `POST`/`GET` endpoint (`/mcp`) carries JSON-RPC 2.0 requests, server-sent events for streamed responses and session resumability. No stdio transport (nothing to spawn), no legacy HTTP+SSE transport from the 2024 spec.
2. **Spec floor:** 2025-11-25 or newer. Tool descriptors use the current schema fields (`inputSchema`, `outputSchema`, `annotations`); nothing targets the deprecated protocol versions.
3. **No Alexa-specific surface.** There is no Alexa Skills Kit code, no intent schema and no Alexa-hosted endpoint anywhere in the repo. Amazon-specific packaging (`packages/alexa-addon`, the `alexa-ai` manifest) is generated *from* the MCP server, never the other way around.
4. **Voice semantics live outside the protocol.** The server speaks structured data and structured errors. Character, cadence and turn-taking are the Agent Skill's job (ADR 0009), which is why every tool returns parseable results plus machine-readable error codes like `PERMISSION_DENIED_NOT_CALLER` instead of prose.
5. **Same contract for simulator and device.** `packages/web-sim` is a real MCP client against this server. Whatever Alexa+ adds on top (Voice ID hints, display fragments) arrives as tool-call arguments and request metadata, not as a second protocol.

## Consequences

- The judged demo path (simulator → MCP → `/v1` → Payload) exercises the identical code path a real Echo would. There is no demo-only fork to maintain.
- Streamable HTTP requires a publicly reachable HTTPS endpoint for the real Alexa+ path; local dev and the simulator run plain HTTP on localhost. Deployment/TLS is a submission-time dependency, tracked in `docs/FRICTION-LOG.md` and the deploy checklist.
- Session resumability and SSE mean the server must hold per-session state (or a stateless token) — the scaffold keeps the seam in `src/mcp/server.ts` with the transport construction TODO'd against the official TypeScript SDK.
- When the `alexa-ai` CLI gains preview access, `alexa-ai new` introspects these tools; tool names and schemas are therefore part of the public contract and must stay stable (`snake_case`, per the build prompt).
