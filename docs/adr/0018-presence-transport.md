# ADR 0018: Presence transport without Supabase

- **Status:** Proposed (draft, needs Mike)
- **Date:** 2026-10-08
- **Conflict it resolves:** ADR 0007 sends presence events over Supabase Realtime; ADR 0005 (Neon and Bunny) says NYC-MON does not use Supabase.

## Context

Presence events (who is in the room, with a confidence) are produced on the Caller's phone or web app and consumed by the MCP server on the next tool call, within about 1–2 s (ADR 0007). Today the MCP server keeps them in an in-process ring buffer fed only by the dev tool `inject_presence_event` (`packages/mcp-server/src/presence/service.ts`). The production database is Neon Postgres through Payload; there is no Supabase project.

## Options

1. **Postgres table, read on demand.** The app POSTs events to a `/v1` route; the MCP server reads the last 90 s for the Caller during each tool call. No new infrastructure. Each presence read adds one `/v1` round trip against the 500 ms budget, unless it's folded into the care and status reads.
2. **Postgres `LISTEN/NOTIFY`.** As option 1, plus the MCP server listens and keeps a warm in-memory window. No extra read per call. Needs a long-lived database connection, which Neon's pooled endpoint doesn't support; it would need the direct endpoint.
3. **A managed pub/sub** (for example AWS IoT Core or AppSync events). Low latency and AWS-native, which helps the AWS Builder story, but it's a new dependency and a new set of credentials.
4. **Supabase Realtime, as ADR 0007 says.** Reverses ADR 0005 for one feature.

## Recommendation

Option 1, with the presence window returned inside the existing `/v1` reads, so no extra round trip. Revisit option 2 if presence must update the screen without a tool call.

## Consequences

- ADR 0007's Supabase line is superseded; the rest of ADR 0007 stands.
- Presence stays seeded test data until ADR 0019 (voice enrollment) is decided. Nothing in this ADR stores audio or embeddings.
