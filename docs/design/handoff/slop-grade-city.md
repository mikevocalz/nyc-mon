# Slop-grade city: handoff

Lane A1, 2026-10-27, for `docs/plans/slop-grade-city-prompt.md` §6.1 #5. Skill: `design:design-handoff`, loaded through the Skill tool; its sections (tokens, states, edge cases, accessibility) are folded into the tables below because this is a renderer handoff, not a screen. Decision: D19. Renderer mode: ADR 0023. Gates: D19's G1–G10 table.

Every Slop parameter below was read from `~/src/slop-newyork` at `be65d0a` and cites file and function or line. Every nyc-mon file in the "nyc-mon file" column is a **target** that the code lanes are writing on `feat/slop-grade-city` while this doc is written; none is claimed to exist or to work. Values are start values (spec §5.7): lane F1 replaces each with a measured one or defends it with a measurement. Colours are named by source here and live as tokens in `packages/theme/tokens.ts` (DESIGN_SYSTEM § Physically lit city); no hex appears in this file.

Tiers: `phone` = iPhone 17, `high` = iPad Pro, `low` = Surface Duo, which keeps today's look (G4 default). "all" means `phone` and `high`.

## 1. Technique table

### Output, rig and post

| Slop technique | Slop file, function | nyc-mon file (target) | Tier | Parameters (Slop value) |
|---|---|---|---|---|
| Renderer options | `js/main.js`, renderer setup (L42–51) | `render-runtime/game-render.ts` (renderer construction ~L288), `world/physical-look.ts` | all | `antialias: true`, `reversedDepthBuffer: true`, `setPixelRatio(1.0)`, `shadowMap.enabled = true`. nyc-mon keeps `render-scale.ts` in place of the fixed pixel ratio |
| Clustered lighting | `js/main.js` L51 | `world/physical-rig.ts` | phone 128, high 256 max lights | `ClusteredLighting(256, 32, 28, 48)`: max lights, tile size, z slices, max lights per cluster. Installed r186 default is `(1024, 32, 24, 64)` |
| Storage instance matrices | `js/main.js` L171–180 | `world/physical-look.ts` | all, WebGPU backend only | Swap every `InstancedMesh.instanceMatrix` to `StorageInstancedBufferAttribute(array, 16)` when `renderer.backend.isWebGPUBackend`. Slop's comment: about 2.5 MB/frame of uniform re-upload otherwise |
| MRT scene pass | `js/main.js` L184–203 | `post/pipeline.ts` | all | Attachments `output`, `normal` (`normalView`), `metalRough` = `vec2(roughness < 0.75 ? metalness × ssrFade : 0, roughness)`; `ssrFade = smoothstep(360, 180, −positionView.z)`; `storeMultisampledColorBuffer = false`; `normal` and `metalRough` blend mode `MaterialBlending` |
| SSR | `js/main.js` L205–222 | `post/pipeline.ts` | phone off first, then a 0.5-res trial; high on | `resolutionScale` 0.5, `blurQuality` 1, `maxDistance` 42, `thickness` 0.85, `quality` 0.25, `binaryRefine` true, `intensity` 0.5, `screenEdgeFadeBlack` true; mask `metalRough.r > 0 ? smoothstep(0.75, 0.55, metalRough.g) : 0` |
| Exposure, white balance, grade | `js/post-processing.js` `createPostProcessing`, `LOOKS` | `post/pipeline.ts`, `world/physical-presets.ts` | all | Per preset (exposure, contrast, saturation, balance RGB, bloom strength, threshold): golden 1.04, 1.12, 1.08, (1.045, 1.00, 0.955), 0.24, 1.20; midday 1.00, 1.10, 1.06, (1.015, 1.00, 0.985), 0.18, 1.35; twilight 1.06, 1.10, 1.08, (1.025, 0.995, 1.015), 0.28, 1.05; midnight 1.04, 1.08, 1.06, (0.985, 1.00, 1.035), 0.30, 1.00. Split-tone shadows `smoothstep(0.02, 0.60, luma)`, highlights `smoothstep(0.60, 3.0, luma)`; contrast pivot 0.18; vibrance 0.10; vignette `smoothstep(0.35, 1.0, r) × 0.12` |
| Bloom | `js/post-processing.js` L44–50 | `post/pipeline.ts` | all, 0.5 res | Input peak-limited to 8.0 (RGB scaled together); `bloom(input, 0.24, 0.40, 1.20)`, `smoothWidth` 0.30, `setResolutionScale(0.5)`; strength and threshold from the preset |
| Tone mapping | `js/post-processing.js` L33–36 | `post/pipeline.ts` | all | `ACESFilmicToneMapping`, `toneMappingExposure` 1.0; the `RenderPipeline` applies ACES and the output conversion once |
| Sky | `js/lighting.js` `LightingSystem` constructor L151–185 | `world/physical-rig.ts` | all (G3 default) | `SkyMesh` scale 200 000 (Slop's, for Manhattan; the tile needs only to contain the camera's 3 000 m maximum distance: `TODO(tune)`), cloud scale 0.00018, cloud speed 0.000015, cloud elevation 0.52; sky exposure per preset; night mix toward `physicalCityLight.nightSky`; reversed-depth vertex fix writes z = 0. Cloud drift stops under Reduce Motion |
| Environment | `js/lighting.js` `bakeEnvironmentMap` | `world/physical-rig.ts` | all | PMREM from the sky with `showSunDisc` 0, `fromScene(envScene, 0, 0.1, 100, { renderTarget })`, one render target reused on preset change; `scene.environmentIntensity` per preset |
| Aerial fog | `js/lighting.js` `createAerialFogNode` | `world/physical-rig.ts` | all | Samples PMREM toward the horizon (`max(dir.y, 0.015)`, roughness 0.3); exponential haze height `H` 900 m; density per preset |
| Background | `js/lighting.js` L143–146 | `world/physical-rig.ts` | all | `scene.background = null` |
| Sun | `js/lighting.js` L192–205, `update` | `world/physical-rig.ts` | phone 2048 px tiles; high 3072 px if `maxTextureDimension2D ≥ 6144` | `SunLight`, 2 cascades in one atlas; near 0.5; far `max(300, min(720, 260 + altitude × 1.6))`; `normalBias` 0.05; registered by `SunLight.registerNode(SunLightNode)` or `renderer.library.addLight` |
| Hemisphere fill | `js/lighting.js` L207–211 | `world/physical-rig.ts` | all | Position (0, 300, 0); colours and intensity per preset |
| Presets | `js/lighting.js` `TIME_PRESETS` | `world/physical-presets.ts`, colours in `physicalCityLight` | all | See § 2 |

### Materials

| Slop technique | Slop file, function | nyc-mon file (target) | Tier | Parameters (Slop value) |
|---|---|---|---|---|
| Shared city uniforms | `js/tsl-materials.js` `cityUniforms` | `world/physical/` (uniform module) | all | `uSunColor`, `uSkyTopColor`, `uSkyHorizonColor`, `uSkySunDir`, `uInteriorGlow` (0.78 initial), `uRoadWetness` (0.38 initial), `uCanyonBounce` (0.52 initial); set by each preset |
| Facade cell | `js/tsl-materials.js` `facadeCell`, `WALL_KINDS` | `world/physical/` facade module; vertex attributes per ADR 0024 | all | Wall kinds shop 0, entry 1, rear 2, lotLine 3, blankStone 4; box-local walls fit whole bays with `cornerPier` |
| Facade boxes | `js/tsl-materials.js` `createFacadeBoxes` | `world/city-mesh.ts` writer + ADR 0024 | all | Slop uses per-instance `box` (w, h, d, seed + tone) and `faces` (4 wall kinds) on instanced unit boxes; nyc-mon writes merged walls, so the same inputs become vertex attributes. Layout, memory and draw-call effect are ADR 0024's |
| Pre-war masonry | `js/tsl-materials.js` `createPreWarBuildingMaterial` | `world/physical/` facade module | all | metalness 0.06, roughness 0.76; window width 2.7 m, floor height 3.8 m, window ratio 0.50 × 0.58, lit probability 0.36, warmth 0.82, corner pier 1.2 m; running bond and domed-brick relief through `bumpNormal`. nyc-mon takes window width from `ww` and floor height from `fh` where recorded |
| Curtain wall | `js/tsl-materials.js` `createCurtainWallMaterial` | `world/physical/` facade module | all | window width 2.8 m, floor height 3.8 m, mullion 0.075 m, spandrel ratio 0.20, lit probability 0.36, warmth 0.62, reflectivity 0.92; mullion relief through `bumpNormal` |
| Interior mapping | `js/tsl-materials.js` `evaluateApartmentInterior` | `world/physical/` interior module (replaces the `glass.ts` interior while the flag is on) | all, full | Rooms 2 or 3 bays wide with a per-floor phase; room height 0.92 × floor; depth 1.55 × room height; setback 0.12 m; left and right drapes up to 48 % of the window each, six-swatch fabric, drape emission 0.20; LOD fade `smoothstep(0.3, 0.8, fw)`, mean drape coverage 0.29 |
| Canyon AO | `js/tsl-materials.js` `canyonSkyAONode` | `world/physical/` facade module | all | Height openness `smoothstep(0, 68, y)`; street crevice `smoothstep(0, 7.5, y) × 0.22 + 0.78`; AO floor 0.44. Slop's open-sky term reads `CENTRAL_PARK_BOUNDS`; this tile has no Central Park. Lane E2 drives that term from the tile's own area polygons (park, garden, grass, pitch, playground, plaza, parking, water) in `world/physical/canyon-ao.ts`; the height term is kept as Slop wrote it |
| Road puddles and wetness | `js/tsl-materials.js` `roadPuddleField`, `roadWetMasks` | `world/physical/` road module | all | Noise octaves at 0.095/0.075, 0.25/0.22, 0.68 with weights 0.52, 0.34, 0.14; Slop's `spawnPool` term sits at Manhattan coordinates (1.6, 122.8) and is **dropped**. Water line `mix(0.86, 0.56, clamp((w − 0.1)/0.55))`; wetness from the preset |
| Road surface | `js/tsl-materials.js` `createRoadSurfaceMaterial` | `world/physical/` road module | all | metalness 0.24, roughness 0.48; aggregate bump, manholes; puddle Fresnel on metalness so SSR reflects at grazing angles |
| Road paint | `js/road-paint.js` `buildRoadPaint`; `createRoadPaintMaterial` | `world/physical/` road paint, generated from `living-city/topology.ts` lanes | all | Height 0.012 m over asphalt; white, yellow and green paint colours become tokens; metalness 0 |
| Sidewalk, curb, tree grate | `js/tsl-materials.js` `createSidewalkMaterial`, `createCurbMaterial`, `createTreeGrateMaterial` | `world/physical/` | all | sidewalk metalness 0, roughness 0.88; curb 0.06, 0.72; grate 0.45, 0.68 |
| Contact shadow | `js/tsl-materials.js` `createContactShadowMaterial` | `world/physical/` | all | Rounded-box SDF; opacity ≤ 0.88; writes `metalRough` so wet-road SSR is occluded under the car |
| Fire escapes | `js/fire-escapes.js` `createFireEscapes` | `world/physical/` on D18's walk-up fire escapes | all | Steel roughness 0.65, metalness 0.6, `alphaToCoverage`; Slop caps 2 400 escapes, 256 near floors, near distance 30 m, storey 3.5 m. nyc-mon keeps D18's placement (747 facades) |
| Scene culling | `js/scene-culling.js` `setupSceneCulling` | `world/physical/` culling module | all | `CULL_PER_METRE` 1100, `CULL_MIN` 300 m, `CULL_MAX` 2000 m, `PROXY_CELL` 500 m, `STATIC_CELL` 1000 m, shadow proxies on layer 3 |
| Billboards, plates, sign blades | `js/tsl-materials.js` `createBillboardCanvasTexture`; `js/street-details.js` `createStreetSignBladeTexture`; `js/actor-models.js` `carPlateTexture` | `render-runtime/skia-texture-bridge.ts` (G9) or `world/pixel-font.ts`, `lettering.ts`, `signage.ts` | all | Slop draws these on DOM canvases. nyc-mon draws them with Skia into WebGPU textures if G9 passes, else from the existing pixel font. No `document` |

### Vehicles and street light

| Slop technique | Slop file, function | nyc-mon file (target) | Tier | Parameters (Slop value) |
|---|---|---|---|---|
| Loft geometry | `js/actor-models.js` `LoftGeometry` (adapted from three's `LoftGeometry`, per Slop's header) | `living-city/lofted-car*.ts` | all | Closed loft with optional caps; sections of equal column count |
| Body tables | `js/actor-models.js` `BODY_SPECS` (`sedan`, `suv`; `taxi` = sedan with `sign: true`), `BUS_SPEC` | `living-city/lofted-car*.ts` | all | Sedan length 4.5 m (`zFront` 2.25, `zRear` −2.25), wheel radius 0.35; SUV 4.6 m, wheel radius 0.39; bus 11.56 m, wheel radius 0.48. Note: the bus is a separate `BUS_SPEC`, not a `BODY_SPECS` entry as the spec's §5.4 wording suggests |
| Car builders | `js/actor-models.js` `buildCarGeometry`, `buildCarProxyGeometry`, `buildLoftedBusBodyGeometry` | `living-city/lofted-car*.ts`, one asset-registry recipe per `VEHICLE_KINDS` entry above `proc:box-car` | all | Box car stays as the fallback recipe. Must build and draw on the worklet runtime (ADR 0025) |
| Car material | `js/actor-models.js` `createLoftedCarMaterial` | `living-city/lofted-car*.ts` | all | Instance attributes `paintColor` (vec3) and `carState` (vec4: brake, left signal, right signal, livery with 1 = police); fixed-colour cars use a `carState` uniform whose 4th component drives reverse lights. nyc-mon feeds both from `VSNAP`; the taxi sign gates on the taxi kind |
| Headlights | `js/vehicle-lights.js` `HEADLIGHTS`, `placeVehicleHeadlight` | `living-city/vehicle-headlights.ts` | phone nearest 8 vehicles, high nearest 24 | Unshadowed `SpotLight`: intensity 700 (bus 900), distance 36 m, angle 0.14, penumbra 0.85, decay 2, pitch 0.145, toe-out 0.005, nose offset 0.08 m, aim 10 m. Others get emissive lamps that bloom |
| Night flares | `js/tsl-materials.js` `createCarFlareMaterial`; `js/traffic.js` flare buffers | `living-city/vehicle-headlights.ts` | all | Additive sprite, `flarePos` (x, y, z, size) and `flareCol` (rgb + pad); night factor `smoothstep(0.35, 1.3, uInteriorGlow)`; no fog |
| Street lights | `js/street-details.js` `buildStreetDetails` light pools | `world/physical-rig.ts` with `world/street-furniture.ts` positions | all, inside the clustered budget | 36 cobra-head spots (distance 25 m, angle 0.96, penumbra 0.82, decay 1.25, peak intensity 88 × lamp scale) within 115 m; 48 point lamps (distance 12 m, decay 1.35) within 110 m; lamp scale `min(1.25, max(0, (interiorGlow − 0.36) × 1.15))` |

### One GPU device

| Slop technique | Source | nyc-mon file (target) | Tier | Parameters |
|---|---|---|---|---|
| Shared device | Not in Slop. `react-native-skia@3.6.1` `Skia.getNativeDevice()`; `react-native-webgpu@0.16.0` `importDevice` | `render-runtime/shared-device.ts`; `packages/ui/gpu/gpu-store.ts` | all, only if G9 passes | Device lane, ADR 0026 |
| Skia-drawn textures | `Skia.Surface.MakeFromGPUTexture`, `flush()` / `flush(true)` | `render-runtime/skia-texture-bridge.ts` | all, only if G9 passes | Textures created `RENDER_ATTACHMENT | TEXTURE_BINDING`; `skiatex` probe decides `flush` vs `flush(true)` |

## 2. Presets (G2 default)

Order in the UI: twilight, golden, midday, midnight (labels in `COPY_DECK.md` § Time of day). Default `twilight`. Values from `js/lighting.js` `TIME_PRESETS`; colours are the `physicalCityLight.<preset>` tokens.

| Field | twilight | golden | midday | midnight |
|---|---|---|---|---|
| Sun direction (before normalising) | (−0.52, 0.36, −0.77) | (−0.44, 0.58, −0.68) | (−0.34, 0.82, −0.46) | (0.42, 0.68, −0.60) |
| Sun intensity | 3.1 | 5.8 | 6.6 | 1.45 |
| Hemisphere intensity | 0.85 | 1.48 | 1.58 | 0.72 |
| Fog density | 0.00032 | 0.00024 | 0.00018 | 0.00036 |
| Interior glow | 1.25 | 0.48 | 0.24 | 1.55 |
| Road wetness | 0.55 | 0.28 | 0.08 | 0.62 |
| Environment intensity | 0.36 | 0.54 | 0.58 | 0.30 |
| Canyon bounce | 0.32 | 0.52 | 0.58 | 0.18 |
| Turbidity, Rayleigh, Mie coeff., Mie g | 9.5, 3.4, 0.010, 0.90 | 8.0, 2.8, 0.008, 0.88 | 6.5, 2.4, 0.006, 0.86 | 4.0, 1.5, 0.004, 0.80 |
| Cloud coverage, density | 0.40, 0.42 | 0.36, 0.38 | 0.32, 0.35 | 0.22, 0.25 |
| Sky exposure | 0.115 | 0.148 | 0.142 | 0.022 |
| Night factor | 0.28 | 0 | 0 | 0.86 |

Sun direction is in Slop's frame, where Manhattan's grid is axis-aligned. In this tile the grid runs about 29° off the x axis (W 125 ST segment `cscl:19401` direction (−0.873, −0.487)). D17's "low south-west sun" is the target for `twilight`; E1 decides whether to rotate Slop's vectors into the tile frame and records it in `physical-presets.ts`. `TODO(tune)` on device.

## 3. Class → family

Each nyc-mon `BuildingClass` maps to one Slop family. Valdrada fields cited are the `city-dataset.ts` names: `vs` (`styleId`, Valdrada STYLE), `f` (`floors`), `fh` (`floorHeightMeters`), `ww` (`windowWidthMeters`), `sh` (`storefrontHeightMeters`), `d` (detail bits), `e` (estimate flags). The STYLE → class step is DESIGN_SYSTEM § City's table; the class → family step below is this handoff's design mapping and carries the same estimate status.

| nyc-mon class | Valdrada `vs` | Count on tile | Slop family | Material | Inputs from the record |
|---|---|---|---|---|---|
| `brick` | 0, 1, 2, 7, 10 | 2 790 | Pre-war brick | `createPreWarBuildingMaterial`, brick bond | `ww` → window width; `fh` → floor height; `sh` → ground-floor shop band; `d` bit 1 (fire escape) → fire escapes; `d` bit 4 (storefront) → `WALL_KINDS.shop` on street fronts |
| `brownstone` | 5 | 529 | Brownstone | `createPreWarBuildingMaterial` with brownstone stone and trim tones | As brick; `d` bit 2 (stoop) → `WALL_KINDS.entry` on the stoop face |
| `civic` | 4, 8 | 196 | Limestone and terra cotta | `createPreWarBuildingMaterial`, ashlar | As brick; landmarks keep their accents (`hotel-theresa` terracotta lookup) |
| `church` | 9 | 134 | Limestone and terra cotta | `createPreWarBuildingMaterial`, ashlar | Lit probability lowered (`TODO(tune)`) |
| `glass` | 3, 11 | 70 | Curtain wall | `createCurtainWallMaterial` | `fh` → floor height; `ww` → mullion pitch |
| `nycha` | 12 (PROJECT_BRICK) | 19 | Pre-war brick, plus the facelift kit | `createPreWarBuildingMaterial` | As brick. FUT-01 is open: the class comes from the record STYLE, not the verified NYCHA development dataset, so no NYCHA-specific claim or label keys on it |
| `plain` | 6, 13, 14, 15 | 4 | Limestone and terra cotta, stucco tone | `createPreWarBuildingMaterial` | As brick |

Counts are from `packages/app/features/game/data/harlem-apollo.json` (`harlem-apollo-20261017`), counted 2026-10-27 by class `c`. Where a record field is missing, Slop's default from the table in § 1 applies, and the building's `e` bits already say which facts are estimates.

## 4. Facelift elements and density

The approved direction (`MOBILE_WORLD_PR_PACK.md` § Approved art direction, 2026-10-13) restated for physical lighting. Additive, keyed by stable building id, reversible under `EXPO_PUBLIC_WORLD_FUTURE`.

| Element | Physical read | Material inputs |
|---|---|---|
| Refined brick and concrete palettes | New tone tokens on the § 3 families; bond and relief unchanged | Facade tone tokens (lane E4) |
| Charcoal window framing | Painted aluminium: dielectric, metalness 0, roughness `TODO(tune)` starting at curb's 0.72 | Frame token |
| Modular facade panels | Facade variant with panel joints drawn as anti-aliased lines (Slop `gridLine`) | Panel pitch from `fh` |
| Planted balconies and roof gardens | Existing foliage path, lit by sun and sky | `future-layer.ts` geometry unchanged |
| Vertical architectural lighting | Emissive strips above the bloom threshold of the active preset | Brand 400/500 keys |
| Upgraded entrances | Lit canopy and glazing through the shop-glazing path | `WALL_KINDS.entry` face |
| LED AdSurfaces | Emissive brand gradients; no logos or lettering; animation off under Reduce Motion; never on a residence (`future-layer.ts` eligibility) | ≤ 48, the D17 cap |
| Neon roofline trims | Brand 400/500, above the bloom threshold | D17 band geometry |
| LED streetlights and royal kerb light lines | Clustered lights cooler than Slop's sodium-warm pools, plus emissive kerb strips | Street-light pool from § 1 |

### Proposed density per block type

Proposals for Mike to approve inside G6. None is measured; each is a share of the buildings of that block type in the tile, picked by a hash of the stable building id so the same buildings always carry the same pieces. "Today" is the shipped D17 or `future-layer.ts` rule, cited.

| Block type (how it is found) | Palette refresh | Window framing | Panels | Balconies / roof gardens | Vertical lighting | Entrances | AdSurfaces | Roofline trim |
|---|---|---|---|---|---|---|---|---|
| Commercial avenue frontage (walls within 14 m of a primary, secondary or trunk road: the D17 fascia rule; 125th Street, ACP Jr. Blvd) | 60 % | 60 % | 25 % of buildings 5 floors and up | 10 % roof gardens | 15 % | 50 % of street-front ground floors with `d` bit 4 | Only on `campaign`-eligible commercial and civic walls, ≤ 48 tile-wide (today's cap) | Today's rule: 18–85 % by height |
| Residential brownstone side street (`brownstone` class off the avenues) | 30 % | 30 % | 0 % | 10 % roof gardens | 0 % | 20 % of stoops (lit canopy only) | None (residence) | 10 % |
| Brick walk-ups (`brick`, 12–32 m, D18's fire-escape band) | 40 % | 40 % | 0 % | 15 % balconies on the rear wall only, so D18's street-face fire escapes stay | 5 % | 25 % | None (residence) | 15 % |
| NYCHA-class towers (`nycha`, 19 buildings) | 100 % (today's kit: `future-layer.ts`) | 100 % | 100 % (today: 197 panel strips) | 100 % (today: 631 balconies, 19 roof gardens) | 100 % (today: one royal strip each) | 100 % (today: 19 entrances) | None (residence) | 0 % |
| Civic, church and landmarks | 0 % | 0 % | 0 % | 0 % | Landmark accents only | 0 % | None | 0 % on landmarks and churches |
| Glass (`glass`, 70 buildings) | n/a (curtain wall) | n/a | 0 % | 20 % roof gardens | 30 % | 50 % | Commercial walls only | Today's rule |

Reasons: the avenues carry the change because the brief's "spectacular New York" lives on the commercial street, and the side streets stay mostly as they are because a fully refitted brownstone block stops reading as Harlem (recognition study P1, P5). Landmarks and churches get nothing so the Apollo, the Theresa and the churches stay the reference points Lynch's landmark test depends on. The NYCHA row keeps today's 100 % kit, which the 2026-10-18 pass shipped; it remains provisional under FUT-01.

## 5. Camera bookmarks

Positions use the `CityCamera` contract (`city-scene.ts`): `{ x, z, yaw, distance }`, x east and z south in metres around the tile origin; the camera sits `distance` behind the target along (sin yaw, cos yaw) and looks at it, so a view direction (dx, dz) has `yaw = atan2(−dx, −dz)`. Eye positions are `cameraPose()`'s output, computed 2026-10-27 with the constants in `city-scene.ts` (`CHASE_PITCH` 0.35, `OVERVIEW_PITCH` atan 0.8, `OVERVIEW_DISTANCE` 220).

No bookmark list exists in the code. The search found `INITIAL_CITY_CAMERA` (`city-camera.ts` L10: `{ x: −28, z: 22, yaw: π/2, distance: 220 }`, the Apollo's 125th Street sidewalk) and `CHASE_DISTANCES` `[8, 18, 40]` (L63). The bookmarks below are derived from tile data: road polylines by name (`roads[].n`), building centroids by class, landmark centroids (`landmarks[]`), and the 125th Street carriageway point (−34.7, 33.6) recorded in `city-world.md` § Walkability. The 125th Street direction comes from segment `cscl:19401`, (−0.873, −0.487); `INITIAL_CITY_CAMERA`'s yaw π/2 is about 29° off that axis.

| Bookmark | Target (x, z) | yaw (rad) | distance (m) | Eye (x, y, z) | Derived from |
|---|---|---|---|---|---|
| Apollo marquee from 125th Street | (−34.7, 33.6) | −0.509 | 18 | (−43.5, 7.8, 49.3) | Carriageway point opposite the Apollo (`city-world.md`); yaw faces the Apollo centroid (−9.5, −12.3) (`landmarks[]`, building `osm:way:271798914`) |
| 125th Street looking east | (−34.7, 33.6) | −2.079 | 18 | (−50.4, 7.8, 24.8) | 125th Street axis, east |
| 125th Street looking west | (−34.7, 33.6) | 1.062 | 18 | (−19.0, 7.8, 42.4) | 125th Street axis, west |
| Residential side street | (−378.1, 122.9) | 1.062 | 8 | (−371.1, 4.1, 126.8) | W 122 ST (`cscl:81568`, residential, 9.1 m), the named residential point within 400 m of the origin with the most `brownstone` buildings inside 35 m (11 brownstone, 3 brick); the street runs parallel to 125th (direction (−0.877, −0.481)) |
| NYCHA block | (−421.4, −175.4) | 1.961 | 40 | (−384.4, 16.6, −190.6) | Nearest `nycha` building to the origin, `osm:way:271912755` (centroid (−467.3, −156.5), 56.3 m, `vs` 12); target is the nearest carriageway point (on a road named W 125 ST, class `residential`, 49.6 m away); yaw faces the tower. FUT-01 caveat applies to the name |
| Rooftop view | (196.1, 91.9) | 1.062 | 140 | (318.4, 90.3, 160.1) | ACP Jr. State Office Building (`landmarks[]`, `osm:way:271798907`, 88.9 m, the tile's second-tallest within 400 m); distance picked so the eye sits at its roof height, looking west along 125th toward the Theresa and the Apollo |

Notes for D2 captures:

- The camera contract has no free eye height, so the "rooftop" bookmark is a high orbit at roof height, not a camera standing on a roof. A true rooftop eye needs a camera field this lane does not add.
- The tallest building within 400 m is `osm:way:738693110` (101.5 m, `brick`, centroid (26.0, 8.4)), next to the Apollo. It can block the Apollo bookmarks from some angles; check the first capture.
- Each bookmark is captured at every shipped preset on iPhone 17 and iPad Pro (spec D2) and beside a Slop frame at the matching preset. None has been captured.

## 6. States, edge cases, accessibility

| Case | Behaviour |
|---|---|
| Flag off | Byte-identical to today (N1); none of the above runs |
| Probe fails on a device (G5) | Lane stops; no silent fallback while the flag is on |
| G9 fails | Separate devices; textures from `pixel-font.ts`, `lettering.ts`, `signage.ts` |
| Reduce Motion | Cloud drift stops (`cloudSpeed` 0), AdSurface animation off; preset changes cut, never cross-fade. Nothing flashes more than three times a second (WCAG 2.3.1) |
| HUD over a lit frame | Opaque chip faces, or a measured contrast pair per preset (DESIGN_SYSTEM § Physically lit city) |
| Shader compile in the lobby | Determinate progress, slow and failed states (`COPY_DECK.md` § Lobby: shaders compiling) |
| Duo (`low`) | Today's look, unchanged (G4) |
