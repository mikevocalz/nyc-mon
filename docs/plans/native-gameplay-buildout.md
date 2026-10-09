# Native GAME buildout: implementation roadmap after the companion vertical slice

**Status: Draft, no production feature implemented by this PR.** Scope comes from `docs/canon/GAMEPLAY_BIBLE_V12.md` and the authoritative current canon decisions. PR #11 builds the egg/companion loop; the full native GAME/world/combat program remains larger. This plan must not be misreported as complete.

## Product contract

- Native tabs: HOME · GAME · H-LYNK · MONS · CALLER. GAME owns exploration and battles, without a separate Battles tab. Web remains the public marketing homepage plus focused authenticated Mon Space; don't ship the whole city game in web accidentally.
- One authoritative Caller and Mon identity, care, bond, progression and memories across sessions and future XR; never fork a distinct battle Mon.
- NYC world geometry is NYC-specific and georeferenced: compile legal NYC OpenStreetMap/open city geometry to a versioned runtime dataset, with boroughs, transit, streets, landmarks and named block identity. Follow the repo's Three.js WebGPU/TypeGPU architecture, LOD/instancing and camera/memory budgets; no Unity.
- Creature world renderer/effects through typed contracts. Viro/Eskiu spatial surfaces reuse existing #9 scene contract and #18 Quest plan; do not ship invented anchors or unsupported headset fallbacks.
- For physical-world presence or outdoor game modes, Phase 2 is explicitly parked by ADR 0013 / PR #10; location permission, safety/counsel review, accuracy measurements and creator decisions are gates, not defaults.

## Slice-by-slice delivery (split into focused implementation PRs)

### G01 — Native GAME shell + city dataset contracts
Deliver Expo Router GAME route, map/scene UI, typed NYC dataset and offline loading, tile/feature IDs, version provenance, memory budgets, fallback for weak GPUs and scene lifecycle tests. Keep a complete accessible 2D navigation mode for users who don't use 3D. Use existing `packages/ui`, Kinetrell motion and app Zustand store.

### G02 — World movement, landmarks and save/restore
Add precise travel/camera contracts and safe NYC location references. Deterministic save snapshot and restore through app background/termination, block-area loading, named landmarks and a frame-time profiler. No location-based outdoor encounter routing until the separate safety gates pass.

### G03 — Encounter state machine + authorship
Use canonical Hood Mon identity/agency, choice, refusal, dialogue and replayable snapshots; no "wild" terminology, no blind capture. Seed deterministic fixture encounters for tests only. Events and progression must survive process death and cross-device handoff.

### G04 — Server-authoritative combat vertical slice
Battle ground (first controlled sandbox, then canonically Rucker/Union Square), 8-Affinity matchup only, typed ability/move IDs, server Battle Rating, action order, HP/faint without Mon death, rewards, rivalry, historical replay, deterministic rollback and anti-cheat. Human-vs-human and Mon-vs-Mon rules stay distinct; do not approximate unresolved canon type conversions.

### G05 — Multiplayer, cards, seasonal live ops
Integrate Fishjam/MoQ communication, Yjs collaborative UX where appropriate and authoritative server game state. Add human cards, tournaments and Payload-editable schedules/events only when gameplay is validated. No direct client writes to win/loss truth.

### G06 — Stories, EngineX and XR
Compose ~60-second gameplay-derived Stories from actual saved events, then EngineX underground content, special three-round Ultimate Battles and XR handoff as separately verified releases. Follow #18 instead of duplicating its blocked Quest anchor work.

## Cross-cutting gates

- Canonkeeper: source tags and decision references for abilities, evolution, matchmaking, equipment and geography; keep every unknown explicitly pending.
- Security: server ownership of resources, idempotent actions, input validation, abuse/rate limits, minors/privacy boundary, no leaked location history.
- Design/UX: Mobbin research, design-system and typography audit, accessibility/dynamic type, no-AI-slop copy, Storybook states, responsive foldables, low distraction map interactions.
- Performance: TraceSift from PR #7 plus native/Three/WebGPU GPU profiling. Publish device models and p50/p95 memory/frame evidence rather than claiming 60 fps without measurement.
- Verification: `pnpm install --frozen-lockfile`, lint, typecheck, deterministic sim tests, server contract tests, gameplay integration and physical-device QA (Android/iOS/tablet/foldable), plus Quest only when native anchor infrastructure is ready.
- Team ownership: gameplay architect, core sim, GIS/NYC data, graphics/WebGPU, Expo platform, network/security, test/QA, creator/canon and accessibility/design review. Assign specific skills by lane; all evidence in each PR.

## First ready-for-work child PR

Start with **G01 only**, based on the merged Phase 1 companion code. A successful G01 loads a deterministic sample of approved NYC geometry on a real phone, renders a stable camera/world under budget, restores the current Mon after navigating in/out, and contains no pretend street encounters or unratified battle rules.

## Non-duplication

PR #19 handles unresolved Phase 1 art/canon; PR #16 consent/presence ADRs; PR #18 Quest presence. This draft intentionally defines downstream work that has **no implementation PR yet**.
