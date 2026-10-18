# Scout B — Reference-repo decision log

Scout report for Living City PR01 (spec §2). Format per spec: **REUSE
CONCEPT / ADAPT ALGORITHM / USE ORIGINAL ASSET / KEEP / REJECT** + why.
Repos were shallow-cloned into `/tmp/lc-refs/` on 2026-10-17; commits cited
per repo. three.js was **not** cloned — read from the installed
`packages/app/node_modules/three@0.186.1` tree, which is the version that
matters.

## 1. fable-cities (P0) — github.com/rawprogress/fable-cities

Cloned at `aea8b1035030` (2026-09-03). **License: MIT** (`LICENSE`, "raw").
Assets separately credited in `public/assets/CREDITS.md` (all CC0 — see
scout-C). The traffic module is plain JS, pure where it counts, with no
framework dependency except `three` in the renderer/materials files — the
sim core is portable.

| File | Decision | Why |
|---|---|---|
| `src/modules/traffic/LaneNetwork.js` (439 ln) | **ADAPT ALGORITHM** | The cleanest piece of reference code for this project. `makePoly` builds arc-length-parametrised lane polylines with per-point curvature speed limits (`sqrt(LAT_ACC/κ)`) backward-smoothed so cars brake *before* a bend (L15-41). `bezierConnector` generates junction turn splines; turn classification straight/right/left/U from tangent dot/cross (L169). `_buildJunctions` groups approaches, pairs opposite approaches into phases, marks `signalized` by rank+approach count, desyncs phase timers with an FNV hash of the node id (deterministic grid). `Uint8Array` connector **conflict matrix** from real polyline crossings (L261-279). A* with binary heap + epoch-stamped visited arrays — zero per-route allocation (L366-400). `_buildPedestrians` builds the same structure for sidewalk lanes; connectors >5.5 m gap get `crossing: true`. All typed arrays, no three.js. Ports almost line-for-line into our pure-TS house style. |
| `src/modules/traffic/TrafficSim.js` (558 ln) | **ADAPT ALGORITHM** | IDM car-following (`A_MAX 2.85, B_COMF 3.30, S0 2.05, T_HEAD 1.05, DEC_MAX -7.6`, L18-31). Junction arbitration: claims map per node, sorted by ticket + turn priority + road rank; a connector may proceed only if no *already-taken* connector conflicts (`_resolveClaims`, L298-324); **blocked-exit check refuses entry when the exit lane is full** — the anti-gridlock rule spec §7.4 requires (L286-295). Amber dilemma: `stopNeed = v²/2·4.2 + 1` — a car too close to stop runs the amber rather than brake-check (L271-278). Stale-claim timeout (7 s) so a left-turner can't deadlock an approach. Sorted-per-element buckets give O(1) leader lookup + route lookahead (L326-345). Brake/blink state derived for the renderer (L382-384, L420-428). Pedestrian kerb-wait + `_crossingClear` (waits until no vehicle within 26 m of the crossing's in-lanes is moving, and no junction claim is inside — L496-513). Spawn weighted by road rank, despawn >170 m, ≤16 A* expansions per tick — all the density/perf knobs spec §8 wants. |
| `src/modules/traffic/Renderer.js` (536 ln) | **REUSE CONCEPT** | Architecture worth copying: per vehicle type × 2 LOD `InstancedMesh`es + one instanced wheel mesh; per-instance attributes `aPaint/aPaint2/aState(lightsOn,brake,blink)`; headlight ground pools, lamp glare billboards and contact-shadow decals as three more instanced quad meshes; distance thinning by stable per-vehicle id bits (`id & 1` past 245 m, `id & 3` past 400 m — never frame counters, so no flicker); ~18 draw calls for the whole fleet. **Not portable as code**: `THREE.ShaderMaterial` GLSL and shadow-map assumptions; on rn-webgpu there are no shadow maps (contact-shadow decals and our existing lean-shadow trick still apply). The instance-attribute contract (`aState`) maps cleanly onto a TSL port. |
| `src/modules/traffic/materials.js` (386 ln) | **REJECT as code / ADAPT CONCEPT** | GLSL `ShaderMaterial` — three's WebGPURenderer cannot compile it; would have to be re-authored in TSL (NodeMaterial). Concepts worth keeping: `flat`-interpolated surface-class attribute so a quad spanning pillar+windscreen never blends materials (WGSL supports `@interpolate(flat)`; our generators already use `partId` flat varyings); lamp radiance authored in display units divided by tone-mapping exposure; per-instance paint via indexed colour table. |
| `src/modules/traffic/VehicleModels.js` (818 ln) | **ADAPT ALGORITHM** (selective) | Lofted rounded-rectangle section sweeps with per-vertex surface classes; real measured dims per type. `VEHICLE_SPECS` (len/wid/wheelR/wheelW/sill/belt/roof/weight/vmax) is directly reusable as the simulation's collision+asset contract even if we render GLBs. Geometry quality is high but ~800 lines of bespoke math — spec §3 says decide GLB-vs-procedural by measured quality/perf; keep this as the procedural fallback candidate. |
| `src/modules/traffic/PedestrianModel.js` (151 ln) | **ADAPT ALGORITHM** | One humanoid geometry, entire walk cycle in the vertex shader via `aLimb` (0 body,1-2 arms,3-4 legs,5 bag,6 cap) + `aWalk` (phase,speed,seed) instance attrs — accessories collapse to a point per instance so one draw yields several silhouettes. 2 LODs (8/5 sides). Height/build variation via seed. The shader must be re-authored in TSL; the attribute scheme is the design to copy. |
| `src/modules/traffic/Geometry.js` (230 ln) | **KEEP ours** | `MeshBuilder` role is already filled by repo `world/geometry.ts` `VertexBuffer` + `parts.ts`. No need to port. |
| `src/modules/traffic/index.js` (190 ln) | **REUSE CONCEPT** | Module wiring: quality-scaled caps (`maxVehicles ≈ 900·density`, `maxPeds ≈ 760`), draw distance, fixed accumulator stepping the sim, congestion metric published per segment. Our equivalents belong in `perf/tier.ts` + the actor's fixed-tick driver. |
| `src/modules/roads/RoadNetwork.js` `laneGraph()` (L768-826) | **ADAPT ALGORITHM** | How lane centrelines and connections get built from segments+nodes: lane offsets per direction, node connection classification `S/L/R/U` by relative heading, rank-matched lane-to-lane connections (left lane can reach left turns; right lane reach right turns; U-turns from leftmost only — L793-815), pedestrian any-to-any. Our v2/v3 data must produce an equivalent `{lanes, connections, pedestrian}` product — this is the shape `LaneNetwork` consumes. |
| `src/modules/simulation/vehicles.js` | **ADAPT ALGORITHM** (later) | Procedural service-fleet variants; deferred until bus/service classes land (spec §8). |
| `public/assets/simulation/models/*.glb` | **USE ORIGINAL ASSET** (candidate) | Kenney Car Kit 3.1, CC0 — see scout-C. Fable itself renders traffic procedurally; the GLBs are an available starter set for our registry, not a requirement. |

**Native-WebGPU compatibility risk:** sim/network code — none (pure JS).
Renderer/materials — **high**: GLSL ShaderMaterials, shadow maps, tone-map
exposure hooks are all WebGL-path. Port the structure, re-author the
materials in TSL.

## 2. night-street (P1) — github.com/StarKnightt/night-street

Cloned at `333f064` (2026-08-13). **License: MIT** (`LICENSE`, Prasenjit).

| File | Decision | Why |
|---|---|---|
| `src/world/cars.ts` (1969 ln) | **ADAPT ALGORITHM** (near-LOD only) | The best procedural-car reference anywhere: lofted hulls through measured stations with real dims (supermini 3.95×1.70×1.47 wb 2.45 … panel van 5.00×1.90×2.10 wb 3.10, L10-17), smooth per-vertex normals (required for clearcoat; faceted normals are "the single most reliable tell"), part-code classification (`CAR.{PAINT,TRIM,ARCH,UNDER,LAMP_R,LAMP_F,CABIN,PLATE,GRILLE,CAP_R,CAP_F,SCUTTLE,MIRROR}`) decided per-pixel from interpolated coordinates, arch cavity shadow, 60-75 mm tyre/arch crescent. **WebGLRenderer + GLSL + desktop post stack** — geometry math is portable TS, shaders must be re-authored in TSL, and triangle cost is desktop-class. Use for hero/near parked cars or as quality bar for the procedural fallback; **do not** replace our instanced `city:cars` pipeline, which already does 220 near cars in one draw. |
| `src/scene/{bloom,volumetric,clouds,pipeline}.ts` | **REJECT** | WebGL post-processing chain; rn-webgpu has no output pass and L5 already owns the flagged post lane. Nothing to take. |

## 3. three.js 0.186.1 city generators (P0/P1) — INSTALLED package

`packages/app/node_modules/three/examples/jsm/generators/` — **License: MIT**
(three.js authors). All of these are **TSL-native** (`MeshStandardNodeMaterial`
+ `three/tsl` imports) and already inside our dependency — the only
references with zero port risk. Internal deps (`LoftGeometry`,
`BufferGeometryUtils`, `InstancedMeshGenerator`, `CityGeneratorUtils`) are
all shipped.

| File | Decision | Why |
|---|---|---|
| `generators/city/CarGenerator.js` (479 ln) | **USE ORIGINAL ASSET (procedural) / candidate fallback** | Lofted sedan + SUV bodies + taxi (roof-signed sedan, `taxiColor 0xf5c518`), per-instance paint, `partId` material zones, instanced via `InstancedMeshGenerator`. Deterministic mix. Canonical: wheels on y=0, +Z forward — matches a registry contract. Compare against Kenney GLBs + our box car in camera tests (spec §3). |
| `generators/city/PersonGenerator.js` | **USE ORIGINAL ASSET (procedural) / starter crowd** | Instanced low-poly people, standing/walking poses, seeded outfit/complexion variation, 2 instanced draws. Not rigged, no independent animation — fine for the mid/far crowd tier behind the swappable actor interface (spec §4 upgrade order). |
| `generators/city/TrafficlightGenerator.js` (106 ln) | **ADAPT ALGORITHM** | NYC mast-arm pole (h 6.5, reach 5.5) + 3-lens head + ped box — correct NYC street furniture proportions, merged into one instanced geometry with `partId` zones METAL/RED/AMBER/GREEN. Its material hardcodes a lit green — **decorative only**. Adapt: keep the geometry + flat `partId`, drive per-lens emissive from an instance attribute fed by our controller state. |
| `generators/city/StreetlightGenerator.js` (100 ln) | **REUSE CONCEPT** | Cobra-head lamp geometry reference. Our LED lamp head + pole system already exists (`street-furniture.ts`); compare silhouettes, don't duplicate. |
| `generators/city/{Bench,Hydrant,Trashcan,Sidewalk,StreetTree}Generator.js` | **REUSE CONCEPT** | Same instancing/`partId` pattern for props we already have (hydrants/baskets) or §10A follow-ons. |
| `generators/CityGenerator.js`, `city/SkyscraperGenerator.js` | **REJECT for streets / REUSE CONCEPT for §10A** | The synthetic grid must never supply topology (spec §10A). Tower instancing + TSL material patterns are the skyline-overlay reference for a later PR. |
| `generators/city/InstancedMeshGenerator.js` + `CityGeneratorUtils.js` (`part()`) | **ADAPT ALGORITHM** | Clean per-instance attribute + flat `partId` material-zone pattern; our `TONE_ATTRIBUTE`/PAINT-marker cars material is the same idea — converge conventions where cheap. |

## 4. vg-demos-all metro-live (P0, already-adapted) — github.com/vietgangzz/vg-demos-all

Cloned at `dd108d5` (2026-10-06). **License: MIT** (Expo template license —
the only LICENSE in the repo; already recorded in
`docs/implementation/city-world.md:219-247`).

| File | Decision | Why |
|---|---|---|
| `src/demos/metro-live/world/people.ts` (87 ln) | **REUSE CONCEPT (already done) / not a crowd** | One 2-box InstancedMesh per platform spot, boarding scale-pop driven by train dwell state. Confirms the instanced-actor pattern on this exact stack, but it is a placeholder people system — spec §4 says so too. Nothing new to port; NYC-MON already took its OSM/materials value. |
| The rest of metro-live | **KEEP (already ported)** | Fetch/build, merge-by-material, leaf crowns, contact shadows — already in `tooling/city` + `world/`. Do not port again (spec §2). |

## 5. ProceduralBuildingsThreeJS (P1) — github.com/achrefelouafi/ProceduralBuildingsThreeJS

Cloned at `6c19f1b` (2026-09-28). **License: MIT.**

| File | Decision | Why |
|---|---|---|
| `src/nyc/{gn,building,kit,shadergraph,render,geo,flatten}.ts` | **REUSE CONCEPT (§10A only)** | Buildings are evaluated live from *dumped Blender geometry-nodes graphs* (`gn.ts` evaluator, 1838 ln) with every modifier input a parameter, materials compiled from dumped shader graphs. Clever, heavyweight, WebGLRenderer-based — a facade-quality north star for the follow-on PR, not for the traffic slice. Blender `.blend` assets' own licensing would need review before any data import. |
| `src/{wet,rain,snow*}.ts` | **REUSE CONCEPT (later)** | Wet-look parameter references for the rainy-night scenario. |

## 6. google-maps-fps (P2) — github.com/sumitaich1998/google-maps-fps

Cloned at `46845df` (2026-06-12). **License: MIT for source code ONLY** —
`LICENSE` explicitly excludes third-party assets and runtime map data;
`CREDITS.md` carries OSM attribution obligations.

| File | Decision | Why |
|---|---|---|
| `src/engine/quality.js` (572 ln) | **REUSE CONCEPT** | Quality-tier structure (device capability → tier → budgets) as a reference for our `perf/tier.ts` extensions. Vite/web game — no code port. |
| `src/engine/fpsController.js`, `docs/CUSTOM_MAP.md` | **REUSE CONCEPT** | World-to-playable-level workflow reference (OSM→game-space, terrain, weather). Our chase-camera + walkability already covers the playable slice; study the collision/map-conversion notes only. |
| Bundled assets | **REJECT** | License excludes them; nothing to take. |

## 7. Not cloned (spec P2, decision from spec + repo fit)

| Repo | Decision | Why |
|---|---|---|
| jstrait/city-tour | **REJECT** | Procedural block grid; must not replace real topology. |
| NASA-AMMOS/3DTilesRendererJS | **REJECT (now)** | Photogrammetry streaming + separate data licenses; orthogonal to this stack. |
| anchitjaincfa/manhattan-3d | **REJECT (now)** | Provenance/coverage unverified; OSM/Valdrada already covers the tile. |

## 8. Composite recommendation for PR02–05

1. **LaneGraph + IntersectionGraph**: port `LaneNetwork.js` structure
   (poly/vmax, connectors, approaches, phases, conflict matrix, A*) into
   `living-city/graph/` as pure TS; feed it a `laneGraph()` adapter that
   expands dataset roads → directed lanes (v2: inferred from class/width,
   labeled; v3: `l/ow/sp/sid` fields).
2. **VehicleSim**: port `TrafficSim.js` (IDM, claims, conflict resolution,
   blocked-exit, amber dilemma, ped kerb-wait) into `living-city/simulation/`
   on a fixed 20–30 Hz tick; add NYC rules (no-RTOR default, ped phase
   bindings) as controller configuration, not driver hacks.
3. **Renderer**: new TSL instanced renderers in `living-city/render/` —
   per-type InstancedMesh × LOD, `aState` instance attrs for
   brake/blink/lights, instanced contact decals + headlight pools — the
   fable Renderer.js architecture re-authored for rn-webgpu (no shadow
   maps, no post pass).
4. **Visuals**: starter = three.js `CarGenerator`/`PersonGenerator`
   (installed, MIT, TSL) or Kenney GLBs (CC0) behind the registry —
   measured A/B, not assumption; upgrade path = night-street loft quality
   for hero cars, Quaternius rigs for foreground peds.
