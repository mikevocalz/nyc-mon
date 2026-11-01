# Living City — scenario matrix (spec §14 A–E)

PR10 deliverable. Every row maps a §14 requirement to what exists, the
test or device capture that proves it, and what remains **PENDING**.
Honesty rule (spec §15): headless `node --test` proof is cited as such;
anything needing a screen is PENDING until captured on hardware. The one
device run is PR09's Duo release build (`docs/living-city/pr09-perf.md`)
— it proved the actors mount and counted their draw/tri deltas; it did
**not** visually verify behaviour.

Legend: ✅ proven (test/device evidence cited) · ◐ partial — read the
note · ☐ not built · ⏳ PENDING device/visual confirmation.

## Scenario A — 125th Street, daylight

| Requirement | Status | Evidence | PENDING |
|---|---|---|---|
| Real Harlem/Apollo roads + storefronts stay placed | ✅ | v3 tile `harlem-apollo-20261017`; F1 device run rendered it 84 s (`docs/performance/v3-f1-2026-10-17.md`) | — |
| ≥2 cars down legal lanes; one stops at red, one proceeds on green | ✅ | `vehicle-sim.test.ts`: "PR05 slice: two legal spawns at 125th & ACP", "PR05 slice: on the real tile one waits on red while the other proceeds", "red light: waits at the line, never enters box on red", "green pass" | ⏳ on-screen capture |
| Turning car follows NYC right-of-way | ✅ | `conflict-solver.test.ts` priority order (ped > through > right > left > uturn > TOR); `signal-controller.test.ts:202` "a turning driver on green must yield to a pedestrian holding the crosswalk"; RTOR default `queued` a full phase, sign-permitted → `must-yield` | ⏳ visual |
| Peds gather, observe signal, cross legally, clear before conflicting movements resume | ✅ | `ped-sim.test.ts` six-ped E2E on the real ACP zebra (entries only on `W`, ≥6 completions, re-queue, ≥0.28 m pairwise, ≤60 s); green-stretch invariant in `signal-controller.test.ts` | ⏳ visual |
| Vehicle direction arrows / signal phase / NPC intent readable in dev inspector | ◐ | Intent rides packed `VFLAG`/`PFLAG` bits + `controller.plan`, `solver.claimsView()/queueOf()/holdersOf()` — all node-test readable | ⏳ no mounted inspector UI — API-level only |
| Game player persists through camera moves | ✅ | existing Caller/camera, untouched; `livingCityActorFactories()` adds actors without touching them | — |
| Daylight specifically | ◐ | `CityClock` accepts any `startHour`; bundled host opens at 18.66 (dusk) — a daylight run is a config change, not new code | ⏳ daylight capture |

## Scenario B — Sunset / night

| Requirement | Status | Evidence | PENDING |
|---|---|---|---|
| Clock moves day→twilight/night | ✅ | `clock.test.ts` dayFactor curve, dawn/dusk ramps, determinism; host steps clock in lockstep (`sim-host.ts:170`) | — |
| Sky / windows / streetlamps / headlights change consistently | ◐ | Lamp drive + headlight bits are packed-clock-driven (tested); sky + facade lit-share are **mount-time picks** — they do not track the running clock (pr07/pr08 Pending) | ⏳ live sky/facade tracking + visual |
| Signals keep phase logic independent of dusk | ✅ | Structural: controller state is a pure function of tick count; env flows clock→sim, never back (`signal-controller.test.ts` determinism at dt 0.05/0.5) | — |
| Brake lights on slow/stop | ✅ | `vehicle-lights.test.ts`: braking-for-red stamps `VFLAG.braking`; `vehicleLightKeys` colour map | ⏳ visual |
| Ground pools without hundreds of shadow-casting lights | ✅ | `lamp-viz.ts`: ≤64 instanced pool decals + ≤256 glow crosses, zero point lights (rn-webgpu has no shadow maps); `lamp-viz.test.ts` pole-for-pole parity | ⏳ visual |
| No GPU blank frame / disappearing materials | ⏳ | Not exercised on device — node runs use the WebGL2 fallback | ⏳ device dusk/night capture |

## Scenario C — Rain and heavy traffic

| Requirement | Status | Evidence | PENDING |
|---|---|---|---|
| Rain intensity in the model | ✅ | `CityClock.setRain`, `rain` in the packed env section; rain darkens effective day → earlier lamps/headlights (clock.test.ts) | — |
| Reduced speed / sensible headway in rain | ☐ | `SimEnvironment.rain` is packed but the driver model only reads `env.headlights` (`vehicle-sim.ts:742,886`) — no wet-speed/headway scaling | ⏳ not built |
| Rain/wet materials, reduced draw distance | ◐ | Lamp drive boosted ≤+45 % in rain (lamp-viz.test.ts); wet-look/window consumers unwired; tier caps cut near-field sets, not a rain rule | ⏳ materials + device |
| Vehicles queue without illegally entering a blocked box | ✅ | `vehicle-sim.test.ts` "blocked exit: a full exit lane keeps the box clear even on green" | ⏳ visual |
| Peds and cars avoid collisions | ✅ | `ped-sim.test.ts` ≥0.28 m pairwise over 300 s; `vehicle-sim.test.ts` IDM never overlaps leader over 30 s; `pedClaimAt`/`pedBlocks` yield | ⏳ visual |
| Optional emergency-vehicle route | ☐ | Not built — spec marks it optional | — |

## Scenario D — Foldable / interruption / lifecycle

| Requirement | Status | Evidence | PENDING |
|---|---|---|---|
| Rotate/fold/posture change with live scene | ✅ device (override) | PR09: `cmd device_state` OPENED→HALF_OPENED→FOLDED→CLOSED→OPENED, scene alive every posture, same PID, controller pill re-laid | ⏳ physical hinge fold (override did not change display geometry) |
| App background/foreground, return | ✅ device | PR09: HOME → process parked ~21 s → `nycmon://game` resume same PID, perf cadence resumed ~3 s, no duplicate ticker | — |
| Same coordinates / seed / controller state | ✅ | Module-scope host + clamped 0.25 s accumulator (no catch-up burst); sim-host attach/detach + determinism tests | — |
| No duplicate loops / remount reset to green | ✅ | `sim-host.test.ts` ref-counted ticker; state persists parked; snapshot version monotonic | — |

## Scenario E — Swap assets without refactoring AI

| Requirement | Status | Evidence | PENDING |
|---|---|---|---|
| Sedan procedural → `sedan.glb` → second model, same id | ◐ | `asset-registry.test.ts` "sedan swap: stable id survives glb → procedural → primitive without touching consumers"; `resolveVehicleEntry` is the single swap point | ⏳ a real GLB tier (nothing vendored — `pending-verification`) |
| Procedural ped → rigged test character | ◐ | Same mechanism (`resolvePedEntry`); Quaternius/Kenney rows seeded pending-verification | ⏳ GLB vendoring + GPU-skinning device proof |
| Pathfinding / bounds / signals / fallback / saves stay correct on swap | ✅ | Sims name semantic ids, never meshes (`ped-actor.test.ts` "semantic seam"); `validateRegistry` enforces a ready primitive tail; saves keyed on dataset id — assets are not in saves | — |
| License/attribution captured by manifest | ✅ | `WorldAssetEntry.provenance` + `asset-validation.ts` license gate (`ready ⇒ licenseVerified`); `docs/living-city/ASSET_NOTICES.md` + `source-index.md` | — |

## §15 automated-test checklist → coverage

| Spec asks | Where proven |
|---|---|
| Road-graph topology, no illegal edges | `topology.test.ts` (no dangling ends, connector legality) |
| Inferred vs verified geodata labels | `topology.test.ts` (recorded/inferred split pinned 563/0, 389/174) |
| Coordinate save/migrations | `topology.test.ts` (dataset identity untouched); `world-resume.test.ts` |
| Intersection phase transitions | `signal-controller.test.ts` |
| No conflicting protected greens | `signal-controller.test.ts` fuzz (4+ cycles, no held conflicting claims) |
| NYC right-on-red default | `signal-controller.test.ts` |
| Deterministic sim + clock pause/resume | `sim-host.test.ts`, `clock.test.ts`, byte-identical snapshot tests |
| Car-following / stop distances | `vehicle-sim.test.ts` (IDM, stop line, amber both branches) |
| Yielding at crosswalk | `ped-sim.test.ts`, `vehicle-sim.test.ts pedClaimAt`, `conflict-solver.test.ts` |
| Pedestrian paths/displays | `ped-sim.test.ts`, `signal-viz.test.ts` |
| Density controls | `tier-caps.test.ts`, `perf/tier.test.ts` |
| Asset fallback/validation/license | `asset-registry.test.ts` |
| Renderer object disposal | actor `dispose()` in the `SceneActor` contract; no dedicated living-city disposal test — ◐ |
| Budget tests | `world/budget.test.ts` (static, unchanged) + living-city tick-cost tests (dynamic) |
| Device/quality flags | `vehicle-actor.test.ts`/`ped-actor.test.ts` flag gate; `tier.test.ts`/`tier-caps.test.ts` |

## Device-confirmation roll-up (the honest bottom line)

**On hardware so far:** one flag-on release build on the bench Surface Duo
(PR09): actors mounted (draw +12–13, tris ~+10–15 k vs F1), 86 s scripted
drive, posture-override cycle, background/foreground resume, adaptive
scale held 0.80. **No scenario has been visually confirmed on device** —
every ⏳ above is a capture to schedule, not a defect found.
