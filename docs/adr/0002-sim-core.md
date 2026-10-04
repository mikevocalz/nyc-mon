# ADR 0002: Sim core

- **Status:** Proposed
- **Date:** 2026-10-04
- **Deciders:** Mike (creator) signs off; the `sim-core` agent implements
- **Spec:** `prompts/BUILD_PROMPT_v3.md` §0 (expansion rule), §1.4 (server contract), §2.1 (lifecycle and care), §3.2 (idle vignettes), §8 (sim acceptance); Laws 3, 5, 6, 7 and 8
- **Canon:** `docs/canon/source/NYC_MON_Canon_and_Lore_Bible_v11.docx`, sections Lifecycle, Hatching and care, Cross-device companion continuity
- **Code:** `packages/core` (`@acme/core`)

## Context

The care loop, the hatch and cross-device continuity have to behave the same on a phone, on a second device and on the server. The Bible fixes the shape: Egg → Baby → Small → Mid → Max; a hatchling stays Baby until an authored evolution; 15, 30 or 60 minute incubation; Energy, Fullness and one Social meter; Mons request food; fainting is recoverable and never an egg reset; "a device session is a surface, not a new creature". It publishes no decay rates, thresholds or bond values.

## Decision

### Package layout

| Path | Contents | Runtime imports |
|---|---|---|
| `schemas/` | zod 4 schemas, one per concept | `zod` |
| `types/` | `z.infer` types for every schema | none (type-only) |
| `sim/` | pure care sim, hatch machine, evolution gate, write queue, PRNG | relative files only |
| `save/` | versioned save loader and migration table | `zod` (through `schemas/`) |

Schemas are the single source of truth; types are inferred from them. `sim/` never parses: callers parse at the boundary (Law 5) and hand typed values in.

### Determinism (Law 3)

- `step(state, now, seed, options)` is a pure function. Nothing in `sim/` reads the clock, `Math.random`, the DOM, React, three.js or Expo. `test/laws.test.ts` scans every `sim/` file and fails on any non-relative import or any of those identifiers.
- Randomness is mulberry32 and hashing is cyrb128, both 32-bit integer math, both from https://github.com/bryc/code/blob/master/jshash/PRNGs.md.
- Both decay shapes (linear, exponential half-life) compose exactly, and the sim splits time at real events (self-wake, sluggish end). Advancing to `b` in one call gives the same meters as advancing to `a` then `b`, to 1e-9. Event times (food request, needs-you) are solved analytically and rounded up to the next millisecond, so they survive a split within 1 ms.
- Idle vignettes are scheduled on a fixed epoch grid of slots; each slot draws from `mixSeed(seed, slot)`. Any window over the same span returns the same vignettes however it was split, so the renderer can ask for "the last 3 s" on every frame.

### Care

- `CareState` has `energy`, `fullness`, `social` in [0, 1], activity (`awake` | `asleep`), `sluggishUntil` and `pendingRequest`. There is no HP, health, sickness or death field (Law 8); a test asserts the key names.
- Invariant: awake and Fullness below the request line means a pending food request. Requests are derived from meters, not from randomness.
- Overfeeding sets `sluggishUntil`; while sluggish Energy drains faster and feeding is declined. Sluggish ends on its own.
- Sleeping recovers Energy linearly; the Mon wakes itself at full Energy. Waking it early costs Social.
- Actions (`feed`, `rest`, `wake`, `play`) go through `applyCareAction`, which advances to the action time first. An action timestamp older than `care.updatedAt` is applied at `updatedAt`; sim time never runs backwards.
- All rates and thresholds live in `DEFAULT_CARE_TUNING` and are tunable game feel, marked `TODO(canon)`.

### Lifecycle (Law 7)

`step` never writes `stage`. `applyEvolution(mon, event, flags)` is the only path that does; it needs an authored `EvolutionEvent`, the `evolutionEnabled` flag (off in `PHASE1_FEATURE_FLAGS`), an adjacent stage, the right species and enough bond. It keeps `monInstanceId`, nickname, bond and voice lineage, matching the Bible's "evolution preserves the same monInstanceId".

### Hatch (Law 6)

- `deriveMonInstanceId(eggId)` is the one id an egg can produce. The server reserves it with the same function in `POST /v1/eggs`, so an egg created offline and an egg created online reserve the same id.
- `mintMonInstance(egg)` is a pure function of the `EggRecord`. The Mon is minted as the Baby form in `egg.hatchesIntoSpeciesId` (e.g. Metro Egg `dex-001` hatches into Squeaklet `dex-002`); the caller copies that id from `@acme/content` when it creates the egg, so core never imports content. `hatchedAt` is `incubationEndsAt`, not the device clock, so device A, device B and the server mint identical individuals.
- `transitionHatch` is a discriminated union: `incubating → ready → presenting(phase) → hatched`. The individual is committed on the first `ready → presenting` edge (or `ready → hatched` on skip). Presentation phases are cosmetic; skip at any phase lands on the same individual. A second `open` is a no-op. A server confirmation with a different `monInstanceId` throws `HatchIntegrityError`, the P0 case.
- `resolveHatch(ledger, egg)` is the server half: returns the existing individual on retry, mints once otherwise.

### Writes and merge (§1.4)

- Each device keeps a `WriteQueue` with a monotonic `seq`, persisted in the save blob.
- §1.4 says `PUT /v1/mons/:id/care` carries a "CareState delta". The delta is sent as the Caller action (`CareWrite = { deviceId, seq, monInstanceId, at, action }`), not as meter numbers. The server replays actions through the same sim, so client and server cannot drift on rates, and a duplicate write cannot double-apply a number.
- `applyCareWrites` drops writes at or below the device's last applied seq, sorts the rest by `(at, deviceId, seq)` and replays them. Batch order does not matter and resending is a no-op.
- `reconcileWithServer` adopts the server state, drops acked writes and replays the rest locally. Conflicts resolve silently in the server's favour (M21).

### Save blob

One versioned JSON value in MMKV (`SaveV1Schema`). `loadSave(raw)` reads the version from the envelope, walks `SAVE_MIGRATIONS` one version at a time, then parses with the current schema. Failures are a typed `SaveLoadError` with `reason: 'corrupt' | 'future-version' | 'missing-migration' | 'invalid'`, which M22 uses to fall back to the last good snapshot. v1 is the first shipped shape, so the table is empty; the next shape appends `{ from: 1, migrate }` and bumps `CURRENT_SAVE_VERSION`.

**`callerName` tightened in place (2026-10-04).** `CallerProfileSchema.callerName` went from 1–32 characters to the M07 rule (M07 handoff B5): at most 16 UTF-16 code units, trimmed, NFC, at least one letter, and only letters and marks in any script plus space, `-`, `'`, `’` and `.`. The schema refines with `isStoredCallerName`, the same check `validateCallerName` runs minus the block list. `birthYear` now uses `BirthYearSchema` (same bounds, 1900–9999). This changes `SaveV1Schema` without a version bump because v1 has not shipped: no save on any device can hold a name the new rule rejects. Once v1 ships, a rule change like this needs a v2 migration that repairs or clears an out-of-rule name so M07 asks again; a stored name must never make `loadSave` fail.

### Boot routing, age gate and Caller name (M01, M04, M07)

All pure, in `sim/`, no clock but the `nowMs` argument:

- `resolveBootRoute(snapshot: BootSnapshot): BootRoute`. The snapshot is `{ save: BootSave; hasSession; ageAnswer; nowMs }`; `readBootSave(raw)` in `save/` turns the raw MMKV string into `BootSave` (`missing` / `loaded` / `unreadable` with the `SaveLoadError` reason) without throwing. Route order: `save-recovered`, `restore` (a session with no save on this device), `consent-denied`, `companion`, `egg-ready` (at or past `incubationEndsAt`, or a hatch already past `incubating`), `incubating`, then `resume-onboarding` (`egg-choice` with a Caller, `caller-name` with a session after restore, `create-account` / `guardian-consent` with a stored age answer) and `first-run`. Offline is not an input, so a route never depends on the network. `restore`, `resume-onboarding` and the `reason` on `save-recovered` are additions to the union in the M01 handoff (`docs/design/DECISIONS.md` L2). On `restore` the app fetches `GET /v1/me/mons` and the Caller profile, writes the save, and calls `resolveBootRoute` again; the server is authoritative, so a signed-in player on a fresh install never gets a second Caller. `caller-name` is left for a session whose restored profile has no Caller name.
- `resolveCreateEntry({ ageAnswer, nowMs }): CreateEntry` is the P1 guard (`docs/design/DECISIONS.md`): `create-account` comes back only with a stored M04 answer for which `isConsentRequired` is false. `resolveBootRoute` uses it, so a resumed boot cannot skip the age gate either.
- `isConsentRequired({ birthYear, nowMs })` is ADR 0001's `currentYear - birthYear <= 13` with the UTC year, the same year the server hook takes (`new Date().getUTCFullYear()` in `packages/payload/src/auth/options.ts`). `utcYearFromEpochMs` computes that year with Hinnant's `civil_from_days` (https://howardhinnant.github.io/date_algorithms.html#civil_from_days) because Law 3 bans `new Date` in `sim/`; a 10k-run test checks it against `getUTCFullYear`. A non-integer `birthYear` throws `RangeError` instead of returning false.
- `validateCallerName(raw, filter)` returns `{ ok: true; name } | { ok: false; reason: 'blank' | 'too-long' | 'characters' | 'blocked' }`, first failing rule wins in that order. The block list is a required `CallerNameFilter` argument, so the app cannot call it without one. `callerNameErrorCopyId(reason)` maps each reason to its `m07.error.*` COPY_DECK id with an exhaustive switch. Length counts UTF-16 code units, the unit of the field's `maxLength` and zod's `.max()`, so all three agree.
- `AgeAnswerSchema` (`{ birthYear, answeredAtMs }`) is the shape the M04 slice persists and parses on read.

### Phase-2 seams (typed, not built)

`AffinitySchema`, `CombatClassSchema`, `CombatStatusSchema` (`ready` | `fainted`, no death state), `BATTLE_CLIP_IDS`, `SURFACE_KINDS`, `VoiceLineageSchema`, `HoodEncounterSchema`, and `MonInstance.voiceLineageId` (null in Phase 1).

### Zustand mirror (for `platform`)

Law 4 puts business state in the sim and mirrors it into sliced Zustand stores. The intended wiring: one slice per concern (`care`, `hatch`, `queue`), each holding the sim's output and calling `step` / `applyCareAction` / `transitionHatch` in its actions; `persist` writes the save blob through MMKV. Core does not depend on Zustand. Slices pattern: https://zustand.docs.pmnd.rs/guides/slices-pattern; persist middleware: https://zustand.docs.pmnd.rs/integrations/persisting-store-data.

### Tests

Vitest 5.0.3 (https://vitest.dev/), headless, `pnpm --filter @acme/core test`. A small seeded property harness (`test/harness.ts`, `forAll`) replaces a property-testing dependency. Suites: 10k-run determinism, split invariance, meter bounds and monotone curves, Law 3 import scan, Law 7, Law 8, hatch idempotency at every phase (skip, process death through a JSON round trip, double open, device A then B, reconnect), server merge, vignette stability, save migration, boundary schemas.

### Third-party APIs verified in `node_modules`

`zod@4.6.5` (`node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/classic/schemas.d.ts`, `external.d.ts`): `z.object`, `z.discriminatedUnion`, `z.enum` (exported as `_enum`), `z.literal`, `z.union`, `z.array`, `.nullable()`, `.min/.max/.int/.nonnegative/.positive`, `.safeParse`, `.shape`, `.options`, `z.infer`. `z.number()` rejects `NaN` and `Infinity` (`v4/core/schemas.js`, `Number.isFinite` check); a test covers it. `vitest@5.0.3`: `describe`, `it`, `it.each`, `expect` from `vitest`, `defineConfig` from `vitest/config`. Docs: https://zod.dev/api, https://zod.dev/basics.

## Consequences

- Any canon number (rates, thresholds, starting bond, hatchling meters) changes one constant in `sim/tuning.ts` or `sim/hatch.ts`, not the model.
- A server built on this package runs the same sim as the client. A server in another language must port `deriveMonInstanceId`, `mintMonInstance` and `applyCareAction` bit-for-bit, or call this package.
- `hatchedAt` reflects incubation end, not when the Caller opened the case. If canon wants the open time, it has to come from the server, not the device.

## Open `TODO(canon)`

1. Care decay rates, request and needs-you thresholds, overfeed line, sluggish length and effect, early-wake cost, play and feed gains (`sim/tuning.ts`).
2. Hatchling starting meters (`HATCHLING_CARE`) and starting bond (`sim/hatch.ts`).
3. Idle-vignette pacing (`sim/vignettes.ts`).
4. Dex ids for each species line (`MonSpeciesDef.dexId`).
5. The eight Affinity names and the combat Class list.
6. Evolution conditions beyond a bond floor (`EvolutionEvent`).
7. Hood Mon encounter rules.
