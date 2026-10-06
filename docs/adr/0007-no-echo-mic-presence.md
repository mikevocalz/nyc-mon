# ADR 0007: No raw Echo mic — presence arrives via NYC-Mon app signals

- **Status:** Accepted (2026-10-06, scaffold)
- **Date:** 2026-10-06
- **Deciders:** Mike (creator) directed the extension; the `platform` agent implements
- **Spec:** `docs/alexa-plus-brief.md` (Familiar Presence Service; "Do not: claim or implement Echo background microphone access"); Alexa Voice ID https://developer.amazon.com/docs/alexa/custom-skills/recognize-a-speaker-with-voice-profiles.html ; Supabase Realtime https://supabase.com/docs/guides/realtime
- **Canon:** Mons are people; consent is per-person and self-only (build prompt §Familiar People)
- **Code:** `packages/mcp-server/src/presence/`

## Context

The Familiar People system needs to know who is in the room. Echo devices offer no raw microphone stream — Alexa Voice ID returns a `personId` for the *direct speaker only*, during a request, and cannot identify background voices. The hackathon prompt is explicit: never claim or implement background mic access.

We do control two surfaces that can hear: the NYC-Mon phone app and the web app. That's where the Familiar Voices enrollment already must live — enrollment is explicit, per-person, opt-in, revocable, and on our own surface where consent is real.

## Decision

1. **Presence pipeline runs on NYC-Mon surfaces, not on the Echo.** Phone/web app: VAD → speaker embedding → match against the Caller-approved, self-enrolled embedding set → `PresenceEvent{personId, callerId, confidence, ts, source}` → Supabase Realtime channel `presence-events` → the Familiar Presence Service inside `@acme/mcp-server` attaches it to session context.
2. **Alexa Voice ID is a hint, not a pipeline.** When Alexa supplies a `personId` for the current speaker, it maps to a `FamiliarPerson` only if that person self-enrolled *and* linked their Voice ID in our app. It never identifies anyone who is not directly addressing Alexa, and never synthesizes an identity from ambient audio.
3. **Only embeddings are stored — encrypted, revocable, with a visible "Familiar Voices active" state.** Enrollment audio is never persisted (build prompt's hard "do not"). No one is enrolled on another person's behalf.
4. **Confidence tiers drive behaviour** (`≥0.90` present / `0.70–0.89` maybe / `<0.70` silent). The tier is computed by the presence service and delivered inside tool results; the Agent Skill (ADR 0009) owns what the Mon does with it — the Mon turns toward James because the model chose to, not because a threshold fired a canned line.
5. **Presence is a freshness-windowed context, not a lock.** A `PresenceEvent` decays (default 90s); tools report `presentPeople` from recent events. Refusals (ADR 0006 §5) key off resolved `ActingVoice`, which combines Voice ID hints + presence events; absence of signal resolves to `unknown`, which is still refused for Caller-only actions.

## Consequences

- The James demo beat works on hardware we own: the Caller's phone hears James, the Echo shows the reaction. Latency budget: Realtime fan-out must land inside the next tool call (~1–2 s).
- Supabase Realtime is a new external dependency (project, channel, keys). Local dev fakes it with an in-process event bus (`src/presence/service.ts`) so the simulator can inject events via the `inject_presence_event` dev tool — which is also how the demo is rehearsed without a second voice.
- The phone/web enrollment UI and the on-device embedding pipeline are separate workstreams (native speaker-embedding code would follow the Margelo react-native skills per the build prompt). The MCP side consumes events regardless of producer.
- Privacy posture is clean for certification: we demonstrably never touch Echo ambient audio, and every stored artifact (embedding) is consented, encrypted and revocable.
