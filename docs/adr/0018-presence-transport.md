# ADR 0018: Presence stays seeded; real presence, when built, is a Postgres window read inside `/v1`

- **Status:** Accepted (2026-10-15). Proposed 2026-10-08.
- **Date:** 2026-10-15
- **Deciders:** Mike (creator). The decision rule is recorded in PR #16: keep seeded presence unless real presence is necessary for the judge story, and add no Supabase for one feature.
- **Supersedes:** the Supabase Realtime transport in ADR 0007 §1 and the "new external dependency" line in its consequences. The rest of ADR 0007 stands.
- **Sources:** `docs/adr/0005-neon-and-bunny-media.md`, `docs/adr/0007-no-echo-mic-presence.md`, `docs/adr/0015-alexa-plus-hackathon-scope.md` §2, `docs/alexa/SUBMISSION.md`, `packages/mcp-server/src/presence/`
- **Related:** ADR 0019 (voice enrollment). Without enrollment there is no producer of real presence events, so this ADR's transport has nothing to carry until ADR 0019's prerequisites are met.

## Context

ADR 0007 routes presence events (who is in the room, with a confidence) from the Caller's phone or web app to the MCP server over a Supabase Realtime channel. ADR 0005 (Neon and Bunny) says NYC-MON does not use Supabase. Two ADR files carry the number 0005; both are cited by file name here.

On `main` today the MCP server keeps presence in a per-process in-memory ring (`packages/mcp-server/src/presence/service.ts`, `MAX_EVENTS_PER_CALLER = 64`, 90 s freshness) fed only by the dev tool `inject_presence_event`. The people are fixtures (`presence/fixtures.ts`: James, Dana). The six familiar-people and presence tools register only when `MCP_DEV_MODE=1` (`env.ts`), which is off for the Alexa build. No code produces a presence event from audio, no `/v1` route accepts one, and no Supabase SDK is in the repo. The judge story (ADR 0015 §2, `docs/alexa/SUBMISSION.md` §1 and the demo script) runs on these fixtures.

## Decision

1. **The hackathon build keeps seeded presence.** Fixtures and injected events, dev and simulator mode only. Nothing changes in the Alexa production `tools/list`.
2. **If and when real presence is built, the transport is Postgres, read inside `/v1`.** The app POSTs each `PresenceEvent` to a `/v1` route; it lands in the Neon Postgres database through Payload. The MCP server reads the Caller's last 90 s of events as a field of the care and status `/v1` responses it already makes, so a tool call gains no extra round trip against the 500 ms budget (ADR 0015 §3).
3. **No Supabase.** ADR 0005 holds for this feature as for every other.
4. **This transport is built only after ADR 0019's prerequisites each have an accepted ADR.** Until then the in-memory ring and fixtures remain the only presence path.

## Alternatives considered

1. **Postgres `LISTEN/NOTIFY`.** The MCP server keeps a warm in-memory window and reads nothing per call. It needs a long-lived connection, which Neon's pooled endpoint does not give; it would need the direct endpoint. Revisit if presence must change the screen without a tool call.
2. **A managed pub/sub** (AWS IoT Core, AppSync events). Low latency and AWS-native, but a new dependency and a new credential set for a feature that is not in the judge story.
3. **Supabase Realtime, as ADR 0007 wrote.** Reverses ADR 0005 for one feature.

## Consequences

- The Alexa+ entry does not depend on live presence. The demo rehearses with `inject_presence_event` as it does today.
- When built, every care and status read carries the presence window, so the MCP server drops the ring buffer for production and the ring stays for dev and tests.
- The following still describe the Supabase path and need rewriting when the real transport is built, or earlier as a docs pass: ADR 0007 §1 and its consequences, `docs/architecture/system-design.md` (Familiar Presence Service, `PresenceEvent` row, sequence diagram, external dependencies), `docs/alexa-plus-brief.md` §Familiar People, and the docblock in `presence/service.ts` ("published to a Supabase Realtime channel").
- A `/v1` presence route is a write path from a phone to the Caller's own data. It inherits `/v1`'s identity rules: the Caller comes from the token, never from the body, and a `callerId` that is not the token's resolves to not-found.

## Evidence (2026-10-15, `origin/main`)

- `git grep -i -E 'presence|voice ?print|embedding|enrol'` over `docs/alexa` and `packages/mcp-server`: every hit is the fixture pipeline, its tools, or the sentence that says it is seeded. `packages/mcp-server/README.md:46`: "There are no voiceprints and no real enrollment (ADR 0015 §2)." `docs/alexa/SIMULATOR.md:32`: "Nobody's voice is recorded."
- `docs/alexa/SUBMISSION.md:33`: six familiar-people and presence tools "exist only in dev and simulator builds".
- `docs/alexa/PLATFORM-DOCS.md` finding 14: Alexa+ documents no Voice ID field, so `speakerHint` is a simulator-only input. Finding 17: embeddings are biometric and need disclosure.
- `docs/HANDOFF.md:123` records the ADR 0005 and 0007 conflict this ADR closes.
