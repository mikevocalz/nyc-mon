# NYC-Mon / Colyseus 0.18 district multiplayer — server authority first

Stacked draft on #46. The package subpath `@acme/core/realtime` now has a **working deterministic server-side authority primitive**, not a production socket server.

## Implemented in this increment

- A district `DistrictAuthority` that admits verified session-to-Caller pairs provided by the future *server* adapter, enforces room capacity, rejects duplicated session/player IDs, invalid vectors and stale sequence numbers.
- Player input is **direction intent**, not a client-provided absolute coordinate or delta time. A burst of packets can move at most once per fixed server tick. Cardinal/diagonal speed normalized, movement limited to the baked tile; an optional trusted collision query blocks walls. The server checks that query at the move's endpoint and at the centre of every walkability-grid cell the move crosses (grid DDA, `walkableCellMetres`, default 0.5 m), so a wall thinner than one tick of movement still stops it.
- Snapshot exposes only ephemeral in-room `callerId, x, z, tick`; never Better Auth account IDs, GPS coordinates, tokens, or an inventory. Disconnect drops the session.
- `packages/core/realtime` subpath is exported with no Colyseus/React/Three dependency. The existing OSM dataset and Mon ownership stay authoritative elsewhere. Tests exercise spoof/teleport/replay, boundary, collision and disconnect cases.

## The real Colyseus integration (pending dependency & server infrastructure)

**Protocol target:** Colyseus 0.18 with `@colyseus/schema` v5's `schema({x:t.number(),...})` builder. Old schema strings are not supported as field definitions in this version.

1. Pin `colyseus`, `@colyseus/schema`, `@colyseus/sdk` (current 0.18-era TypeScript client, not legacy `colyseus.js`) using the monorepo's release-age policy and update its `pnpm-lock.yaml` in one reviewable PR. No npm lock changes were made here because this environment cannot install from npm.
2. Add `apps/game-server`: authenticate a Better Auth session server-side at Room authorization; verify current Caller/world ownership in existing Neon tables before calling `join()`. Never accept `callerId` or `startX/Z` from client room options. Resolve those from signed user/active world save.
3. Use one Colyseus room per authorized, bounded district instance. Map `client.sessionId` to `DistrictAuthority`. `onMessage("move")` must parse a small finite `{seq,dx,dz,run}` intent before `submit()`; do not accept `{x,z}` teleports.
4. Server fixed interval runs `authority.step()` at 20Hz (50 ms), updates the Colyseus schema state. On the client interpolate remote Caller/Mon positions in Three.js only; local player prediction/reconciliation needs a later explicit design, not a second truth store.
5. Collision indexing comes from the same baked district tile; server cannot trust client obstacle queries or environment LOD. Stop spawns on roads/crossings. Wild spawn seeds and species come from the existing approved Payload catalog rather than fabricated DB entries.
6. On room leave/disconnect, remove ephemeral presence. Before persistence update, apply revisions through the existing world-save authority with optimistic concurrency; never overwrite another device's newer save.
7. Auth/TLS, spam-rate limits, idempotency, protocol versioning, client clock independence, reconnect grace, network partitions and capacity attacks are release blockers. No public location proximity from room coordinates.
8. Monitor server tick processing p95, room join/leave churn, schema bytes per player, device FPS and battle determinism; do not claim multiplayer until two separate authenticated devices share a district and complete a server-validated encounter.

## Senior reviewer roster

- Authoritative multiplayer engineer (Colyseus 0.18, room lifecycle and schema patches).
- Backend AppSec engineer (Better Auth, account/Caller ownership, replay protection, rate limits).
- Gameplay simulation engineer (movement speed, deterministic battle/spawns, collision).
- Three.js/TypeGPU performance engineer (interpolation, entity LOD and network GPU occupancy).
- Neon/Payload data engineer (no duplicate player/Mon/CMS truth, migration safety).
- QA/chaos engineer (lossy network, reconnect, delayed packets, two client devices and attack cases).

Read Colyseus 0.18 Schema/State Sync docs, Game Performance Optimization skill, and apply the foldable/native QA matrix. These are handoffs; no autonomous external subagent or live server instance ran here.

**The actual Colyseus socket server is not implemented yet. Do not merge/deploy or claim real multiplayer.**
