# PR06 — Pedestrian sidewalk navigation + crosswalk behaviors

Living City spec §13 row PR06. Branch `lane-lc-peds`, stacked on
`lane-lc-vehicles` (PR05) → `lane-lc-registry` (PR04) → `lane-lc-signals`
(PR03) → `lane-lc-topology` (PR02) → the v3 tile chain.

The headline slice runs end-to-end on the **real** 125th Street & Adam
Clayton Powell Jr. Boulevard tile: **six pedestrians on opposite kerbs of
one OSM zebra — three per side — walk in, wait on the kerb, step off on
WALK, cross, stroll out, and come back to wait again**, cycling through
repeated signal phases without collisions or stalls. The crowd rides the
same authoritative host and the same packed snapshot as the vehicle
fleet, mounts through the same `SceneActorFactory` seam on both render
paths, and sits behind `EXPO_PUBLIC_LIVING_CITY=1` (default off,
flag-off = zero-diff).

## Scope

- `PedSim`: pure, seeded, fixed-step (24 Hz) pedestrian simulation on the
  PR02 walk-band graph — kerb-queue waiting, WALK-gated crosswalk entry
  through solver claims, FDW honest-clearing, corridor steering with a
  spatial-hash crowd model, static-obstacle dodging, corner links, an
  ambient spawner, and the appended ped snapshot section.
- `LivingCityHost`: now owns the pedestrian sim on the same tick and
  publishes the **combined** actor snapshot — the untouched PR05 vehicle
  layout plus a ped section appended after the vehicle records.
- `createPedActor`: `SceneActorFactory`-mountable crowd renderer. One
  `InstancedMesh` per ped kind (`ped.adult`, `ped.kid`), render-time
  interpolation one tick behind, per-id clothing palette, spawn grow-in,
  stride bob. Meshes resolve through the WorldAssetRegistry via
  `resolvePedEntry` — the spec §5 swap point.
- `livingCityPedSlice` in `vertical-slice.ts`: the authored six-ped spec
  on a real ACP zebra — deterministic leg choice (the OSM-crossing leg
  with the most kerb room), three scripted `loop` peds per kerb.
- `conflict-solver.ts`: a re-request on a held claim is now a heartbeat —
  it refreshes `heldAt`, so actively-committed claimants (a ped mid-zebra
  during a crowd pinch) don't hit the 30 s stale-claim expiry, while
  entities that stop asking still expire exactly as before.

## Paths

| Path | Role |
|---|---|
| `packages/app/features/game/living-city/ped-sim.ts` | Pure ped sim + ped-section codec (`packPedSection`, `packActorSnapshot`, `pedSectionOffset`, `pedSnapshotCount`, `interpolatePedPose`, `PSNAP*`, `PFLAG`). |
| `packages/app/features/game/living-city/sim-host.ts` | `LivingCityHost` steps `pedSim` after `sim` each tick and publishes `packActorSnapshot`; stats report `pedestrians` + `lastPedTickMs`. |
| `packages/app/features/game/living-city/ped-actor.ts` | `personGeometryData` 2-box recipe, `resolvePedEntry`, `pedClothes`, `createPedActor`. |
| `packages/app/features/game/living-city/vertical-slice.ts` | `livingCityPedSlice` — pure six-ped spec on the real ACP zebra (node-testable). |
| `packages/app/features/game/living-city/bundled-host.ts` | Singleton host now seeds the ped slice + `targetPeds: 16` ambient + bundled-tile obstacles (trees/transit/furniture); `livingCityActorFactories()` returns `[vehicle, ped]` factories when flagged. |
| `packages/app/features/game/GameScreen.tsx` | JS path: `livingCityActorFactories()` replaces the PR05 vehicles-only export — flag off → identical array. |
| `packages/app/features/game/render-runtime/game-render.ts` | Worklet path mounts `createPedActor` beside `createVehicleActor` on the same snapshot `Synchronizable` — no second channel crosses the bridge. |
| `packages/app/features/game/living-city/{ped-sim,ped-actor,sim-host}.test.ts` | 21 node:test cases (see Tests). |

## Behaviour model

Per tick, in ped-id order (determinism):

1. **Task control.** A `waitKerb` ped stands in a kerb file: `queueSlot`
   counts same-mouth waiters closer to the channel mouth, `slotS` creeps
   the file forward (`QUEUE_HEAD 1.0 m` behind the kerb, `0.8 m` pitch).
   Each tick it re-asks `signals.requestGrant(ped, xwalk)` — the solver
   only grants during `W`. On a grant the ped still must pass, in order:
   `uncontrolledGapClear` (unsignalized kerbs wait for a real traffic
   gap), `mouthClear` (let them off before you get on), `frontOfQueue`
   (only the closest waiter steps off), `zebraEntryBusy` (single-file
   through the ramp until the leader clears `ENTRY_SERIAL 2.2 m`), and
   `entryClear` (the first 2.5 m of the path is free of foot traffic).
   While held at the kerb the claim is kept so the zebra stays reserved
   against conflicting traffic; if WALK lapses unstepped, the claim is
   released.
2. **Crossing.** `buildCrossing` traces: kerb-edge approach sampled along
   the band drifted `≤0.75 m` toward the channel side (departures thread
   beside the loitering file instead of sweeping a diagonal through it) →
   the zebra polyline shifted `0.9 m` right of travel (opposite streams
   ride different channels and never meet head-on at a shared vertex) →
   the far band's channel-side landing, scanned ±5 m for the nearest
   clear spot (people adjust where they step off the kerb). On a
   `xwalk` link the claim is heartbeat-re-requested each tick and
   released only at landing — a mid-zebra ped keeps its reservation
   through FDW and DON'T WALK (`PFLAG.clearing`, hurry ≥1.5 m/s).
3. **Separation.** A 4 m spatial hash supplies neighbours ≤2.5 m.
   Longitudinal clamp: a neighbour inside the collision cone brakes me —
   the sqrt term is the exact standoff that keeps closest approach at the
   pair's floor (`MIN_SEPARATION 0.55 m` on open sidewalk,
   `KERB_CRUSH 0.34 m` within 3.2 m of a corridor end — crowds squeeze to
   shoulder width at a ramp; a flat 0.55 deadlocked the slice). Lateral:
   shoulder-room sidestep + kerbside courtesy (band peds ease out of an
   active crossing corridor). A post-move failsafe rolls back any move
   that *closed* a gap below the floor — already-close peds moving in
   parallel or apart stay free so the sidestep can space them out.
4. **Routing.** `wander` picks corner links (weight 3 — different-street
   band ends within 28 m whose hop crosses no carriageway centreline, so
   jaywalking is structurally impossible), a reachable xwalk (weight 1),
   or turn-back. `loop` ping-pongs its scripted xwalk: kerb → WALK →
   cross → seeded stroll → walk back → wait again.
5. **Obstacles.** Bundled-tile trees, hydrants, LinkNYC kiosks, bike
   racks, subway stairs and shelters are projected once onto the bands
   they fall inside; a ped within 3.2 m and 0.55 m laterally sidesteps
   (`PFLAG.obstructed`).

## Snapshot format

`packActorSnapshot` = `packVehicleSnapshot` (untouched bytes) ++ ped
section. Header `[count, stride, spawnTotal, despawnTotal]` (4), then
`count` records × `PSNAP_STRIDE` 12 in the same field order as vehicle
records: `[id, kind, prevX, prevZ, prevYaw, x, z, yaw, speed, flags,
age, reserved]`. `pedSectionOffset` computes the section start from the
vehicle header; older vehicle-only readers stop before it, and a
vehicle-only snapshot reports `pedSnapshotCount === 0`. Fresh array
every publish — the Synchronizable identity rule holds.

## What renders end-to-end

- **Authored slice** (`livingCityPedSlice`, seed `0x1c2026 ^ 0x5eed`):
  six `loop` peds, three per kerb of
  `xwalk:01:osm:way:990626907` (the real OSM zebra on the ACP node), on
  `walk:cscl:19401:l` / `walk:cscl:19401:r`. Adult/kid mix per side.
- **Ambient population**: `targetPeds: 16`, spawned ≥40 m from the
  camera look-at, despawned >420 m, mix adult 85 / kid 15.
- **Meshes today**: the `proc:person-2box` recipe — legs + torso/head
  boxes, feet pivot, +Z forward, sized from each resolved entry's
  declared bounds (adult ≈1.7 m, kid ≈1.15 m). Quaternius/Kenney rigged
  GLBs stay `pending-verification`; `three:` PersonGenerator is skipped
  pending worklet-bundle verification — `resolvePedEntry` is the single
  swap point. One `InstancedMesh` per kind = ≤2 draw calls, 24 tris/ped.

## Tests

94 living-city tests pass; the 21 PR06 additions:

- `ped-sim.test.ts` (14): the six-ped spec resolves on the real tile
  (3/side, two bands, one `osm-crossing` leg); the E2E asserts ≥6
  entries, ≥6 completions, every ped waits again, entries **only on
  `W`**, pairwise ≥0.28 m over 300 s, and no crossing exceeds 60 s
  (stall regression); a three-seed sweep repeats it. Kerb claims:
  crossing peds always appear in `holdersOf` (the heartbeat keeps FDW
  clearing legal). Synthetic-cross WALK-gating. **Vehicle yield**: a
  conflicting right-turn connector is never occupied while a ped claim
  is held. Corner links used, no carriageway elements ever reported.
  Obstacle dodge. Byte-identical ped sections across seeds; divergence
  across seeds. Ped-section codec + combined-snapshot byte equality +
  interpolation math. Ambient fill + out-of-focus despawn. Tick cost.
- `ped-actor.test.ts` (5): person recipe (24 tris, feet pivot, bounds),
  `resolvePedEntry` picks the buildable `proc:` tier, deterministic
  clothing, semantic-id seam, flag gate.
- `sim-host.test.ts` (+2): combined snapshot carries the ped section,
  host stats meter the crowd; two equal-seed hosts pack identical
  combined snapshots.

Full package: `node --test '**/*.test.ts'` → see final report; the
living-city subset is **94 pass / 0 fail**.
`tsc --noEmit` → clean. `eslint` → clean except one pre-existing
unused-import warning on `game-render.ts:24` (predates this PR).

## Performance (this machine, node --test timing)

| Workload | Ped tick cost |
|---|---|
| Six-ped slice | ≈1.5 ms/tick |
| ~200-ped ambient tile crowd | ≈7.7 ms/tick |

The 200-ped case is ambient worst-case on the real tile — the mounted
config targets 16 ambient + 6 scripted, which sits far closer to the
slice row. Costs are `sim.step` wall-time only; the ped section adds
`PSNAP_HEADER + n×PSNAP_STRIDE` numbers to the publish.

## Deadlocks found and fixed during this PR

Early runs froze the slice in five distinct ways — each fix is in
`ped-sim.ts` and covered by the E2E + stall regression:

1. Head-on zebra streams — keep-right + channel offset + ungated
   sidestep.
2. Post-move rollback restored x/z but not s/lat — full state rollback.
3. A follow-gap clamp braked oblique neighbours outside the collision
   cone — removed; the sqrt floor term is the exact criterion.
4. Two-abreast entry knotted at the ramp — `zebraEntryBusy` serializes
   the file until the leader clears 2.2 m; the kerb-edge approach keeps
   departures out of the loiter file.
5. Held claims expired mid-zebra at the solver's 30 s stale window —
   re-request is now a heartbeat (`conflict-solver.ts`) and crossers
   heartbeat every tick.

## Licensing / provenance

Unchanged from `ASSET_NOTICES.md` (PR04): Quaternius Universal Base
Characters + Animation Library (CC0 per pack page, `ped.adult`,
pending-verification), Kenney Animated Characters (CC0 per publisher
page, `ped.kid`, pending-verification), three.js `PersonGenerator` (MIT,
vendored inside installed three@0.186.1), `proc:person-2box` (internal,
follows the metro-live instanced-2-box pattern, MIT). No new third-party
assets were vendored in this PR.

## Device status

- Node tests pass (above). **Real device render verification is
  pending**: no WebGPU/WebGL path runs under `node --test`; the mounted
  crowd has not been eyeballed on device. Argent tooling was unavailable
  in this environment (`mcp__argent__*` tools absent), so no
  simulator/device run was attempted — honest status: sim + codec +
  claims + gate verified headless; draw/triangle budgets are arithmetic
  from the recipe and instance counts, not a `renderer.info` capture.
- The worklet path mirrors the combined snapshot through the same
  `Synchronizable<number[]>` channel as PR05 — same unverified-device
  caveat; the fresh-array publish keeps the identity contract.

## Pending / next

- GLB tier: vendor verified Quaternius/Kenney characters under
  `assets/living-city/…`, `markStatus → ready`; `resolvePedEntry` picks
  them up unchanged.
- `three:` PersonGenerator pending worklet-bundle verification.
- Ambient `targetPeds` is 16 — crowd tuning past ~200 belongs with
  measured device costs.
- `EXISTING_SYSTEMS_AUDIT.md` lives on the PR01 lane, not this stack:
  the crowd mounts through the same `params.actors` seam as PR05 — no
  second canvas, no channel changes. Deviation: none.

## Rollback

Delete the env flag or unset it — nothing mounts. `git revert` this
commit restores the PR05 snapshot shape (the ped section is appended,
never woven in); the only existing-behaviour change is the solver
heartbeat, which is a strict relaxation of claim lifetime for
actively-requesting entities.
