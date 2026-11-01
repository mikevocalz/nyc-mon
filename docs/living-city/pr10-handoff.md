# PR10 — Integration, canon/legal review and handoff (closing report)

Living City PR stack row 10 (`docs/plans/living-city-prompt.md` §13–§15).
Docs-only lane on `lane-lc-handoff`, 2026-10-18. This is the program's
closing document — the honesty capstone: anything unverifiable is
PENDING, and nothing below claims on-screen behaviour that was not
captured on hardware.

## 1. Program summary

Ten PRs built a deterministic living-city simulation on the real
Harlem/Apollo v3 tile: a CSCL/OSM-derived lane + sidewalk + crosswalk
graph (PR02), a per-junction signal phase machine with an FCFS conflict
solver encoding NYC right-of-way (PR03), a semantic-id asset registry
with license gates (PR04), IDM vehicle and kerb-queue pedestrian sims on
a fixed 24 Hz tick (PR05/PR06), controller-honest signal heads, ped
displays, streetlamp glows and the authoritative world clock (PR07), a
record-furniture/parapet/daypart streetscape pass (PR08), actor tiers +
an adaptive step-down + the first on-device run (PR09), and this
integration/handoff doc set (PR10). One env flag
(`EXPO_PUBLIC_LIVING_CITY`, default off) gates all of it; flag-off is
zero-diff by test.

**Verified headless:** 124 living-city `node --test` cases green;
`features/game` suite 472 green; full `@acme/app` suite 684 green;
`tsc --noEmit` clean (TypeScript 6.0.3, the catalog pin); `eslint` clean
on the module. **Verified on device
(one run, physical Surface Duo):** flag-on release build mounts the full
actor set within budget, posture-override cycle and background/foreground
resume clean. **Not verified anywhere:** what it looks like — no
screenshot/video of an actor behaving exists. See §5.

## 2. Per-PR evidence table

| PR | Commit(s) | Tests added | Headless evidence | Device evidence | Docs |
|---|---|---|---|---|---|
| 01 audit+scouts | `6e1e0e8`, `783fb5d` (merged `e68df96`) | — | `EXISTING_SYSTEMS_AUDIT.md` + 4 scout reports + `asset-ledger.md` | Scout-F cites M0/F1 baselines | `docs/living-city/` |
| 02 topology | `495b840` | 9 | 300 nodes / 563 segs / 1 159 lanes / 876 xwalks on real tile; 3 verified 125th St anchors; byte-identical rebuild | PENDING (pure data) | `pr02-topology.md` |
| 03 signals | `267bf91` | 31 | FHWA amber/all-red formulas, MUTCD ped windows, RTOR default, dark→all-way-stop, determinism, real-junction plans | PENDING (pure logic) | `pr03-signals.md` |
| 04 registry | `bf56f48` | 14 | resolve chains, license gate, swap test, GLB validator tool | PENDING | `pr04-asset-registry.md`, `ASSET_NOTICES.md` |
| 05 vehicles | `368c341` | 21 | red-hold/green-pass/blocked-exit/amber on real tile; zero-diff gate; 0.146 ms tick | PENDING visual | `pr05-vehicles.md` |
| 06 peds | `955c7b7` | 21 | six-ped E2E on real OSM zebra, WALK-gating, vehicle yield, heartbeat claims | PENDING visual | `pr06-peds.md` |
| 07 viz+clock | `7496d95` | 20 | packed-signal-section honesty test (decode == controller state), lamp/ped/headlight bits, ~15 k typical tris | PENDING visual | `pr07-viz.md` |
| 08 streetscape | `5ec1292` (+merge `cc48025`) | 7 | record hydrants/LinkNYC/racks render into existing prop meshes, 0 added draws, parapet lip, shared daypart | PENDING capture matrix | `pr08-streetscape.md` |
| 09 perf | `931cc9a` | 6 (+ tier pins) | caps table, adaptive stepper, scripted-spawn protection | **Duo release run**: draws 53–54 (+12–13 vs F1), tris 319–335 k (~+10–15 k), gfxinfo p50 15 ms (window caveat), posture overrides, bg/fg resume | `pr09-perf.md`, `DEVICE_CHECKS.md` |
| fix | `c6ab331` | — | import-free adaptive bridge; flag-off `frame` stays null | — | commit message |
| 10 handoff | this commit | — | this doc set; CI/canon/no-dup review | — | `docs/architecture/LIVING_CITY.md`, `scenario-matrix.md`, `source-index.md`, this file |

## 3. Canon / legal review — findings

Grep sweep over `living-city/*.ts` + `docs/living-city/`: brands/
trademarks, CC0 claims, unlicensed ports, raw hex outside the palette.

- **Clean — no unambiguous violations found; nothing was fixed.**
- Brands/likenesses: none. Street names, LinkNYC/CSCL record names and
  the Apollo tile are factual geography/OSM/DOT data (allowed). "MTA-ish
  bus blue" is a comment on an in-house hex, not a logo. PR08 explicitly
  declined brands/holograms (spec §8).
- CC0 claims: every one is hedged — Kenney/Quaternius/Kenney-characters
  rows are `pending-verification` with named gates; Mixamo is
  **explicitly non-CC0 and unregistered**. No `cc0` tag without a
  verification note (`seed-assets.ts` headers, `asset-validation.ts`
  gate).
- Unlicensed ports: none. Fable (MIT) and night-street (MIT) influence
  is algorithm/citation level — in-file headers cite repo + commit +
  "no code copied" (`conflict-solver.ts:11-18`, `ped-sim.ts:5`). All
  rendering was re-authored in TSL/NodeMaterial; no GLSL came over — the
  cel-shader lesson applied as scout-B's per-file
  algorithm/code/asset split.
- Raw hex: `world/*.ts` palette pin holds (`streetscape.test.ts`
  asserts it). `living-city/` owns three small documented constants —
  `VEHICLE_PAINTS` (vehicle-actor.ts:146), `PED_CLOTHES`
  (ped-actor.ts:112), signal-housing `#2a2d30` (signal-viz.ts:525-526) —
  per-entity instance-color variation palettes. **Reported, not a
  violation**: the pin's scope is `world/`; a follow-up could fold them
  into `palette.ts` if Mike wants one palette to rule the module.
- ODbL: the F2 audit's four PENDING-MIKE escalations are carried forward
  verbatim in `source-index.md` §4 — unaddressed, deliberately visible.
- `probe.test.ts`: a diagnostic test that only `console.log`s the ACP
  node — kept as evidence tooling, flagged here so nobody reads it as a
  real assertion.

## 4. No-unsafe / no-duplicated check (vs `EXISTING_SYSTEMS_AUDIT.md` §5)

| Audit forbade | Verified | Evidence |
|---|---|---|
| Second parked-car system | ✅ none | `grep placeParkedCars` — zero hits in `living-city/`; moving cars spawn on lanes, parked slots stay `street-props` |
| Second streetlight/sign system | ✅ none | `lamp-viz.ts:62` calls the world's own `placeStreetFurniture` for positions; test: "lamp placements reuse the world streetlight layout pole-for-pole" |
| Second scene/canvas/renderer | ✅ none | all mounts through `SceneActorFactory(THREE)`; one canvas, on-demand redraw preserved |
| Second walkability/clearance index | ✅ none | `bundled-host.ts`/`lamp-viz.ts` import `createStreetClearance`; peds route on the PR02 walk-band graph — no second grid |
| Per-frame allocations / per-actor React state | ✅ | fresh packed `number[]` per tick (identity rule); zero React in the module |
| Procedural grid topology | ✅ | topology derives from CSCL records only; three.js CityGenerator grid REJECTED (scout-B) |
| `setInterval` visuals / second channel | ✅ | one `Synchronizable<number[]>` carries vehicles+peds+signals+env; signal cadence runs on packed sim time |
| Flag-off byte-identical | ✅ | `vehicle-actor.test.ts`/`ped-actor.test.ts` gate (`factoriesFor(false,…)→[]`); `livingCityHost()`→`null`, `livingCitySky()`→`undefined`; `GameRenderArgs.vehicles`→`null` same mounts; `adaptive-bridge.frame`→`null` (c6ab331); `tier-caps.test.ts` pins `high` == authored counts |

## 5. CI checks — what runs vs what misses these files

`.github/workflows/` (all read 2026-10-18):

- **`ci.yml`** (push to main + every PR): `.env` commit guard → install →
  Playwright → `pnpm --filter web,@acme/ui,@acme/theme,@acme/mcp-server,
  @acme/web-sim,@acme/payload test` → **`node --test` on exactly two
  @acme/app files** (`hud-layout.test.ts`, `map-data-credit.test.ts`) →
  `expo prebuild --platform android` → `spatial:verify-android` +
  `spatial:verify-typegpu` → `turbo build typecheck lint` → web city
  layout QA.
- **`alexa-readiness.yml`** (PRs touching `packages/**` + alexa paths):
  Python offline-contract validator via `tooling/alexa-readiness/run.mjs`
  — unrelated surface.
- **`alexa-live-smoke.yml`**: `workflow_dispatch` only, Bedrock spend —
  unrelated.
- **`pages.yml`**: static site snapshot — unrelated.

**What covers living-city:** `turbo typecheck` + `turbo lint` (the
module's TS + eslint run on every PR), `expo prebuild` proves the native
graph still resolves, `map-data-credit.test.ts` pins the ODbL credits
surface.

**The gap — flagged, not fixed (docs-only lane):** **`@acme/app`'s
`node --test '**/*.test.ts'` is not in CI.** The `test` step's filter
list excludes `@acme/app`, so all 124 living-city cases — and the whole
684-test `@acme/app` suite with them — run locally only. A one-line CI fix is adding
`--filter @acme/app` to the test step; recommended before this lane
merges. Second gap: `tooling/assets/validate-glb.mjs` has no CI hook
(PENDING by design until the first GLB is vendored — pr04).

## 6. PENDING master list (everything unverified, in one place)

Device/visual (the big one):
1. **Any visual confirmation of living-city behaviour on device** — cars
   at a red, peds on WALK, lit lenses, lamp glows, headlights. Draw/tri
   deltas prove mounting; no frame of an actor behaving was captured.
   §14 capture matrix owed for all five scenarios (see
   `scenario-matrix.md`, `pr08`'s 3×3 table).
2. **Physical hinge fold** — `cmd device_state` verified overrides only;
   real fold needs hands on the Duo (pr09).
3. **Forced crowd step-down observed live** — armed, never fired; scale
   held 0.80 ≥ 0.75 (pr09; mechanics are test-pinned).
4. **Memory growth attribution** — +181 MB session PSS needs a heap
   breakdown (pr09).
5. **GPU completion timing** — timestamp queries unenabled; capped
   histogram tail (inherited M0/F1).
6. **XR-tier budget** — `xr` rung intentionally = `high`; no headset
   measurement exists.

Assets/licensing:
7. **GLB vendoring gates** — kenney.nl re-fetch + SHA-256 (sedan/van),
   Quaternius zip + bundled license (ped.adult), Kenney pack license
   (ped.kid); then `markStatus → ready`, `validate-glb.mjs` CI hook.
8. **`three:` generator worklet-bundle binding** — swap point ready.
9. **GPU skinning / rigged peds on rn-webgpu** — unvalidated; procedural
   crowd is the baseline.
10. **F2's four PENDING-MIKE ODbL items** — share-alike declaration,
    Produced-Work attribution surface, DOITT/OTI naming, MTA licenseUrl
    (`source-index.md` §4).

Features deferred inside the program:
11. **Live daypart tracking** — sky preset + facade lit-share are
    mount-time picks; running `dayFactor` doesn't re-drive them (pr07/08).
12. **Building-window/storefront/wet-material consumers** of the packed
    env section (`dayFactor`/`rain` fields shipped unread).
13. **Ped-signal countdown digits** — FDW seconds packed in `SSIG` aux;
    no glyphs yet (pr07).
14. **Rain *driving* model** — `SimEnvironment.rain` packed but unread by
    IDM (no wet speed/headway scaling; §14-C).
15. **Dev-inspector UI** — plan/claims/flags are API-readable; nothing
    mounted (§14-A).
16. **Ambient route lookahead >1 hop** — fine at current density; revisit
    at higher counts (pr05).
17. **`probe.test.ts`** — diagnostic, not an assertion; keep or delete
    at Mike's call.

External/pre-existing:
18. **Release onboarding `crypto.randomUUID` crash** — bypassed via
    `nycmon://game` on every device run (M0/F1/PR09 caveat).
19. **LinkNYC/rack vs streetlight-pole overlap** — not checked
    (hydrants are; pr08 pending).
20. **Record `rot` semantics unverified** — kerb-derived orientation
    used instead (v3 handoff PENDING E1).
21. **Controls-jank** — not measured as a living-city item; inherited
    janky-share reporting is window-sensitive (pr09 caveat: 33.3 % vs
    F1 44.3 % are not comparable windows).

## 7. Rollback per stage

| Stage | Rollback |
|---|---|
| Flag-only | Unset `EXPO_PUBLIC_LIVING_CITY` — nothing mounts; scene byte-identical (test-pinned) |
| PR09 tiers/perf | `git revert 931cc9a`; defaults remain authored counts; caps table inert |
| PR08 streetscape | `git revert 5ec1292`; record path additive — no records → exact pre-PR08 placements; `timeOfDay` defaults restore dusk share |
| PR07 viz/clock | `git revert 7496d95`; snapshot sections appended-only, old readers default safely |
| PR06 peds | `git revert 955c7b7`; ped section appended — vehicle bytes untouched; solver heartbeat is a strict relaxation |
| PR05 vehicles | `git revert 368c341`; restores pre-PR05 actor arrays + snapshot channels |
| PR04 registry | delete `living-city/` + `tooling/assets/validate-glb.mjs`; nothing else imports it |
| PR03 signals | `git revert 267bf91`; self-contained under `living-city/` |
| PR02 topology | `git revert 495b840`; derived sidecar — dataset/saves untouched |
| PR01 docs | drop `docs/living-city/` audit/scout/ledger files |
| Whole program | `git revert` the lane range or delete `EXPO_PUBLIC_LIVING_CITY`; no schema/save migration exists to unwind |

## 8. Device build / QA commands (verified real scripts)

Build (PR09 recipe, `apps/mobile`):

```bash
# flags live in apps/mobile/.env (gitignored; inlined at bundle time)
#   EXPO_PUBLIC_GAME_PERF=1   — [NYC-Mon/perf] submission probe
#   EXPO_PUBLIC_LIVING_CITY=1 — the whole feature
#   EXPO_PUBLIC_LIVING_CITY_TIER=low|medium|high|xr  — optional override
cd apps/mobile
pnpm prebuild                      # node scripts/assert-viro-fork.mjs && expo prebuild
cd android && ./gradlew :app:assembleMobileRelease   # PR09: BUILD SUCCESSFUL ~6 m
adb install -r app/build/outputs/apk/mobile/release/app-mobile-release.apk
```

Headless checks (green now):

```bash
cd packages/app
node --test 'features/game/living-city/*.test.ts'   # 124 cases
node --test 'features/game/**/*.test.ts'            # 472 cases
pnpm typecheck                                       # tsc --noEmit (TS 6.0.3)
pnpm lint                                            # eslint
pnpm turbo build typecheck lint                      # repo-wide, from root
```

On-device QA (PR09/M0/F1 method — adb serial `913949703467`):

```bash
adb shell am start -a android.intent.action.VIEW -d 'nycmon://game' com.nycmon.app
adb shell dumpsys gfxinfo com.nycmon.app reset      # before a scripted drive
adb shell dumpsys gfxinfo com.nycmon.app            # histogram after
adb shell dumpsys gfxinfo com.nycmon.app framestats # PROFILEDATA
adb shell dumpsys meminfo com.nycmon.app            # PSS over the session
for s in 0 1 2 3; do adb shell cmd device_state state "$s"; done  # posture overrides (not a real fold)
adb shell input keyevent KEYCODE_HOME               # background; relaunch via nycmon://game
```

Scripted drives use argent `gesture-custom` (Down + deflect + Move holds
+ Up); PR09's 89-event pattern is the reference. Logcat marker:
`[NYC-Mon/perf]` windows + `living-city crowd tier` on a step-down.
Caveat carried forward: release onboarding still crashes on
`crypto.randomUUID` — enter via the `nycmon://game` deep link.

## 9. The spec's seven closing questions (§15)

1. **What works now:** everything in §2's headless column, on the real
   tile, behind one flag — proven by 124 tests. On device: mounting +
   continuity only (§5).
2. **Reused vs adapted:** reused — actor seam, snapshot channel,
   clearance/furniture placements, pixel-font path, module-scope stores,
   perf-tier plumbing. Adapted — fable algorithms (cited), three.js
   generator *concepts* (not yet bound), night-street technique.
3. **Temporary GLBs + procedural sources:** `source-index.md` §3 — all
   GLB rows `pending-verification`, none vendored; procedural recipes
   internal/MIT-vendored.
4. **Signal/pedestrian behaviours working:** red hold, green pass,
   blocked exit, amber dilemma, RTOR default, dark→all-way-stop, LPI,
   exclusive ped phase, WALK-gated crossing, kerb queues, FDW clearing,
   ped-priority claims — every one test-cited in §2/scenario-matrix.
5. **Performance by device:** Duo release run only — §2/pr09 numbers;
   no 30/60-goal claim; watch item = memory slope.
6. **Deferred:** GLB visuals, rigged peds, live daypart, wet materials,
   countdown digits, inspector UI, rain driving, bus/service fleets,
   trains (creator hook preserved — no train code exists), §10A
   skyline/facade/AdSurface layer (separate brief).
7. **Replacing every asset without touching logic:** register a verified
   entry under the semantic id in `seed-assets.ts` (or `markStatus` a
   pending row after its gate); `resolveVehicleEntry`/`resolvePedEntry`
   pick the first buildable candidate; sims name ids, never meshes —
   proven by the seeded swap test.
