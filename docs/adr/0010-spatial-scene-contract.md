# ADR 0010: Spatial scene contract and the one Mon store

- **Status:** Proposed
- **Date:** 2026-10-08
- **Deciders:** Mike (creator) signs off; the spatial Contract agent implements (PR A)
- **Builds on:** ADR 0002 (sim core), `docs/SPATIAL.md`, `docs/XR-PLATFORM-MATRIX.md`
- **Code:** `packages/core/schemas/spatial.ts`, `packages/core/sim/scene-input.ts`, `packages/app/features/mon/`
- **Contract reference:** `docs/spatial/CONTRACT.md`

## Context

The phase-1 brief kept XR surfaces out of scope and asked for seams. The spatial program now puts the Mon on a headset, a phone and the web. Three facts shape the contract:

1. **Mike's decision: Viro renders the Mon on every platform.** Headset (Quest 3 is the XR target), phone and web all draw the same Mon through `@reactvision/react-viro` (the private fork, `3.0.2-moyo.1` in `node_modules`). A renderer therefore needs one platform-neutral description of the Mon to draw, not one per platform.
2. **Mike supplies the glb models later.** The contract has to name every slot a model will fill without inventing a model, a clip name or a scale.
3. **The Mon's state already has one home.** `packages/core` owns the schemas and the sim; the save is one MMKV value (`nyc-mon-save`, key `save`) read and written by `packages/app/features/onboarding/save-store.ts`. Before this ADR no Zustand store held the Mon, so every screen that needed it re-read MMKV.

Canon gives no lifecycle triggers, no care numbers and no Baby scale (OPEN_QUESTIONS Q19, Q20, Q29, Q43). Nothing in this ADR supplies them.

## Decision

### `MonSceneInput` is the only thing a renderer reads

`MonSceneInputSchema` (core) is the renderer contract. Fields:

| Field | Type | Phase 1 |
|---|---|---|
| `mon` | `MonSceneMon`: `monInstanceId`, `speciesId`, `bloodlineId`, `stage`, `care` (`energy`, `fullness`, `social`), `mood`, `intent` | always set |
| `mode` | `'screen' \| 'tabletop' \| 'room' \| 'street' \| 'preview'` | `street` is typed, never produced (ADR 0011) |
| `placement` | `'table' \| 'floor' \| null` | from `resolveSceneMode`; `null` in `screen` and `preview` |
| `anchors` | `SceneAnchors \| undefined`: `space: 'local-floor'`, optional `table`, `floor`, `wall` poses | only anchors the resolver accepted; absent in flat modes |
| `hLynk` | `'app' \| 'hand_panel' \| 'wrist_panel'` | from `resolveSceneMode` |
| `legend` | `null` | Phase 2 widens it to `LegendRef \| null` |

The brief wrote the H-Lynk field as `h_lynk`. Core spells every field in camelCase (`monInstanceId`, `incubationEndsAt`), so the field is `hLynk`; the values keep the brief's spelling.

Poses are plain numbers: position in metres and a unit quaternion (`w` last, OpenXR `XrQuaternionf` order), all in OpenXR LOCAL_FLOOR space (+Y up, floor at y = 0). The schema rejects a quaternion whose norm is off by more than 1e-3.

`buildMonSceneInput` is the only constructor. It takes the `ResolvedSceneMode` from `resolveSceneMode` (ADR 0011) and copies `mode`, `placement`, `hLynk` and the accepted `anchors` from it, so a renderer never sees an anchor the resolver dropped as stale and `street` cannot reach it by type. The schema refines the combination: flat modes carry no placement, no anchors and the `app` H-Lynk; a table placement needs a table anchor; `room` stands on the floor with floor and wall anchors.

It derives two values from care, deterministically:

- **`mood`** (`deriveMonMood`), first match wins: `asleep`, `sluggish` (`sluggishUntil > updatedAt`), `needs-fullness` (pending food request or Fullness unmet), `needs-energy`, `needs-social`, `content`. "Unmet" is `listUnmetNeeds`, so the threshold stays `CareTuning.needsAttentionBelow` and moves when Q20 is answered. Each mood names a care fact that already exists; none adds a meter or a story claim.
- **`intent`** (`deriveAnimationIntent`), first match wins: a running `ActionCue` (`eat`, `play` or `evolve` until `untilMs`), `sleep` while asleep, `approach` while the approach trigger is active (ADR 0012), else `idle`. The cue's end time comes from the clip the renderer plays, so core holds no animation lengths.

`legend` is a Phase-2 seam. Its Phase-2 shape, `LegendRefSchema = { legendId, blockId }`, carries ids only; no legend content exists in canon (Q46).

### Model slots: typed and empty

`MonModelSlotSchema = { bloodlineId, stage, glbUri: string | null, clips: { idle, approach, eat, sleep, play, evolve } }`, every clip `string | null`. A type test pins the clip keys to `ANIMATION_INTENTS`. `emptyModelSlots(bloodlineIds)` builds one slot per bloodline × lifecycle stage; `packages/app/features/mon/model-slots.ts` builds `MON_MODEL_SLOTS` from `@acme/content` bloodlines (F01, F02, F12 → 15 slots), all null. When Mike delivers a glb, its slot gets a uri and clip names and nothing else changes. A renderer that reads `null` draws its placeholder.

The brief's per-starter clip list (`idle_a`, `approach`, `eat_{food_class}`, `sleep_loop`, …, §3.2) is finer than the intent set. The slot maps an intent to the one clip the rig provides for it; food-class eat clips wait on Q22.

### Phase-2 slots on `MonInstance`

`originBlock: OriginBlockId | null`, `habitatTags: HabitatTag[]` and `activeHours: { startMinute, endMinute } | null` were added to `MonInstanceSchema` with zod defaults (`null`, `[]`, `null`). A save written before this change parses unchanged; `test/scene-input.test.ts` loads such a v1 save through `loadSave`. No save version bump: the change only adds defaulted keys, so every existing blob still parses and no migration is needed.

`OriginBlockId` and `HabitatTag` are branded strings, not unions. Canon lists no blocks and no habitats, and a union would freeze values nobody has authored. When canon publishes the lists, the brand can narrow to a union in one place. Nothing in Phase 1 reads these fields; `mintMonInstance` writes the defaults. Payload's `toMonInstance` does not carry them yet, so a server round trip yields the defaults, which is correct while they are always empty.

### One Mon store, written through the save

`packages/app/features/mon/create-mon-store.ts` exports `createMonStore(io: SaveIO)`. `mon.store.ts` binds it once to `saveIO`, the same `createSaveIO(saveStorage, SAVE_KEY)` instance that `readSave` and `writeSave` now delegate to. `apps/mobile/app/_layout.tsx` calls `hydrateMon()` next to `hydrateOnboarding()`.

- The store owns the parsed save (`save`) and the active Mon id. It has no other persisted field and writes no other key; a test asserts the save key is the only key written.
- `applyCare(action, atMs)` re-reads the save, applies `applyCareAction`, queues the write with `enqueueCareWrite`, and writes the whole save back through `SaveIO`. Re-reading first means a write made by another feature since hydrate (the Caller profile from M07, for example) is kept instead of overwritten.
- `SaveIO.addOnWriteListener` fires after every write through the binding. The store subscribes at creation, so `writeSave` and `storeCallerProfile` land in the store without a manual `hydrate()`; a test writes a profile from outside and reads it through the store.
- Selectors: `selectActiveMon` (identity), `selectStarterBloodlineId` (starter, via `@acme/content`), `selectStage`, `selectActiveCare`, `selectEvolutionProgress` (`stage`, `bond`, `PHASE1_FEATURE_FLAGS.evolutionEnabled`), `selectLastSeen` (`careUpdatedAt`, `lastFedAt`, `lastRestedAt`, `lastSocialAt`), and `selectSceneInput(scene: ResolvedSceneMode, presence?)`. Object-returning selectors cache on the save's records, so zustand v5's `useSyncExternalStore` sees a stable snapshot.
- "One store" is tested: two subscribers receive the same state object on every change, and a second store hydrating from the same `SaveIO` reads back what the first wrote.

Other writers (`storeCallerProfile`, and the hatch writer when it lands) still call `writeSave` directly; the write listener keeps the store current. Moving them into the store as actions is a follow-up, not part of this PR.

**BootScreen is unchanged.** It resolves the boot route from the raw save in a render-time ref and drives a timed power-on sequence. Moving it onto the store would change when the save is read relative to the 600 ms budget and is not a small change, so it stays on `readSave`.

## Options considered

### Option A: scene input built in core, store in app (chosen)

| Dimension | Assessment |
|---|---|
| Complexity | Low: pure functions plus one store factory |
| Determinism | Mood and intent are pure functions of care and caller-supplied presence |
| Testability | Core under vitest; store under `node --test` against an in-memory `SaveIO` |
| Coupling | Core never imports Viro, React or content; app resolves the bloodline |

### Option B: each renderer reads the save and derives what it needs

Rejected. Three renderers (headset, phone, web) would each re-derive mood and intent, and the first rule change would land in one of them only.

### Option C: Zustand `persist` middleware for the Mon store

Rejected. `persist` writes its own serialised copy of the store under its own key, which would be a second copy of the save next to `nyc-mon-save`. The save codec (`loadSave`, migrations, `SaveLoadError`) already exists; the store writes through it.

## Consequences

- A renderer on any platform takes one `MonSceneInput` and one `MonModelSlot` and draws.
- Answering Q20 changes mood thresholds through `CareTuning` with no contract change.
- Adding `street` (Phase 2) needs a resolver change only; renderers already switch over it.
- The store is the place to put the next Mon writer. A writer that bypasses `saveIO` (raw MMKV) would not notify the store; none exists.

## Open questions

- Canon: Q19, Q20, Q29, Q43–Q46 in `docs/canon/OPEN_QUESTIONS.md`.
- **Product (not canon): PayPal E-Card balance.** The brief mentions an E-Card balance. Neither canon nor code has an E-Card, so the store has no field for it. Mike to decide whether it exists, where its balance lives (server, save, payment provider) and whether a minor can hold one.
