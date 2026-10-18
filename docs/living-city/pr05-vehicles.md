# PR05 — Moving vehicle simulation + render integration

Living City spec §13 row PR05. Branch `lane-lc-vehicles`, stacked on
`lane-lc-registry` (PR04) → `lane-lc-signals` (PR03) → `lane-lc-topology`
(PR02) → the v3 tile chain.

The vertical slice is real end-to-end: two cars at the verified 125th
Street & Adam Clayton Powell Jr. Boulevard junction — one holds at red
while the other proceeds on green — plus a seeded ambient population,
mounted through the existing `SceneActorFactory` seam on **both** render
paths (JS `ThreeCanvas` and the worklet render runtime), behind
`EXPO_PUBLIC_LIVING_CITY=1` (default off, flag-off = zero-diff).

## Scope

- `VehicleSim`: pure, seeded, fixed-step (24 Hz) vehicle simulation on the
  PR02 directed lane graph — Treiber IDM car-following, signal stop lines
  from PR03 state, FCFS junction claims through the conflict solver,
  amber-dilemma rule, blocked-exit anti-gridlock, and the PR06 pedestrian
  seam (`pedClaimAt` / `pedBlocks`). Fable Cities' algorithmic ideas
  (MIT-licensed reference), cited not copied.
- `LivingCityHost`: the single authoritative host. Owns the fixed-step
  accumulator (20–30 Hz spec band → 24 Hz), the signal system and the sim,
  and publishes **one flat packed actor snapshot per tick** with a fresh
  array every publish (the Synchronizable identity rule from
  `render-snapshot.ts`).
- `createVehicleActor`: `SceneActorFactory`-mountable renderer. One
  `InstancedMesh` per vehicle class, render-time interpolation one tick
  behind the sim, per-id palette colours, spawn grow-in so mid-block
  spawns never pop. Meshes resolve through the WorldAssetRegistry's
  semantic ids via `resolveVehicleEntry` — the spec §5 upgrade point.
- `bundled-host.ts` / `vertical-slice.ts`: the flag gate, the singleton
  host bound to the real Harlem/Apollo tile, and the authored ACP slice.

## Paths

| Path | Role |
|---|---|
| `packages/app/features/game/living-city/vehicle-sim.ts` | Pure vehicle sim + snapshot codec (`packVehicleSnapshot`, `interpolateVehiclePose`, `VSNAP*`). |
| `packages/app/features/game/living-city/sim-host.ts` | `LivingCityHost` — fixed-step clock, sinks, attach/detach ref-counted ticker. |
| `packages/app/features/game/living-city/vehicle-actor.ts` | Flag (`EXPERIMENTAL_LIVING_CITY`), `livingCityFactoriesFor` gate, `boxCarGeometryData` recipe, `resolveVehicleEntry`, `createVehicleActor`. |
| `packages/app/features/game/living-city/vertical-slice.ts` | `livingCityVerticalSlice` — pure ACP slice spec (node-testable). |
| `packages/app/features/game/living-city/bundled-host.ts` | Singleton host on the bundled tile + the JS-path actor factory + `livingCityHost()` for the worklet path. |
| `packages/app/features/game/GameScreen.tsx` | JS path: `actors: [...CALLER_ACTORS, ...livingCityVehicleActorFactories()]` — flag off → identical array. |
| `packages/app/features/game/render-runtime/worklet-host.ts` | Vehicle `Synchronizable<number[]>` channel: sink per publish, parked-loop wake, attach/detach, dispose. |
| `packages/app/features/game/render-runtime/game-render.ts` | `GameRenderArgs.vehicles`; mounts `createVehicleActor({ read })` on the render runtime. |
| `packages/app/features/game/living-city/{vehicle-sim,sim-host,vehicle-actor}.test.ts` | 21 node:test cases (see Tests). |

## What renders end-to-end

- **Authored slice** (seed `0x1c2026`): sedan `lane:cscl:19399:b:0`
  (W 125 ST) and taxi `lane:cscl:19169:b:0` (ADAM CLAYTON POWELL JR BLVD),
  each spawned 36 m before its stop line with a `through` connector route
  through `node:s19169.s19170.s19212.s19213.s19399.s19400.s19401`. The two
  approaches sit in perpendicular phase groups, so the PR03 program
  necessarily shows one waiting on red while the other proceeds —
  asserted in tests on the real tile.
- **Ambient population**: `targetVehicles: 12` spawned ≥130 m from the
  camera look-at (anti-pop), despawned >500 m, kind mix
  sedan 55 / taxi 20 / van 15 / bus 10.
- **Meshes today**: the `proc:` recipes — primitive box-car/van/bus
  (body + cabin + four wheels) sized from each resolved entry's declared
  bounds, instanced, palette-coloured. GLB candidates stay
  `pending-verification` by design (PR04); `three:` generator bindings
  are skipped until worklet-bundle import is verified —
  `resolveVehicleEntry` is the single swap point.

## Simulation

- **Rate**: `SIM_DT = 1/24` (24 Hz, inside the spec's 20–30 Hz band).
  `LivingCityHost.step()` accumulates real time, clamps any frame to
  0.25 s (no catch-up burst after backgrounding), runs whole ticks.
- **Determinism**: `mulberry32(seed)`; id-sorted vehicle iteration;
  spawn/route/claim order is a pure function of the tick count. Two
  same-seed sims pack byte-identical snapshots (test).
- **Driver model** per tick: aspect → ped claim → blocked exit → FCFS
  claim → IDM leader/track → lane-end guard → element hop (lane → conn →
  next route lane) → pose. Turn speeds through/left/right/uturn =
  8/6/5/3 m/s; IDM `aMax 2.85, bComf 3.3, s0 2.05, tHead 1.05,
  decMax -7.6, δ 4`.
- **Signals**: aspect read through `SignalSystem.state(node).vehicleAspects[conn]`.
  Red: ticket registered, hold at stop line. Amber: stop when
  `stopGap > v²/(2·4.2) + 1`, else claim and clear (Fable's rule). Green:
  ped check → exit-free check → request grant. Held claims clear on red
  (legal clearing).
- **Anti-gridlock**: `exitFree(conn) < len + 1 m` ⇒ wait `blocked`,
  claim or no claim — the box never fills.
- **Pedestrians**: no ped entities exist yet (PR06). The seam is live:
  `signals.requestGrant(ped, xwalkId)` shows in `sim.pedClaimAt(xwalkId)`
  and `pedBlocks(conn)` holds vehicles off conflicting xwalks that a held
  ped claim covers.
- **Stop lines**: lane end −1.6 m, pulled back to the approach's
  crosswalk crossing point when one exists (`polylineCrossS`).

## Snapshot layout (flat packed actor channel)

Header 8, then `count` records of stride 12, `number[]`:

```
header  [version, tick, tickDt, count, stride, simTime, spawnTotal, despawnTotal]
record  [id, kind, prevX, prevZ, prevYaw, x, z, yaw, speed, flags, age, reserved]
```

`flags` = bitfield `{inJunction, braking, stoppedForSignal, yielding,
blockedExit, blinkLeft, blinkRight}`. The renderer interpolates
`prev → curr` over `tickDt` (one tick of latency, no extrapolation);
yaw takes the shortest arc. `packVehicleSnapshot` allocates a new array
every publish — handed straight to the Synchronizable, satisfying the
Worklets identity-cache rule (never re-serialize one buffer).

## Threading / channel

- **JS path**: `createVehicleActor({ read: () => host.latestSnapshot() })`;
  `onMount/onUnmount` → `host.attach()/detach()` — the 24 Hz ticker runs
  only while a consumer renders; sim state persists across remounts
  (module-scope bundle, like the session stores).
- **Worklet path**: `worklet-host.start()` creates a second
  `Synchronizable<number[]>`, subscribes via `host.addSink` (each publish
  `setBlocking`s the fresh array and wakes a parked loop once), passes it
  in `GameRenderArgs.vehicles`; `game-render.ts` mounts the same actor
  with `read: () => args.vehicles?.getDirty()`. The sim stays
  JS-authoritative; only packed numbers cross runtimes. Flag off →
  `vehicles: null` → `GameRenderArgs` shape unchanged at the call site.
- **No per-actor React state**: the whole channel is the flat snapshot.

## Budgets (audit baseline: ~40 draws / ~298 k tris)

| Metric | Budget | This PR | Status |
|---|---|---|---|
| Extra draw calls | ≤ ~10 | 1 `InstancedMesh` per class present (2 in the slice, ≤4 saturated) | ✓ |
| Dynamic triangles | ≤ ~50 k | 72 tris/vehicle; ~14 live ≈ 1 k; 48-capacity × 4 kinds ceiling ≈ 13.8 k | ✓ |
| Added encode (sim) | ≤ ~1.5 ms | **0.146 ms** per tick+pack, 12 vehicles, full real tile (measured, this machine) | ✓ |
| Snapshot traffic | — | 8 + 12·count numbers ≈ 0.2 KB @ 24 Hz ≈ 4.6 KB/s | ✓ |
| Startup | lazy | topology+signals+host built on first flagged mount (~ms, JS thread) | ✓ |

## Flag / zero-diff

`EXPO_PUBLIC_LIVING_CITY=1` opts in (default off — the test asserts the
module reads false with the env unset). Off ⇒
`livingCityVehicleActorFactories()` → `[]` and `livingCityHost()` →
`null`: the JS-path actors array is `[createCallerProxy]` exactly as
before and the worklet args carry `vehicles: null` → the same single
caller actor mounts. No scene difference; nothing else is constructed.

## Tests / acceptance

`node --test 'features/game/living-city/*.test.ts'` → **73 pass / 0 fail**
(this PR adds 21):

- `vehicle-sim.test.ts` (10): seeded determinism (identical packed
  snapshots), IDM gap-keeping (no overlap over 30 s), red-light hold (no
  box entry on red, stood at line), green pass (entered and exited,
  aspect recorded), blocked exit (box stayed clear on green, `blocked`
  reported), `pedClaimAt` seam (claim surfaces + releases), amber both
  branches (far ⇒ stopped, close ⇒ cleared on non-red), snapshot shape /
  versioning / fresh-array identity, ACP slice spec on the real tile
  (two spawns, real streets, legal connectors), and the real-tile run
  (one waited on red, the other entered the box only on non-red).
- `sim-host.test.ts` (3): fixed-step accumulator, one fresh packed
  snapshot per tick with sink replay + identity, attach/detach
  ref-count and park/resume without re-seeding.
- `vehicle-actor.test.ts` (8): box-car recipe (72 tris, ground pivot,
  bounds), `resolveVehicleEntry` picks the buildable `proc:` tier today,
  deterministic paint, interpolation math (lerp + shortest yaw arc), and
  the flag gate (`EXPERIMENTAL_LIVING_CITY === false`,
  `livingCityFactoriesFor(false, …) → []` — the zero-diff contract).

Full package: `node --test 'features/game/**/*.test.ts'` → **409 pass /
0 fail**. `tsc --noEmit -p tsconfig.json` → clean. `eslint` → clean except
one pre-existing unused-import warning on `game-render.ts:24` (predates
this PR, left untouched).

## Licensing / provenance

- Algorithmic influence only: Fable Cities (MIT) — IDM-like following,
  FCFS junction claims, blocked-exit, amber dilemma, ped conflict. No
  code copied; constants restated in `vehicle-sim.ts`.
- Meshes: seeded registry's internal `proc:` recipes (internal) — no new
  third-party assets vendored this PR; Kenney CC0 GLBs remain
  `pending-verification` per `ASSET_NOTICES.md`.
- Signals are simulated (PR03), not surveyed — unchanged claim.

## Device status

- Node tests pass (above). **Real device render verification is pending**:
  no WebGPU/WebGL path runs under `node --test`; the mounted slice has
  not yet been eyeballed on the Duo/iOS. Honest status: sim + codec +
  gate verified headless; draw/triangle budgets are arithmetic from the
  recipe and instance counts, not a `renderer.info` capture.
- The worklet path (`EXPO_PUBLIC_WORKLET_RENDER=1`) mirrors the channel
  through a Synchronizable — same unverified-device caveat; the wiring
  follows the camera channel's proven fresh-array pattern.

## Pending / next

- PR06 pedestrian entities plug into `pedClaimAt` / `requestGrant` —
  vehicle yield-on-held-ped-claim is implemented but only seam-tested
  (no ped claimants exist to exercise it in world).
- GLB tier: vendor verified Kenney sedan/van under `assets/living-city/…`,
  `markStatus → ready`, `resolveVehicleEntry` picks them up unchanged.
- `three:` generator candidates skipped pending a verified worklet-bundle
  import — same swap point.
- Ambient route lookahead extends one hop ahead until a lane's next
  connector is chosen (scripted routes see further) — fine at current
  density; revisit with heavier ambient counts.
- `EXISTING_SYSTEMS_AUDIT.md` lives on the PR01 lane, not this stack:
  the audit's "actor seam = mounted path" claim holds — vehicles mount
  through `params.actors` / `createCityScene` on both render paths, no
  second canvas, no BundleGroup changes. Deviation: none.

## Rollback

Delete the env flag or unset it — nothing mounts. `git revert` this
commit restores the exact pre-PR05 scene and snapshot channels
(`GameRenderArgs.vehicles` is optional and the only touched existing
lines are the two actor arrays + the worklet sink block).
