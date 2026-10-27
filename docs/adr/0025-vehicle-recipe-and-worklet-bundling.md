# 0025 — Vehicle recipe and worklet bundling for the lofted fleet

- **Status:** Proposed. Recipe selection, triangle counts and the module rules are node-verified. That the fleet builds under Hermes on the device worklet runtime is unverified; so is every frame on iPhone 17 and iPad Pro.
- **Date:** 2026-10-27
- **Deciders:** Mike
- **Builds on:** ADR 0023 (renderer mode; `EXPO_PUBLIC_WORLD_PHYSICAL`).
- **Sources:**
  - `docs/plans/slop-grade-city-prompt.md` §6.4 (ADR 3), §9 N8.
  - Slop New York @ `be65d0a`, `js/actor-models.js` `LoftGeometry`, `BODY_SPECS`, `buildCarGeometry`, `buildCarProxyGeometry`, `buildLoftedBusBodyGeometry`, `createLoftedCarMaterial`, `createLoftedBusMaterial`, `carPlateTexture`. Slop's `LoftGeometry` is ported from three's `examples/jsm/geometries/LoftGeometry.js`; its car bodies come from three's `examples/jsm/generators/city/CarGenerator.js`. Both are MIT, by the three.js authors, and present in the installed `three@0.186.1`.
  - Installed three 0.186.1: `examples/jsm/lighting/ClusteredLighting.js` L51 and `examples/jsm/tsl/lighting/ClusteredLightsNode.js` L219.
- **Code:** `packages/app/features/game/living-city/lofted-car.ts` (geometry), `lofted-car-material.ts` (materials), `seed-assets.ts` `LOFTED_VEHICLE_ASSETS` and `PHYSICAL_SEED_ASSETS` (L335–405), `asset-registry.ts` `candidates` (L108–141), `vehicle-actor.ts` `LOFTED_RECIPE_PREFIX` and `resolveVehicleEntry` (L158, L176), `vehicle-sim.ts` `VEHICLE_KINDS` (L73). Tests: `lofted-car.test.ts`, `lofted-fleet.test.ts`, `lofted-car.worklet-runtime.test.ts`.

## Context

Cars on the tile are `proc:box-car`: six boxes, 72 triangles (`vehicle-actor.ts` header). Slop's cars are lofted bodies with a coarse far proxy. The cars stayed boxes because three's `CarGenerator` binding was never checked on the worklet render runtime, where `render-runtime/game-render.ts` builds the city. That runtime has no `react-native`, no DOM and no Turbo Modules, and the installed `LoftGeometry.js` and `BufferGeometryUtils.js` import from `'three'`, not `'three/webgpu'`, so loading them there would pull a second three module graph onto the runtime.

## Decision

**One lofted recipe per vehicle kind, ranked above the box.** `VEHICLE_KINDS` is `sedan`, `taxi`, `van`, `bus`. Under the flag the registry is `PHYSICAL_SEED_ASSETS = [...SEED_ASSETS, ...LOFTED_VEHICLE_ASSETS]`. Each lofted entry is `source: 'procedural'` with `uri: 'proc:lofted-car'` or `'proc:lofted-bus'` and `params.vehicleKind`; each box entry is `source: 'primitive-fallback'`. `candidates()` sorts by `SOURCE_PRIORITY` (glb 0, procedural 1, primitive-fallback 2), so the lofted entry outranks the box by tier, not by array order. `resolveVehicleEntry(registry, semanticId, kind)` then takes the lofted entry whose `vehicleKind` matches, which is how the taxi gets its roof sign while sharing `vehicle.sedan` with the sedan. Without a kind, resolution stays on `proc:box-*` (`lofted-fleet.test.ts` L88–110).

**Geometry is plain data with no three import.** `lofted-car.ts` has no import statement. It writes Slop's surfaces into number arrays: an ear clipper replaces Earcut for the caps, a four-section loft replaces `ExtrudeGeometry` for the taxi sign, and an indexed 24-vertex box replaces `BoxGeometry`. The file header lists each difference from Slop.

**Materials take three as a parameter.** `createLoftedCarMaterial(THREE, spec, options)`, `createLoftedBusMaterial(THREE, options)` and `createPlateAtlasTexture(THREE)` receive the runtime's three; `lofted-car-material.ts` imports three only as types. The runtime that owns the renderer owns the three instance.

**No module-level mutable state.** Neither module has a module-scope `let`, `var`, `Map` or cache. Slop memoises layouts on its spec objects (`spec._body`, `spec._layout`); the port recomputes them, and `lofted-car.test.ts` L189–196 checks `BODY_SPECS` serialises the same after a build. `BODY_SPECS` and `BUS_SPEC` are typed `Readonly` but not frozen.

**Real headlight spots are off.** `createVehicleActor` defaults `headlightSpots` to true (`vehicle-actor.ts` L650). Both call sites pass `false`: `render-runtime/game-render.ts` L355 and `living-city/bundled-host.ts` L218. In three r186, `ClusteredLightsNode` puts a light in the clusters only when `light.isPointLight === true && light.castShadow !== true` (`ClusteredLightsNode.js` L219). A `SpotLight`, shadowed or not, goes on the per-material path and would light every lit material in the city. Lamps and the flare sprites still show. `bundled-host.ts` L218 carries no comment saying why; `game-render.ts` L353–354 does.

## Numbers

| Kind | Triangles | Vertices |
|---|---|---|
| sedan | 4,152 | 2,761 |
| taxi | 4,240 | 2,849 |
| van | 4,284 | 2,857 |
| bus | 4,036 | 2,562 |

Pinned in `lofted-car.test.ts` L111–116. The far proxies are 494 (sedan), 494 (SUV) and 506 (taxi) triangles (L117). The taxi is the sedan plus 88 triangles of roof sign (L170).

**Draws for the fleet: 8.** Near and far `InstancedMesh` for each of sedan, taxi and van (6), one bus mesh with no far proxy (1), and one instanced flare sprite (1, `vehicle-actor.ts` L665–678). That assumes one material per mesh, which `lofted-car-material.ts` L6–8 states. **No test asserts 8**; `lofted-fleet.test.ts` L152–176 checks the meshes exist and that `bus:far` does not, without counting draws. The header budget in `vehicle-actor.ts` is about 10 draws and 50 k triangles for dynamic actors.

## Worklet bundling

`lofted-car.worklet-runtime.test.ts` (3 tests) loads the lofted modules the way the render runtime would, using the harness from `render-runtime/game-render.worklet-runtime.test.ts`:

- `__RUNTIME_KIND` is 3 (a worker runtime) and the dev Turbo Module guard is installed.
- `react-native`, uniwind, React, Expo, Reanimated, Gesture Handler and react-native-webgpu resolve to a module that throws on evaluation; `react-native-worklets` is stubbed.
- Reads of `document`, `window` and `localStorage` are recorded, and none may come from app code.

The tests check the harness itself, build all four kinds from `lofted-car.ts` alone, and build the full actor (`physical: true`, `tier: 'phone'`) with real `three/webgpu`, run `update` and `dispose`, and assert no app DOM reads.

**This is Node evidence only.** Hermes on a device worklet runtime is not exercised. Whether the fleet builds and draws there is part of the Phase 0 worklet-runtime rows (ADR 0023).

## Options considered

### A. Lofted recipes as plain data, three passed in (chosen)

| Dimension | Assessment |
|---|---|
| Worklet safety | Geometry imports nothing; materials use the runtime's three |
| Testability | Triangle counts and watertightness pinned in Node without three |
| Fidelity | Same surfaces as Slop; the differences are listed in the file header |
| Cost | About 4,000 triangles per near car versus 72 for a box |

### B. Import three's `LoftGeometry` and `CarGenerator` directly

Rejected. Both import from `'three'`, which is a second module graph next to `'three/webgpu'` on the render runtime, and the binding was never checked there.

### C. Keep `proc:box-car`

Rejected for the flag-on path. It cannot reach the look target. It remains the fallback: with the flag off, or without a kind, resolution lands on the box.

## Consequences

- The fleet costs more triangles. The far proxy (about 500 triangles) draws every vehicle outside the near set. Whether the fleet stays inside the 50 k actor budget at full traffic has not been measured.
- Adding a vehicle kind means a recipe in `LOFTED_VEHICLE_ASSETS` with its `vehicleKind`, a pinned count in `lofted-car.test.ts`, and two more draws if it has a far proxy.
- Turning headlight spots on waits for either three clustering `SpotLight`s or a lane that measures spots on the per-material path. Until then the two call sites stay `false`.

## Verification status

- **Node-verified, run 2026-10-27:** 12 tests pass in `lofted-car.test.ts` (9) and `lofted-car.worklet-runtime.test.ts` (3); with `lofted-fleet.test.ts` (recipe ranking and kind selection) the three files run 27 tests, all passing.
- **Read from code, not asserted:** the 8-draw total and the 64 B per wall vertex in ADR 0024 are counted by hand.
- **Not verified:** Hermes on the device worklet runtime; frames, frame time and triangle throughput on iPhone 17 and iPad Pro.
