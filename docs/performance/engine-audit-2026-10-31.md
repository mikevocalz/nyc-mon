# Engine audit — 2026-10-31 (Phase 0, PR 0 scope)

Writing-block §17 PR 0: verified current state of the repository, active
Three.js version, patches, graphics architecture, hardware availability and
bottlenecks. Assembled from five parallel codebase audits plus test runs on
`pixy-branch` @ `e217c528` (one handoff commit ahead of `main` @ `932fbaf0`).
Everything below was read or executed in this tree today; anything not
re-executed is labelled with the date and device that produced it.

## 1. Verified dependency state

- `three` resolves once: **0.187.0** for every workspace (`pnpm-workspace.yaml:172`,
  catalog-driven; `@types/three` 0.187.0 matches).
- `typegpu` **0.12.9**, `@typegpu/three` **0.12.2**, `@typegpu/gl` **0.12.8**,
  `unplugin-typegpu` 0.12.5 — peer ranges satisfied.
- `react-native-webgpu` **0.19.2** + `react-native-webgpu-dawn` 157.0.0.
- `react-native-skia` **3.8.1** (also aliased as `@shopify/react-native-skia`),
  `canvaskit-wasm` 0.41.1.
- No `@react-three/*`, no `pixi`/`@pixi/*` installed anywhere.
- No renderer-critical version drift. Two cosmetic drifts: `apps/mobile`'s
  uniwind pulls `@expo/metro-config@57.0.8` (metro 0.84 side-tree; styling only)
  and the catalog comment still cites skia 3.6.1.
- Node `>=24.15 <26` (`.nvmrc` 24.15.0), pnpm 12.8.1.

## 2. Patch state — and the r187 gap

Twelve patches wired through `patchedDependencies`, all stamped in the
lockfile. None touch `three`, `typegpu`, `@typegpu/*` or `react-native-webgpu`.
The Oct-31 handoff's "dropped patches (upstreamed)" is only half true — two
verified test failures on this tree:

| Test | Verdict today | Cause |
|---|---|---|
| `world/sun-shadow-normal-bias.test.ts` | FAIL | r187 `examples/jsm/lights/SunShadowNode.js:126` still uses `normalWorld` for the shadow normal bias. The r186 patch was **not** upstreamed; the bump-mapped "patchy walls" regression is back. `normalWorldGeometry` exists in r187 (`src/nodes/accessors/Normal.js:75`) so the patch forward-ports verbatim. |
| `world/shadow-pass-alpha.test.ts` | FAIL (3 of 3) | The pin asserts `REVISION === '186'`. Upstream r187 **did** land the fix (`src/renderers/common/Renderer.js:3951`, `overrideMaterial._alphaTest = material.alphaTest`) — measured today: `before.keys = 0`, casters no longer re-key. `installShadowPassAlphaTest` is inert by its own gate and can be retired; the test needs re-pinning to r187 behaviour, not the runtime fix. |
| WGSL compile / pipeline tests (see §6) | FAIL | r187 shader-graph compile regressions — exact list in §6. |
| gpu-store shared-device tests (see §6) | FAIL | Skia 3.8.1 shared-device path drift. |

Confirmed upstream fixes in r187 we no longer carry: ClusteredLightsNode
`bufferCount` (`src/nodes/accessors/Arrays.js:32`), shadow-pass alphaTest
bypass. Confirmed still-needed private-internal access (all present in r187):
`_animation`, `_nodes.nodeFrame`, `_canvasTarget`, `backend.get/has`,
`_attributes`, `renderer.library`, `renderer.lighting`, `scene.fogNode`,
`shadow.filterNode`.

r187 now warns (functional, deprecated): `physical-rig.ts:113-118,217-218` uses
`library.getLightNodeClass` / `addLight` → migrate to
`SunLight.registerNode(SunLightNode)`.

**r187 ships the GPU-driven drawing pipeline.** PR mrdoob/three.js#35191
(sunag, merged 2026-10-29 into milestone r187) is installed in this tree:
`renderer.drawingPipeline` (default `StandardDrawingPipeline`, Renderer.js:349)
plus `examples/jsm/pipelines/MeshletDrawingPipeline.js` and
`VisibilityBufferDrawingPipeline.js`. Meshlets cluster geometry into 64-tri
groups with simplified LOD, cull per-cluster on the GPU (frustum, normal cone,
two-phase occlusion against a depth pyramid), pick LOD by screen-space error
and draw indirect. It supports `InstancedMesh`, `LOD`, material groups, static
`BundleGroup`, shadow maps, clipping, alpha test and node materials
(`colorNode`, `normalNode`, `emissiveNode`, `opacityNode`, `positionNode` with
fitted bounds); unsupported objects and WebGL fall back to the regular
pipeline. A shared demo (x.com/dangreenheck, user-supplied) reports ~150 fps
on the meshlet path. This is the strongest upstream answer yet to our #1
measured bottleneck — the per-draw TSL/JSI encode floor — and to the
`InstancedMesh` uuid-keyed node-build problem §3 describes. Verification
questions before Phase 4 touches it: our `vd-instanced` custom instancing is
plain `Mesh` over `InstancedBufferGeometry` (does the meshlet path treat it as
a fallback or as instanced?); our TSL materials apply transforms inside
`positionNode` (fitted-bounds requirement); indirect-draw + compute support
under react-native-webgpu/Dawn on Android and iOS is unproven; static
`BundleGroup` support does not erase the frozen-camera-UBO rejection — only a
static bundle is eligible. Evaluation belongs in Phase 4's measured PR, not
as a drop-in.

Latent break (probe path only): `skia-texture-bridge.ts:59` calls
`MakeImageFromGPUTexture`, renamed in Skia 3.8.x to `MakeFromGPUTexture` —
silent because the interop is structurally typed; only fires under the
`EXPO_PUBLIC_WORLD_PROBE` device lanes.

## 3. Graphics architecture as built

- **One GPU device, one owner.** `packages/ui/gpu/gpu-store.ts` creates a single
  adapter/device/TypeGPU root. Under `EXPO_PUBLIC_WORLD_PHYSICAL` — now default
  ON via `physical-look.ts:24` — it imports Skia's Graphite device so three,
  TypeGPU and Skia share one Dawn device (ADR 0026). Own-device fallback logs a
  `sharedError`. Shared-device loss still treated as fatal until restart
  (`gpu-store.ts:70-84`) though Skia 3.8.1 can now re-import.
- **Two sanctioned render paths, one scene contract** (`ThreeScene<P>`):
  JS-thread `ThreeCanvas` (default; `GameScreen` mounts `paused`, every store
  write calls `invalidate()`) and the worklet render runtime
  (`EXPO_PUBLIC_WORKLET_RENDER=1`, verified rendering on-device Oct 17). three's
  internal `Animation` loop is stopped post-init — one scheduler per canvas.
  Draw body identical on both: `update → advanceNodeFrame → renderer.render →
  context.present()`.
- **Worklet pacing** is a 16 ms `setTimeout` polyfill in `'poll'` mode (can
  double-draw per display frame); `'vsync'` mode via `EXPO_PUBLIC_WORKLET_VSYNC`
  drives off the UI runtime's native frame callback.
- **Materials.** Cel shading is TypeGPU→TSL (`cel/cel-shading.ts`, `celBody`,
  `createCelMaterial` → `MeshBasicNodeMaterial`). Material lanes resolve in
  `world/index.ts:172-212`: `vd-materials` default, `pbr`/`glass`/`car`,
  lean variants, `toon`, `physical/*` (Slop port) under `WORLD_PHYSICAL`.
- **Camera.** `CityCamera` stores are the logical authority; the scene owns one
  `PerspectiveCamera`; floating origin re-bases per 256 m cell
  (`floating-origin.ts` + `render-space.ts`). No jitter, no motion vectors, no
  TAA — absence is designed-in; IGN dithering substitutes where TAA would hide
  noise.
- **Post.** One `RenderPipeline` at a time, mounted by patching
  `renderer.render` through `delegateRender` (`post/pipeline.ts:377-408` —
  flagged fragile: anything caching `render` before mount bypasses it). Legacy
  chain (SSAO→bloom→grade→FXAA) and physical chain (SSR→exposure→bloom→grade→
  ACES) are flag-separated; `compile-pass.ts` runs START compile inside the
  real MRT.
- **Instancing.** Custom `InstancedBufferGeometry` + interleaved `vdXform`
  records (`world/vd-instanced.ts`, `vd-port/furniture/pool-instancer.ts`)
  because r186 keyed `InstancedMesh` render objects on `object.uuid` — ~22 ms
  node build each per pass. Conventional `InstancedMesh` still lives in
  `street-furniture`, `street-props`, `living-city` actors, `fire-escapes` —
  the workaround is partial.
- **Dynamic resolution.** `perf/render-scale.ts` steps pixel ratio on 1.5 s
  windows (floor 0.5, provisional). Header caveat stands: it measures JS
  submission cadence, not GPU frame time.
- **Disposal.** Ordered cascade in `city-scene.ts:497-510` and
  `world/index.ts:501-521`; `releaseCanvasBuffers` frees ~100 MB of canvas
  targets three's dispose leaks; `release-uploaded.ts` (opt-in, off after an
  iPad regression) has no device-loss re-upload path.
- **Other renderers** (not the city path, real and independent):
  `MonModel3D.tsx:332` and `HatchSequence3D.tsx:182` are classic
  `WebGLRenderer`s with their own GL contexts and rAF loops on web;
  `GpuCanvas.tsx` is a TypeGPU-direct canvas.

## 4. Valdrada streaming — manifest verified at pin level

`vd-cells-manifest.ts` matches the release doc exactly: **1,692 cells**
(290 `far/`, 50 near + 50 lite, 75 + 205 `structures[/ringN]`, 1,022 ring
keys, `ring3` = 0 — Central Park, per the doc), 184 bundled home cells,
`r20261030-c98106d6` pinned in `apps/web/next.config.ts:24` and both
`apps/mobile/eas.json` profiles. SHA-256 double-verified on download and on
bundled reads; bounded 1.5 GB LRU disk cache; whole-object GETs (no client
range requests); concurrency gate 3; 20 s/90 s deadlines; unresolvable cells
degrade to far shells, never crash.

Streamer (`cells/cell-stream.ts`): screen-error want set, hysteresis eviction
(disposes geometry + render objects, never shared materials), IGN dither
fades, landmark pinning, `msPerFrame` 3–6 ms + `uploadBytesPerFrame` 6–32 MB
budgets per preset, template meshes keep pipelines warm.

Gaps (documented, not yet built): no camera-direction/velocity prefetch —
the ring is distance-only; all decode + posing on the main thread (no Worker);
colliders/pednet/traffic/spawns VGC1 decoders + 1,708 bundled packs are real
but test-only consumers; `districtId` always null; `vd-systems-manifest.ts`
unmerged; lane C structures draw nothing on web (`asset-bytes.ts` returns
null); far-tier baked bytes live in gitignored `tooling/city/.cache` (ODbL
deliberate), so pin re-hashing needs that cache or `--dry-run` publish.

## 5. Native presentation — the measured wall

Every device number in the repo is **Surface Duo 1** (`913949703467`,
Android 14, SD855/Adreno 640, 2700×1800 @ 60 Hz, release builds,
2026-10-17→19, three 0.186.1 / rn-webgpu 0.16.0). iOS entirely unmeasured.

Consensus state before r187 (present-tail §2026-10-19): best sustained config
VD_LEAN+AHB+free-run ≈ **30 fps locked** (intervalP50 33.35 ms, two-vsync
lock); `render()` p50 ~15.6–18 ms — first sub-16.7 ms crossing at p50 but
sustained 60 unreachable. The wall is per-draw TSL/JSI submit encode plus a
~14 ms JS-timer scheduling floor; the documented fix is a native vsync-driven
submit pump, not built. Present tail (fifo + two BufferQueues) is mitigated
by `EXPO_PUBLIC_GAME_SURFACE=ahb` (present p90 16–20 ms → 0.05–0.13 ms),
opt-in and un-re-verified on rn-webgpu 0.19.2. UI stage p50 7.0 ms is
76–86 % RenderThread buffer backpressure, not UI compute; Rive exonerated
(0.031 ms/frame).

Stale-vs-code flags from the audit: `backingView` renamed in 0.19.2 (code
correct, docs stale); `WORLD_PHYSICAL` flipped to default-on; Rive
repost-skip patch already landed despite the doc listing it unbuilt;
`render-scale.ts:41-45` DEVICE-PENDING comment can retire.

Do-not-revive list (all documented rejections): static render bundles /
BundleGroup (frozen camera UBO, deleted 2026-11), `rn-game-engine-next`,
`react-native-runtimes` for render, PixiJS 3D, Skia static-art controller,
present-mode/queue-depth C++ patches.

## 6. Test + CI state, run today

`pnpm --filter @acme/app test` world suite on this tree:

- **PASS baseline check:** `world/budget.test.ts` — scene build 583 ms
  (budget 1400), triangle/draw budgets hold at all three camera distances.
- **PASS streaming baseline:** `cells/cell-stream.walk.test.ts` — the
  scripted 2-minute 125th St walk on r187. Stream on: 143 shader modules,
  79 pipelines at frame 0, 139 loads / 92 evictions, residency flat by place
  (identical cells/bytes/renderObjects/draws at the same spot 60 s apart),
  **0 overBudget refusals, 0 new pipelines or shader modules after frame 0**.
  Stream off: 132 modules / 73 pipelines, flat ~152–164 draws.
- **FAIL (11 test cases verified):** `sun-shadow-normal-bias` (1),
  `shadow-pass-alpha` (3), WGSL compile regressions — `car and bus graphs`,
  `vd body material`, `every physical variant`, `mounted pipeline material`
  (4) — plus `physical + vd first frame` (71 s, budget/timeout, 1) and two
  `gpu-store` shared-device tests (2). The full world run was still in
  progress at write time: 444 pass / 7 fail at cutoff, the shadow-pin
  failures verified separately. All are §2/§3 findings; Phase 1 scope.

Known pre-existing failure elsewhere: `packages/core`
`phase1-loop.test.ts` nickname rejection (recorded in
`docs/evidence/verification/gates.md` since Oct 15).

CI (`ci.yml`) gates host tests + prebuild + typecheck/lint + city-layout;
`nycmon-world-surface-detail.yml` is the only shader gate;
`vd-cells-publish.yml` validates manifests and can publish on dispatch.
No GPU job, no device job, no benchmark job anywhere — presented-frame
metrics can never gate in CI.

`tooling/renderer-bench/` is a fairness comparator for two externally
captured JSONs — it measures nothing itself and has never seen a real
capture (PixiJS 3D closed beta). The 12 gameplay benchmarks have no registry;
~4 have any coverage (125th St walk well-trodden, district streaming
host-only, rain sim-level, Rive-while-moving incidental). Zero device
artifacts are committed — every published number lives in `/tmp` or
`~/nyc-mon-artifacts` and dies with a wipe.

## 7. Hardware availability today

- `adb devices`: **empty** — the Duo is not attached. No device baseline was
  produced in this environment and none is claimed.
- iPhone 17 Pro paired but unreachable (hardware-matrix). iOS remains
  unmeasured.
- Host-side reproducible baselines recorded above (budget gate + scripted
  125th St walk, both green on r187): host numbers only, not device evidence.

## 8. Bottlenecks ranked by measured effect

1. **Per-draw TSL/JSI submit encode** (~13–18 ms p50) + **~14 ms JS-timer
   scheduling floor** → 30 fps lock on the Duo. Fix named in docs: a native
   vsync-driven submit pump. (present-tail, Oct 18–19)
2. **r187 test fallout** — the items in §2/§6; blocks a green tree. Phase 1.
3. **Present path** — fifo + double BufferQueue; AHB flag mitigates but is
   opt-in and un-re-verified on 0.19.2.
4. **InstancedMesh uuid-keyed node builds** — ~22 ms each per pass;
   `vd-instanced` workaround covers only part of the mesh population.
5. **Streaming decode on the main thread**, distance-only prefetch.
6. **Private r186-era internals** throughout the render path — each three
   bump is a scavenger hunt (this audit exists because of one).
7. **Evidence fragility** — no committed device artifacts; numbers can't be
   re-verified without the Duo attached.

## 9. Phase 1 entry list (carried forward)

1. Re-create `patches/three@0.187.0.patch`: SunShadowNode
   `normalWorld` → `normalWorldGeometry` at the shadow normal bias.
2. Re-pin `shadow-pass-alpha.test.ts` to r187 upstream behaviour; retire
   `installShadowPassAlphaTest` after re-measuring.
3. Fix the r187 WGSL compile failures and `gpu-store` shared-device tests
   enumerated by the suite run in §6.
4. Migrate `physical-rig.ts` off deprecated `getLightNodeClass`/`addLight`.
5. Fix `skia-texture-bridge.ts` `MakeImageFromGPUTexture` →
   `MakeFromGPUTexture` (Skia 3.8.x rename).
6. Re-baseline on the Duo under 0.187.0/0.19.2 when the device is attached;
   re-verify AHB present-tail findings.
7. Sweep stale `r186`/`0.186.1` comments and the skia-3.6.1 catalog note.

## 10. Skills and roster (directive §4/§5)

Audits ran as five parallel subagents (render pipeline, deps/patches,
Valdrada, native path, bench/CI) — lanes A/C/E/F split per the roster.
Skill packs used: repo `skills/` registry — three-agent-skills +
threejs-skills vocabulary for the render audit, callstack/Margelo packs for
the native audit, `no-ai-slop` on this document's prose. No pack was claimed
that isn't in the checkout.
