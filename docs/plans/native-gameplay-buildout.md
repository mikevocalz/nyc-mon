# Native GAME buildout: implementation roadmap after the companion vertical slice

Status: roadmap. Scope comes from `docs/canon/GAMEPLAY_BIBLE_V12.md` and canon Decisions #23 to #28 (`docs/canon/DECISIONS.md`, 2026-10-06). PR #11 built the egg and companion loop; the first G01 slice has shipped since (PRs #30, #33, #34). See "Status 2026-10-15" at the end for what is on `main`, what is in flight and what remains. This plan must not be misreported as complete.

## Product contract

- Native tabs: HOME · GAME · H-LYNK · MONS · CALLER (Decision #23). GAME owns exploration and battles; battle is a game state, never a separate tab. Web stays the public marketing homepage plus the focused authenticated Mon Space; never ship the whole city game to web by accident.
- One authoritative Caller and Mon identity, care, bond, progression and memories across sessions and future XR; never fork a separate battle Mon.
- NYC world geometry is NYC-specific and georeferenced: compile legal NYC OpenStreetMap and open city geometry into a versioned runtime dataset with boroughs, transit, streets, landmarks and named block identity. Follow the repo's Three.js WebGPU/TypeGPU architecture (Decision #28), LOD and instancing, camera and memory budgets; no Unity.
- World styling follows the creator-approved futuristic NYCHA exterior facelift (2026-10-13), specified in `docs/implementation/MOBILE_WORLD_PR_PACK.md`: an additive overlay keyed by stable building IDs, housing classified against verified NYC and NYCHA data, train and transit visuals out of scope, no generated project names treated as canon. It leaves the OSM geometry G01 compiles unchanged.
- Creature world renderer and effects go through typed contracts. Viro and Eskiu spatial surfaces reuse the #9 scene contract (ADR 0010 to 0012) and the #18 Quest plan; do not ship invented anchors or unsupported headset fallbacks.
- Physical-world presence and outdoor game modes stay parked by ADR 0013 / PR #10; location permission, safety and counsel review, accuracy measurements and creator decisions are gates, not defaults.

## Slice-by-slice delivery (split into focused implementation PRs)

### G01: Native GAME shell + city dataset contracts
Deliver the Expo Router GAME route, map and scene UI, a typed NYC dataset with offline loading, tile and feature IDs, version provenance, memory budgets, a fallback for weak GPUs and scene lifecycle tests. Keep a complete accessible 2D navigation mode for Callers who do not use 3D. Use the existing `packages/ui`, Kinetrell motion and the app Zustand stores.

### G02: World movement, landmarks and save/restore
Add precise travel and camera contracts and safe NYC location references. Deterministic save snapshot and restore through app background and termination, block-area loading, named landmarks and a frame-time profiler. No location-based outdoor encounter routing until the separate safety gates pass.

### G03: Encounter state machine + authorship
Use canonical Hood Mon identity, agency, choice, refusal, dialogue and replayable snapshots; no "wild" terminology, no blind capture. Seed deterministic fixture encounters for tests only. Events and progression survive process death and cross-device handoff.

### G04: Server-authoritative combat vertical slice
Battle Ground (first a controlled sandbox, then canonically Rucker Park and Union Square per Decision #26), the eight-Affinity matchup only (Decision #25), typed ability and move IDs, a server Battle Rating, action order, HP and faint without Mon death, rewards, rivalry, historical replay, deterministic rollback and anti-cheat. Human-vs-human and Mon-vs-Mon rules stay distinct (Decision #24); never approximate the unratified legacy type conversions.

### G05: Multiplayer, cards, seasonal live ops
Integrate Fishjam and MoQ communication, Yjs collaborative UX where it fits, and authoritative server game state. Add human cards, tournaments and Payload-editable schedules and events only once gameplay is validated. No direct client writes to win/loss truth.

### G06: Stories, EngineX and XR
Compose roughly 60-second gameplay-derived Stories from saved events, then EngineX underground content, three-round Ultimate Battles and XR handoff as separately verified releases. Follow #18 instead of duplicating its blocked Quest anchor work.

## Cross-cutting gates

- Canonkeeper: source tags and decision references for abilities, evolution, matchmaking, equipment and geography; every unknown stays `TODO(canon)`.
- Security: server ownership of resources, idempotent actions, input validation, abuse and rate limits, the minors and privacy boundary, no leaked location history.
- Design and UX: Mobbin research, design-system and typography audit, accessibility and dynamic type, no-AI-slop copy, Storybook states, responsive foldables, low-distraction map interactions.
- Performance: TraceSift from PR #7 plus native, Three and WebGPU GPU profiling. Publish device models and p50/p95 memory and frame evidence instead of claiming 60 fps without measurement.
- Verification: `pnpm install --frozen-lockfile`, lint, typecheck, deterministic sim tests, server contract tests, gameplay integration and physical-device QA (Android, iOS, tablet, foldable), plus Quest only when native anchor infrastructure is ready.
- Ownership by lane: gameplay architect, core sim, GIS and NYC data, graphics and WebGPU, Expo platform, network and security, test and QA, creator and canon, accessibility and design review. All evidence in each PR.

## Non-duplication

PR #19 (draft) handles unresolved Phase 1 art and canon; PR #16 (draft) the presence and voice ADRs; PR #18 (draft) Quest presence. ADR 0013 (PR #10, merged) parks Phase 2 location encounters.

## Status 2026-10-15

Checked against `main` at `311ab58` (merge of PR #34) and the uncommitted working tree of the arcade-controller lanes. Two numbering systems meet here: the G01 to G06 below are the slices of this roadmap; `docs/design/screens/G01-arcade-controller`, `G02-game-lobby` and `G03-game-control-settings` are design screen IDs from the Master Directive v2 and are not the same things. The text below says "slice" or "screen" each time.

| Slice | Shipped on `main` | In flight (uncommitted, Master Directive v2, 2026-10-15) | Remaining |
| --- | --- | --- | --- |
| G01 shell + dataset | PR #29 (plan: `docs/implementation/MOBILE_WORLD_PR_PACK.md`, scope lock "City Renderer Only" 2026-10-13; `THREENATIVE_COMPATIBILITY_SPIKE.md`). PR #30: typed offline dataset parser `packages/app/features/game/city-dataset.ts` (NYC envelope, feature and point budgets, HTTPS source, ODbL provenance), `city-scene.ts`, `city-camera.ts`, the Apollo Theater sample `data/harlem-apollo.json` (17 buildings, 9 road features, estimates listed) and `tooling/city/compile-osm.py`. PR #33: `GameScreen.tsx` on a paused `ThreeCanvas` drawing on demand, RNGH 3 gestures (`use-city-camera-gestures.ts`), `CameraControls.tsx`, hinge-safe `hud-layout.ts`, `GameStatusLayer.tsx` (loading, ready, empty, data error, render error with Retry, unsupported GPU), `MapAttribution.tsx`, route `apps/mobile/app/(drawer)/(tabs)/game.tsx`; design plan `docs/implementation/GAME_SCREEN_PLAN.md`. PR #34: the left-rail branch removed after PR #31 fixed the rail to the physical right. | Screen G01 (arcade controller): `packages/ui/game-controls/` (`contract.ts` input contract, `ArcadeController`, `AnalogStick`, `DigitalDPad`, `ArcadeSixButtons`, `StartStopPill`, `ArcadeRiveSurface.*`, `layout/AdaptiveControlLayout`, `hardware/*` keyboard and gamepad mappings), the Nitro module `packages/ui/modules/nyc-gamepad-input/` (`docs/implementation/hardware-input.md`: Xbox, PlayStation, Nintendo and generic HID pads plus keyboards), `packages/app/features/game/use-game-input.ts`, `game-input-bindings.ts`, the controller profile and layout stores, `GameTab.tsx` (lobby first, then `GameScreen`). Screen G03 (control settings): `apps/mobile/app/(drawer)/game-controls.tsx`, `features/game/controls-settings/`. Design dossiers for screens G01 to G03 and research (`arcade-controller-mobbin.md`, `arcade-ergonomics.md`, `game-lobby-mobbin.md`, `arrangement-view-verdict.md`: REJECT for the controller). `rn-game-engine-next` spike: STRIKE (`docs/performance/rn-game-engine-next-spike.md`). | The canon five-tab shell (PR 1 of the PR pack; `main` has Game, Alerts, Profile). Tile streaming, LOD and instancing (PR pack stage 3). A separate accessible 2D navigation mode (the 3D view carries labelled buttons and accessibility actions only). Device first-frame and memory evidence: PR #33 states "No device or simulator run", and `hardware-input.md` states nothing in its lane ran on a device. |
| G02 movement + save/restore | Bounded camera pan, orbit, zoom and reset in a session-only Zustand store (`game-session.ts`); the camera is not persisted ("DEFERRED until there is a player position worth restoring"). | ADR 0020 "World save and exact resume" (Proposed): `packages/core/schemas/world-save.ts`, `packages/core/world/{migrate,transform,resume,session}.ts` (WGS84 position plus dataset ref, revision + savedAt conflict rule, a session machine that owns the START/STOP pill state), `packages/app/features/game/world-resume/*` (save cadence, MMKV `world` instance), screen G02 lobby `packages/ui/lobby/*` and `features/game/lobby/*` (resume sequence, resume summary). | Landmarks, block-area loading, the frame-time profiler, baseline frame-time and memory metrics (PR pack quality gate), travel contracts beyond the bounded camera. ADR 0020 needs Mike's sign-off. |
| G03 encounters | Seams only: `packages/core/schemas/seams.ts` `HoodEncounterSchema` with encounter rules `TODO(canon)`. | nothing | Everything. Outdoor routing stays parked (ADR 0013). |
| G04 combat | Canon only: Decisions #24 to #26 and the v12 Bible (combat law, Battle Rating, Battle Grounds, faint without death). Seams: `AffinitySchema`, `CombatClassSchema`, `CombatStatusSchema`, `BATTLE_CLIP_IDS`. The eight Affinities are still unlisted (`TODO(canon)` Q33). | nothing | Everything, and the Affinity list before any matchup code. |
| G05 multiplayer + live ops | Seams: `PlaySessionSchema`; Payload `IdempotencyRecords` and the `/v1` idempotency path (`packages/payload/src/admin/console/v1/`, PR #3). | Leaderboard boundary only: `packages/core/schemas/leaderboard.ts`, `packages/core/leaderboard/source.ts`; the lobby shows `unavailable` until a server ranking authority exists and never computes a score on the client. | Fishjam, MoQ and Yjs integration, cards, tournaments, Payload-editable schedules, the ranking authority itself. PR #16 (presence transport ADR) is still a draft. |
| G06 Stories, EngineX, XR | Canon only (v12 §Replays / Stories, §EngineX). Spatial contract ADR 0010 to 0012 from PR #9. | nothing | Everything. PR #18 (Quest presence) is still a draft, blocked on virocore anchors, the `@viro-external` link strategy and glb models. |

What this status does not claim: no in-flight path above is on `main`, in a PR or verified on hardware. The controller, lobby and resume lanes report typecheck and `node --test` results only.
