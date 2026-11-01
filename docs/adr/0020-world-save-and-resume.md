# 0020 — World save and exact resume

- **Status:** Proposed
- **Date:** 2026-10-15
- **Deciders:** Mike (creator) signs off; lane E (Game Systems and Persistence) implements
- **Builds on:** ADR 0002 (sim core, Laws 3, 5, 6), ADR 0014 (save v2, migration table), Master Directive v2 §2C, §3, §11, §13, §14 (`/Users/mikevocalz/Downloads/NYC‑MON ARCADE CONTROL + GAME LOBBY — Master Directive v2.md`)
- **Sources:** `packages/app/features/game/city-dataset.ts` (`projectCityPoint`), `city-camera.ts` (clamps), `camera-input.ts` (`headingDegrees`), `packages/ui/game-controls/contract.ts` (`PillState`), react-native-mmkv 4.3.2 `lib/index.d.ts` and `lib/specs/MMKV.nitro.d.ts`, zod 4.6.5 `v4/classic/schemas.d.ts` (`z.number()` rejects non-finite by default), https://github.com/margelo/react-native-skills/tree/main/skills/api-design
- **Code:** `packages/core/schemas/{world-save,leaderboard}.ts`, `packages/core/world/{migrate,transform,resume,session}.ts`, `packages/core/leaderboard/source.ts`, `packages/app/features/game/world-resume/*`, tests `packages/core/test/{world-resume,game-session,leaderboard}.test.ts`, `packages/app/features/game/world-resume/save-cadence.test.ts`; spike `docs/performance/rn-game-engine-next-spike.md`

## Context

§3 makes exact resume a P0: the player comes back to the last durably saved coordinates, heading and camera, with no teleport from spawn. The Game tab today keeps its camera in a session-only Zustand store (`game-session.ts`: "persisting it to MMKV is DEFERRED until there is a player position worth restoring"). The pill (§2C) needs a session owner so Rive can reflect state it never decides. The lobby needs a leaderboard boundary, and no ranking authority exists.

## Decision

**A second save, not a third field on the first.** `WorldSaveV1Schema` is its own versioned blob in its own MMKV instance (`world`), apart from the Mon save (`nyc-mon-save`). It is written on a cadence while the Game tab is open; the Mon save is not. Keeping them apart means a world write can never touch eggs, Mons or care (Law 6), and the lobby can read it synchronously at boot without parsing the larger Mon save.

**Canonical position is WGS84 with the transform's inputs stored beside it.** `position: { crs: 'EPSG:4326', longitude, latitude }` plus `dataset: { datasetId, datasetVersion, originRef }`. Scene `(x, z)` is re-derived with `world/transform.ts`, a copy of `projectCityPoint`'s arithmetic (equirectangular about the origin on a 6 371 008.8 m sphere). Core cannot import the app (Law 3), so the formula is duplicated and `world-resume.test.ts` pins both to 84.1614436019474 / −111.19508023327376 for the point `city-dataset.test.ts` checks. The camera `(x, z, yaw, distance)` is stored too, so the common case (same dataset, same origin) resumes bit-identical doubles with no arithmetic at all (fixture 3). Only an origin move re-projects.

**Precision is plain doubles, never float32, never a chunk index.** A longitude's ulp is about 3e-9 m; a scene coordinate inside the ±2000 m clamp has an ulp of about 4.5e-13 m. The round-trip test holds the inverse projection under 1e-6 m across 2000 random points plus every corner of the clamp (fixture 4 covers 250 m chunk edges). Chunk indices are floors of those doubles at load, so a save on an edge resolves to the same chunk.

**Heading is stored, not only derived.** `headingRadians` is `−yaw mod 2π`, the radian twin of `headingDegrees`. It sits beside the camera so a later camera model with pitch or roll keeps the same field.

**Revision + savedAt is the conflict rule.** `revision` rises by one per durable write. `resolveResume` orders candidates by (revision desc, savedAt desc), keeps the local copy on a full tie, and lists every loser with a reason (`stale-revision`, `older-same-revision`, `duplicate`). A lower-revision offline snapshot never wins over a synced newer one (fixture 8); two devices that both reached the same revision resolve by `savedAt` (fixture 8b). `sync: { syncedRevision, pendingSince }` is the bookkeeping a future sync endpoint reads.

**Never spawn by accident.** `new-game` only when there are zero candidates. One or more candidates that all fail is `error { reason, recovery }`: `future-version → keep-waiting`, `incompatible-dataset → start-new`, `corrupt → retry-sync` (or `start-new` once a remote copy was already tried), `not-owner → start-new`. The lobby shows the reason; the player picks.

**A dataset migration is a coordinate migration.** `DatasetMigration { datasetId, fromDatasetVersion, toDatasetVersion, migratePosition }` moves only the canonical position; the origin change is a re-projection; revision, session and world instance are untouched (fixture 10b). No chain for a version pair is `incompatible-dataset`, never a reset.

**The session machine owns the pill.** `world/session.ts`: `idle → playing` on `start`; `pillPress` toggles `playing ↔ paused`; `stopConfirm` then `confirmStop` is the only way to `idle`; `cancelStop` returns to exactly the prior state; `background` pauses and never ends a session. `start` while a session exists is ignored, so a second id can never be minted mid-session. Pause, background and stop emit `request-save` effects; the app runs them.

**Save cadence is bounded and idempotent by revision.** `save-cadence.ts`: every 15 s while playing, and on pause, background, stop, exit. Nothing subscribes to the camera store, so a gesture never writes. The draft revision is `stored + 1` when dirty, else `stored`; an unchanged draft never writes. `worldSaveStore.commit` refuses any revision not above the stored one, so a stale closure cannot roll back.

**Leaderboard is read-only and honest.** `LeaderboardSource.load()` returns `ready | empty | stale | error`; rows pass `LeaderboardRowSchema` one by one and bad ones are dropped, not fatal. `createUnavailableLeaderboardSource()` answers `error / no-ranking-authority` until a server ranking exists. There is no `submitScore`: a competitive ranking never trusts a client score.

**`rn-game-engine-next` is struck** (spike doc): competing JS-thread `requestAnimationFrame` loop against `ThreeCanvas`'s on-demand drawing, authoritative state duplicated in an untyped entity map, a `PanResponder` that claims the whole view, a second haptic native module and an optional `react-native-sensors` peer the repo does not have. No device benchmark was run; the static grounds already fail §11.

## Consequences

- `game-session.ts` still owns the camera in memory; the lifecycle hook reads it and writes the world save. Wiring the lobby's START to `resolveResume` and restoring `gameCameraStore` from the result is the lobby lane's integration step, not in this ADR's code.
- `@acme/ui` has no `./game-controls` export yet, so `save-cadence.ts` checks `WorldPillState` against a literal mirror of `PillState`; re-point it at the export when it lands.
- No server endpoint reads or writes the world save. `sync` fields are written but `syncedRevision` stays 0 until one exists; `resolveResume` already accepts `remote` candidates for that day.
- `districtId` is `null` until the dataset carries districts; "last verified district" in the lobby stays hidden until then.
- The pre-existing `phase1-loop.test.ts` nickname failure in `@acme/core` is unrelated to this change and is left for its owner.
- Session ids (2026-10-15, review finding L5). A START that resumes an eligible save reuses that save's `sessionId`; only a new game mints one (`mintSessionId`). The lobby plan carries the id on its `start-session` step (`lobby/resume-sequence.ts`), and the in-game START uses `sessionIdForStart` (`world-resume/world-snapshot.ts`), which reuses the stored id only when the save belongs to the same Caller. One session id therefore spans exit and reopen of the same world; a new id means a new game. The session machine is unchanged: `start` still only applies from `idle`.
- The lobby starts the session after the world's first frame, right before the reveal, so nothing under the cover is a live session and a START whose world never draws leaves no session behind (review findings C1, H1).
- Ownership on write (review finding M1). `saveWorldNow` refuses to write when the stored save belongs to another Caller (`ownedPrevious` returns `'foreign'`), so one Caller's world instance and revision are never carried into a write under another identity. The Caller has to choose a new game in the lobby first.
- Device id (review finding M2). A world identity takes the Mon save's queue id when it has one; otherwise the world store mints an id once, persists it under `world-device-id` in the `world` MMKV instance, and reuses it.
- "Start a new game" over an unreadable save copies the raw value to `world-save-quarantine` before removing it (review finding M20); a later quarantine replaces an earlier one.

