# Living City — architecture

- **Status:** Landed behind `EXPO_PUBLIC_LIVING_CITY=1` (default off) on
  `lane-lc-handoff`, 2026-10-18. PR10 deliverable
  (`docs/plans/living-city-prompt.md` §12–§15).
- **Module:** `packages/app/features/game/living-city/`
- **Program docs:** `docs/living-city/` (PR01 audit + scouts → PR10
  handoff).
- **Honesty contract:** everything below marked PENDING is unverified,
  not broken. Nothing here claims device visuals that were not captured.

## 1. What it is

A deterministic traffic + pedestrian + signal + streetlamp + clock
simulation layered on the existing Harlem/Apollo city — real CSCL road
records, real OSM crosswalks — mounted through the scene's existing
`SceneActorFactory` seam. The static world is untouched; the living layer
is a set of actors plus one flat packed snapshot channel, so the flag-off
city is byte-identical to the pre-program build.

The simulation is **pure TypeScript**: no three.js, no React, no timers
inside the sim core. `node --test` covers every behaviour; the renderers
are thin instanced-mesh actors that read packed bytes.

## 2. Module map

```
packages/app/features/game/living-city/
  topology.ts          PR02  directed lane/walk/xwalk/connector graph (pure)
  bundled-topology.ts  PR02  lazy accessor over bundledCity() (load seam)
  conflict-solver.ts   PR03  connector/xwalk conflict matrix + FCFS claim arbiter (pure)
  signal-controller.ts PR03  per-junction phase machine + SignalSystem (pure)
  bundled-signals.ts   PR03  lazy SignalSystem accessor (load seam)
  asset-registry.ts    PR04  WorldAssetRegistry — semantic ids → resolve chains (pure)
  asset-validation.ts  PR04  pivot/units/LOD/animation/license validators (pure)
  seed-assets.ts       PR04  SEED_ASSETS: 6 ids, 15 entries, hedges in provenance notes
  vehicle-sim.ts       PR05  VehicleSim — IDM, claims, stop lines, spawn/despawn (pure)
  sim-host.ts          PR05+ LivingCityHost — fixed-step clock, sinks, attach/detach
  vehicle-actor.ts     PR05+ flag, factory gate, proc recipes, resolveVehicleEntry, lights
  vertical-slice.ts    PR05+ authored ACP slice specs (2 cars, 6 peds) — pure
  bundled-host.ts      PR05+ singleton host on the bundled tile + JS factories
  ped-sim.ts           PR06  PedSim — kerb queues, WALK gating, corridor crowd (pure)
  ped-actor.ts         PR06  crowd InstancedMesh + resolvePedEntry
  clock.ts             PR07  CityClock — the one authoritative day/night clock (pure)
  signal-viz.ts        PR07  signal heads + ped displays + SSIG codec + roster
  lamp-viz.ts          PR07  clock-driven lamp glows/pools on world placements
  adaptive-bridge.ts   PR09  import-free city-scene → bundled-host seam (c6ab331)
  *.test.ts            15 files, 124 tests — all pure/node --test
```

Consumers outside the module (the only touchpoints — grep-verified):

| File | Touch |
|---|---|
| `features/game/GameScreen.tsx:196-199` | `actors: [...CALLER_ACTORS, ...livingCityActorFactories()]`, `sky: livingCitySky()` — flag off → identical array + `undefined` |
| `features/game/render-runtime/worklet-host.ts:202-215` | `livingCityHost()` → second `Synchronizable<number[]>`; sink per publish + parked-loop wake |
| `features/game/render-runtime/game-render.ts:321-348` | worklet path mounts the same 4 actor factories reading `args.vehicles.getDirty()` |
| `features/game/city-scene.ts:210-216` | `livingCityAdaptiveBridge.frame?.(scale)` — null unless a flag-gated path evaluated bundled-host (c6ab331) |
| `features/game/perf/tier.ts:125-220` | `LivingCityTier`, `LIVING_CITY_CAPS`, `resolveLivingCityTier`, `createLivingCityAdaptive` |

## 3. Sequence — one sim tick to one drawn frame

### 3a. Sim tick (JS thread, 24 Hz)

```
rAF/timeout ticker            LivingCityHost.step(frameSeconds)
      │                              │ acc += min(dt, 0.25 s)  — no catch-up burst
      │                              ▼
      │                       while acc ≥ 1/24:
      │                        ├─ clock.step(SIM_DT)          CityClock — pure fn of ticks
      │                        ├─ sim.setEnvironment(env)      headlights/rain INTO drivers
      │                        ├─ sim.step(SIM_DT)             VehicleSim: aspect → ped claim
      │                        │                               → blocked-exit → FCFS claim
      │                        │                               → IDM → lane hop → pose
      │                        │                               (signals stepped inside sim)
      │                        ├─ pedSim.step(SIM_DT)          PedSim: kerb queue → WALK
      │                        │                               grant → corridor crossing
      │                        ▼
      │                        publish(): packWorldSnapshot(version, sim,
      │                          pedSim, signals, clock.state(), roster)
      │                          → ONE fresh number[]  (never mutated after)
      ▼
sinks: JS actor reads latest() in place; worklet sink setBlocking()s
a Synchronizable and wakes the parked render loop once.
```

### 3b. Snapshot layout (append-only sections, all readers default-safe on old buffers)

```
[vehicle]  VSNAP_HEADER 8 [version,tick,tickDt,count,stride,simTime,
                           spawnTotal,despawnTotal] + count×12
           [id,kind,prevX,prevZ,prevYaw,x,z,yaw,speed,flags,age,res]
[ped]      PSNAP_HEADER 4 + count×12   (same field order)
[signal]   SSIG_HEADER 4 [count,stride=2,scheme=1,nodes]
           + count×2 [aspectCode, auxSeconds]   (binds to signalRoster)
[env]      CSNAP_HEADER 2 [scheme=1,fields=6]
           + 6 [hour,dayFactor,lampLevel,headlights,rain,simTime]
```

### 3c. Render path — both surfaces

```
JS path (ThreeCanvas)                    worklet path (game-render runtime)
─────────────────────                    ──────────────────────────────
GameScreen params.actors                 worklet-host: host.addSink(snap ⇒
 = [caller, …lcFactories()]                vehicles.setBlocking(snap);
createCityScene calls each                 wake parked loop)
 actor.update(frame)                     GameRenderArgs.vehicles →
 actors read host.latestSnapshot()         game-render mounts same actors,
   via their read closure                  read = () => args.vehicles.getDirty()

both paths: actor.update(frame) —
  read() → prev/curr pose per record → lerp by
  (renderTime − tickTime)/tickDt, shortest-arc yaw → write
  instanceMatrix/instanceColor → update() === true keeps the
  on-demand canvas awake → renderer.render
```

One tick of latency by design — interpolation, never extrapolation.
Signal/ped-display lenses and lamp glows read the **same packed bytes**
the sims act on, so the street can never show a state the AI did not see
(`signal-viz.test.ts` decodes the packed section and compares it to
`SignalSystem.state` element-for-element).

## 4. Authoritative clock design

`CityClock` (`clock.ts`) lives inside `LivingCityHost` and steps in
lockstep with `SIM_DT` — the world clock is a pure function of the tick
count plus options. Pause/fold/resume/background never re-seeds it:
real time only feeds the host's clamped accumulator.

- **Readers, dynamic:** the env section packs `hour, dayFactor,
  lampLevel, headlights, rain, simTime` each tick → lamp drive, vehicle
  headlight bit, indicator/FDW blink parity.
- **Readers, static world:** `livingCitySky()` maps the clock's hour onto
  the sky-rig named presets **once at mount**; the same mount-time pick
  feeds `windows.ts litShareAt` → all three facade material lanes (PR08).
- **Direction of data flow:** clock → env → sim. The sim stamps
  `VFLAG.headlights` from the env it was given; a dusk flip cannot
  reorder traffic (host comment, `sim-host.ts:167-172`).
- **Speed:** `hoursPerSimSecond = 1/60` on the bundled host — dusk
  arrives inside a session. `LIVING_CITY_START_HOUR = 18.66` opens the
  slice mid-transition.
- **Known limit:** the sky/facade pick is mount-time, not live-tracked
  (PENDING, §7).

## 5. Flag / env surface

| Variable | Values | Default | Effect |
|---|---|---|---|
| `EXPO_PUBLIC_LIVING_CITY` | truthy set per `parseSkyRigFlag` | **off** | Master gate. Off ⇒ factories `[]`, `livingCityHost()` `null`, `livingCitySky()` `undefined`, `GameRenderArgs.vehicles` `null`, adaptive bridge `frame` null. Zero-diff, test-pinned. |
| `EXPO_PUBLIC_LIVING_CITY_TIER` | `low` / `medium` / `high` / `xr` | unset → world-tier row → `high` | Actor/LOD caps (`LIVING_CITY_CAPS`, `perf/tier.ts`). `high` = authored PR05–07 counts exactly (test-pinned). |
| `EXPO_PUBLIC_WORLD_TIER` | `phone` / `high` | unset | World tier bundle; its `livingCity` row supplies the LC tier when no explicit LC selector (`phone`→`medium`). |
| `EXPO_PUBLIC_WORKLET_RENDER` | `1` | off | Render-runtime path; the living-city channel mirrors through its own `Synchronizable` when both flags are on. |
| `EXPO_PUBLIC_GAME_PERF` | `1` | off | `[NYC-Mon/perf]` submission-cost probe the PR09 device run used. |
| `EXPO_PUBLIC_WORLD_RENDER_SCALE` | `1` | off | Required with the LC flag for the adaptive crowd step-down feed. |

Expo inlines `EXPO_PUBLIC_*` at bundle time — flags are build-time
decisions; a device build needs them set before `expo prebuild`/bundle.

## 6. Budget accounting vs the PR01 audit

Audit ceiling (scout-F, `EXISTING_SYSTEMS_AUDIT.md`, measured on the Duo):
**≤ ~10 extra draw calls / ≤ ~50 k added tris / ≤ ~1.5 ms added encode**,
against a ~40 draw / ~298 k tri baseline at p50 ≈13.18 ms encode.

| Metric | Budget | Shipped | Evidence |
|---|---|---|---|
| Dynamic draw calls | ≤ ~10 | ≤ 12 at cap (≤4 vehicle + 1 light + 2 ped + 3 signal + 2 lamp) | Arithmetic (PR07); device: 53–54 vs F1's 40–41 = +12–13 draws **measured** (PR09 probe `stages`) |
| Dynamic triangles | ≤ ~50 k | ~1 k typical fleet + ~15 k typical near-field viz ≈ ~16 k; ~40 k worst case at caps | Arithmetic (PR07); device: ~+10–15 k over F1's ~310 k (PR09's reading of 319–335 k) |
| Sim cost | ≤ ~1.5 ms | 0.146 ms tick+pack @12 vehicles; ped slice ≈1.5 ms, 200-ped ≈7.7 ms (node, this machine) | `vehicle-sim.test.ts`/`ped-sim.test.ts` tick-cost assertions |
| Snapshot traffic | — | (8 + 12n + sections) numbers @24 Hz — KB/s scale | codec tests |
| Draw-call delta on device | — | within budget; p50 frame time at/below baseline (window caveats, not a win claim) | PR09 Duo run |

## 7. PENDING table (honest — nothing here is claimed)

| Item | Status | Where tracked |
|---|---|---|
| Any visual confirmation of actors on device (cars braking at red, peds crossing, lenses lit) | **PENDING** — mounted + counted on device (draw/tri deltas), never eyeballed/captured | pr05–09 device sections; scenario-matrix |
| GLB vendoring (Kenney car kit, Quaternius, Kenney characters) | **PENDING** — `pending-verification`, nothing vendored | asset-ledger, ASSET_NOTICES, source-index |
| `three:` generator bindings in the worklet bundle | **PENDING** — `resolve*Entry` swap point ready | pr04/pr05 pending |
| Live sky/facade tracking of the running clock | **PENDING** — mount-time pick only | pr07/pr08 pending |
| Building-window lit share + rain/wet materials consuming the env section | **PENDING** — env fields packed, consumers unwired | pr07 pending |
| Countdown digits on ped displays | **PENDING** — aux seconds packed, no digit glyphs | pr07 pending |
| Physical hinge fold on the Duo | **PENDING** — posture overrides verified, geometry unchanged | pr09 |
| Forced crowd step-down observed live | **PENDING** — armed, never fired (scale held 0.80) | pr09 |
| Memory growth attribution (+181 MB session) | **PENDING** — heap breakdown needed | pr09 |
| GPU completion timing (timestamp queries) | **PENDING** — inherited from M0/F1 | pr09, baseline docs |
| Bus/other emergency-class routing | not built — spec's "optional" | §14-C |
| XR-tier measured budget | **PENDING** — `xr` rung = `high` copy | pr09 honesty note |
| Scenario C rain *driving* (reduced speed/headway) | **PENDING** — rain drives lamps/headlights only | scenario-matrix |
| Dev-inspector UI | not built — state is test/API-readable (`plan`, `claimsView`, flags) | §14-A |
| Trains, skyline/AdSurface layer, hero facade kit | deferred by spec (§10A is a later brief) | spec |
| `probe.test.ts` | diagnostic test that logs the ACP node — kept, not a claim | living-city/probe.test.ts |

## 8. Dependency map (imports)

```
city-dataset.ts / city-data.ts (bundledCity, CityDatasetV3, ODbL tile)
        │
        ▼
living-city/topology.ts ──► @acme/core unprojectFromScene
        │                   world/geometry.ts ribbon()
        ▼
living-city/conflict-solver.ts ──► signal-controller.ts ──► bundled-signals
        │                                                   (over bundled-topology)
        ▼
living-city/vehicle-sim.ts + ped-sim.ts ──► topology, signals, solver
        │
        ▼
living-city/sim-host.ts ──► clock.ts, signal-viz.ts (roster + packWorldSnapshot)
        │
        ├─► bundled-host.ts ──► bundledCity(), game-session camera store,
        │     perf/tier LIVING_CITY_CAPS, world/walkability createStreetClearance,
        │     lamp-viz/signal-viz/ped-actor/vehicle-actor factories,
        │     adaptive-bridge.ts (registers frame — c6ab331)
        │
        ├─► GameScreen.tsx (JS actors + sky pick)
        ├─► worklet-host.ts (Synchronizable mirror)
        ├─► game-render.ts (worklet actor mounts; rebuilds topology+signals
        │     deterministically — the roster binds with no extra bytes)
        └─► city-scene.ts ──► adaptive-bridge.frame?.(scale) (render-scale feed)

asset-registry.ts/seed-assets.ts/asset-validation.ts — pure; actors call
resolveVehicleEntry/resolvePedEntry (the ONLY mesh-swap seams).
```

Nothing in living-city imports React; only the actor files touch
`@acme/ui/three` types (constructor injection — `SceneActorFactory(THREE)`).

## 9. PR list and status

| PR | Scope | Branch | Commit on this lane | Status |
|---|---|---|---|---|
| 01 | Audit + scouts + asset ledger | `lane-lcaudit` | `6e1e0e8` + `783fb5d`, merged here at `e68df96` | DONE — docs in `docs/living-city/` |
| 02 | Topology sidecar | `lane-lc-sidecar` | `495b840` | DONE — 9 tests green |
| 03 | Signal controller + solver | `lane-lc-signals` | `267bf91` | DONE — 31 tests green |
| 04 | Asset registry + GLB tooling | `lane-lc-registry` | `bf56f48` | DONE — 14 tests; GLBs pending-verification by design |
| 05 | Vehicle sim + render | `lane-lc-vehicles` | `368c341` | DONE headless; device visual PENDING |
| 06 | Pedestrian sim | `lane-lc-peds` | `955c7b7` | DONE headless; device visual PENDING |
| 07 | Signal/ped viz + lamps + clock | `lane-lc-sigviz` | `7496d95` | DONE headless; device visual PENDING |
| 08 | Streetscape pass | `lane-lc-streetscape` | `5ec1292` + merge `cc48025` | DONE headless; capture matrix PENDING |
| 09 | Perf + tiers + Duo run | `lane-lc-perf` | `931cc9a` | DONE — release build on physical Duo; sub-PENDINGs in §7 |
| fix | scene→host bridge | this lane | `c6ab331` | DONE — import-free adaptive bridge |
| 10 | Integration + handoff | `lane-lc-handoff` | this doc set | THIS PR |

## 10. Rollback

Per-PR rollback plans are in each `docs/living-city/pr0*.md`. The whole
feature is one env flag: unset `EXPO_PUBLIC_LIVING_CITY` and nothing
mounts — the actors array, the worklet args, the sky param and the
adaptive bridge all revert to pre-program behaviour (test-pinned
zero-diff). `git revert` of the lane removes only `living-city/`,
`docs/living-city/`, the four small touchpoint edits listed in §2, and
`perf/tier.ts`'s appended section.
