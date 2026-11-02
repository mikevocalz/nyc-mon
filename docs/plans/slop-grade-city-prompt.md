# NYC-MON · Slop-grade Harlem with the futuristic facelift — agent prompt

Written 2026-10-26, and revised the same day for React Native Skia 3 (Graphite) and a shared GPU device. Save as `docs/plans/slop-grade-city-prompt.md`. This prompt checks these sources:

- `mikevocalz/nyc-mon` `main` @ `7ba25e2` (2026-10-25, merge of PR #114): https://github.com/mikevocalz/nyc-mon
- `mrdoob/slop-newyork` `main` @ `be65d0a` (2026-10-26), MIT: https://github.com/mrdoob/slop-newyork · live build: https://mrdoob.github.io/slop-newyork/
- `wcandillon/react-native-webgpu` `main` @ `3f4b0f0` (2026-10-24): https://github.com/wcandillon/react-native-webgpu
- `react-native-skia` 3.6.1 (installed; npm `latest` is 3.8.0) and William Candillon's *Hello, Graphite: Performance* (2026-10-26): https://wcandillon.dev/article/hello-graphite-performance

**Goal.** Make the Apollo-centred Harlem tile and its cars look like Slop New York on iPhone 17 and iPad Pro. That means physically lit, tone-mapped, sun-shadowed, sky-lit, reflective, with lit interiors behind the windows and lofted cars. Then put the approved futuristic facelift on top. The Valdrada record-backed city data, the living-city sim, world saves and the origin all stay.

**Design rule.** Port Slop's rendering techniques, not its geography. Every ported piece cites the Slop file and function it came from. Every three.js API it calls is checked against the installed `three@0.186.1` source.

**Target devices (Mike, 2026-10-26).** Newer phones like iPhone 17, and iPad Pro. These replace the Surface Duo as the baseline in `perf/tier.ts`. G4 decides the Duo's remaining role.

---

## 0. How to run this

1. Run Claude Code at the nyc-mon root on a new branch, `feat/slop-grade-city` unless Mike names another.
2. Before any edit, read these in full.
   - **nyc-mon:**
     - Repo and design docs:
       - `AGENTS.md` and `skills/README.md`
       - `docs/design/reference-roster.md`
       - `docs/design/DECISIONS.md` (D17, D18) and `docs/design/toon-look-spec.md`
       - `docs/implementation/city-world.md`
       - `docs/implementation/MOBILE_WORLD_PR_PACK.md` (§ "Approved art direction")
       - `docs/design/future-layer-2026-10-18.md`
       - `docs/design/handoff/realism.md` and `docs/design/graphics-settings-surface.md`
       - `docs/implementation/worklet-rendering.md` and `docs/DEVICE_CHECKS.md`
     - Under `packages/app/features/game/`:
       - Scene and runtime: `city-scene.ts`, `post/pipeline.ts`, `render-runtime/game-render.ts`, `render-runtime/worklet-host.ts`
       - World look and lighting: `world/sky-rig.ts`, `world/look.ts`, `world/index.ts`, `world/palette.ts`
       - World geometry and materials: `world/city-mesh.ts`, `world/materials.ts`, `world/car-materials.ts`, `world/future-layer.ts`
       - Performance: `perf/tier.ts`, `perf/render-scale.ts`
       - Living city: `living-city/vehicle-actor.ts`, `living-city/seed-assets.ts`, `living-city/vehicle-sim.ts`, `living-city/topology.ts`
     - Theme: `packages/theme/tokens.ts`
   - **Slop New York @ `be65d0a`:**
     - `README.md` and `LICENSE`
     - `js/main.js`: renderer, MRT, SSR and pipeline setup, roughly L40–225.
     - `js/lighting.js` and `js/post-processing.js`
     - `js/tsl-materials.js`:
       - `cityUniforms`, `canyonSkyAONode`, `evaluateApartmentInterior`, `facadeCell`
       - `createPreWarBuildingMaterial`, `createCurtainWallMaterial`, `createFacadeBoxes`
       - `roadPuddleField`, `roadWetMasks`, `createRoadSurfaceMaterial`, `createRoadPaintMaterial`, `createSidewalkMaterial`, `createCurbMaterial`
       - `createCarPaintMaterial`, `createContactShadowMaterial`, `createCarFlareMaterial`
     - `js/actor-models.js`: the `LoftGeometry` port, `BODY_SPECS`, `buildCarGeometry`, `createLoftedCarMaterial`, the bus builders.
     - Street and city: `js/vehicle-lights.js`, `js/street-details.js`, `js/road-paint.js`, `js/fire-escapes.js`, `js/scene-culling.js`, `js/buildings.js` (the `Quadtree` detail streaming).
     - `js/traffic.js` (behaviour reference only) and `tests/`.
   - **Installed `three@0.186.1`**, under `examples/jsm/`:
     - `lights/SunLight.js` and `lights/SunLightNode.js`
     - `lighting/ClusteredLighting.js`
     - `tsl/display/SSRNode.js` and `tsl/display/BloomNode.js`
     - `objects/SkyMesh.js`
     - `geometries/LoftGeometry.js`
     - `generators/city/*` (https://github.com/mrdoob/three.js/tree/r186/examples/jsm/generators/city)
   - **react-native-webgpu:** `apps/example/src/ThreeJS/PostProcessing.tsx` (https://github.com/wcandillon/react-native-webgpu/blob/main/apps/example/src/ThreeJS/PostProcessing.tsx) and `apps/example/src/ThreeJS/components/makeWebGPURenderer.ts`.
   - **Shared device (React Native Skia 3 and react-native-webgpu):**
     - The Graphite article above, in full.
     - `react-native-skia@3.6.1`, under `lib/typescript/src/skia/types/`: `Skia.d.ts` (`getNativeDevice`), `GPUTexture.d.ts`, `Image/ImageFactory.d.ts` (`MakeImageFromGPUTexture`, `MakeGPUTextureFromImage`), `Surface/SurfaceFactory.d.ts` (`MakeFromGPUTexture`) and `Surface/Surface.d.ts` (`flush(sync)`).
     - `react-native-webgpu@0.16.0` `src/importDevice.ts` (`importDevice`, `adoptTexture`).
     - nyc-mon `packages/ui/gpu/gpu-store.ts`, and `render-runtime/game-render.ts` where it constructs the `WebGPURenderer` (~L288).
3. Clone Slop and react-native-webgpu outside the nyc-mon tree (for example `~/src/`). Nothing is vendored wholesale. Ported code becomes strict TypeScript in the repo and carries the MIT notice (§5.8).
4. Coordinate through the subagents in §7, using the `ecc:*` plugin (https://github.com/WorldFlowAI/everything-claude-code). Take agent names from the plugin's own listing.
5. The gates in §4 are hard stops: ask Mike, record the answer in `docs/design/DECISIONS.md`, then continue.
6. No dependency upgrades, no merges, no deploys. Draft PRs only.
7. Device evidence comes from iPhone 17 and iPad Pro **hardware**. Simulator and browser results are labelled as such and never close a device gate. The rule this prompt overturns (§2.1 #1) was itself a simulator result.

---

## 1. Roster

Append the block below to `docs/design/reference-roster.md` as `## Slop-grade city (2026-10-26)`.

Judge every decision by one test: would the author of the technique, spec or API sign off on this exact file? Do not use "senior" or "principal" in role framing; those titles are below this bar. The names set a craft standard. They do not imply that anyone listed takes part.

### Engineers (creator / spec-author tier)

| Domain | Bar | Source |
|---|---|---|
| Slop New York, the look target | Ricardo Cabello (mrdoob), three.js creator and Slop's author | https://github.com/mrdoob · https://github.com/mrdoob/slop-newyork |
| WebGPURenderer, TSL, `RenderPipeline`, SSR and bloom nodes, `SunLight`, `ClusteredLighting` | Michael Herzog (Mugen87), sunag, Renaud Rohlinger | https://github.com/Mugen87 · https://github.com/sunag · https://github.com/RenaudRohlinger · TSL wiki: https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language |
| RN WebGPU surface, `present()`, Dawn on iOS; React Native Skia 3 on Graphite and the shared device | William Candillon, author of react-native-webgpu and React Native Skia | https://github.com/wcandillon/react-native-webgpu · https://wcandillon.dev/article/hello-graphite-performance |
| Skia Graphite, the 2D backend that shares the device | Google Skia team | https://skia.org/ |
| WebGPU itself | W3C GPU for the Web spec editors; Dawn implementers | https://www.w3.org/TR/webgpu/ · https://dawn.googlesource.com/dawn |
| The GPU underneath (iPhone, iPad) | Apple Metal team | https://developer.apple.com/metal/ |
| Physically based shading | Brian Karis, Naty Hoffman (SIGGRAPH 2013 Physically Based Shading course) | https://blog.selfshadow.com/publications/s2013-shading-course/ |
| PBR in production, light units and exposure | Sébastien Lagarde (Moving Frostbite to PBR) | https://seblagarde.wordpress.com/ |
| Interior mapping (the lit rooms behind Slop's windows) | Joost van Dongen, *Interior Mapping* (2008) | https://www.proun-game.com/Oogst3D/CODING/InteriorMapping/InteriorMapping.pdf |
| Procedural shading, noise, anti-aliased patterns | Inigo Quilez | https://iquilezles.org/ |
| Traffic behaviour (IDM, the model Slop's `traffic.js` names) | Martin Treiber | https://traffic-simulation.de/ |
| City records | Mehmet Kerem Turkcan, Valdrada author | https://github.com/mkturkcan/valdrada |
| TypeGPU interop | Software Mansion TypeGPU team | https://docs.swmansion.com/TypeGPU/ |
| TypeScript | Anders Hejlsberg, Ryan Cavanaugh, Daniel Rosenwasser | https://www.typescriptlang.org/ |
| Native boundary (only if §6.6 triggers) | Marc Rousavy | https://github.com/mrousavy · https://nitro.margelo.com/ |

### Designers

| Name | Why they are the bar | Source |
|---|---|---|
| Syd Mead | A future layered onto a real city without erasing it: the facelift's test | https://sydmead.com/ |
| Kevin Lynch | *The Image of the City*: paths, edges, districts, nodes and landmarks. The test that the new look still reads as Harlem | https://mitpress.mit.edu/9780262620017/the-image-of-the-city/ |
| Massimo Vignelli | NYC transit information discipline: street signs, chips and wayfinding stay true to the street | https://standardsmanual.com/ |
| Michael Bierut, Pentagram | WalkNYC: the facelift's "upgraded wayfinding" | https://www.pentagram.com/work/walknyc |
| Justin K. Thompson | NYC stylisation that stays recognisable | https://www.cartoonbrew.com/feature-film/spider-man-into-the-spider-verse-production-design-is-about-character-not-style-168137.html |

### Design agencies

| Agency | Take | Source |
|---|---|---|
| Pentagram | WalkNYC system thinking for street furniture, credits and HUD street chips | https://www.pentagram.com/ · https://www.pentagram.com/work/walknyc |
| Territory Studio | Screen graphics for future cities in film: restraint for LED panels and HUD overlays | https://territorystudio.com/ |
| Sony Pictures Imageworks | Stylised-NYC production reference | https://www.imageworks.com/node/1371 |
| Chromosphere | Colour scripting across times of day | https://chromosphere.studio/ |

### Dev agencies

| Agency | Role here | Source |
|---|---|---|
| Software Mansion | TypeGPU, and the worklet runtime the renderer runs on | https://swmansion.com/ |
| Callstack | Measured frame time, TTI and memory; `agent-device` evidence | https://www.callstack.com/ · https://github.com/callstackincubator/agent-skills |
| Margelo | `api-design` on exported `@acme/*` surfaces; native only behind §6.6 | https://margelo.com/ · https://github.com/margelo/react-native-skills/tree/main/skills |
| Utsubo | WebGPU/TSL production work | https://www.utsubo.com/ |
| Active Theory · Lusion · 14islands | Real-time city craft bar | https://activetheory.net/ · https://lusion.co/ · https://14islands.com/ |

### Rejected on sight

- "Fixing" the look by tuning cel bands or colour constants while the output stays linear with no tone mapping.
- Importing Slop's Manhattan geodata (OSM-derived, ODbL, a different area) in place of the Valdrada tile.
- A hex literal outside `packages/theme/tokens.ts`. Slop has hundreds; each one becomes a token or a named physical constant with units.
- DOM APIs (`document.createElement('canvas')`, `localStorage`, Web Audio, `navigator.getGamepads`) carried into the React Native or worklet bundle.
- A device claim backed only by the simulator.
- Flipping a flag to default-on without G8.
- Uniform neon cyberpunk, logos or lettering on LED panels, or invented NYCHA development names.
- A second `RenderPipeline` mount next to `post/pipeline.ts`.
- A second or third GPU device once the shared one passes Phase 0 (G9).
- Slop code without its MIT notice.
- "Should work" without numbers.

---

## 2. Ground truth (verified 2026-10-26)

### 2.1 Why the city still doesn't look right

| # | Finding | Evidence | Consequence |
|---|---|---|---|
| 1 | The city renders with linear output, no tone mapping, no shadow maps and no post | `city-scene.ts` ~L100–111 sets `outputColorSpace = LinearSRGBColorSpace`, `NoToneMapping` (unless `VD_TONEMAP`) and `shadowMap.enabled = VD_SHADOWS`. Its comment cites the metro-live README. The source line, vg-demos-all `README.md` L23, says shadow maps, the output pass and `Color` backgrounds render black, "checked on the iOS 27 simulator with three r186" (https://github.com/vietgangzz/vg-demos-all). `city-world.md` L106 and D17 ("Not done: bloom") inherit it | Slop's look is built on exactly these three things |
| 2 | react-native-webgpu's own maintainer example runs the pipeline that #1 forbids | `apps/example/src/ThreeJS/PostProcessing.tsx` uses `new THREE.RenderPipeline(renderer)`, `bloom()` and `NeutralToneMapping` on three 0.184.0, and calls `context.present()` after `renderPipeline.render()` | The rule is unproven on hardware. Phase 0 settles it on iPhone 17 and iPad Pro |
| 3 | Every realism lane is opt-in and off | 17 `parseSkyRigFlag` flags: `LIVING_CITY`, `WORKLET_VSYNC`, `WORLD_ADPF`, `WORLD_CAR_PBR`, `WORLD_FRAME_RATE`, `WORLD_FUTURE`, `WORLD_GLASS`, `WORLD_PBR`, `WORLD_POST`, `WORLD_RENDER_SCALE`, `WORLD_SKY_RIG`, `WORLD_THERMAL`, `WORLD_TOON`, `WORLD_VD`, `WORLD_VD_LEAN`, `WORLD_VD_LEANDRAW`, `WORLD_VD_LEANMAT` (all `EXPO_PUBLIC_`-prefixed). Nothing committed turns one on | What Mike sees is the floor, not the upgrades |
| 4 | Cars are boxes | `living-city/vehicle-actor.ts` header: resolution lands on `proc:box-car` (6 boxes, 72 triangles). The `three:` CarGenerator binding is pending worklet-bundle verification, and the GLBs are pending | "Cars don't look right" is literal |
| 5 | The look target itself is cel | `docs/design/toon-look-spec.md`; D17 (fixed dusk, cel bands, brand light added after shading) | "Just like Slop" supersedes D17 for the city (§5.9) |
| 6 | Tiers baseline the wrong device | `perf/tier.ts`: "the Duo's constraints are the baseline" | Re-baseline on iPhone 17 and iPad Pro (§5.7, G4) |

### 2.2 Slop New York @ `be65d0a`

- **Size and licence.** 31,599 lines of plain JS across 33 modules in `js/`. MIT, © 2026 Mr.doob. The README invites forks and remixes; its data notice is NYC Open Data and OSM (ODbL). Remix index: https://github.com/zz85/slop-cities
- **three version.** three is loaded from the `three.js@dev` branch through jsDelivr (`index.html` importmap). Checked by script against the installed `three@0.186.1`:
  - All 7 `three/addons/*` imports Slop uses exist.
  - All 71 `three/tsl` names Slop imports exist.
  - Also present: `SSRNode` `binaryRefine`, `blurQuality`, `screenEdgeFadeBlack`, `resolutionScale`; `BloomNode` `setResolutionScale`, `smoothWidth`; `SkyMesh` `showSunDisc` and the cloud uniforms; `storeMultisampledColorBuffer`.
  - Constructor signatures: `SunLight(color, intensity)`; `ClusteredLighting(maxLights = 1024, tileSize = 32, zSlices = 24, maxLightsPerCluster = 64)`. Slop calls `(256, 32, 28, 48)`.
  - Behaviour can still drift between dev and r186. Diff each source before porting it.
- **Frame (`main.js`).** In order:
  1. `WebGPURenderer({ antialias: true, reversedDepthBuffer: true })` with pixel ratio 1.0 and `ClusteredLighting(256, 32, 28, 48)`.
  2. `pass()` with MRT: output, `normalView`, and `metalRough`. Metalness is faded over 180–360 m, and SSR is skipped above roughness 0.75. `storeMultisampledColorBuffer = false`.
  3. SSR at 0.5 resolution: quality 0.25, `binaryRefine`, `maxDistance` 42, `thickness` 0.85, intensity 0.5, then masked by roughness.
  4. `createPostProcessing`: exposure and white balance first, then bloom at 0.5 resolution on a peak-limited input. Then split-tone, contrast pivoted on 0.18 grey, saturation plus vibrance, and a vignette.
  5. `RenderPipeline` with `ACESFilmicToneMapping`, so ACES and the output conversion each happen once.
  6. On WebGPU, every `InstancedMesh.instanceMatrix` is swapped to a `StorageInstancedBufferAttribute`. Slop's comment measures about 2.5 MB/frame of uniform re-upload otherwise.
- **Lighting (`lighting.js`).**
  - `SkyMesh` (Preetham sky plus clouds), baked without the sun disc into PMREM as `scene.environment`.
  - Aerial-perspective `fogNode`: samples the PMREM in the horizon direction through an exponential height haze.
  - `SunLight` with 2 cascades in one atlas: 3072 px tiles when `maxTextureDimension2D ≥ 6144`, otherwise 2048. `normalBias` 0.05. Far plane 300–720 m, scaled with camera altitude.
  - `HemisphereLight` fill.
  - `scene.background = null`. Slop's comment: a `Color` background forces a clear that wipes cascade 0 while cascade 1 renders. This explains part of #1.
  - Four presets: `golden`, `midday`, `twilight`, `midnight`. Each drives `cityUniforms`: sun colour, sky colours, interior glow, road wetness and canyon bounce.
- **Materials (`tsl-materials.js`).**
  - Pre-war brick, brownstone, limestone and terra cotta, with anti-aliased running bond and domed-brick relief through `bumpNormal`.
  - 3D interior mapping on upper floors, with 2–3-bay rooms, drapes, a lit-room probability and a pixel-footprint fade. Ground-floor shops get 2D glazing.
  - Window AC units, grimy glazing with sill dirt and rain streaks, and canyon AO with a warm bounce.
  - Curtain wall with mullion relief.
  - Roads with aggregate bump, manholes and puddle wetness (wet roads reflect through SSR). Also sidewalks, curbs, tree grates and contact shadows.
- **Vehicles (`actor-models.js`, `vehicle-lights.js`).**
  - Lofted bodies come from `BODY_SPECS` design tables (`sedan`, `suv`, a bus spec), with wheel wells, mirrors, roof rails, bumpers, a taxi sign and a plate texture.
  - Each instance carries `paintColor` and `carState` attributes.
  - Headlights are unshadowed `SpotLight`s in the clustered path (`HEADLIGHTS` table).
- **Street.**
  - `street-details.js`: signal lens and walk materials, sign blades, clustered street and store lights.
  - `road-paint.js`: road markings generated from the lane network.
  - `fire-escapes.js`: fire escapes masked by pixel coverage.
  - `scene-culling.js`: spatial chunking plus shadow proxies.
- **DOM dependencies.** 14 files hit `document.createElement` / `localStorage` / `AudioContext` / `getGamepads`. `main.js` has 9, `audio-system.js` 4, `controllers.js`, `gamepad-controls.js` and `nyc-map.js` 2 each, `tsl-materials.js` 2, and `actor-models.js`, `boroughs.js`, `buildings.js`, `city-grid.js`, `landmarks.js`, `street-details.js`, `traffic.js` and `trees.js` 1 each. None of these can run under Metro or the worklet runtime.
- **Tests.** Under `tests/`: boot, cameras, controllers, facade-projection, geodata, nyc-map, overpass, smoke-texture, teleports, touch-controls, traffic-performance, traffic, vehicle-lights, vehicle-physics.

### 2.3 nyc-mon @ `7ba25e2`

- **Versions:**
  - `three` 0.186.1 with `@types/three` 0.186.0
  - `react-native-webgpu` 0.16.0, with `patches/react-native-webgpu@0.16.0.patch`
  - `typegpu` 0.12.7 with `@typegpu/three` 0.12.1
  - Expo SDK 58 / React Native 0.88
- **World already in place.** Reuse it; don't duplicate it.
  - The Valdrada v3 tile (`world/vd-*`). `city-mesh.ts` writes merged buffers: 12 draws on the tile per `future-layer-2026-10-18.md`.
  - The living-city sim (`vehicle-sim.ts`, `signal-controller.ts`, `ped-sim.ts`, `topology.ts`).
  - `post/pipeline.ts`: already mounts a `RenderPipeline` behind flags, with bloom, SSAO, FXAA, grade and a tone-mapping selector.
  - `sky-rig.ts`: the Poly Haven HDRI path. Its HDR upload is device-pending.
  - `car-materials.ts`: physical paint behind a flag.
  - `future-layer.ts`: the facelift behind a flag.
  - `render-scale.ts`, and the worklet render runtime.
- **Text tools for Slop's canvas textures.** The repo already has `world/pixel-font.ts`, `world/lettering.ts` and `world/signage.ts`, which can replace the canvas-drawn plates, sign blades and bus destinations.
- **Unrelated.** The lobby's known stall at 75% during `compileAsync` (`worklet-rendering.md`) is separate from this lane, but D4 has to survive it.

### 2.4 One GPU device: React Native Skia 3 and react-native-webgpu (verified 2026-10-26)

- **The article** (https://wcandillon.dev/article/hello-graphite-performance, 2026-10-26):
  - React Native Skia 3.0 renders with Skia Graphite on Dawn. Recordings are made on a thread pool and submitted automatically, so the UI thread is free.
  - Measured on iPhone 14 Pro: a Reanimated animation next to the canvas held about 120 fps at every scene size in v3. In v2 it fell to 4.3 fps at 48K rectangles.
  - Graphite uses fewer, more general pipelines that can be compiled ahead of time, and on Dawn they can be persisted to disk. Using them to shorten time to first frame is still in progress.
  - Skia 3 shares the GPU device and resources with WebGPU libraries such as three.js. The article promises details in a part 2.
- **nyc-mon already runs Skia 3.** `react-native-skia` 3.6.1 is installed, with `@shopify/react-native-skia` aliased to it (`pnpm-workspace.yaml`). npm `latest` is 3.8.0 (G10).
- **The interop API exists in what is installed.**
  - Skia 3.6.1:
    - `Skia.getNativeDevice()` returns Graphite's `WGPUDevice` pointer.
    - `Skia.Surface.MakeFromGPUTexture(texture)` draws straight into a WebGPU texture. The texture needs RENDER_ATTACHMENT usage, plus TEXTURE_BINDING to be sampled, and the surface must be flushed with `flush()` before the frame that samples it.
    - `Skia.Image.MakeImageFromGPUTexture` and `MakeGPUTextureFromImage` go the other way.
  - react-native-webgpu 0.16.0: `importDevice(pointer)` returns a `GPUDevice` on Skia's device, and `adoptTexture(pointer)` adopts a texture Skia made.
  - three 0.186.1: `WebGPURenderer` accepts `parameters.device` (`build/three.webgpu.js` ~L87169–87210), and the backend handles textures flagged `isExternalTexture`. Confirm the public wrapper class in the installed source before using it.
- **nyc-mon uses none of it today.**
  - `packages/ui/gpu/gpu-store.ts` (~L34–47) requests its own adapter and device for TypeGPU.
  - `game-render.ts` (~L288) constructs the `WebGPURenderer`; record whether it passes a `device`.
  - Skia's Graphite device is separate again.
- **Consequence.** One device lets Skia draw Slop's canvas textures straight into textures that three samples: no copy, no DOM. It also lets TypeGPU, three and Skia share resources.
- **Not claimed.** That three's pipelines, through react-native-webgpu, get the persisted-pipeline gains Skia gets. Also not claimed: that Skia's recording threads and the worklet render runtime are safe on one device. Phase 0 measures both.

---

## 3. Goal and non-goals

**Goal.** One new opt-in master flag, `EXPO_PUBLIC_WORLD_PHYSICAL` (off by default, same truthy table as the other lanes). With it on, on iPhone 17 and iPad Pro hardware, the Harlem tile renders with Slop's:

- output, light rig and post;
- facade, street and road materials;
- lofted cars and street lights;

and then the facelift on top, at frame times inside the G6 budget. With it off, the build is byte-identical to `7ba25e2`.

**Non-goals.**
- Changing the geography or data source.
- Rewriting the traffic sim. `vehicle-sim.ts` stays the sim of record; Slop's `traffic.js` is a behaviour reference, and gaps are filed as issues.
- Audio (G7).
- Slop's helicopter, cyclist and on-foot modes.
- Caller and Mon shading (G1).
- Payload and CMS for AdSurfaces.
- Train and transit assets (creator-owned).

---

## 4. Decision gates (stop and ask Mike)

| Gate | Question | Default if Mike says "your call" |
|---|---|---|
| **G1** | Caller and Mons: keep cel shading inside a physically lit city, go physically lit, or a hybrid (cel ramp with PBR environment light)? | Leave `cel-rig.ts` untouched. Deliver side-by-side device captures of all three at two bookmarks |
| **G2** | Time of day: ship Slop's four presets, keep D17's fixed dusk, or map them onto `look.ts` morning/dusk/night? | Four presets, `twilight` as the default (closest to D17's canon dusk), selection held in Zustand |
| **G3** | Sky source: Slop's procedural `SkyMesh` baked to PMREM, or the HDRI `sky-rig.ts` path? | `SkyMesh`. It matches Slop and skips the half-float HDR upload that `sky-rig.ts` flags as device-pending |
| **G4** | Devices and frame rate: is the Duo a floor tier or out of the matrix? Lock 60 fps or allow 120 on the ProMotion displays, per device? | Duo kept as `low` with the current look. 60 fps locked on iPhone 17; 120 offered on iPad Pro only if D3 numbers allow |
| **G5** | Any Phase 0 probe renders black or corrupt on iPhone 17 or iPad Pro hardware | Stop. Report the bisect (§8, Phase 0) and propose a fix or workaround. No silent fallback |
| **G6** | Budgets: draw calls (12 today), GPU memory and frame time per tier | Propose numbers from Phase 0 and Phase 1 measurements. Nothing ships over budget |
| **G7** | Port Slop's engine and ambience synth through `react-native-audio-api`? | Out of this lane |
| **G8** | Flip `EXPO_PUBLIC_WORLD_PHYSICAL` to default-on | Only after Mike signs off on D2 frames from both devices |
| **G9** | One GPU device: run Skia, TypeGPU and three on Skia's Graphite device | Adopt only if the `shared` and `skiatex` probes pass on both devices and both runtimes. Otherwise keep separate devices and draw the textures with `pixel-font.ts` and `lettering.ts` |
| **G10** | Bump `react-native-skia` from 3.6.1 to 3.8.0 | No bump in this lane. Read the changes between the two versions and report anything that touches interop, threading or pipeline caching |

---

## 5. Spec

### 5.1 One flag, one pipeline

- `EXPO_PUBLIC_WORLD_PHYSICAL` is the master flag. It absorbs the parts of the `SKY_RIG`, `PBR`, `GLASS`, `CAR_PBR` and `POST` lanes it needs. It does not delete those lanes.
- Extend the `post/pipeline.ts` mount with the SSR and grade stages from Slop. Do not add a second `RenderPipeline`.
- Keep the flag-off invariant: `renderer.render` and every existing snapshot test stay byte-identical.
- **One GPU device (G9).**
  - Under the flag, the renderer factory gets its device from `importDevice(Skia.getNativeDevice())` and passes it to `new THREE.WebGPURenderer({ device })`.
  - `gpu-store.ts` takes the same device instead of calling `requestAdapter()` and `requestDevice()`. It uses the init-from-device API cited from the installed `typegpu` 0.12.7 source.
  - With the flag off, today's device path is unchanged.

### 5.2 Output and light rig (Phase 1)

- **Output.** `outputColorSpace = SRGBColorSpace`, with `ACESFilmicToneMapping` applied once by the `RenderPipeline`, as in `post-processing.js`. Exposure, white balance, contrast, saturation, vibrance, split-tone and vignette are ported from `LOOKS` and `outputNode`, with every constant moved into tokens (§5.6).
- **Renderer.** Set `reversedDepthBuffer: true`. Apply the `StorageInstancedBufferAttribute` swap only when `renderer.backend.isWebGPUBackend`.
- **Sky (G3 default).**
  - `SkyMesh` scaled to contain the camera.
  - The reversed-depth vertex fix from `lighting.js`.
  - Bake to PMREM without the sun disc, and reuse the render target on preset change.
  - Port the aerial fog node (`createAerialFogNode`).
  - `scene.background = null`.
- **Sun.** `SunLight` with two cascades, registered the way `lighting.js` does it (`registerNode`, or `renderer.library.addLight`). Tile size comes from the tier (§5.7) and `device.limits.maxTextureDimension2D`. Use `normalBias` 0.05 and the altitude-scaled far plane.
- **Fill and clustered lights.** A `HemisphereLight` per preset. `ClusteredLighting`, sized from the tier.
- **Presets.** Per G2. Each preset is a typed table and drives the ported `cityUniforms`.
- **MRT and SSR.** Port the `metalRough` packing and roughness mask exactly, then the SSR settings per tier.

### 5.3 Materials (Phase 2)

- **Class mapping.** Map every `BuildingClass` in `city-dataset.ts` to one Slop family: pre-war brick, brownstone, limestone/terra cotta, or curtain wall. Valdrada STYLE 12 `PROJECT_BRICK` (the `nycha` class) maps to brick with the facelift kit. The table goes in the handoff, with each Valdrada field cited.
- **Facade inputs.** Slop's facade graphs read per-box local coordinates, floor height, window width, a seed and a corner pier (`facadeCell`, `createFacadeBoxes`). `city-mesh.ts` writes walls into merged buffers, so add the vertex attributes these graphs need. Write an ADR on the attribute layout, its memory cost and its draw-call effect.
- **Interiors.** Port `evaluateApartmentInterior`, including the drapes and the pixel-footprint fade. This replaces the `glass.ts` interior path while the flag is on.
- **Canyon AO.** `canyonSkyAONode` hard-codes Central Park bounds. Drive the open-sky term from nyc-mon's park and area polygons, or drop that term, and say which.
- **Roads.**
  - Port `roadPuddleField`, `roadWetMasks` and the road, sidewalk and curb materials.
  - Wetness comes from the preset.
  - Road paint is generated from `living-city/topology.ts` lanes, using the same principle as `road-paint.js`, so markings sit where traffic actually drives.
- **Detail.** Port the fire escapes onto D18's walk-ups. Port the `Quadtree` detail streaming only if G6 numbers ask for it; the tile is small.
- **Culling.** Port the `scene-culling.js` chunking and shadow proxies for instanced props.
- **No DOM: Skia draws the textures.** Slop's canvas-drawn textures (plates, sign blades, bus destinations, billboards) are drawn by Skia straight into WebGPU textures on the shared device, then sampled by three as external textures.
  - Each texture is created with `RENDER_ATTACHMENT | TEXTURE_BINDING` and drawn through `Skia.Surface.MakeFromGPUTexture(texture)`.
  - Call `flush()` before the frame that samples it, and `flush(true)` if the `skiatex` probe shows a stale frame.
  - Glyph data comes from the repo's `pixel-font.ts` and `lettering.ts` where it already exists. Skia text uses bundled fonts only.
  - If G9 rules out the shared device, fall back to bitmaps from `pixel-font.ts`, `lettering.ts` and `signage.ts`.
  - Nothing touches `document`.

### 5.4 Vehicles (Phase 3)

- Port `LoftGeometry` usage, `BODY_SPECS` (sedan, suv, bus) and `buildCarGeometry` / `buildCarProxyGeometry` into `living-city/`. Add one asset-registry recipe per `VEHICLE_KINDS` entry, ranked above `proc:box-car`. The box car stays as the fallback recipe.
- Port `createLoftedCarMaterial` with its per-instance `paintColor` and `carState` attributes. Feed both from the vehicle snapshot (`VSNAP`). Paint colours come from tokens. The taxi sign gates on the taxi kind, not on a colour test.
- Headlights and taillights:
  - Port the `HEADLIGHTS` table as start values.
  - The nearest N vehicles (tier) get real `SpotLight`s in the clustered path; the rest get emissive lamps that bloom.
  - Port `createCarFlareMaterial` for night flares.
- Prove the ported vehicle code builds and draws **on the worklet runtime** (`worklet-host.ts`). That is the exact blocker that left the cars as boxes.

### 5.5 Futuristic facelift (Phase 4)

The approved direction (MOBILE_WORLD_PR_PACK.md, 2026-10-13) is retargeted from the cel world onto the physical one. It stays additive, is keyed by stable building id, and is reversible under `EXPO_PUBLIC_WORLD_FUTURE`. Each element is restated for PBR:

| Element | Physical read |
|---|---|
| Refined brick and concrete palettes | New tokens on the §5.3 families; the brick bond and relief stay |
| Charcoal window framing | Painted-aluminium frames: dielectric, roughness from the handoff |
| Modular facade panels | A facade-material variant with panel joints from `gridLine`-style AA lines |
| Planted balconies and roof gardens | Existing foliage path, lit by the new sun and sky |
| Vertical architectural lighting | Emissive strips above the bloom threshold, so they glow now |
| Upgraded entrances | Lit canopies and glazing through the shop-glazing path |
| LED AdSurfaces | Emissive brand gradients, **no logos or lettering**, animation off under Reduce Motion |
| Neon roofline trims | Brand 400/500 tokens, above the bloom threshold |
| LED streetlights and royal kerb light lines | Clustered lights with a cooler colour than sodium, plus emissive kerb strips |

Rules for the facelift:

- **Selectivity.** It stays believable and lived-in, not uniform neon. The handoff proposes a density per block type with captures, and Mike approves it inside G6.
- **FUT-01 is still open.** No NYCHA-specific claim keys on the OSM/Valdrada class until the verified NYCHA dataset cross-check lands.

### 5.6 Tokens

- Every colour Slop hard-codes becomes a named token in `packages/theme/tokens.ts`: preset sun, sky, hemisphere and fog colours, paint colours, lamp colours and facade tones.
- Physical constants (intensities, densities, metres) become named constants with units in a typed `world/physical-look.ts`, marked "Slop measured" or `TODO(tune)`.
- No hex outside `tokens.ts`.

### 5.7 Tiers (Phase 5)

Every value below is a **start** value. F1 replaces each one with a measured value or keeps it with a measurement.

| Setting | iPhone 17 (`phone`) | iPad Pro (`high`) | Slop source |
|---|---|---|---|
| Resolution | `render-scale.ts` controller; record the floor | Same | `main.js` fixes pixel ratio at 1.0 on desktop |
| Sun shadow | 2 cascades, 2048 px tiles (atlas ≈ 32 MiB at 4 bytes/texel) | 2 cascades, 3072 px tiles if the limit allows (≈ 72 MiB) | `lighting.js` tile rule |
| SSR | Off first, then a 0.5-resolution trial against the G6 budget | 0.5 resolution, quality 0.25, `binaryRefine` | `main.js` |
| Bloom | 0.5 resolution | 0.5 resolution | `post-processing.js` |
| Clustered lights | Max 128 | Max 256 | `main.js` |
| Real headlight spots | Nearest 8 vehicles | Nearest 24 vehicles | `vehicle-lights.js` |
| Interior mapping | Full, with Slop's pixel-footprint fade | Full | `evaluateApartmentInterior` |
| Frame target | Per G4 | Per G4 | n/a |

- Record the exact device model, chip and iOS version from the device in every report.
- Thermal state comes from the existing `WORLD_THERMAL` lane, where it reports on iOS. Otherwise record the thermal state Xcode shows, and say which source it came from.

### 5.8 Licence and credit

- **File headers.** Each ported file opens with: `Adapted from mrdoob/slop-newyork @ be65d0a, js/<file> <function> (MIT, © 2026 Mr.doob)`. Where Slop itself credits a three.js addon (for example `SkyscraperGenerator.js`, `LoftGeometry.js`, `CarGenerator`), name that too.
- **Notices.** Add the full MIT text to `docs/licenses/` and a notice section to `city-world.md`.
- **Credit row.** Add a Legal & credits row (`settings-content.tsx`, `MapAttribution.tsx` if it lists software) reading "Rendering techniques adapted from Slop New York by Mr.doob (MIT)", linked to the repo.
- **Data.** No Slop geodata is imported, so its ODbL notice does not carry over. Say so in the notice.

### 5.9 Decisions

- Add a new `DECISIONS.md` entry. Mike, 2026-10-26: the Game world matches Slop New York's physically lit look with the futuristic facelift on top. It supersedes D17's cel bands and "no bloom" for the city. D17's dusk canon carries into G2.
- Mark `toon-look-spec.md` "superseded for the city". It stays in force for characters pending G1.
- Update `city-world.md` §react-native-webgpu rules with the Phase 0 device results. The old simulator rule stays quoted as history.

---

## 6. Skills

Every skill below is named on purpose and produces the output listed. A run that skips one says why in the handoff.

The `design:*` and `engineering:*` skills are Claude plugin bundles. In Claude Code, only `/code-review` is bundled, and `frontend-design` comes from the official marketplace. Where a skill cannot be loaded:

- apply its method;
- write its output anyway;
- say how it ran in the output header;
- never claim a slash command ran when it did not.

### 6.1 UX / design sequence (fixed order)

| # | Skill | Output | Done when |
|---|---|---|---|
| 1 | `design:user-research` | `docs/design/research/slop-grade-city-recognition.md` | Study plan written. People who know 125th Street judge current vs new frames at fixed bookmarks on two questions: "is this Harlem?" and "is this a believable near future?" Covers method, participants and pass criteria |
| 2 | **Mobbin, per screen** (§6.2) | `docs/design/research/slop-grade-city-mobbin.md` | Every screen in §6.2 has references or an explicit "no relevant pattern" |
| 3 | `design:design-system` | Tokens in `packages/theme/tokens.ts`; a city section in `docs/DESIGN_SYSTEM.md` | Every preset, paint, lamp and facelift colour is a token with a measured contrast note where it sits under UI. No raw hex |
| 4 | `design:ux-copy` | `docs/COPY_DECK.md` entries | Labels for time-of-day presets and quality tiers, the lobby line while shaders compile, and the MIT credit line |
| 5 | `design:design-handoff` | `docs/design/handoff/slop-grade-city.md` | Slop technique → Slop file and function → nyc-mon file → tier → parameters table. Also the class → family table, the facelift element table with density, and the camera bookmarks |
| 6 | `design:accessibility-review` | `docs/design/review/slop-grade-city-a11y.md` | Reduce Motion stops cloud drift and LED animation. No content flashes more than three times a second (WCAG 2.3.1). HUD chips keep contrast over the brighter frames. Settings targets meet WCAG 2.5.8 |
| 7 | `design:design-critique` | `docs/design/review/slop-grade-city-critique.md` | iPhone 17 and iPad Pro frames at every bookmark and shipped preset, side by side with Slop frames at the matching preset, critiqued against Lynch's five elements and the §1 designers |
| 8 | `code-review` (`/code-review`) and the CodeRabbit loop | Findings fixed in each PR | Every finding fixed and retested before re-request |
| 9 | `frontend-design` (official marketplace plugin) | Graphics settings row; HUD time-of-day control and street chips | Built on `@acme/ui` primitives (`packages/ui/html` on web). State in Zustand, never bare `useState`/`useReducer`. Stories updated |

`skills/impeccable` (https://github.com/pbakaus/impeccable) runs its audit pass on #9's UI before #7.

### 6.2 Mobbin per screen

Follow the method in `docs/design/research/game-lobby-mobbin.md`: use the Mobbin MCP `search_screens` and `search_flows`, download each screenshot and view it before writing. References inform hierarchy and states, never pixels.

| Screen | File | Search for | Output |
|---|---|---|---|
| Game lobby, world loading | `features/game/lobby/GameLobbyScreen.tsx` | Loading while shaders compile; long first loads in games | 3–5 references, take/reject, plus states (compiling, slow, failed) |
| Graphics settings | `features/settings/settings-content.tsx`, per `graphics-settings-surface.md` | Quality tiers and time-of-day pickers in mobile games | 3–5 references, take/reject |
| Game HUD | `features/game/GameScreen.tsx` | Street-name chips and time-of-day toggles in driving and city games | References, or "no UI change" |
| Legal & credits | `settings-content.tsx`, `MapAttribution.tsx` | Open-source credit lists with mixed code and data licences | 3–5 references, take/reject |

If any of these screens changes layout on iPad Pro, read `skills/mikevocalz-foldable-layouts/SKILL.md` first. Tablets keep the physical right rail.

### 6.3 three.js and game skills (repo copies; upstream in each `SOURCE.md`)

- **`skills/threejs-skills/`** (https://github.com/CloudAI-X/threejs-skills):
  - `threejs-fundamentals`: colour management, linear vs sRGB output, units.
  - `threejs-lighting`: `SunLight` cascades, hemisphere fill, clustered lights, PMREM.
  - `threejs-postprocessing`: `RenderPipeline`, MRT, SSR, bloom, grade.
  - `threejs-shaders`: TSL facade, road and interior graphs.
  - `threejs-materials`: `MeshStandardNodeMaterial` and `MeshPhysicalNodeMaterial` for paint and glass.
  - `threejs-textures`: PMREM, and the canvas-texture replacements.
  - `threejs-geometry`: lofted cars, facade attributes.
- **`skills/three-agent-skills/three-best-practices`** (https://github.com/emalorenzo/three-agent-skills): instancing, material reuse and pipeline compile cost, disposal.
- **`skills/awesome-gamedev/`** (https://github.com/gamedev-skills/awesome-gamedev-agent-skills):
  - `performance-optimization`: frame budget, CPU/GPU split.
  - `threejs-scene-setup`.
  - `camera-systems`: the critique bookmarks.
  - `game-feel`: headlight and lamp response.

### 6.4 Engineering skills

- **`engineering:architecture`:** three ADRs.
  1. Renderer mode: overturning the simulator rule with Phase 0 data.
  2. Facade attribute layout.
  3. Vehicle recipe and worklet bundling.
  4. One GPU device for Skia, TypeGPU and three (G9).
- **`engineering:debug`:** Phase 0 and any black or corrupt frame. Reproduce, isolate, fix.
- **`engineering:testing-strategy`:** the §9 plan in the first PR body, written before tests.
- **`engineering:documentation`:** rewrite `city-world.md` (pipeline, rig, materials, notices) and update `DEVICE_CHECKS.md`.
- **`engineering:tech-debt`:** list the flags this lane makes redundant. Retire none without G8.
- **`skills/mattpocock/`** (https://github.com/mattpocock/skills): typing the ported JS. Use exhaustive unions for presets, families and vehicle kinds.
- **`skills/margelo/api-design`:** every exported `@acme/*` surface this lane touches (repo law R5).

### 6.5 Performance and evidence

- **`skills/callstack-react-native-best-practices`** (https://github.com/callstackincubator/agent-skills): before and after on both devices.
  - Measure per bookmark: frame time and its pacing, `ThreeFrameTiming` `renderMs` and `drawCalls`, GPU memory, time to world-ready, and shader compile time.
  - Then a 10-minute soak with thermal state recorded.
  - Use Xcode's Metal frame capture and Instruments (Metal System Trace) for GPU time.
  - Measure UI-thread fps with a Reanimated animation running next to the world canvas, the method from the Graphite article. That way the HUD and Skia overlays are measured while the city renders.
  - One cherry-picked run is not a measurement.
- **`skills/agent-device`** (https://github.com/callstackincubator/agent-device): scripted bookmark captures where it supports the hardware. Otherwise use manual captures, labelled manual.
- **`skills/callstack-react-native-testing`:** tests for the settings and HUD UI.

### 6.6 Native gate (Margelo)

This lane adds no native code. **If** a probe or a budget points to native code, stop and tell Mike first. Then load `skills/margelo/build-nitro-modules`, `skills/margelo/cpp` and `skills/margelo/swift` (plus `kotlin` for Android). Any C++ is Nitro HybridObjects, with Nitrogen output committed. Source: https://github.com/margelo/react-native-skills/tree/main/skills

### 6.7 Prose and review

- **`skills/no-ai-slop`** (https://github.com/petergyang/no-ai-slop): every doc, comment, ADR and PR body.
- **`ecc:*`** (https://github.com/WorldFlowAI/everything-claude-code): coordination and the review loop.
- **CodeRabbit** (https://github.com/coderabbitai): independent review. Fix everything, retest.

---

## 7. Subagents

Lanes follow the repo directive: A is research and design, E is game systems, F is verification and accessibility.

| Subagent | Owns | Skills | Outputs | Starts | Done when |
|---|---|---|---|---|---|
| **F0 Device truth** | Phase 0 probe matrix on iPhone 17 and iPad Pro | `engineering:debug`, `threejs-fundamentals`, `threejs-postprocessing`, §6.5 | `DEVICE_CHECKS.md` rows; ADR 1 draft | Immediately | Every probe recorded on both devices, on both the JS and worklet runtimes; G5 answered if needed |
| **A1 Research and design** | §6.1 #1–5, Mobbin | §6.1, §6.2 | Those docs | Immediately, in parallel with F0 | G1, G2, G3 framed with captures; handoff reviewed by F3 |
| **E1 Light and output rig** | §5.2 | §6.3 lighting, postprocessing, fundamentals | Rig, presets, pipeline extension | After F0 clears Phase 0 | N1–N3 green; D2 frames at one bookmark |
| **E2 Materials** | §5.3, §5.6 | §6.3 shaders, materials, geometry; ADR 2 | Facades, interiors, roads, paint, fire escapes, culling | After E1 | N4, N8 green; draw calls inside G6 |
| **E3 Vehicles and street light** | §5.4 | §6.3 geometry, materials, `game-feel`; ADR 3 | Lofted fleet, lights, flares | After E1, in parallel with E2 | N5, N6 green; D5 |
| **E4 Facelift** | §5.5 | §6.1 #3, #5; §6.3 materials | Retargeted `future-layer.ts` | After E2 | Density approved by Mike; flag off byte-identical |
| **E5 Shared device and Skia textures** | §5.1 one-device bullet, §5.3 Skia textures, G9, G10 | `threejs-textures`, `threejs-fundamentals`, `engineering:architecture` (ADR 4), `engineering:debug` | Renderer and `gpu-store` device wiring; the Skia texture bridge | After F0's `shared` and `skiatex` probes | N10 green; D7 on both devices |
| **F1 Performance and tiers** | §5.7, G4, G6 | §6.5 | `tier.ts` rows, performance report | Continuous from E1 | D3 on both devices; every start value replaced or defended |
| **F2 Licence and docs** | §5.8, §5.9 | `engineering:documentation`, §6.1 #4, #9 | Notices, credit row, decisions, `city-world.md` | After E3 | Every ported file has its header; G8 packet ready |
| **F3 Review and prose** | §6.1 #6–8 | `design:accessibility-review`, `design:design-critique`, `/code-review`, no-ai-slop, CodeRabbit | Review and critique docs, resolved threads | Last, and on every PR | Zero open findings |

Hand-offs between subagents are files. Each subagent ends with a status that separates device-verified, simulator or browser-verified, node-verified and not verified.

---

## 8. Phases (one draft PR each)

0. **PR A, device truth.** Gates everything else.
   - Run react-native-webgpu's `PostProcessing.tsx` example on iPhone 17 and iPad Pro as the control.
   - Add `EXPO_PUBLIC_WORLD_PROBE=<name>`. Each probe isolates one feature on the Harlem tile:
     - `srgb`: sRGB output
     - `aces`: `RenderPipeline` with ACES
     - `shadow1` and `shadow2`: `SunLight` with 1 and 2 cascades
     - `bgnull`: `scene.background` null vs `Color`
     - `pmrem`: `SkyMesh` baked to PMREM
     - `mrt`: the three MRT attachments
     - `ssr`, `bloom` and `clustered`
     - `storage`: the `StorageInstancedBufferAttribute` swap
     - `msaa`: `storeMultisampledColorBuffer = false`
     - `shared`: three, TypeGPU and Skia on one device from `importDevice(Skia.getNativeDevice())`, with three rendering on the worklet runtime while Skia records on its own threads
     - `skiatex`: a Skia surface made with `MakeFromGPUTexture` draws a plate and a sign blade, and three samples that texture in the same frame. Run it after `flush()`, then again after `flush(true)`
     - `pipecache`: time to world-ready on a cold launch and on a second launch, to measure (not assume) whether Dawn's persisted pipelines help three's pipelines the way they help Skia's
   - Run each probe on the JS runtime and on the worklet runtime.
   - Record non-black yes/no, a capture and the frame time for each.
   - For any failure, bisect the obvious suspects before G5: a missing `context.present()` after `pipeline.render()`, the canvas format and alpha mode, the depth format with `reversedDepthBuffer`, and the MSAA store mode.
1. **PR B, light and output rig** (§5.2).
2. **PR C, materials** (§5.3, §5.6).
3. **PR D, vehicles and street light** (§5.4). Can run in parallel with PR C after PR B.
4. **PR E, facelift retarget** (§5.5).
5. **PR F, tiers and performance** (§5.7).
6. **PR G, UI, docs, licence, decisions** (§6.1 #9, §5.8, §5.9), and the G8 packet.

---

## 9. Tests and acceptance

### Node (vitest), all green before any PR leaves draft

- **N1** Flag off is byte-identical: the existing render-snapshot and lane-guard tests pass unchanged.
- **N2** Presets are pinned. Each preset table resolves only through tokens, and a test fails on any hex literal outside `tokens.ts` in the touched files.
- **N3** Flag on gives: `SRGBColorSpace`, `ACESFilmicToneMapping`, shadows enabled, `scene.background === null`, exactly one `RenderPipeline`, and SSR and bloom per tier.
- **N4** Facade attributes are deterministic per building id. Port the cases from Slop's `tests/facade-projection.test.cjs` and match its numbers on the same fixtures.
- **N5** Lofted bodies: each `BODY_SPECS` kind builds closed lofts. Triangle counts per kind are pinned, and instance attribute sizes (`paintColor` vec3, `carState` vec4) are pinned.
- **N6** Vehicle lights: port the cases from Slop's `tests/vehicle-lights.test.cjs` (placement, aim, toe-out).
- **N7** Tiers: `phone` and `high` rows pinned; parsing defaults unchanged.
- **N8** No DOM: every ported module imports and runs in node with no `document`, `window` or `localStorage` global.
- **N9** `tsc --noEmit` clean; lint clean.
- **N10** Shared device. Use react-native-webgpu's mock exports (`importDevice`, `adoptTexture`). Under the flag, the renderer factory passes the imported device and `gpu-store` reuses it. With the flag off, the current device path is unchanged.

### Device (iPhone 17 and iPad Pro hardware, both required)

- **D1** The Phase 0 matrix is complete on both devices and both runtimes.
- **D2** Frames at every bookmark and shipped preset, beside Slop frames at the matching preset. Bookmarks are defined in the handoff: Apollo marquee from 125th Street, 125th looking east and west, a residential side street, a NYCHA block, and a rooftop view.
- **D3** Frame time and pacing at each bookmark, peak memory, and a 10-minute soak with thermal state, all inside the G6 budget.
- **D4** The lobby completes shader warm-up with honest progress, with no stall at the known 75% point.
- **D5** Lofted cars draw on the worklet runtime. Headlights and flares show at night. No box car unless forced.
- **D6** Reduce Motion is honoured. Nothing flashes more than three times a second.
- **D7** Skia-drawn plates and signs show in the scene on both devices, with no stale or torn frames. Skia UI overlays hold the display rate while the city renders, measured as in §6.5.

---

## 10. Rules

- **No invented APIs.** Every three.js, react-native-webgpu and TypeGPU call cites the installed file and symbol it relies on. Every Slop port cites file and function. Stop and ask rather than guess an API shape.
- **Gates.** `tsc --noEmit` is a hard gate.
- **State.** Zustand only. Bare `useState`/`useReducer` are banned; React 19's `useOptimistic` and `useActionState` are fine.
- **Native.** C++ is Nitro, with Nitrogen output committed (§6.6). No native code in this lane without Mike.
- **Colour and UI.** No hex outside `packages/theme/tokens.ts`. Semantic UI from `@acme/ui` (`packages/ui/html` on web). No Tamagui or Bento.
- **Scope.** No dependency upgrades, merges or deploys. Draft PRs only.
- **Evidence.** Keep device, simulator, browser and node results separate in every report. A simulator result never closes a device gate.
- **No AI slop.** No placeholders, stubs, hallucinated packages, invented data, narrating comments, speculative abstractions, assertion-free tests or unverified "should work" claims. The repo must read as if a careful engineer wrote it.

---

## 11. Deliverables

- PRs A–G (draft).
- ADRs 1–4.
- New code:
  - `world/physical-look.ts`
  - tokens in `packages/theme/tokens.ts`
  - the ported material, rig and vehicle modules, each with its MIT header
- Docs:
  - `docs/design/research/slop-grade-city-recognition.md` and `slop-grade-city-mobbin.md`
  - `docs/design/handoff/slop-grade-city.md`
  - `docs/design/review/slop-grade-city-a11y.md` and `slop-grade-city-critique.md`
  - the new `DECISIONS.md` entry
  - `city-world.md` rewrite
  - `DEVICE_CHECKS.md` rows
  - the performance report
  - the MIT notice in `docs/licenses/`
  - the credit row
- The roster block appended to `reference-roster.md`.
- A G8 packet: D2 frames from both devices, D3 numbers, and the open-gate list.

---

## 12. References

- Slop New York: https://github.com/mrdoob/slop-newyork · live: https://mrdoob.github.io/slop-newyork/ · Slop Cities remixes: https://github.com/zz85/slop-cities
- three.js:
  - https://github.com/mrdoob/three.js
  - r186 city generators: https://github.com/mrdoob/three.js/tree/r186/examples/jsm/generators/city
  - TSL wiki: https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language
  - WebGPU post-processing manual: https://threejs.org/manual/en/webgpu-postprocessing
- react-native-webgpu:
  - https://github.com/wcandillon/react-native-webgpu
  - post-processing example: https://github.com/wcandillon/react-native-webgpu/blob/main/apps/example/src/ThreeJS/PostProcessing.tsx
- React Native Skia 3:
  - *Hello, Graphite: Performance*: https://wcandillon.dev/article/hello-graphite-performance
  - docs: https://shopify.github.io/react-native-skia/
  - npm: https://www.npmjs.com/package/react-native-skia
  - Skia: https://skia.org/
- The simulator rule's source: https://github.com/vietgangzz/vg-demos-all (`README.md` L23)
- WebGPU spec: https://www.w3.org/TR/webgpu/ · Dawn: https://dawn.googlesource.com/dawn · Metal: https://developer.apple.com/metal/
- Devices: iPhone 17 specs https://www.apple.com/iphone-17/specs/ · iPad Pro specs https://www.apple.com/ipad-pro/specs/
- Shading:
  - SIGGRAPH 2013 PBS course: https://blog.selfshadow.com/publications/s2013-shading-course/
  - Lagarde: https://seblagarde.wordpress.com/
  - Interior Mapping: https://www.proun-game.com/Oogst3D/CODING/InteriorMapping/InteriorMapping.pdf
  - Quilez: https://iquilezles.org/
- Traffic (IDM): https://traffic-simulation.de/
- Valdrada: https://github.com/mkturkcan/valdrada
- TypeGPU: https://docs.swmansion.com/TypeGPU/ · Nitro: https://nitro.margelo.com/
- Skills:
  - Margelo: https://github.com/margelo/react-native-skills/tree/main/skills
  - Callstack: https://github.com/callstackincubator/agent-skills · agent-device: https://github.com/callstackincubator/agent-device
  - three.js: https://github.com/CloudAI-X/threejs-skills · https://github.com/emalorenzo/three-agent-skills
  - Game dev: https://github.com/gamedev-skills/awesome-gamedev-agent-skills
  - Matt Pocock: https://github.com/mattpocock/skills
  - Impeccable: https://github.com/pbakaus/impeccable
  - no-ai-slop: https://github.com/petergyang/no-ai-slop
  - everything-claude-code: https://github.com/WorldFlowAI/everything-claude-code
  - CodeRabbit: https://github.com/coderabbitai
- Designers and studios: https://sydmead.com/ · https://mitpress.mit.edu/9780262620017/the-image-of-the-city/ · https://standardsmanual.com/ · https://www.pentagram.com/work/walknyc · https://territorystudio.com/ · https://www.imageworks.com/node/1371 · https://chromosphere.studio/
- Dev agencies: https://swmansion.com/ · https://www.callstack.com/ · https://margelo.com/ · https://www.utsubo.com/ · https://activetheory.net/ · https://lusion.co/ · https://14islands.com/
