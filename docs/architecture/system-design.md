# NYC-MON × Alexa+ add-on — system design

- **Status:** Scaffold (extension of the existing stack, not a parallel one)
- **Date:** 2026-10-06
- **Contract:** `docs/nyc-mon-alexa-plus-build-prompt.md`
- **ADRs:** `docs/adr/0005-alexa-mcp-transport.md` … `docs/adr/0009-agent-skill-routing.md`
- **Builds on:** `docs/adr/0001-auth-and-identity.md` (Better Auth inside Payload), `docs/adr/0003-admin-app-split.md` (admin/API host), `docs/adr/0002-sim-core.md` (`@acme/core` sim), `docs/canon/DECISIONS.md`

## 1. What the add-on is

Three new surfaces bolt onto the stack that already exists. Nothing existing moves: `apps/admin-vite` keeps Better Auth + Payload + `/v1`, `apps/web` keeps the product site, `@acme/core` keeps the sim, `@acme/content` keeps the bloodlines.

| Surface | Where it lives | Talks to |
|---|---|---|
| **MCP server** (`@acme/mcp-server`, `packages/mcp-server`) | New Node service, deployed as its own project. Streamable HTTP transport, MCP spec 2025-11-25 (ADR 0005). OAuth 2.1 + PKCE (S256) + RFC 9728 PRM (ADR 0006). | `/v1` on the admin-vite host for Mon/care data; the Familiar Presence Service for `PresenceEvent`s; Better Auth for the linked Caller. |
| **Familiar Presence Service** | Logical service; the first implementation is a module inside `@acme/mcp-server` (`src/presence/`) fed by Supabase Realtime channels. Enrollment and mic live in the NYC-Mon phone/web app, never on Echo (ADR 0007). | Supabase Realtime (presence-event fan-out), Payload (`familiar-people`, `speaker-embeddings` collections — TODO, not yet created). |
| **Web Alexa+ simulator** (`packages/web-sim`, TODO) | A real MCP client over Streamable HTTP driven by the Agent Skill + a real model. This is the judged surface. | `@acme/mcp-server` directly. No hand-written intent router (ADR 0009). |
| **Agent Skill** (`.devin/skills/nyc-mon-alexa/SKILL.md`) | Repo file, loaded by whatever agent drives the session. | Carries character, tool routing and the permission model. |

### Attachment points (nothing here is re-invented)

- **Auth / Caller identity.** Better Auth runs inside Payload at `/payload-api/auth/*` on the admin-vite host (ADR 0001, 0003). The Alexa account-link OAuth flow resolves to the same `users` row; `callerId` is the Better Auth user id, stable across devices — the same id `/v1` already uses. MCP bearer tokens are issued against that account link, never a parallel user table.
- **Mon data.** `mon-instances`, `care-states`, `eggs` collections in `packages/payload` are the server of record. The MCP server reads/writes through the `/v1` contract (`GET /v1/me/mons`, `PUT /v1/mons/:id/care`, `POST /v1/eggs`, `POST /v1/eggs/:id/hatch` — ADR 0001) so idempotency, seq ordering and Law 6 uniqueness hold for free. Where `/v1` lacks a surface (inventory, presence), the MCP data layer calls the Payload Local API only if it is co-deployed with Payload — otherwise it stays a TODO behind `src/data/` and the simulator supplies fixtures.
- **Sim state.** `@acme/core` owns `CareState` (`energy`, `fullness`, `social`, `activity`, `pendingRequest` — `packages/core/schemas/care.ts`) and `MonInstance` (`packages/core/schemas/mon.ts`). The MCP tools reuse those zod schemas verbatim; they do not define a second care model. Note: the build prompt's status fields "hunger / mood / health" map to canon `fullness` / derived mood / *no health field* — canon deliberately has no HP or sickness (Law 8). `heal_mon` is the Nurse Nay flow and is `TODO(canon)`-shaped: it soothes, it never treats "sick".
- **Content.** `@acme/content` owns the three starter bloodlines (`hood-ratti.ts`, `bodega-cee.ts`, `yotes.ts`) and `BloodlineSchema` chains. Tool responses render species/bloodline names from content, never hard-coded.
- **Canon terms.** `Caller` in every API field, state object and UI string; `Callah` exists only in character dialogue and the TTS lexicon (ADR 0008, COPY_DECK §Caller-and-Callah).

## 2. Service boundaries

```mermaid
flowchart LR
    subgraph Client surfaces
        Echo[Echo Show / Alexa+\nAgent Skill loaded]
        WebSim[packages/web-sim\nweb Alexa+ simulator\n(real MCP client)]
    end

    subgraph New extension
        MCP["@acme/mcp-server\nStreamable HTTP · MCP 2025-11-25\nOAuth 2.1 + PKCE + PRM (RFC 9728)"]
        FPS["Familiar Presence Service\n(confidence-tiered PresenceEvents)"]
    end

    subgraph Existing stack
        BA["Better Auth\n/payload-api/auth/* (admin-vite)"]
        V1["/v1 game API\n(admin-vite server routes)"]
        PL["Payload Postgres\nusers · mon-instances · care-states · eggs"]
        RT["Supabase Realtime\npresence channels"]
        APP["NYC-Mon app (phone/web)\nmic + enrollment live here"]
    end

    Echo -->|MCP over HTTPS| MCP
    WebSim -->|MCP over HTTP| MCP
    MCP -->|bearer → linked Caller| BA
    MCP -->|care loop reads/writes| V1
    V1 --> PL
    FPS -->|subscribe| RT
    APP -->|enroll + VAD + embedding| RT
    APP -->|enrollment records| PL
    MCP -->|presence context per call| FPS
```

Boundary rules:

1. **The MCP server is the only Alexa+ surface** (ADR 0005). No Alexa skill SDK, no custom intents — Alexa+ talks MCP or nothing.
2. **No Echo audio ever reaches us** (ADR 0007). Alexa Voice ID `personId` is accepted as a *hint* only when Alexa itself supplies it for the current speaker; it maps to a `FamiliarPerson` only if that person self-enrolled. Presence otherwise arrives as `PresenceEvent`s from the NYC-Mon app over Supabase Realtime.
3. **Mutations route through `/v1`** so server-authoritative care ordering (`lastAppliedSeq`) and idempotency apply to voice-driven actions exactly as they do to touch-driven ones.
4. **The Agent Skill carries character and tool routing** (ADR 0009); the MCP server returns structured data and structured errors, never canned dialogue.

## 3. Data model

New zod schemas live in `@acme/mcp-server` (`src/presence/types.ts`); persistence lands in new Payload collections (TODO — the task forbids touching existing collections, so these are design-only until the Payload migration is scheduled).

### Existing (reused, not redefined)

| Entity | Schema | Store |
|---|---|---|
| Caller | `CallerProfileSchema`, `callerId` = Better Auth user id | `users` (Payload/Better Auth) |
| Mon | `MonInstanceSchema` + `CareStateSchema` | `mon-instances`, `care-states` |
| Bloodline/species | `MonSpeciesDefSchema`, `BloodlineSchema` | `@acme/content` (static) |
| Egg/incubation | `EggRecordSchema` | `eggs` |

### New

| Entity | Fields | Notes |
|---|---|---|
| `FamiliarPerson` | `personId`, `callerId` (the Caller whose circle this is), `displayName`, `relationship`, `permissions: Permission`, `enrolledAt`, `enrolledBy: 'self'`, `voicePrintRef` (opaque pointer to the encrypted embedding, never audio), `alexaVoiceIdHint?` | James is the canonical instance. Enrollment is self-only, explicit, revocable; embedding stored, recordings never. |
| `Permission` | `{ talk: bool, play: bool, feed: bool, care: bool }` | Per-person grants the Caller sets. `care` covers heal/inventory mutations. Default: `{talk:true, play:true, feed:false, care:false}`. |
| `PresenceEvent` | `personId`, `callerId`, `confidence ∈ [0,1]`, `ts` (EpochMs), `source: 'app-vad' \| 'alexa-voice-id'`, `monInstanceId?` | Produced by the presence pipeline, fanned out on Supabase Realtime, consumed as MCP context. |
| `ActingVoice` | `kind: 'trainer' \| 'familiar' \| 'unknown'`, `personId?`, `confidence?` | Resolved per tool call. `trainer` = the Caller; the code keeps the wire term `trainer` (a role in the permission contract) while copy stays `Caller`. |

### Confidence tiers (drive Mon reaction, decided by the Skill/model)

| confidence | Tier | Expected beat |
|---|---|---|
| ≥ 0.90 | `present` | Warm recognition: "Yo, James!" |
| 0.70–0.89 | `maybe` | Hedge: "Wait… is that James back there?" |
| < 0.70 | — | Silent. The event is recorded, never voiced. |

### Error contract

Mutating tools resolve `ActingVoice` first. A familiar (or unknown) voice requesting a Caller-only action gets a structured `PERMISSION_DENIED_NOT_CALLER` error payload — `{ code, actingVoice, requiredPermissions, monId }` — so the personality layer renders the Callah refusal in-character rather than a generic denial. Other codes: `NOT_LINKED`, `MON_NOT_FOUND`, `PRESENCE_REQUIRED`, `NOTHING_INCUBATING`, `RATE_LIMITED`.

## 4. Sequence diagrams

### 4.1 The James scene (demo beat 3)

```mermaid
sequenceDiagram
    autonumber
    participant J as James (in the room)
    participant App as NYC-Mon app (Caller's phone)
    participant RT as Supabase Realtime
    participant FPS as Familiar Presence Service
    participant MCP as @acme/mcp-server
    participant Agent as Alexa+ / web-sim agent<br/>(Agent Skill loaded)
    participant User as Caller (at the Echo)

    J->>App: speaks nearby (phone mic, consented surface)
    App->>App: VAD → speaker embedding → match vs enrolled embeddings
    App->>RT: publish PresenceEvent{personId: james, confidence: 0.93, ts}
    RT->>FPS: PresenceEvent
    FPS->>FPS: tier: present (≥0.90); attach to Caller's session context
    User->>Agent: "Yo Ratti, what's up?"
    Agent->>MCP: tools/call check_on_mon (bearer = linked Caller)
    MCP->>FPS: recent PresenceEvents for callerId
    FPS-->>MCP: [james @ 0.93, present]
    MCP-->>Agent: { mon status, presentPeople: [james], tier: 'present' }
    Agent->>Agent: Skill: tier ≥0.90 → react toward James
    Agent-->>User: "Hold up— Yo James! …Yeah Callah, I'm good."
    Note over Agent,Echo: fragment shows Ratti turning toward James<br/>(full-screen three.js view re-renders on the event)
```

### 4.2 The Callah refusal (demo beat 4)

```mermaid
sequenceDiagram
    autonumber
    participant J as James (familiar, talk+play only)
    participant Agent as Alexa+ / web-sim agent
    participant MCP as @acme/mcp-server
    participant FPS as Presence service
    participant V1 as /v1 on admin-vite

    J->>Agent: "Use Mike's rare item on it."
    Agent->>MCP: tools/call feed_mon{itemId: rare} (speaker context: alexaVoiceId → james)
    MCP->>MCP: resolveActingVoice → familiar{personId: james, permissions: feed=false}
    MCP->>FPS: confirm james is currently present (freshness window)
    MCP-->>Agent: error { code: PERMISSION_DENIED_NOT_CALLER,<br/>actingVoice: {kind:'familiar', personId:'james'},<br/>requiredPermissions:['feed'], monId }
    Note over MCP,V1: /v1 is never called — denial happens before mutation
    Agent->>Agent: Skill: refusal beat — the Mon, not Alexa, refuses
    Agent-->>J: "You ain't my Callah. I'm not listenin' to you."
    Note over Agent: canon line shape (V11 ¶59); rendered by the<br/>character voice layer, never by the MCP server
```

Rules encoded in both diagrams: the mutation is refused **before** `/v1` is touched; the refusal is the *Mon's* voice because Mons are people and can refuse; an unknown voice (no presence event, no Voice ID) gets the same denial path.

## 5. Deployment shape (target, not built)

- `@acme/mcp-server` deploys as its own HTTPS origin (Alexa requires reachable HTTPS). Local dev runs on `http://localhost:8788`.
- Supabase project + Realtime publication `presence-events` — external dependency.
- `packages/web-sim` serves the simulator; in dev it can proxy to the local MCP server.
- The `alexa-ai` CLI package (`packages/alexa-addon`, TODO) introspects the tool manifest.
