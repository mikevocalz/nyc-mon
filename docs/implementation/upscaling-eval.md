# Upscaling evaluation — Phase 4 (PR 4), slice 2

Status: evaluation only. No runtime change beyond a committed host test, no
commit. Measured against the installed, patched `three@0.187.0` (patch hash
`605a4c87…`; the patch does not touch `examples/jsm/tsl/` or
`examples/jsm/postprocessing/`). Evidence is host-side on the recording
GPUDevice unless marked device-pending.

Skills consulted: `skills/threejs-skills/` (grep for
`TAA`/`upscale`/`temporal`/`TAARenderPass` — no coverage; the pack's
postprocessing skill is WebGL `EffectComposer`-era, no TSL render-pipeline
reference), repo `AGENTS.md`, plus the audit's own citations
(`docs/performance/engine-audit-2026-10-31.md` §3: "No jitter, no motion
vectors, no TAA — absence is designed-in").

## Verdict up front

**TAAU: conditional GO as a flagged, device-measured experiment on iPad-class
and web; NO-GO on the Surface Duo.** Three r187 ships a TSL-native temporal
upscaler (`taau`) that slots into our `RenderPipeline` cleanly — the host
harness mounts it, runs frames, and pins the integration seam. But motion
vectors cost more than the texture they write: the `velocity` MRT output
forces a FULL render-object refresh on every draw of every frame
(`NodeMaterialObserver.needsVelocity`), which stacks directly on our #1
measured bottleneck (per-draw submit encode), and our twelve
`positionNode`-transformed material paths — cars, trees, weather, shells —
silently produce wrong velocity, the same class of silent-misdraw hazard the
meshlet eval found for `InstancedBufferGeometry`.

**FSR1 is the safer first flag** — spatial upscale with zero temporal state,
works *with* the existing MSAA chain, no velocity MRT, no jitter owner, no
positionNode hazard. Its own doc note caps the expectation: only wins if the
app is fragment-bound. On the Duo we are encode-bound, so FSR1 helps little
there either; on the iPad's 3.2 MP-capped buffer it is the honest candidate.

## 1. What r187 ships — every relevant pass/node and its requirements

All under `examples/jsm/tsl/display/` unless noted; all are TSL nodes for the
`RenderPipeline` output graph (not `EffectComposer`).

| Node | Purpose | Inputs | Temporal state | Own requirements |
|---|---|---|---|---|
| `taau` — `TAAUNode.js` (700 lines, added r184 #33368) | Temporal AA **+ upsample** in one pass — the "alternative to FSR2/3" | `beautyNode`, `depthNode`, `velocityNode`, `camera` | YES: halton(2,3)×32 camera jitter via `camera.setViewOffset`; history colour + lock RTs, resolve RT, previous-depth RT (all `HalfFloat`/`depthTexture`, output-sized) | Inputs rendered below output res via `PassNode#setResolutionScale`; **MSAA must be disabled** (class doc); must be built inside a `RenderPipeline` — it claims `renderPipelineState.viewOffsetOwner` for the jitter hooks (`OnBeforeRenderPipeline`/`OnAfterRenderPipeline`) |
| `traa` — `TRAANode.js` (609 lines) | Temporal AA at native res (no upscale) | same four | same jitter + history mechanics, minus the lock texture | same — the non-upscaling sibling; irrelevant to this slice's goal except as an MSAA replacement |
| `fsr1` — `FSR1Node.js` (481 lines) | AMD FSR 1: EASU edge-adaptive upsample + RCAS sharpen, two passes | `textureNode`, `sharpness`, `denoise` | NONE — no velocity, no history, no jitter, no `viewOffsetOwner` | Doc note: only wins if fragment-bound; "should always be used with an anti-aliased source" — our 4× MSAA satisfies that |
| `sharpen` — `SharpenNode.js` | RCAS sharpening alone — the intended post-TAAU sharpener (Mugen87 used it that way in #33359) | texture + amount | NONE | trivial |
| `TemporalReprojectNode.js` (1024 lines) | General reprojection primitive used by `RecurrentDenoiseNode` (SSGI/denoise lane) | `beautyNode`, `depthNode`, `normalNode`, `velocityNode`, `camera`, options | YES — also claims `viewOffsetOwner` | not an AA/upscaler; noted because it competes for the same owner slot |
| `TAARenderPass.js` — `examples/jsm/postprocessing/` (243 lines) | Legacy `EffectComposer` accumulation pass. **"This effect uses no reprojection so it is no TRAA implementation"** (class doc) | scene, camera | jitter accumulation only | **Dead on our stack**: `SSAARenderPass`/`EffectComposer`/`WebGLRenderTarget` — WebGL-only, no WebGPU path, and we have no composer |
| `SSAAPassNode.js` | Ordered supersampling | — | NONE | render-cost multiplier, not an upscaler |

Supporting machinery (`src/nodes/`):
- `accessors/VelocityNode.js` — the `velocity` TSL singleton. Computes NDC
  delta between current and previous `projection × modelView × position`.
  Per-object `update()`/`updateAfter()` tracks `object.matrixWorld` history;
  camera history is renderGroup-scoped and `frameId`-gated.
  `setProjectionMatrix` override lets TAAU feed unjittered projection to the
  velocity pass (jitter-correct reprojection).
- `accessors/Position.js` — `positionPrevious` (`positionGeometry.toVarying`)
  is the previous-frame vertex. **Only the built-in `instance()`, `batch()`,
  `skinning()`, `Line2` nodes write it** (`Instance.js:234`, `Batch.js:160`,
  `Skinning.js:274`…), using cloned previous-frame instance/bone/batch data.
  `material.positionNode` feeds `positionLocal` (`NodeMaterial.js:804-806`)
  but nobody feeds `positionPrevious` from user transforms — upstream
  acknowledges the gap: *"When users modulate `positionLocal` in their app,
  they automatically break velocity computation"* (Mugen87, #30846).
- `NodeBuilder.needsPreviousData()` (`NodeBuilder.js:3908`) — true when the
  bound MRT has a `velocity` output → materials build previous-transform
  paths and `NodeMaterialObserver.needsVelocity` (`NodeMaterialObserver.js:220`)
  returns `RenderObjectRefreshType.FULL` for **every render object every
  frame** (`:1075`) — see §4.
- `Instance.js:212,293-310` — with velocity MRT, each `InstancedMesh` gets a
  cloned `previousInstanceMatrix` attribute (one extra vertex buffer; per
  frame `array.set(matrices.array)` CPU copy via `OnAfterObjectUpdate`), and
  `canReferenceInstanceData` grows the vertex-buffer count by one against
  `MAX_VERTEX_BUFFERS = 8`.
- `PassNode.setResolutionScale` (`PassNode.js:526`, effective size at `:999`)
  scales render target + scissor + viewport — the intended input-resolution
  knob for `taau`/`fsr1`.
- `pass(scene, camera, { samples })` → `renderTarget.samples = options.samples
  ?? renderer.samples` (`PassNode.js:821`) — the MSAA opt-out.

## 2. The r187 compatibility picture

r187 (tagged 2026-10-30) was an unusually active week for this area. Fixed
**in** our installed build: `TAA Nodes: Register inputs ahead of consumers`
(#34565 — the `depthNode/velocityNode/beautyNode.build(builder)` calls at the
top of `setup`), `PassNode/TAA: Improve depth support` (#34802),
`TRAANode: Fix previous-depth texture leak` (#34873), `TemporalReprojectNode`
depth-type fixes (#34793, #34823), and r187's `VelocityNode` rework that made
the current projection a captured uniform (needed for the unjittered velocity
pass). The r186→r187 diff on installed trees confirms `TAAUNode` was
restructured for the r187 pipeline-event mechanism (`_needsPostProcessingSync`
and the manual `initRenderTarget` resize handling are gone).

Landed **after** the r187 cut — verified absent from the installed source:

- **#35236 `VelocityNode: Preserve previous transforms across velocity
  passes`** (merged Oct 30, into dev). Installed `updateAfter` copies
  `object.matrixWorld` unconditionally — an object rendered into two
  velocity-emitting passes in one frame loses its motion in the second.
  Single-velocity-pass wiring (ours) is unaffected today; it becomes a bug
  the moment a second temporal consumer renders in the same frame.
- **#35299 `TRAANode: Swap history/depth instead of copying`** (merged Oct
  31). Removes one full-res colour copy per frame (~11 % faster TRAA pass,
  author's M3 numbers) and shrinks TAAU's pure-depth targets (`count: 0`).
  Our build still pays the copy.

Still open upstream: **#31892** (TRAA ghosting during motion — the
world-position disocclusion check); Mugen87's own quality caveat on
`TAAUNode` in **#33359** (blurriness and flicker are "noticeably amplified"
vs TRAA; `SharpenNode` was added as the intended companion); and the
architectural positionLocal caveat from #30846 quoted in §1 — that is the
"known issue" that maps onto our materials, and it has no upstream fix.

## 3. Our current scaling and post chain

- **Dynamic resolution** (`perf/render-scale.ts`, opt-in
  `EXPO_PUBLIC_WORLD_RENDER_SCALE`, or implied on the vd lane only when
  physical is off — `city-scene.ts:249-255`): a controller steps
  `renderer.setPixelRatio(base × scale)` on 1.5 s windows (floor 0.5
  provisional). It measures JS draw cadence, not GPU time (header caveat).
  On the physical path the pipeline "sizes its own targets" and the
  controller is left unmounted unless explicitly flagged — the seam a
  temporal upscaler would take over.
- **Static pixel cap** (`perf/pixel-budget.ts`): the drawing buffer is capped
  to the iPhone 17's ~3.2 MP budget (`PHYSICAL_PIXEL_BUDGET`), so the 12.9"
  iPad already renders at 2049×1536 of a possible 2732×2048 — the target
  device is *policy*-limited today, and every post target (MRT, bloom, SSR)
  scales with the buffer.
- **Post chain** (`post/pipeline.ts`): one `RenderPipeline` mounted by
  patching `renderer.render` (`delegateRender`, `:377-408`). Physical chain
  (default on): `pass` → MRT `output + normalView + metalRough` → SSR
  (tier-gated, off on phone) → exposure/balance → peak-limited bloom →
  grade → **ACES once** in the pipeline's `renderOutput`. Legacy chain:
  SSAO → bloom → grade → FXAA. The physical scene pass today is 4× MSAA on
  a core-features device (`antialias: true` → `renderer.samples = 4`;
  `msaaDiscard` only drops *storing* the MSAA colour, `pipeline.ts:432`).
- **No existing temporal state** — verified by grep: no jitter, no
  `setViewOffset`, no `velocity`/motion-vector MRT, no `SSRNode.setHistory`,
  no `camera.projectionMatrix` mutation (only a read at
  `pool-instancer.ts:173`, outside render). `scene.fogNode` is swapped around
  the PMREM bake (`physical-rig.ts:335-376`) — not temporal. The audit's
  line stands: absence is designed-in; IGN dither fills the TAA role for
  cell fades.

## 4. Conflict map — "do not stack conflicting temporal systems"

| System | Mechanism | Conflict |
|---|---|---|
| **Jitter ownership** | `renderPipelineState.viewOffsetOwner` is claimed once per pipeline (`TRAANode.js:426`, `TAAUNode.js:478`, `TemporalReprojectNode.js:727`). Host-pinned: two temporal nodes in one output chain → only the first jitters; the second resolves against a jitter it never applied — silently asymmetric, no warning. | TRAA XOR TAAU XOR TemporalReprojectNode per pipeline. |
| **Velocity MRT ↔ per-draw encode floor** | `mrt({velocity})` flips `needsVelocity` → `FULL` refresh for every render object every frame (`updateForRender` + `bindings.updateForRender` per draw, `Renderer.js:4074-4085`), plus a per-object `previousModelWorldMatrix` uniform write and per-`InstancedMesh` previous-matrix clone + per-frame `array.set` CPU copy. | This *is* bottleneck #1 made worse — the ~13–18 ms p50 submit-encode path gets an extra uniform/bindings refresh per draw. On the Duo this alone is disqualifying. It also works against the `storage` swap's whole purpose (`swapInstanceMatricesToStorage`, the ~2.5 MB/frame upload win): velocity re-adds a per-InstancedMesh previous-matrix buffer and its CPU copy. |
| **`positionNode` materials ↔ wrong velocity** | `positionPrevious` stays raw `positionGeometry` for anything the built-in instance/batch/skinning nodes don't handle. Our custom instancing (`vd-instanced.ts`, `pool-instancer.ts`) and every `positionNode` displacement (12 files: car material, headlights, trees, weather, road-paint, culling, street-props, shell nudge, furniture materials, leandraw) write `positionLocal` only → velocity = displaced-vs-raw garbage for those meshes. | The moving content most needing correct vectors — cars, swaying trees, precipitation — produces bogus vectors → TAAU ghosting/smearing that no depth check fully masks. Fixable only by double-buffering previous transform data per object and assigning `positionPrevious` in our position nodes — real work, same shape as the meshlet eval's fitted-bounds caveat. FSR1 doesn't care — it reads one texture. |
| **`renderScale` ↔ TAAU** | render-scale drives `setPixelRatio` → shrinks the *output* buffer and every pass target; every scale step resizes TAAU's history → `needsRestart` → reseed (plus the WebGPU depth-copy timing hazard TAAU's own comments describe). Under TAAU the dynamic knob must be `scenePass.setResolutionScale` (input-only), which keeps output and history stable. | Mutually exclusive mechanisms — the flag must make them so. `EXPO_PUBLIC_WORLD_RENDER_SCALE` and a TAAU flag must not coexist. |
| **MSAA ↔ temporal resolve** | TAAU/TRAA docs: MSAA must be off on the beauty pass. Ours is `renderer.samples=4` → scene pass 4× on core devices (`{samples:0}` on `pass()` is the opt-out). Compat-mode devices force `_samples = 0` (`WebGPUBackend.js:258-262`). | Dropping 4× MSAA for TAAU changes the AA contract of the whole frame — quality call that needs device eyes. On compat-mode adapters it's already 0 and TAAU is the only AA available. |
| **Compat-mode MRT blending** | Recording device logs it: "MRT blending configuration is not fully supported in compatibility mode — material blending will be used for all render targets." | On a compat-mode adapter, transparent materials blend into the **velocity** attachment → garbage vectors for every transparent draw. Already true for `normal`/`metalRough` today; velocity adds a third victim. Device-pending whether rn-webgpu-dawn 157 exposes `core-features-and-limits`. |
| **`reversedDepthBuffer`** | `TAAUtils.sampleCurrentDepth` explicitly handles it (`depth.oneMinus()`). | None — unlike the meshlet pipeline, TAAU is reversed-depth-compatible with our physical lane. |
| **SSR temporal reuse** | r187 `SSRNode.setHistory(history, velocity)` exists; we don't call it. Upstream #35228 (spatio-temporal SSR denoise, open) would consume the same velocity buffer — and #35236's multi-pass bug lands exactly when a second temporal pass exists. | Not stacked today; is the next collision if both ship. |
| **IGN dither fades** | `ditherFadeMask` is a stable screen-space stochastic mask. | TAA accumulates it into smooth fades — probably a *win*, unproven; transparent/precipitation objects still write velocity, a quality caveat. |
| **Floating origin / paused draws** | Rebase moves `matrixWorld` consistently → one invalid-history frame per cell hop; `invalidate()`-driven on-demand draws just accumulate over stale-but-valid history. | None structurally; camera previous matrices are frame-to-frame, not wall-clock. |
| **Meshlet pipeline** | `MeshletDrawingPipeline` keeps GPU-side previous matrices specifically "for the velocity of temporal effects like TRAA" (its own comments, :2580,:2630,:3158). | Forward-compatible — if meshlets ever ship, velocity is already designed in. No conflict. |

## 5. Native feasibility (rn-webgpu / Dawn)

- **TAAU/TRAA are backend-agnostic TSL**: QuadMesh renders into ordinary
  `RenderTarget`s plus `renderer.copyTextureToTexture` (colour + same-format
  depth). No `GBuffer`, no MSAA paths, no DOM — unlike `TAARenderPass`
  (WebGL-only). Depth-format `copyTextureToTexture` is spec-legal for
  same-format full copies; Dawn supports it on desktop — on rn-webgpu it is
  the same code path as every other copy, **unproven on device**.
- **Motion vectors need no special feature** — `velocity` is a plain fragment
  output into an `rgba16float` attachment (host recording confirms the
  texture). Storage buffers/indirect are irrelevant here.
- **Compat-mode detection decides the MSAA question**:
  `WebGPUBackend.js:258` sets `compatibilityMode = !device.features.has(
  'core-features-and-limits')` and forces `renderer._samples = 0`. Whether
  rn-webgpu-dawn 157's device exposes that feature is **device-pending** — if
  not, native already runs MSAA-free and TAAU's requirement is auto-satisfied
  (while the MRT-blending caveat in §4 applies harder).
- **iPad A12X budget** (`tier-presets.ts`): buffer is capped at ~3.2 MP by
  `PHYSICAL_PIXEL_BUDGET` regardless. TAAU at 0.5 input scale adds
  ~**80–90 MB**: history colour+lock+resolve `rgba16float` at output res
  (~75 MB at 2049×1536) + previous-depth at input res (~3 MB) + velocity
  `rgba16float` at input res (~6 MB, 8 B/px for two used channels). Fits the
  4 GB budget next to the existing ~100 MB of canvas targets; the cost that
  needs a device is bandwidth: a full-res resolve quad (9-tap + depth
  dilation + history read/write) and one full-res copy every frame
  (until r188's swap lands).
- **The JS-side costs matter more than the GPU costs on our stack**: per-draw
  FULL refresh + per-object velocity uniforms + per-InstancedMesh
  previous-matrix `array.set` every frame — Hermes pays all of it, on the
  thread that is already the bottleneck.

## 6. Host proof — what was run

Committed test: `packages/app/features/game/post/temporal-upscale.test.ts`
(4 tests, all pass on `pnpm exec node --experimental-strip-types --test`).

- **TAAU mounts and renders** on the recording device inside a
  `RenderPipeline`: `pass(scene, cam, {samples:0})`,
  `setResolutionScale(0.5)`, `setMRT(mrt({output, velocity}))`,
  `taau(beauty, depth, velocity, cam)` → `pipeline.outputNode`. Three frames,
  no throw; recorded: scene pass at 160×120 with **two** `rgba16float`
  attachments (`output` + `velocity`) + `depth24plus`, TAAU's
  `history.color` + `history.lock` + `resolve` at output-res 320×240, and
  `previousDepth`. 5 render pipelines, ~2.7 MB textures at that size.
- **Jitter ownership**: `viewOffsetOwner === taauNode`; projection matrix is
  restored between frames (baseline taken after the first render's
  WebGPU-NDC rebase — `camera.view` ends `{enabled:false}`); stacked
  TRAA+TAAU leaves only the first as owner.
- **MSAA seam**: scene pass inherits `renderer.samples` (0 on the compat
  recording device; 4 on a core-features device under `antialias:true`) and
  `{samples:0}` is the explicit opt-out.
- **FSR1**: mounts on the same pass with `setResolutionScale(0.5)`, no MRT,
  `viewOffsetOwner` stays null, `easu`+`rcas` targets at output res.

**Cannot be proven on host:** the WGSL validity of the TAAU/FSR1 shaders
under Dawn's stricter validation; the GPU cost of the resolve pass and the
per-frame history copy; the JS cost of the velocity FULL-refresh on a device
CPU; whether the positionNode velocity gap is visually damning (the harness
counts calls, it does not shade); compat-mode behaviour on real Dawn
hardware; and every quality judgement (blur, flicker, ghosting) — #33359's
author calls TAAU's flicker a problem on good hardware.

## 7. Per-platform verdicts

| Path | Verdict |
|---|---|
| iPad A12X-class (physical, `WORLD_PHYSICAL` on) | **Conditionally GO-able** — flagged experiment. The buffer is policy-capped at 3.2 MP; TAAU at 0.5–0.67 input scale could cut scene shading cost and the pixel-budget pressure, but only a device frame answers whether velocity refresh + resolve beats MSAA + the cap. The positionNode velocity gap will smear cars/trees/weather — needs eyes, and probably `SharpenNode`. |
| Surface Duo (physical or vd lane) | **NO-GO.** Encode-bound at ~30 fps locked; the velocity MRT's per-draw FULL refresh is precisely the cost class that walls it. Compat-mode MRT blending may corrupt velocity on top. TAAU cannot help a CPU wall. |
| iPhone 17 / phone tier | **NO-GO today** — SSR is already off there and 3.2 MP is its native buffer; TAAU is a quality experiment at best, blocked by the same velocity caveat. |
| Web (desktop Chrome WebGPU) | **GO-able** — the easiest place to get real fps/quality evidence; same seams; no compat-mode unless the adapter lacks core features. |
| FSR1 (any platform) | **Conditionally GO-able as the cheap first flag** — spatial only, composes with MSAA, zero temporal coupling; but it only pays when fragment-bound, which on the Duo we are not. Most honest on iPad/web. |

## 8. Integration seam — if a slice goes ahead

- **Flag**: `EXPO_PUBLIC_WORLD_UPSCALE=taau|fsr1` (off default), read at
  module scope like `EXPO_PUBLIC_WORLD_PHYSICAL`. Mutually exclusive with
  `EXPO_PUBLIC_WORLD_RENDER_SCALE` — under `taau`, dynamic resolution must
  drive `scenePass.setResolutionScale`, never `setPixelRatio`.
- **Site**: inside `mountPhysical` (`post/pipeline.ts:417+`) — add
  `upscale` to `PhysicalPostRequest`; when `taau`: extend `sceneMRT` with
  `velocity: T.velocity`, set `scenePass.renderTarget.samples = 0` (or pass
  `{samples:0}` at construction — needs plumbing since `pass()` is called
  before the physical branch), `scenePass.setResolutionScale(tier scale)`,
  and replace `sceneColor` with `taau(...).getTextureNode()` so
  SSR/bloom/grade/ACES still run once, at output res, on the resolved image.
  FSR1 is the same seam minus MRT/samples: `fsr1(sceneColor)`.
- **Dispose**: add `taauNode.dispose()`/`fsrNode.dispose()` to the mount's
  dispose list next to `ssrNode`/`bloomNode` (`pipeline.ts:570-573`).
- **Both paths**: `mountCityPostPipeline` is shared by the JS and worklet
  render paths (`city-scene.ts:210`), so the seam lands once; the worklet's
  one-shot `setPixelRatio` (`game-render.ts:125`) is unaffected.
- **Tests to pin**: `post/temporal-upscale.test.ts` (written); a pipeline
  test asserting `applied.upscale` truth-table + `samples===0` on the scene
  pass + `viewOffsetOwner`; a walk-level pin for velocity-MRT pipeline
  counts vs the 79-pipeline baseline.
- **Upstream**: re-evaluate on r188 — #35236 (multi-pass previous
  transforms) and #35299 (history swap, ~11 % and smaller depth targets)
  both fix TAAU/TRAA costs that this slice would otherwise carry; and watch
  #35228 (SSR rework) for the second-temporal-consumer collision.
- **Velocity correctness follow-up** (the blocker for anything temporal):
  a `positionPrevious` channel for our custom instancing — double-buffered
  `vdXform`/pool transforms or a zero-velocity opt-out material for
  `positionNode` meshes — is its own slice. Until it exists, every temporal
  resolve ghosts the moving city.

## Files a Phase-4 implementation slice would touch

- `packages/app/features/game/post/pipeline.ts`: `PhysicalPostRequest.upscale`,
  MRT velocity output, `samples` plumbing on `pass()`, `setResolutionScale`,
  chain splice, dispose.
- `packages/app/features/game/world/physical-look.ts`: flag + features field
  (e.g. `upscale: 'taau' | 'fsr1' | null`) and tier scale row.
- `packages/app/features/game/perf/tier-presets.ts`: per-preset input scale.
- `packages/app/features/game/city-scene.ts`: render-scale/upscale mutual
  exclusion around `city-scene.ts:249-255`.
- `packages/app/features/game/world/vd-instanced.ts`,
  `vd-port/furniture/pool-instancer.ts`, the 10 other `positionNode` files:
  previous-transform channels — only if a temporal resolve survives the
  device measurement.
- `docs/performance/*`: iPad + Duo baselines before any merge. No device was
  attached for this eval (`adb devices` empty, iPhone paired but unreachable)
  — every device claim above is explicitly pending.
