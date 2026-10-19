# NYC-MON — Living NYC World: Realistic Cars, Pedestrians, Functional Traffic Signals & Streetlights

**Copy/paste master engineering prompt for Claude Code, Codex, Cursor, or another coding agent**  
**Prepared:** October 17, 2026  
**Target repository:** https://github.com/mikevocalz/nyc-mon  
**Objective:** Extend NYC-MON's already-built Three.js city into a believable, busy, cinematic, near-future New York City with moving traffic, actually functioning traffic lights, safe pedestrian crossings, animated people, street illumination, and easily replaceable 3D assets.

---

## 0. YOUR MISSION — IMPLEMENT, DON'T START OVER

You are the engineering lead of a multidisciplinary AAA-grade world-simulation and cross-platform graphics team. **Your job is to improve the existing NYC-MON monorepo**, not scaffold a new game or replace the current architecture. Inspect the actual working tree, latest open PRs, installed libraries, skills, tests, creator canon, and the existing Harlem city implementation **before making changes**. Cite real file paths and commits in the implementation report; do not assume the paths below are unchanged.

The visual ambition is **a lived-in near-future NYC with grounded photorealistic streets and characterful futurism**: believable cars, traffic and people at street level; wet asphalt, reflective glass, neon and signage when appropriate; recognizable Harlem/Bronx/Brooklyn streets and borough identity; selected futuristic skyscrapers and holographic ad surfaces as a later additive layer. The game should have cinematic presence without copying proprietary imagery, assets or brands from existing games or films.

**Top priority:** When a player stands on 125th Street near the Apollo Theater, they should see a *living city*: a sedan brakes at a real red signal, cross traffic passes on green, pedestrians wait for WALK, people enter the crosswalk, a turning driver yields, a delivery van pulls away, a bus approaches its stop, and streetlamps switch on as night falls. These are **one coherent simulation**, not disconnected animations.

### Non-negotiables

1. **Three.js WebGPU on React Native**, using the existing `react-native-webgpu` runtime and compatible TSL/TypeGPU facilities. Follow the real installed version matrix; evaluate TypeGPU shader integration where available, without an unreviewed dependency or renderer rewrite. No Unity, Unreal or unapproved replacement 3D engine. Do not drop to a separate WebGL-only city on native.
2. **Preserve the existing NYC-MON environment, OSM dataset, coordinate system, world saves and gameplay interfaces.** The first traffic slice is in the existing Harlem/Apollo tile, not a separate procedural city or imaginary road network.
3. Keep feature implementation under `packages/app/features/game/` and native routes thin under `apps/mobile/app/`; inspect the current feature/package boundaries. Reuse `packages/ui`, `packages/theme`, current spatial/adaptive layout components, Zustand for appropriate shared app state, and Kinetrell/Reanimated for app/UI motion. Do not introduce GSAP, Lenis, Tamagui or Bento.
4. **Reuse before replacing:** current `city-scene.ts`, `world/index.ts`, `world/street-furniture.ts`, `world/street-props.ts`, `world/street-props-layout.ts`, `world/walkability.ts`, `world/budget.ts`, `world/pbr-materials.ts`, and existing actor/render-runtime contracts. The city already has parked-car props, LED streetlamps, light pools, street signs and performance tests. Extend/integrate those features; don't construct parallel systems.
5. **Functional traffic rules and pedestrian safety are mandatory.** A color-cycling model that has no effect on cars is a failed implementation. Use the same controller state for driver behavior, visible signal heads and pedestrian indicators.
6. **Preserve the right to replace ALL temporary car and pedestrian art later.** Simulation, collision bounds, animations, instance rendering and model choices must be decoupled. Include links to original assets and procedural-source files in a tracked manifest. No hardcoded asset paths in driver AI.
7. Real NYC roads and provenance matter. Preserve OpenStreetMap/Open Data attribution and ODbL obligations where applicable. Do not quietly remove attribution or create invented road facts. Never portray inferred speed limits, lane directions, protected turn permissions or signal locations as verified real-world facts.
8. Respect creator canon and existing game systems. Do not implement trains yet; preserve hooks for a creator-provided train layer. Do not overrun the world with uniform cyberpunk assets, invent names for real public housing, or put billboards on real residences by default.
9. No claims of physical-device performance without actual hardware measurements. No merger into `main` without explicit approval; open reviewable PRs and leave concrete verification evidence.

---

## 1. REQUIRED REPOSITORY BASELINE AUDIT

Read and summarize the actual current contents of:

- [`README.md`](https://github.com/mikevocalz/nyc-mon/blob/main/README.md), `AGENTS.md` where present, `CONTRIBUTING.md`, `docs/canon/`, [`docs/REPO_MAP.md`](https://github.com/mikevocalz/nyc-mon/blob/main/docs/REPO_MAP.md).
- [`docs/implementation/city-world.md`](https://github.com/mikevocalz/nyc-mon/blob/main/docs/implementation/city-world.md): existing Harlem OSM world, compiler, street props, renderer constraints and previous Surface Duo performance work.
- [`docs/implementation/MOBILE_WORLD_PR_PACK.md`](https://github.com/mikevocalz/nyc-mon/blob/main/docs/implementation/MOBILE_WORLD_PR_PACK.md): platform rules and PR dependencies.
- [`packages/app/features/game/city-dataset.ts`](https://github.com/mikevocalz/nyc-mon/blob/main/packages/app/features/game/city-dataset.ts), [`city-scene.ts`](https://github.com/mikevocalz/nyc-mon/blob/main/packages/app/features/game/city-scene.ts), `scene-actor.ts`, `game-session.ts`, `world-resume/`, `render-runtime/`.
- [`packages/app/features/game/world/street-furniture.ts`](https://github.com/mikevocalz/nyc-mon/blob/main/packages/app/features/game/world/street-furniture.ts), [`street-props.ts`](https://github.com/mikevocalz/nyc-mon/blob/main/packages/app/features/game/world/street-props.ts), [`street-props-layout.ts`](https://github.com/mikevocalz/nyc-mon/blob/main/packages/app/features/game/world/street-props-layout.ts), `signage.ts`, `walkability.ts`, `world/index.ts`, `world/budget.ts`, and tests.
- `tooling/city/fetch.mjs`, `build.mjs`, `print-counts.mjs`, the committed `data/harlem-apollo.json`, and `packages/core/world/transform.ts`.
- Package versions in `pnpm-workspace.yaml`, `package.json`, native Expo modules, TypeGPU support, three.js and renderer capabilities; existing branch/PR work that may already implement any requested behavior.

**Important baseline observed October 16, 2026 (verify against latest code):** Harlem/Apollo v2 data is a roughly 1.7 km city tile, with documented counts of **3,761 buildings** and **2,414 roads**. The existing scene contains parked-car prop placements, LED streetlamp poles/heads and a capped near-camera light-pool implementation. The city notes document a Surface Duo vertex-bound frame-rate regression and a later on-demand visibility budget; that is **not proof** that the full city + traffic already sustains 30 or 60 FPS on hardware. Audit this before selecting traffic/crowd densities. Keep current save dataset identifiers and geo origin stable.

**First deliverable:** write a short `EXISTING_SYSTEMS_AUDIT.md` (or append to the implementation docs) listing existing behavior, missing systems, overlapping PRs, code to reuse, risks, provenance and device baselines. No duplicate engine or duplicate GPU canvas.

---

## 2. RESEARCH REPOSITORIES — WHAT TO BORROW AND WHAT NOT TO BORROW

| Priority | Source | Study / adapt | Limitation / guardrail |
|---|---|---|---|
| **P0** | [Fable Cities](https://github.com/rawprogress/fable-cities) / [live city](https://fablecities.rawscollections.com/) | Lane graphs, routed cars, intersection conflict checks, signal phases, pedestrian paths, traffic behavior and tightly batched crowd rendering | Its simulation is a web/Three.js/WebGL2 implementation: **port concepts**, not its rendering engine or entire app. Inspect licenses. |
| **P0** | [Fable traffic subsystem](https://github.com/rawprogress/fable-cities/tree/main/src/modules/traffic) | `LaneNetwork.js`, `TrafficSim.js`, `Renderer.js`, `VehicleModels.js`, `PedestrianModel.js`, `index.js` | Use NYC-MON's native simulation/render boundary and exact road data. |
| **P0** | [vg-demos-all `metro-live`](https://github.com/vietgangzz/vg-demos-all/tree/master/src/demos/metro-live) | Native Three.js WebGPU city geometry, OSM transforms, chunking, LOD and materials | NYC-MON already adapted many concepts. **Do not port again**; integrate with current existing modules. |
| **P1** | [night-street](https://github.com/StarKnightt/night-street) / [live demo](https://night-street.vercel.app/) | Exceptionally detailed, **procedural parked-car geometry**, glazing, accurate vehicle silhouettes, ground-contact shading and street-level PBR art | The cars are generated in [`src/world/cars.ts`](https://github.com/StarKnightt/night-street/blob/master/src/world/cars.ts), **not exported third-party GLBs**. Desktop-oriented visuals must be budgeted for native. |
| **P1** | [ProceduralBuildingsThreeJS](https://github.com/achrefelouafi/ProceduralBuildingsThreeJS) / [demo](https://proceduralbuildings.chirostudio.xyz/) | NYC corners, prewar façades, windows, AC units, stores, signs, fire escapes and night interiors | Preserve correct local architecture and performance. This project does **not** supply car/crowd simulation. |
| **P1** | [Official Three.js CityGenerator](https://github.com/mrdoob/three.js/blob/master/examples/jsm/generators/CityGenerator.js) and [SkyscraperGenerator](https://github.com/mrdoob/three.js/blob/master/examples/jsm/generators/city/SkyscraperGenerator.js) | Modular WebGPU/TSL skyscrapers and **separate generators for NYC-style streetlights, traffic-signal heads, cars and people**; reusable geometry, instancing, shading patterns | Visual generators are **not** a working NYC traffic controller, and their synthetic grid must never replace OSM topology. Confirm installed Three.js API compatibility. |
| **P2** | [jstrait/city-tour](https://github.com/jstrait/city-tour) | Block layout and city camera ideas | Generated streets must **not replace** actual NYC street topology. |
| **P2** | [NASA-AMMOS/3DTilesRendererJS](https://github.com/NASA-AMMOS/3DTilesRendererJS) | Geographic rendering / streamed LOD references | Real-world photogrammetry often has separate data licenses and limited gameplay editability. Reference only unless reviewed. |
| **P2** | [Manhattan 3D](https://github.com/anchitjaincfa/manhattan-3d) | Real building placement / NYC open geodata examples | Confirm data provenance and coverage before reuse. |
| **P2** | [google-maps-fps](https://github.com/sumitaich1998/google-maps-fps) / [custom-map docs](https://github.com/sumitaich1998/google-maps-fps/blob/main/docs/CUSTOM_MAP.md) | World-to-playable-level conversion using OSM buildings/roads, terrain DEM, weather/time-of-day, procedural environment, FPS camera/collision and mobile quality tiers; inspect how game state attaches to real coordinates | Uses a web/Vite/Three.js game and packaged web runtimes, **not** NYC-MON native Three WebGPU; do not replace the current NYC-MON renderer or import its unrelated combat. Its MIT **source-code** license excludes third-party assets/data; follow `CREDITS.md` and map-provider attribution. |

### Specific source files to review first

- **Traffic simulation:** https://github.com/rawprogress/fable-cities/blob/main/src/modules/traffic/TrafficSim.js
- **Lane/intersection graph and phases:** https://github.com/rawprogress/fable-cities/blob/main/src/modules/traffic/LaneNetwork.js
- **Traffic renderer:** https://github.com/rawprogress/fable-cities/blob/main/src/modules/traffic/Renderer.js
- **Procedural, realistic vehicles:** https://github.com/rawprogress/fable-cities/blob/main/src/modules/traffic/VehicleModels.js
- **Procedural animated pedestrians:** https://github.com/rawprogress/fable-cities/blob/main/src/modules/traffic/PedestrianModel.js
- **Procedural service fleets (alternate Fable system):** https://github.com/rawprogress/fable-cities/blob/main/src/modules/simulation/vehicles.js
- **Night Street's procedural parked cars:** https://github.com/StarKnightt/night-street/blob/master/src/world/cars.ts
- **Metro-live platform pedestrians (simple instanced placeholders):** https://github.com/vietgangzz/vg-demos-all/blob/master/src/demos/metro-live/world/people.ts
- **Three.js official CityGenerator (overall architecture):** https://github.com/mrdoob/three.js/blob/master/examples/jsm/generators/CityGenerator.js
- **Official CityGenerator detailed towers:** https://github.com/mrdoob/three.js/blob/master/examples/jsm/generators/city/SkyscraperGenerator.js
- **Official procedural instanced car fleet (sedan/SUV/taxi):** https://github.com/mrdoob/three.js/blob/master/examples/jsm/generators/city/CarGenerator.js
- **Official procedural instanced people (standing/walking poses):** https://github.com/mrdoob/three.js/blob/master/examples/jsm/generators/city/PersonGenerator.js
- **Official NYC-style mast-arm signals (geometry/visible heads, NOT control logic):** https://github.com/mrdoob/three.js/blob/master/examples/jsm/generators/city/TrafficlightGenerator.js
- **Official NYC-style cobra-head streetlamp geometry:** https://github.com/mrdoob/three.js/blob/master/examples/jsm/generators/city/StreetlightGenerator.js
- **google-maps-fps real-location playable-map workflow:** https://github.com/sumitaich1998/google-maps-fps/blob/main/docs/CUSTOM_MAP.md
- **google-maps-fps first-person camera reference:** https://github.com/sumitaich1998/google-maps-fps/blob/main/src/engine/fpsController.js
- **google-maps-fps mobile quality-tier reference:** https://github.com/sumitaich1998/google-maps-fps/blob/main/src/engine/quality.js

**Reference discovery must result in a file-by-file decision log:** REUSE CONCEPT / ADAPT ALGORITHM / USE ORIGINAL ASSET / KEEP NYC-MON IMPLEMENTATION / REJECT (plus why). Check exact licenses, performance tradeoffs and source provenance. Do not invent models or assert a project provides downloadable pedestrian meshes when it generates geometry in code.

---

## 3. CAR MODELS: DIRECT ORIGINAL ASSET LINKS + PROCEDURAL SOURCES

**Critical factual distinction:** Fable Cities **bundles these existing GLB vehicle files** under `public/assets/simulation/models/`, credited to **Kenney Car Kit 3.1 (CC0)**; however its `src/modules/traffic/VehicleModels.js` builds the main traffic vehicles **procedurally** rather than simply loading these GLBs. The separate `src/modules/simulation/vehicles.js` likewise defines procedurally rebuilt service vehicles. Catalog both paths in the asset ledger. For a first prototype, choose between the already-bundled CC0 GLBs and procedural models based on measured quality/performance, not assumption.

| Vehicle starter asset | GitHub model source (click to view/download) |
|---|---|
| sedan | [sedan.glb](https://github.com/rawprogress/fable-cities/blob/main/public/assets/simulation/models/sedan.glb) |
| SUV | [suv.glb](https://github.com/rawprogress/fable-cities/blob/main/public/assets/simulation/models/suv.glb) |
| van | [van.glb](https://github.com/rawprogress/fable-cities/blob/main/public/assets/simulation/models/van.glb) |
| truck | [truck.glb](https://github.com/rawprogress/fable-cities/blob/main/public/assets/simulation/models/truck.glb) |
| delivery vehicle | [delivery.glb](https://github.com/rawprogress/fable-cities/blob/main/public/assets/simulation/models/delivery.glb) |
| police vehicle | [police.glb](https://github.com/rawprogress/fable-cities/blob/main/public/assets/simulation/models/police.glb) |
| ambulance | [ambulance.glb](https://github.com/rawprogress/fable-cities/blob/main/public/assets/simulation/models/ambulance.glb) |
| firetruck | [firetruck.glb](https://github.com/rawprogress/fable-cities/blob/main/public/assets/simulation/models/firetruck.glb) |
| garbage truck | [garbage-truck.glb](https://github.com/rawprogress/fable-cities/blob/main/public/assets/simulation/models/garbage-truck.glb) |
| construction shovel | [tractor-shovel.glb](https://github.com/rawprogress/fable-cities/blob/main/public/assets/simulation/models/tractor-shovel.glb) |

**Source and license verification:**

- [All Fable vehicle model files](https://github.com/rawprogress/fable-cities/tree/main/public/assets/simulation/models)
- [Fable bundled asset credits](https://github.com/rawprogress/fable-cities/blob/main/public/assets/CREDITS.md)
- [Fable's bundled Kenney license](https://github.com/rawprogress/fable-cities/blob/main/public/assets/simulation/models/KENNEY_LICENSE.txt)
- [Original Kenney Car Kit](https://kenney.nl/assets/car-kit) — CC0 per publisher; use to verify exact source pack.
- [Fable traffic procedural vehicle source](https://github.com/rawprogress/fable-cities/blob/main/src/modules/traffic/VehicleModels.js) — no distinct GLB is implied.
- [Night Street car generator](https://github.com/StarKnightt/night-street/blob/master/src/world/cars.ts) — no source `.glb` claimed.
- [Official Three.js procedural CarGenerator](https://github.com/mrdoob/three.js/blob/master/examples/jsm/generators/city/CarGenerator.js) — instanced sedan/SUV/taxi shapes in source code, not downloadable `.glb` assets. Its geometry and `partId`/TSL shading deserve a direct comparison with Fable and Night Street.

**Implementation rule:** Store provenance and a repo-owned copy of each *approved* starter GLB or generator only after verifying license and Git LFS/storage strategy. Do not hotlink production assets from someone else's GitHub repository. Make each asset swappable by stable semantic ID (`vehicle.sedan.city`, `vehicle.suv.city`, `vehicle.taxi.city`, `vehicle.bus.city`, etc.). A replacement may be a proprietary detailed mesh later, but driver logic, routes, collision bounds, light controllers and save formats must be unchanged.

**Art direction:** Starter geometry can be temporary; long-term cars should have credible silhouettes and real-world scale, realistic wheelbases/ground contact, rubber tires, dark cabin glass, PBR car paint and glazing, brake and turn indicators, headlights, rear lamps, and wheel rotation. Support NYC taxis, buses, sanitation/delivery vehicles and service fleets using original/license-cleared art; avoid embedding unauthorized logos or trademarks in acquired assets.

---

## 4. PEDESTRIAN MODEL SOURCES — BE EXPLICIT ABOUT WHAT IS ACTUALLY INCLUDED

**Fable Cities pedestrians are currently procedural, not a public pack of character GLBs.** Their geometry is generated by [`PedestrianModel.js`](https://github.com/rawprogress/fable-cities/blob/main/src/modules/traffic/PedestrianModel.js); its shader-based instanced walk cycle is handled through the traffic rendering pipeline. Read the file before claiming downloadable model filenames. [Traffic renderer](https://github.com/rawprogress/fable-cities/blob/main/src/modules/traffic/Renderer.js) is the companion implementation.

**metro-live** uses simplified instanced geometry for station/platform people: [world/people.ts](https://github.com/vietgangzz/vg-demos-all/blob/master/src/demos/metro-live/world/people.ts). It is a useful behavior/performance reference, **not** a realistic character-model library.

**Official Three.js `PersonGenerator`** also creates procedural instanced standing/walking human shapes: [source](https://github.com/mrdoob/three.js/blob/master/examples/jsm/generators/city/PersonGenerator.js). These are reusable *visuals*, not a complete crosswalk/sidewalk AI or a set of separately downloadable rigged `.glb` characters. Compare quality and GPU cost with the Fable instanced pedestrian pipeline; adapt the winning renderer behind the swappable actor interface.

### Replacements for future high-detail pedestrians (real links)

| Source | Why it belongs in the pipeline | License / limitations |
|---|---|---|
| [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) | Rigged reusable humanoid bases (including teen proportions) and hairstyles; starting point for a more believable, varied crowd. GLTF/FBX options. | Publisher lists CC0; verify exact free/source variant and contents before copying. |
| [Quaternius Universal Animation Library](https://quaternius.itch.io/universal-animation-library) | Walking, running, idling, sitting and other motion clips for future retargeting. | Publisher lists CC0; confirm package variant, rig and export behavior. |
| [Kenney Animated Characters Protagonists](https://kenney.nl/assets/animated-characters-protagonists) | Small CC0 animated humanoid kit for near-term import/retarget tests. | Stylized/low-detail: prototype, not final AAA fidelity. |
| [Kenney Animated Characters 3](https://kenney-assets.itch.io/animated-characters-3) | Another source for simple rigged starter humans. | CC0 per publisher; check download and export formats. |
| [Mixamo](https://www.mixamo.com/) / [Adobe licensing FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) | Animation rigging and locomotion prototype assets. | Commercial games are permitted under Adobe's published FAQ, but review redistribution restrictions; **not** a CC0 asset pack. |
| [Three.js WebGPU individual skinned instancing example](https://threejs.org/examples/webgpu_skinning_instancing_individual.html) / [instanced animated mesh repo](https://github.com/bandinopla/threejs-instancedanimatedmesh) | Study GPU instancing and independent animation timing for crowds. | Implementation compatibility on current native WebGPU must be verified; no blind copy/paste of shaders. |

**Asset upgrade order:**

1. Ship deterministic, low-cost procedural stand-ins first **only when acceptable in camera tests**. Keep class/behavior identity independent of mesh identity.
2. Create a future-ready rig and animation contract (`idle`, `walk`, `run`, `wait`, `turn`, `cross`, `look`, `react`, `sit`, `board`, optionally accessibility-specific locomotion). Use a stable +Y-up/metres convention and documented forward axis, not implicit transforms.
3. Upgrade a few foreground pedestrians to real rigged characters and a cheap instanced crowd for mid/distant citizens; use screen-space LOD selection to avoid hundreds of full skeleton updates.
4. Avoid stereotyped clothes, bodies and ethnicity assignments; aim for a credible, varied New York street scene with appropriate accessibility and everyday human activity.
5. Keep an explicit fallback character: a failed GLB/animation import must not prevent the game world from loading.

---

## 5. SWAPPABLE, LICENSE-AUDITED ASSET SYSTEM — REQUIRED

Build one **WorldAssetRegistry** consumed by both vehicle and pedestrian renderers. It must treat the scene's model as a **presentation detail** over stable simulation data.

Propose/implement a structure based on the existing monorepo rather than blindly creating paths:

```text
packages/app/features/game/living-city/
  graph/                 # lane graph + sidewalk graph + geodata adapters
  simulation/            # clock, seeded state, controllers, vehicles, pedestrians
  render/                # Three.js WebGPU instance renderers and asset adapters
  assets/                # typed manifest, import/conversion tools, license index
  scenarios/             # scripted, reproducible acceptance scenarios
  tests/                 # unit, graph, signal, collision, snapshot tests

docs/architecture/LIVING_CITY.md
docs/implementation/TRAFFIC_AND_CROWD_PR_PLAN.md
docs/assets/LIVING_CITY_ASSETS.md
docs/performance/LIVING_CITY_DEVICE_BASELINES.md
```

Example typed contract (**adapt to the existing code style, do not duplicate existing registries**):

```ts
type AssetSource = {
  id: string;                         // stable: vehicle.sedan.city, pedestrian.adult.walker
  kind: 'vehicle' | 'pedestrian' | 'traffic-signal' | 'streetlamp';
  sourcePageUrl: string;              // human-reviewable license/provenance URL
  originalFileUrl?: string;          // exact original .glb or .gltf source when present
  originalGeneratorUrl?: string;     // procedural fallback when NO file exists
  localPath?: string;                // validated and optimized packaged output
  license: string;                   // e.g. CC0-1.0, or requires review
  licenseVerified: boolean;
  author?: string;
  unitScaleToMeters: number;
  forwardAxis: '+Z' | '-Z' | '+X' | '-X';
  upAxis: '+Y';
  pivot: 'ground-center' | 'wheelbase-center' | 'feet';
  widthM?: number; lengthM?: number; heightM?: number;
  lods: { near?: string; medium?: string; far?: string };
  fallbackId: string;
  animations?: Record<string, string>;
  visualVariantTags?: string[];
};
```

**Requirements:**

- One authoritative source manifest with original URLs, local optimized paths, license, author, download date, SHA-256 of source file, source version/commit, glTF node names, variants, poly/triangle counts, compressed GPU memory estimate and runtime LOD mapping. Maintain a separate mandatory `ASSET_LICENSES.md` / third-party notices file.
- Import pipeline supports GLB/glTF, reasonable optimized texture sizes, compression only if tested on supported runtimes, normalized units/pivots/orientation, semantic node naming, wheels/axles on vehicle rigs and clip retargeting for people. Include preview/validation commands and reject broken assets with actionable diagnostics.
- Stable ID mapping from simulation class to chosen mesh; runtime fallback to procedural geometry without reloading routes or traffic brains.
- Vehicle bounding/collision box measured in metres from real parameters; model may be scaled/rotated visually but cannot silently change physics or road clearances.
- No unlicensed source dumps, hotlinked runtime GitHub raw URLs, trademark violations, or accidental redistribution of Mixamo models as an asset pack. Track assets even when CC0.
- **Acceptance test:** replace `vehicle.sedan.city` with another differently shaped GLB, and replace a pedestrian mesh/rig, by changing the manifest/import package only. Their paths, signal response, walking behavior, collision bounds and world saves continue working.

---

## 6. REAL NYC ROAD, LANE, CROSSWALK & INTERSECTION DATA

Use the **existing Harlem dataset and world-coordinate system** as the foundation. The currently documented v2 dataset has road geometry but does not guarantee all traffic-specific facts (e.g. verified lane directions, turning lanes, signal heads and stop-line positions). Add a **versioned, provenance-tracked lane/intersection sidecar** or a safe backward-compatible schema revision rather than fabricating network topology and quietly altering save coordinates.

Create these conceptual subsystems, with names adjusted to the repo:

- `CityTrafficData`: input roads/footways/crossings from OSM and any verified NYC Open Data; independently tagged generated approximations.
- `LaneGraph`: directed lanes, lane widths, one-way rules, legal turns, turn radii, connector geometries, sidewalks/bike lanes, route cache. Distinguish tagged truth from inferred defaults.
- `IntersectionGraph`: unique IDs tied to road/OSM source IDs; conflict matrix, stop lines, crosswalk geometry, turning movements, pedestrian conflict set, controller type.
- `PedestrianGraph`: accessible walkable sidewalk network with crosswalk connections, ramps, park paths, subway entrances and bus shelters; avoid routing pedestrians through buildings/traffic lanes.
- `RoadsideParking`: integrate **existing** parked-car layout (`street-props-layout.ts`), fire hydrant offsets, crosswalk clearance and bus stops. Mark slots occupied so moving cars cannot drive through parked ones.
- `GeospatialValidation`: inspect a map overlay and get reports of snapped/unconnected segments, inferred vs verified signals, wrong-side-driving, sidewalk gaps, cul-de-sacs, bridge/tunnel edges and invalid turn connectors.

Start with **at least three real nearby intersections** in the Harlem/Apollo tile, with correct directions and genuine crosswalk placements. Render them in debug mode with lanes, legal turns, stop lines, signal IDs and pedestrian links. Do not invent a citywide real traffic-lights dataset; if real data is absent, use **explicitly labeled simulated signalization**, never silently pass it off as surveyed NYC infrastructure.

**NYC-specific behavior:** right-on-red is **off by default** throughout the five boroughs unless a posted sign authorizes it; protected/permissive left-turn rules must be modeled from controller configuration. Yield for walkers and cyclists. Preserve one-way streets, loading zones, bus stops, double-parked delivery vehicles where permitted by the fictional simulation, and emergency response behaviors without making the city a chaotic obstacle course.

Reference: [New York State DMV traffic-control rules](https://dmv.ny.gov/new-york-state-drivers-manual-and-practice-tests/chapter-4-traffic-control), [NYC DOT traffic signals](https://www.nyc.gov/html/dot/html/infrastructure/signals.shtml).

---

## 7. REAL, SHARED TRAFFIC-SIGNAL CONTROLLER — NOT DECORATION

Make all three agree, every fixed simulation tick: **(1) visible lights, (2) vehicle right-of-way, (3) pedestrian permission**.

### Phase machine

Use explicit phases (and valid transitions) for:

- `VEHICLE_GREEN` (per permitted approach / group)
- `VEHICLE_YELLOW`
- `RED_CLEARANCE` when configured/required
- `CROSS_TRAFFIC_GREEN`
- `PED_WALK`
- `PED_FLASHING_DONT_WALK` with countdown when that signal type uses a timer
- `PED_SOLID_DONT_WALK`
- `LEADING_PEDESTRIAN_INTERVAL` where configured
- `ALL_PEDESTRIAN_PHASE` at intersections explicitly configured for an exclusive phase
- `OFFLINE/FLASHING/UNSIGNALIZED` with appropriately different traffic priority logic

Do not mechanically give pedestrians WALK whenever *any* light is green. Signal indications, permitted turns and protected crossing movements require explicit phase/conflict pairing. Timing must be per-controller configured, reproducible, and consistent with safety clearance. Consult **current MUTCD and NYC DOT signals guidance**; yellow/red clearance times come from appropriate controller parameters and crossing geometry, not arbitrary global constants. Favor correct plausible operation over accidental contradictory greens.

### Driving reactions

1. Car approaching red **slows, stops ahead of crosswalk**, waits, then proceeds at its green with safe headway.
2. On amber, a vehicle applies a safe stop-or-clear decision; no hard teleport or immediate 0 velocity.
3. Left turns yield to conflicting oncoming traffic unless protected; right turns yield to walkers and follow NYC no-right-on-red by default.
4. Do not enter an intersection if the exit is blocked (gridlock prevention).
5. Cars obey a lane graph, car-following/headway, realistic steering and turn radii. Adapt the ideas in [Fable TrafficSim](https://github.com/rawprogress/fable-cities/blob/main/src/modules/traffic/TrafficSim.js) (which documents IDM-like following, junction claims and crosswalk-aware pedestrians).
6. Pedestrians wait at curb, cross on safe WALK, finish an initiated crossing when clearance begins, do not enter on flashing DON'T WALK; turning cars yield to them. The player and gameplay interactions must not cause cars to drive through visible NPCs.
7. NPC emergencies/service special cases must be deterministic and separately tested.

### Signal art/rendering

- NYC-scale suspended or side-mounted traffic light heads with correct orientation and emissive bulbs; duplicate heads visible in appropriate directions, not simply rotated models copied at arbitrary offsets.
- Pedestrian WALK/hand and optional countdown displays using a stable, instanced glyph/texture budget; lights look luminous after dark and are legible in daylight.
- Actual signal object instances read the **single simulation state**. No separate `setInterval` UI animation; updates should derive from fixed simulation time.
- Device-friendly debug overlay: intersection ID, phase, remaining seconds, conflicts, route stop reason, active lane and actor intent. Hide developer tooling in production.
- Add scenario-based tests proving no conflicting protected movements receive green, no pedestrian WALK conflicts with active protected vehicle movement, and phase changes remain valid under pause/resume and time scaling.

References: [NYC DOT signal timing and pedestrian intervals](https://www.nyc.gov/html/dot/html/infrastructure/signals.shtml), [FHWA Traffic Signal Timing Manual](https://ops.fhwa.dot.gov/publications/fhwahop08024/chapter5.htm), [MUTCD 11th edition](https://mutcd.fhwa.dot.gov/pdfs/11th_Edition/mutcd11theditionhl.pdf).

---

## 8. MOVING VEHICLES: AN ENTIRE LIVING FLEET

### Initial classes

- Cars: sedan, hatchback, SUV, electric vehicle/taxi, older/modern NYC variants.
- Commercial: delivery van, box truck, light freight, sanitation truck.
- Municipal/service: police, firetruck, ambulance with policy-aware emergency modes.
- Transit: **MTA-like city bus behavior** using an original/license-cleared visual design; route/depot timetable claims must not be fabricated. Leave rail/transit track work to its separate creator-led scope.
- Parked cars: preserve and improve current parking layout; no collision/intersection conflicts.

### Behaviors

- Route through real directed roads; accelerate/brake/turn/wheel-rotate without clipping curbs; follow traffic lights and yield at crosswalks.
- Realistic road-speed categories, adaptive headway, soft following, legal turns, lane change only when modeled and safe, park/pull-away, queues, optional honking and indicator usage.
- Turn signals synchronized with actual intention; brake lights brighten under slowing; headlights and tail lights respond to dusk/fog/rain and any city clock time override.
- Buses approach a valid stop, brake, dwell, open-door animation if available, release and continue; later passenger boarding hooks belong in a well-specified phase.
- Spawn ahead of player and despawn far away, **never pop in/out visibly**; maintain deterministic world/route seed and a soft simulation retention zone so camera motion or fold/unfold does not re-randomize all cars.
- Separate behavioral classes (driving physics) from visual class variants (taxi vs sedan can share core kinematics).
- Player/NPC collisions: combine broad-phase spatial hash with cheap bounds; decide gameplay-safe responses rather than simulate arbitrary high-speed impacts in this city-life milestone.

### Realism versus speed

Use pooled actors and fixed time-step state, transform interpolation for smooth 60 Hz-looking motion where render timing allows, instanced/merged materials per LOD, batched lights, and traffic density by neighborhood/time of day. Avoid spawning hundreds of uniquely skinned or individually shadow-casting cars on low-end mobile devices. Profile before claiming any density is shippable.

---

## 9. PEDESTRIANS: PEOPLE WITH PURPOSE, NOT ORBITING DECORATIONS

Build a continuous sidewalk/crosswalk navigation experience with:

- Walk, wait, cross, idle, turn, talk in groups, enter/leave local building points (when valid), wait at a bus stop, and carry simple bags/phones/umbrellas as presentation variants.
- Time-of-day and neighborhood density controls; crowd variation in speed, outfit, body silhouette, skin/hair textures, posture and age appearance *without* stereotypes or demographic profiling.
- Crosswalk permission comes from the signal controller; path planners do not allow walking through vehicles or buildings. Handle curbs, ramps, obstructions and adjacent NPCs with simple local avoidance.
- A correct foreground character (rigged or high-quality procedural) around player distance, cheaper instanced/walk-shader people farther away, and silhouettes/billboards only when visually justified.
- Robust fallback when a model or animation is missing; foreground quality should not be ruined by a default primitive when the model is available.
- NPCs should respond in a harmless, game-appropriate way to player presence and action; preserve later quest/Mon interaction hooks without implementing encounters in this PR stack.
- Reduced-motion settings affect nonessential flourishes/UI, not the state integrity or safety of traffic/crosswalk behavior.

**One small functional slice first:** six pedestrians approach opposite sides of a real crosswalk. They wait, start moving on WALK, finish without collisions, and wait again at the next phase. Only scale crowd counts after this passes.

---

## 10. WORKING STREETLAMPS, CAR LIGHTS & A DAY–NIGHT CITY

**Distinguish traffic signals (road control) from streetlamps (illumination)**. NYC-MON already includes LED streetlamp models and local light-pool approximations; upgrade those.

- One authoritative game clock feeds sky appearance, sun/ambient lighting, building window lights, streetlamp on/off state, vehicle headlights, brake illumination, storefront/nightlife lighting and weather overlays.
- Streetlamps **actually turn on** at dusk with smooth but deterministic transitions (and off at dawn). Emissive bulbs are visible from afar; ground light pools and limited true light sources are nearby only, clustered/pool-managed for native performance. Don't create a shadow-casting point light at every streetlamp.
- Lamps illuminate wet asphalt and sidewalks with believable falloff; render gracefully with simplified emissive halos on lower tiers where per-pixel reflections are too expensive.
- Traffic signal lamps are separate; they are illuminated by **controller state**, not time of day. Their casing/emissive brightness adapts to ambient contrast but signal permissions never depend on daylight.
- Car headlights/taillights/brakes/turn indicators/parked-car reflectors adapt consistently to weather/time/actor intent; use emissive and cheap projected light textures/decals when per-vehicle dynamic lights are expensive.
- Real city detail: crosswalk zebra stripes, stop bars, directional arrows, lane paint wear, curb transitions, street signs, subway entrance fixtures, street trees, trash baskets, hydrants, illuminated shopfronts, bus shelters and selective puddles.
- Visual tiers (`low`, `medium`, `high`, `XR`), screenshot comparison at noon, sunset, rainy night and clear night. No black-frame regression if a shader/material capability is unavailable.

References: [Fable asset credits including Poly Haven streetlamps](https://github.com/rawprogress/fable-cities/blob/main/public/assets/CREDITS.md), [Poly Haven Street Lamp 01](https://polyhaven.com/a/street_lamp_01), [Poly Haven Street Lamp 02](https://polyhaven.com/a/street_lamp_02), [ambientCG asphalt textures](https://ambientcg.com/view?id=Asphalt010).

---

## 10A. REALISTIC BUILDINGS, FUTURISTIC NYC SKYLINE & HOLOGRAPHIC STREETS (ADDITIVE FOLLOW-ON)

**Do not sacrifice the working moving-city vertical slice for a giant visual rewrite.** Once the simulation is stable, plan a strictly additive city-detail pass on the *existing* real NYC street footprint and buildings:

- **Near camera / hero façades:** use the architectural methods from [ProceduralBuildingsThreeJS](https://github.com/achrefelouafi/ProceduralBuildingsThreeJS) to add correct NYC fire escapes, authentic shopfronts, windows/interiors, masonry joints, utility boxes, stoops, AC units, awnings, gates, rooftop tanks and meaningful silhouette changes. Make them modular/instanced and anchored to building IDs from the current OSM dataset. Avoid repeat-tiled fake windows at player distance.
- **Skyscrapers and distance silhouette:** investigate [official Three.js CityGenerator](https://threejs.org/docs/pages/CityGenerator.html) and [SkyscraperGenerator](https://threejs.org/docs/pages/SkyscraperGenerator.html), including their low-cost proxy geometry and TSL material patterns. Use their *tower generation / instance optimization* ideas, **never** their imaginary street grid in place of real NYC data. Put futuristic tower variations on curated, geographically coherent candidate buildings.
- **Complete official streetscape-generator comparison:** inspect [CarGenerator](https://github.com/mrdoob/three.js/blob/master/examples/jsm/generators/city/CarGenerator.js), [PersonGenerator](https://github.com/mrdoob/three.js/blob/master/examples/jsm/generators/city/PersonGenerator.js), [TrafficlightGenerator](https://github.com/mrdoob/three.js/blob/master/examples/jsm/generators/city/TrafficlightGenerator.js) and [StreetlightGenerator](https://github.com/mrdoob/three.js/blob/master/examples/jsm/generators/city/StreetlightGenerator.js). The city scene already creates its own streetlamp/parked-car objects; **do not duplicate them**. Extract or adapt material, silhouette, instancing and NYC visual-design ideas, then wire any chosen visible signal to the actual shared traffic controller (visual generator does not itself simulate red/green right-of-way).
- **Real-world map to actual game space:** evaluate [google-maps-fps](https://github.com/sumitaich1998/google-maps-fps) for collision/map conversion, world streaming/caching, player position, terrain and time/weather/biome boundaries, and [quality tiers](https://github.com/sumitaich1998/google-maps-fps/blob/main/src/engine/quality.js). Compare with existing NYC-MON save/coordinate, tile and collision systems. **Study, do not replace:** the user's playable NYC slice already exists in native WebGPU. Document which ideas add genuine value, which are redundant, and which are incompatible.
- **Night Street material research:** evaluate [night-street](https://github.com/StarKnightt/night-street) for procedural road asphalt, curb grime, glass, vehicle clearcoat, shadowing and golden-hour lighting. Port only shaders/material calculations compatible with current native WebGPU and budget.
- **Neighborhood identity:** Harlem stays Harlem; Brooklyn brownstones stay identifiable; Bronx streets and housing should not be indistinguishable copied blocks. Use local street typography, stoop treatment and building typology; do not copy trademarks, logos or game environments wholesale.
- **Public-housing improvements:** follow existing NYC-MON creator direction and the specific `docs/implementation/city-world.md` constraints: preserve footprint/massing and verified development identity, modernize exteriors via addressable reusable kits, and never assign a public-housing classification by visual guesswork alone.
- **Futuristic NYC layer:** original neon storefronts, selected LED canopies, street-level digital signs, a handful of elevated holograms, rooftop vegetation and subtle Blade Runner-like atmosphere **without copying protected imagery**. Put hologram/billboard inventory under existing Payload CMS architecture, with stable AdSurface world IDs and moderation; never require ad/CMS data to load the base game.
- **Performance:** focus on a single real hero block near the Apollo first; take same-camera day/night screenshots, inspect material response at street level and protect current world draw-call/triangle budgets. Detail tiers and distance impostors must work before broad rollout.

**Deliver a separate future PR design brief** for the upgraded facades/skyscraper/AdSurface layer, with artist references and acceptance screenshots, but keep this phase subordinate to finishing working cars, signals and pedestrians.

---

## 11. NATIVE RENDERER, PERFORMANCE & SPATIAL / FOLDABLE RULES

### Simulation/render separation

```text
OSM/NYC geodata + versioned sidecar
                 |
                 v
    LaneGraph + PedestrianGraph
                 |
       IntersectionController
          /              \
 VehicleSimulation    PedestrianSimulation      <-- fixed-time, deterministic
          \              /
           ActorSnapshotStore
                 |
    interpolated render snapshots
                 |
   AssetRegistry -> Three.js WebGPU instances / LOD
                 |
          Existing CityScene
                 |
  Expo phone / tablet / foldable / Quest spatial presentation
```

- **Simulation tick:** evaluate fixed 20–30 Hz stepping with an accumulator and interpolation, subject to proven movement quality and load; renderer can refresh independently, without multiple per-car React state updates.
- **Determinism:** seed plus input/clock = reproducible outputs; pause, resume, background/foreground, low-FPS recovery and time acceleration should not produce illegal light phases or NPC teleporting.
- **GPU:** use a few instanced materials/meshes for many cars and citizens. Profile skinning strategies; do not assume WebGPU skinning code from desktop Three.js works unmodified through react-native-webgpu.
- **Per-frame memory:** reuse typed arrays and matrices, avoid allocating per car/pedestrian on each tick, never rebuild the whole road graph when a moving actor changes.
- **LOD and streaming:** bound active physics radius, near/mid/far visual tiers, texture/material/mesh budgets, quality adaptation via existing runtime, preserve current static world geometry and culling.
- **Frame/quality targets:** measure baseline first. Aim for stable 30 FPS at a tested low tier and pursue 60 FPS at higher tiers where hardware allows; XR refresh targets are headset-specific and must be measured. Record median/p95 frame time, GPU/CPU time, draw calls, visible triangles, resident texture bytes, active actors and signal count. **Do not claim goals are achieved without device captures.**
- **Test devices:** iOS phone, Android phone, Surface Duo/book-style foldable where available, Android tablet and Quest 3/Horizon variant. Verify physical-device results where possible; label simulator-only evidence clearly.
- **Spatial/adaptive UI:** the world stays mounted when a foldable secondary Inspector opens, screen folds or rotates; preserve player/map coordinates, simulation time and lane queue states. Hinge exclusion and physical-right nav rail rules remain per current app skill and tests.
- **Texture/geometry sourcing:** do not load arbitrary 160 MB web demo scenes into the native bundle. Optimize chosen GLBs with measurable build-size and runtime budgets; production packaging is local/CDN-controlled and license-compliant.

---

## 12. MUST-USE SKILLS AND SENIOR SUBAGENT ROSTER

**Read actual `SKILL.md` files and repo-local agent instructions before implementing.** Use installed skills and subagents when the environment supports them. A repository link is **not** proof that a skill is installed: install/enable only through an approved workflow. If subagent orchestration isn't supported, perform separate explicit role-based reviews and record the reviewer perspective without falsely claiming independent agents were run.

### Skills / reference packs

- [Callstack Agent Skills](https://github.com/callstackincubator/agent-skills) — especially [React Native Best Practices](https://github.com/callstackincubator/agent-skills/blob/main/skills/react-native-best-practices/SKILL.md), FPS measurement and native profiling references.
- [Software Mansion Skills](https://github.com/software-mansion-labs/skills/tree/main/skills) — rendering-adjacent React Native motion, gesture and native integration patterns.
- [Official Expo Skills](https://github.com/expo/skills) — Expo SDK, EAS, native debugging and package/version constraints.
- [FloWritesCode fwc-swiftui-skills](https://github.com/FloWritesCode/fwc-swiftui-skills), especially `swiftui-iphone-duo` concepts for adaptive panes/foldables; **only transfer design/geometry principles**, not SwiftUI APIs into RN.
- [React Native Arrangement View](https://thiagobrez.github.io/react-native-arrangement-view/index.html) and [installation guide](https://thiagobrez.github.io/react-native-arrangement-view/guide/installation) — evaluate compatibility with existing foldable/split-view implementation, don't add a duplicate layout engine.
- Repo-local NYC-MON game, geodata, TypeGPU, React Native, accessibility, testing, device-lab, graphics and cleanup skills, plus applicable `petergyang/no-ai-slop`/repo hygiene guidance already in use.
- [three.js official WebGPU examples](https://threejs.org/examples/?q=webgpu) and verified installed Three.js API documentation. No assumption that latest examples match pinned runtime.

### Senior expert roles (assign review ownership)

1. **Principal Three.js/WebGPU Graphics Engineer** — existing scene integration, shaders/TSL/TypeGPU feasibility, batching, GPU frame diagnostics.
2. **Principal Game Simulation Engineer** — deterministic clock, car-following, intersection right-of-way, queue/gridlock safety.
3. **Transportation/NYC Map Data Engineer** — OSM lane graph, road rules, right-on-red configuration, provenance and coordinate integrity.
4. **Senior Crowd AI / Animation Engineer** — sidewalk network, crosswalk permissions, rigging/instanced movement.
5. **Senior Technical Artist / Vehicle Artist** — believable vehicle silhouettes, PBR, wheel rigs and swap-ready model import.
6. **AAA NYC Environment Art Director** — authentic block identity, illumination, rain/reflections, future skyline overlay quality.
7. **Senior React Native / Expo Engineer** — native module compatibility, render thread, platform-specific runtime.
8. **Android Foldable / Spatial Engineer** — Duo/Quest/Android XR adaptations, right rail, hinge-safe UI and scene lifecycle.
9. **Performance / Device Lab Engineer** — reproducible profiling, adaptive actor budgets, 30/60 FPS evidence.
10. **Security/License + Accessibility Reviewer** — source asset rights, geodata notices, download safety and user accessibility.
11. **Staff Documentation / Test Infrastructure Engineer** — diagrams, ADRs, scenario runner, deterministic simulation tests and maintainable onboarding.

### Subagent execution order

**Read-only parallel scouts first:** A = current NYC-MON world architecture and open PR conflicts; B = reference repo algorithms and licenses; C = vehicle/pedestrian original asset provenance; D = NYC geodata/traffic rules; E = native WebGPU/TypeGPU/animation feasibility; F = device/performance baseline. Consolidate into a single dependency graph with file owners and explicit conflicts. Then implement nonoverlapping PR branches. Finally run an independent integration-review and QA pass. No duplicate files or speculative checkmarks.

---

## 13. PROPOSED SMALL, REVIEWABLE PR STACK

Each PR requires scope, paths, dependency graph, acceptance evidence, tests, screenshots/video when applicable, licensing changes, device verification status and rollback plan. Use draft PRs while implementation is incomplete. Avoid overlapping branches changing the same core scene file at once.

| PR | Title / scope | What proves it's done |
|---|---|---|
| **01** | **Living City audit, interfaces, scenario harness** | Source of truth, current render/physics boundaries, asset/license ledger, reproducible initial Harlem scene recorded. |
| **02** | **Road & sidewalk topology sidecar** | At least three verified/geographically grounded intersections, directed lanes/crosswalk graph, stable geo IDs, saved locations preserved. |
| **03** | **Signal controller + intersection conflict solver** | Tests of phase timing, protected conflicts, NYC right-on-red rule, red queues and leading/exclusive pedestrian phase scenarios. |
| **04** | **WorldAssetRegistry + GLB import tooling** | Linked CC0 starter GLBs + procedural sources, license notices, pivot/unit/LOD validation, live sedan swap test. |
| **05** | **Moving vehicle simulation + render integration** | Cars follow real directed lane routes, brake/stop/turn at signals, react to crossing pedestrians, no popping/obvious clipping; metrics. |
| **06** | **Pedestrian sidewalk nav + crosswalk behaviors** | People walk to crosswalk, wait for WALK, cross, avoid obstacles, safely finish crossings; assets swappable. |
| **07** | **Signal heads, pedestrian displays and actual streetlamps** | Visual signals read same controller as AI; daylight/night/rain lamp toggles, responsive brake/headlight effects. |
| **08** | **NYC streetscape quality pass** | Street scene looks convincingly New York at 3 camera angles/dayparts; props and details not duplicating existing world systems. |
| **09** | **Mobile/Quest GPU performance and adaptive quality** | Baseline/after traces, actor/LOD tiers, 30/60 goal evidence where reached, fold/unfold and app background safety. |
| **10** | **Integration, canon/legal review and handoff docs** | All CI checks, scenario matrix, source/license index, world architecture, device notes, no unsafe/duplicated systems. |

**Sequencing:** PR01 → PR02/PR04 in parallel → PR03 → PR05/PR06 → PR07 → PR08/PR09 → PR10. Build the smallest real **one intersection + two cars + six pedestrians + one streetlight** vertical slice early in PR03–07 to validate the pipeline before scaling. Keep every PR independently buildable, rebasing frequently without overwriting teammate code.

---

## 14. DEMONSTRATION SCENARIOS — MUST RUN

### Scenario A — 125th Street, daylight

- Camera/player in the Harlem/Apollo sample tile; real roads and storefronts stay where the current dataset places them.
- At least two cars head down legal lanes; stop at a red light before the crosswalk, another crosses on green. Turning car follows NYC right-of-way rules.
- Pedestrians gather, observe pedestrian signal, use a legal crosswalk and clear before conflicting movements resume.
- Vehicle direction arrows, signal phase and NPC intent readable in dev inspector. Game player persists through camera moves.

### Scenario B — Sunset / night

- Game clock moves from daytime to twilight/night, sky/windows/streetlamps/headlights change consistently.
- Each traffic signal **continues obeying its phase logic**, independent of dusk. Brake lights light up when vehicles slow/stop; ground pools illuminate roads without hundreds of shadow-casting lights.
- Motion remains smooth relative to measured device tier; no GPU blank frame or disappearing road materials.

### Scenario C — Rain and heavy traffic

- Reduced speed, sensible headway, rain/wet materials and reduced draw distance as required by tier.
- Vehicles queue without illegally entering a blocked intersection. Pedestrians and cars avoid collisions and remain visible from player perspective. Optional emergency vehicle route does not produce conflict errors.

### Scenario D — Foldable / interruption / device lifecycle

- Stand at a crosswalk, open the hinge-safe secondary panel, rotate/fold, app background/foreground, return to game.
- Same street coordinates, same seed/controller state, same vehicle/pedestrian world continuity. No duplicate loops, animation timers or scene remount resetting traffic to green.

### Scenario E — Swap assets without refactoring AI

- Switch a sedan from procedural renderer to local `sedan.glb` starter, then to a second approved model; swap a procedural pedestrian for a rigged test character.
- Traffic pathfinding, physics bounds, signal behavior, animation fallback and saved state stay correct; license/attribution automatically captured by manifest reporting.

---

## 15. TESTS, QUALITY GATES AND HONEST REPORTING

**Automated tests:** road graph topology and no illegal edges; inferred vs verified geodata labels; coordinate save/migrations; intersection phase transitions; no conflicting protected greens; NYC right-on-red default; deterministic sim snapshots and clock pause/resume; car-following/stop distances; yielding at crosswalk; pedestrian paths/displays; density controls; asset fallback/validation/license; renderer object disposal; budget tests; device/quality flags.

**Visual/device QA:** scripted screenshots and videos of the five scenarios; sunrise/day/dusk/night/rain, close-up cars, crosswalks, streetlights, first visible frame, physical phone/Android/Duo/Quest where available. Include authoring shots from same coordinates/time to evaluate regressions. Keep existing `world/budget.test.ts` valid and define a separate **dynamic actor** budget rather than hiding added triangle cost.

**Deliverables:** typed implementation, unit/integration/scenario tests, measurements, visual captures, license/asset inventory, updated [`docs/REPO_MAP.md`](https://github.com/mikevocalz/nyc-mon/blob/main/docs/REPO_MAP.md), `docs/architecture/LIVING_CITY.md` with text sequence diagrams, dependency map, PR list and status. Provide explicit device build/QA commands after checking real repo scripts. Set unverified hardware results to **PENDING**, not PASS.

**Final completion report:**

1. What works now, with PR links, exact file references and measured proof.
2. What was reused from existing NYC-MON versus adapted from third-party repos.
3. Full list of temporary vehicle GLBs and procedural pedestrian sources with verified license links and SHA/dates.
4. Which signal behaviors and pedestrian crossings are working, with recorded test cases.
5. Performance by actual device/build, supported quality tier and unsolved bottlenecks.
6. Which models, environment details, trains and future skyline systems remain intentionally deferred.
7. How a new engineer can replace every car and pedestrian asset without touching navigation/signal logic.

**Success means playable, inspectable, measurable street life in the actual NYC-MON Harlem city — not a speculative plan, not a new disconnected city project and not just traffic lights changing colors. Begin with the repository audit and first vertical slice; proceed to the scoped PRs. Never merge unreviewed code into main.**

---

## 16. SOURCE / LICENSING QUICK REFERENCE

These are links for auditing and implementation, not permission to indiscriminately transplant unrelated code/assets:

- NYC-MON: https://github.com/mikevocalz/nyc-mon
- Existing Harlem world specification: https://github.com/mikevocalz/nyc-mon/blob/main/docs/implementation/city-world.md
- Fable Cities: https://github.com/rawprogress/fable-cities
- Fable Cities source license: https://github.com/rawprogress/fable-cities/blob/main/LICENSE
- Fable Cities asset credits: https://github.com/rawprogress/fable-cities/blob/main/public/assets/CREDITS.md
- Kenney car kit: https://kenney.nl/assets/car-kit
- Fable traffic source: https://github.com/rawprogress/fable-cities/tree/main/src/modules/traffic
- Fable vehicle GLBs: https://github.com/rawprogress/fable-cities/tree/main/public/assets/simulation/models
- Fable pedestrian generator: https://github.com/rawprogress/fable-cities/blob/main/src/modules/traffic/PedestrianModel.js
- night-street detailed procedural cars: https://github.com/StarKnightt/night-street/blob/master/src/world/cars.ts
- metro-live city reference: https://github.com/vietgangzz/vg-demos-all/tree/master/src/demos/metro-live
- Procedural NYC buildings: https://github.com/achrefelouafi/ProceduralBuildingsThreeJS
- Official Three.js CityGenerator: https://threejs.org/docs/pages/CityGenerator.html
- Official Three.js SkyscraperGenerator: https://threejs.org/docs/pages/SkyscraperGenerator.html
- Official CityGenerator source: https://github.com/mrdoob/three.js/blob/master/examples/jsm/generators/CityGenerator.js
- Official SkyscraperGenerator source: https://github.com/mrdoob/three.js/blob/master/examples/jsm/generators/city/SkyscraperGenerator.js
- Official car generator (sedan/SUV/taxi): https://github.com/mrdoob/three.js/blob/master/examples/jsm/generators/city/CarGenerator.js
- Official procedural pedestrian generator: https://github.com/mrdoob/three.js/blob/master/examples/jsm/generators/city/PersonGenerator.js
- Official traffic-signal physical model: https://github.com/mrdoob/three.js/blob/master/examples/jsm/generators/city/TrafficlightGenerator.js
- Official NYC cobra-head streetlamp generator: https://github.com/mrdoob/three.js/blob/master/examples/jsm/generators/city/StreetlightGenerator.js
- Real-location playable Three.js city game: https://github.com/sumitaich1998/google-maps-fps
- Real-location city/game pipeline: https://github.com/sumitaich1998/google-maps-fps/blob/main/docs/CUSTOM_MAP.md
- google-maps-fps source-only license: https://github.com/sumitaich1998/google-maps-fps/blob/main/LICENSE
- google-maps-fps third-party asset/data credits: https://github.com/sumitaich1998/google-maps-fps/blob/main/CREDITS.md
- Quaternius characters: https://quaternius.com/packs/universalbasecharacters.html
- Quaternius animation library: https://quaternius.itch.io/universal-animation-library
- Kenney rigged characters: https://kenney.nl/assets/animated-characters-protagonists
- Three.js GPU crowd example: https://threejs.org/examples/webgpu_skinning_instancing_individual.html
- NY DMV city traffic control: https://dmv.ny.gov/new-york-state-drivers-manual-and-practice-tests/chapter-4-traffic-control
- NYC DOT signals / pedestrian priority: https://www.nyc.gov/html/dot/html/infrastructure/signals.shtml
- FHWA Signal Timing Manual: https://ops.fhwa.dot.gov/publications/fhwahop08024/chapter5.htm
- Callstack agent skills: https://github.com/callstackincubator/agent-skills
- Software Mansion skills: https://github.com/software-mansion-labs/skills/tree/main/skills
- Expo agent skills: https://github.com/expo/skills
- Foldable layout skill: https://github.com/FloWritesCode/fwc-swiftui-skills
- Arrangement View docs: https://thiagobrez.github.io/react-native-arrangement-view/index.html

**Note:** All third-party assets must be re-audited at the actual revision incorporated. A GitHub model file existing is not evidence that the source demo currently renders it, and a scene created in WebGL is not evidence its shaders are compatible with native WebGPU.
