# MeshletDrawingPipeline evaluation — Phase 4 (PR 4), slice 1

Status: evaluation only. No runtime change, no commit. Measured against the
installed, patched `three@0.187.0` (patch hash `605a4c87…`; the patch does not
touch `examples/jsm/pipelines/`). Evidence is host-side on the recording
GPUDevice unless marked device-pending.

Skills consulted: `skills/threejs-skills/` (grep for
`meshlet`/`drawingPipeline`/`indirect` — no coverage; the pack has no
drawing-pipeline reference), repo `AGENTS.md`, plus the audit's own citations
(`docs/performance/engine-audit-2026-10-31.md` §2/§8). The upstream PR is
mrdoob/three.js#35191.

## Verdict up front

**NO-GO as a drop-in for the per-draw encode wall.** On the real
physical-stack scene the pipeline claims 25 of ~110 objects and turns
221 draws into 192 (2 frames, ~13 %) while adding 16 compute pipelines and
~0.8 s of meshlet preprocessing. The dominant geometry — VDN shells
(~1.43 M tris), near/lite cells, structures, and *every* InstancedMesh — is
either ineligible by shape or poisoned by features our own physical stack
switches on (`reversedDepthBuffer`, the `storage` instance-matrix swap). The
one shape it *would* take that we actually rely on — plain `Mesh` over
`InstancedBufferGeometry` (vd-instanced, pool-instancer) — is **claimed and
silently misdrawn as a single instance**, which needs a patch hunk before the
flag can safely exist anywhere.

A real integration is feasible but is a Phase-4-sized project, not a slice:
bake `normal` into VDN cells, re-plumb per-object `onObjectUpdate` uniforms,
decide between `reversedDepthBuffer` and the meshlet path, keep the `storage`
feature off eligible InstancedMeshes, exclude `InstancedBufferGeometry` in
`isSupportedObject`, and move `createMeshlets` off the render thread.

## 1. Requirements — what the pipeline needs

`examples/jsm/pipelines/MeshletDrawingPipeline.js` (5,571 lines), class
`MeshletDrawingPipeline extends StandardDrawingPipeline` (line 3281). It
implements the `DrawingPipeline` contract the renderer drives
(`Renderer.js:1027,1114-1137`): `prepareAsync`, `begin`, `beginRenderList`,
`project`/`pushRenderItem`, `finishRenderList`, `updateView`, `dispose`.
Unsupported objects fall through to `super.pushRenderItem` — a per-object
fallback to the regular path, not a per-scene one (line 3852).

Runtime gates (`begin()`, lines 3538-3549) — all must hold or the *entire*
frame silently takes the standard path:

- `renderer.backend.isWebGPUBackend === true` (WebGL2 falls back wholesale),
- `_ready` — the meshoptimizer WASM modules have loaded
  (`clusterProcessingReady`, MeshletGeometryUtils.js:28),
- `renderer.logarithmicDepthBuffer !== true`,
- **`renderer.reversedDepthBuffer !== true`**,
- `renderer.localClippingEnabled !== true` and no global `clippingPlanes`,
- camera is `PerspectiveCamera` (not `ArrayCamera`); render target not a cube
  map / `depth <= 1`,
- `renderer.getRenderObjectFunction() === null` — except shadow-map passes,
  which re-enable it when `overrideMaterial.isShadowPassMaterial` and
  `shadowMap.type !== VSMShadowMap` (lines 3584-3590).

Per-object gates (`isSupportedObject`, lines 554-595): `isMesh`, not skinned
or batched, `occlusionTest !== true`, `count <= 1` for non-instanced (r187
`Mesh.count = 1`, `src/objects/Mesh.js:104`), `InstancedMesh` rejected when
`instanceMatrix`/`instanceColor` is a `StorageInstancedBufferAttribute`, when
`morphTexture` is set, or `count === 0`; no morph targets, no
`onBeforeRender`/`onAfterRender` overrides, `matrixWorld.determinant() > 0`;
geometry needs `position` (itemSize 3) **and `normal`**, `drawRange` must be
the default `(0, Infinity)`, no `morphAttributes`.

Per-material gates (`isSupportedMaterial`, lines 270-300): node material or
a type with a node class; opaque or alpha-tested (no `transparent`,
`transmission`, `alphaHash`, `alphaToCoverage`); `FrontSide` only; no
`vertexColors`, `flatShading`, `wireframe`, `displacementMap`,
`clippingPlanes`, `polygonOffset`; `depthTest`/`depthWrite`/`colorWrite` all
on; every texture `channel === 0`; and none of `UNSUPPORTED_NODES`
(line 114): `vertexNode`, `geometryNode`, `depthNode`, `fragmentNode`,
`outputNode`, `contextNode`, `backdropNode`, `backdropAlphaNode`,
`alphaTestNode`, `castShadowNode`, `maskShadowNode`. **`positionNode` is
allowed**, via a fitted-bounds evaluation (`createDeformation`, lines
409-525): affine transforms bound exactly; anything reading an attribute it
can't sample (other attributes, `vertexIndex`) sets `unbounded` and the
objects are simply never culled — drawn, but at full cost.

Meshlet data is **generated at load, not required precomputed**:
`createMeshlets` (MeshletGeometryUtils.js:76) welds vertices, builds 64-tri
clusters with `MeshoptClusterizer` and a 6-level simplification chain with
`MeshoptSimplifier` — synchronous JS+WASM on the calling thread. Without
`prepareAsync` the pipeline processes **one new geometry per projection**
(`_getClusters`, lines 5401-5407); `renderer.compileAsync` calls
`drawingPipeline.prepareAsync` (`Renderer.js:1027`), which walks the scene
and meshletizes every supported geometry with a `setTimeout(0)` yield
between submeshes (lines 3462-3524). Cost measured on host: **~1.7-2.1 s for
a 150 k-tri merged geometry** (two runs, node 24, M-series Mac) — the
simplifier, not the clusterizer, dominates. On a phone that is several
seconds per streamed cell.

Device features: nothing exotic. `drawIndexedIndirect` /
`drawIndirect` (WebGPUBackend.js:2191,2217), `dispatchWorkgroupsIndirect`
(:1952) — all core WebGPU, no `multiDrawIndirect`/chained-draw extension
needed. Counter readback via `getArrayBufferAsync` every 30 projections
(lines 4787-4795) — `mapAsync`, standard. The one limit to gate on is
**`maxStorageBuffersInVertexStage`**: vertex pulling binds `var<storage,read>`
buffers in the vertex stage; the spec default is 8 but *compatibility-mode*
adapters may report 0 — check `device.limits` at attach time.
`maxStorageBufferBindingSize` also caps `maxInstances`
(128 MB default ⇒ ~1 M objects/list).

## 2. Interop with our meshes — measured claim map

Real scene probe (recording device, bundled `harlem-apollo.json`, physical
stack on, `reversedDepthBuffer` off so the pipeline could run):
`renderer.drawingPipeline = new MeshletDrawingPipeline({occlusionCulling:false})`,
`compileAsync`, two frames. `_hasClusters` per mesh tells who was claimed
(`prepareAsync` only processes objects passing both gates).

| Object class | Claimed | Why / why not |
|---|---|---|
| `city:walls-masonry`, `walls-glass`, `roofs`, `billboards` (merged city-mesh) | YES | Slop facade materials carry `normalNode`/`colorNode` only — they pass `isSupportedMaterial`. |
| `city:street-detail`, `city:facelift` streamed cells (7+7) | YES | …but see the fade caveat below — they claim while breaking `cellFade`. |
| `city:vd-blocks-shell` ×50 (~1.43 M tris) | no | `no normal` + finite `drawRange` (blocks/index.ts:144 `setDrawRange`). |
| `city:vd-blocks-near` (near/lite cells) | no | `no normal` — VDN cells carry position/color/emissive/uv only (on-demand.ts:39-44). |
| `vd:storefronts:*` | no | `no normal`, `flatShading`, `outputNode`, transparent glass. |
| `city:vd-far*` shells | no | `no normal`. |
| structures / furniture `vd-std:*` materials | no | `std-material.ts:100` sets `alphaTestNode` **unconditionally** (even `alphaTest=0`) — `alphaTestNode` is an unsupported node. Cheap fix: use `alphaTest` for the 0 case. |
| `city:cars-vd-*` (vd-instanced plain meshes) | no — by accident | `side=DoubleSide` on the car material saves them; the *shape* itself is claimed (hazard below). |
| pool-instancer furniture pools | would be claimed — hazard | `MeshStandard/BasicNodeMaterial` + `positionNode` only → supported; the mesh is `Mesh` + `InstancedBufferGeometry` → see hazard. |
| `city:trees-*` InstancedMesh | no | `storageInstanceMatrix` on every one; leaf/far also `side=2`. |
| `physical:fire-escapes-*` | no | `storageInstanceMatrix`, `transparent`, `side=2`, `maskShadowNode`. |
| `city:trees-near/far/trunks` (classic) | no | `storageInstanceMatrix`. |
| `city:neon` | no | `vertexColors`. |
| `city:areas`/`sidewalks`/`roads`/`contact-shadows`/`road-paint`/sky/ground/precipitation | no | `side=2`, `polygonOffset`, `transparent`/`depthWrite:false`, BackSide sky, `vertexNode` on `physical-sky`. Correct fallbacks — these are decals/overlays. |

**`storageInstanceMatrix` is our own doing.** `physical-rig.ts:459-471`
`swapInstanceMatricesToStorage` — a `storage` feature of the physical stack
(`physical-look.ts:101`, on in `fullPhysicalFeatures`) — rewrites every
InstancedMesh's `instanceMatrix` to `StorageInstancedBufferAttribute` (Slop's
~2.5 MB/frame upload win). `isSupportedObject` line 572 then rejects *all*
InstancedMesh. Under `EXPO_PUBLIC_WORLD_PHYSICAL` (default on), **zero**
InstancedMeshes can ever meshletize — the audit's #4 bottleneck
(uuid-keyed ~22 ms node builds) is untouched unless `storage` is dropped for
eligible meshes, trading the upload win back.

**Hazard — the vd-instanced shape.** r187 `Mesh.count = 1`; a plain `Mesh`
over `InstancedBufferGeometry` passes `isSupportedObject` (it has
`position`+`normal`), and a `positionNode`-only material passes
`isSupportedMaterial`. The pipeline then draws it as a **single** instance:
the batch's non-instanced path ignores `geometry.instanceCount` and never
fetches `vdXform`/`vdPool*` (the instanced-attribute fetch is gated on
`entry.instanced`, MeshletDrawingPipeline.js:2607). Host proof: claimed,
two frames render, **no throw** — every slot but the first silently drops.
The car materials survive only because they're `DoubleSide`; the pool
materials (`furniture/materials.ts`) are eligible and would break. Any
adoption requires a patch hunk rejecting `geometry.isInstancedBufferGeometry`
(or `object.count === 1 && geometry.instanceCount > 0`) in
`isSupportedObject` — or converting those pools to real `InstancedMesh`,
which then hits `storageInstanceMatrix` under physical.

**Per-object `onObjectUpdate` uniforms break under batching.**
`ditherFadeMask` (cells/cell-stream.ts:73-82) and the shell's `isShell`
(shell-material.ts:68) read `object.userData` through a uniform updated per
render object. Under the meshlet path the render object is the internal
batch mesh — `cellFade` reads as `undefined → 1` on every claimed cell:
streamed street-detail/facelift cells pop in opaque instead of IGN-dither
fading (and the near/shell handover bias dies the same way). `maskNode` is
*not* in `UNSUPPORTED_NODES`, so nothing warns. Fixing it means carrying
fade as a per-instance channel (an instanced attribute the batch forwards),
not a uniform.

**Fitted-bounds `positionNode`:** allowed and handled — affine reads of
`positionLocal`/`normalLocal` get exact bounds; the shell's
`p.add(away…isShell)` nudge and `vd-trees` `speciesMatch` reads hit the
`unsupported` attribute path → `unbounded` → drawn but never culled. That is
safe-but-wasteful, not broken.

## 3. Dawn / react-native-webgpu

- All GPU work is core WebGPU: `drawIndexedIndirect`,
  `dispatchWorkgroups(Indirect)`, storage buffers in compute and vertex
  stages, `mapAsync` counter readback every 30 frames, one extra
  `DepthTexture`+`RenderTarget` per view for the optional HZB occlusion.
  **No `multiDrawIndirect`, no chained draw, no mesh/task shaders** — the
  "indirect support" question reduces to core limits Dawn already meets on
  our lane, *except* `maxStorageBuffersInVertexStage`, which must be >0
  (default 8; compat-mode adapters can be 0 — the flag should gate on
  `device.limits.maxStorageBuffersInVertexStage`).
- Phase-1 shared-device pattern: every resource the pipeline makes lives on
  `renderer.backend.device` — the shared Dawn device gpu-store hands three.
  No new device path is created. `renderer.dispose()` calls
  `drawingPipeline.dispose()` (Renderer.js:3033 → pipeline line 5289), which
  frees batches, the occlusion view and the geometry pool — same lifecycle
  contract as `releaseCanvasBuffers`/`releaseStorageInstanceMatrices`.
- Unproven on Dawn: WGSL validity of the pulled-vertex/culling shaders under
  Dawn's stricter validation (e.g., storage-buffer counts per stage), readback
  timing on Adreno, and whether `maxComputeWorkgroupsPerDimension` 65535 is
  enough (`MAX_WORKGROUPS = 65535` per dispatch dimension is what the code
  assumes — matches spec default).

## 4. Host proof — what was run

Committed test: `packages/app/features/game/world/meshlet-pipeline.test.ts`
(5 tests, all pass on `pnpm exec node --test`).

- **Synthetic scene** (4 shared-geometry meshes + InstancedMesh + transparent
  fallback): standard 14 draws over 2 frames → meshlet 8 (two indirect-draw
  batches + fallback + output), **18 compute pipelines** created. Pinned:
  shared-geometry meshes collapse into one batch; transparent mesh untouched.
- **vd-instanced hazard**: `Mesh` + `InstancedBufferGeometry(instanceCount=2)`
  + `vdXformPositionNode` — `_hasClusters` true (claimed), renders without
  throwing, `mesh.count === 1` → one instance drawn, the rest silently
  dropped.
- **VDN cell shape** (no `normal`): rejected; shell shape (`drawRange` cut):
  rejected.
- **`reversedDepthBuffer`**: `_meshletsSupported` false → zero compute, draws
  identical to standard — and pinned: `prepareAsync` still burns meshlet
  builds it will never use (compile-time waste under the physical lane).
- **`createMeshlets`**: ~1.7-2.1 s per 150 k-tri merged geometry on host —
  the stream-in hitch is real and must move off the render thread
  (`prepareAsync` yields *between* geometries; each build itself is one
  synchronous WASM call).

**Real-scene probe** (ad-hoc script on the recording device, physical stack,
no reversed depth): standard **221 draws / 79 render pipelines / 1 compute**;
meshlet **192 draws / 81 / 17**, compile 5.6 s → 6.4 s. Claimed: the four
merged wall/roof/billboard meshes + 14 streamed cells (~160 k tris of the
~1.6 M in view). Everything instanced, everything VDN, everything decal —
untouched.

**Cannot be proven on host:** GPU-side culling wins (frustum/cone/occlusion),
per-frame JS cost of batch bookkeeping (`SlotRanges` diffing ~thousands of
objects per frame — plausible but unmeasured on device CPU), indirect-draw
submit cost on Adreno, HZB effectiveness, and whether the ~13 %-of-draws
capture grows enough to matter once the eligible set is engineered up.

## 5. Integration seam — if a future slice goes ahead

- **Flag**: `EXPO_PUBLIC_WORLD_MESHLET=1`, read once at module scope like
  `EXPO_PUBLIC_WORLD_PHYSICAL` (physical-look.ts:24). Candidate home: a new
  `world/meshlet-pipeline.ts` exporting `attachMeshletPipeline(THREE, renderer)`
  that no-ops unless flag + `backend.isWebGPUBackend` +
  `device.limits.maxStorageBuffersInVertexStage > 0` +
  `renderer.reversedDepthBuffer !== true`.
- **Attach sites** (post-`renderer.init()`, the setter binds the pipeline to
  the renderer): `packages/ui/three/ThreeCanvas.tsx:306` (JS path),
  `packages/app/features/game/render-runtime/game-render.ts:323` (worklet),
  and the three test-support constructors
  (`city-scene.physical-first-frame.test-support.ts:167`,
  `cells/cell-stream.walk.test-support.ts:137`,
  `vd-port/budget.test-support.ts:44`). The pipeline is a world-scene choice,
  so attaching inside `createCityScene`/the game setup — not the generic
  canvas — keeps `MonModel3D`/`HatchSequence3D` (plain WebGLRenderers) and
  non-city ThreeCanvas users untouched.
- **`compileAsync` seam is free**: `load-game-scene.ts`/`compile-pass.ts`
  already run `renderer.compileAsync`, which calls `prepareAsync` — the
  START set meshletizes during load. Streamed cells need an explicit
  `pipeline.prepareAsync(cellRoot, camera)` after decode (it yields), or a
  worker/bake-time meshlet format — `_getClusters`'s one-geometry-per-frame
  trickle otherwise produces a guaranteed multi-hundred-ms JS hitch per cell.
- **Whitelist**: not needed for selection — the pipeline opts *in* per object
  and falls back cleanly. A blocklist *is* needed for the
  `InstancedBufferGeometry` hazard (patch hunk) until/unless those pools
  become real InstancedMesh.
- **Precedence with physical**: `EXPO_PUBLIC_WORLD_PHYSICAL` sets
  `reversedDepthBuffer` (native) and `storage` (all platforms). Both fight
  meshlets; decide whether `WORLD_MESHLET` implies dropping them
  (`physicalRendererParams`, `swapInstanceMatricesToStorage`) or restricts
  meshlets to `WORLD_PHYSICAL=0` builds.
- **Tests to pin**: `world/meshlet-pipeline.test.ts` (written — batch
  collapse, hazard rejection after the patch, reversed-depth inertness,
  claim-shape table); a walk-level pin extending
  `cells/cell-stream.walk.test-support.ts` with a meshlet config asserting
  claimed-set + draw counts; a `shadow-pass` pin (meshlet shadow path works
  for non-VSM — ours is PCF via SunShadowNode).

## Files a Phase-4 implementation slice would touch

- `packages/app/features/game/world/meshlet-pipeline.ts` (new): flag, limit
  gate, attach helper.
- `patches/three@0.187.0.patch`: `isSupportedObject` hunk —
  `geometry.isInstancedBufferGeometry === true` → reject (prevents the
  silent single-instance misdraw); optionally skip `prepareAsync` work when
  `!_meshletsSupported`.
- `packages/app/features/game/world/physical-look.ts`: flag interplay
  (`reversedDepthBuffer`, `storage`) vs `WORLD_MESHLET`.
- `packages/app/features/game/world/physical-rig.ts`:
  `swapInstanceMatricesToStorage` skip list / reversal for eligible IMs.
- `packages/app/features/game/render-runtime/game-render.ts`,
  `packages/ui/three/ThreeCanvas.tsx`: attach call after `init()`.
- `packages/app/features/game/cells/cell-stream.ts` + decode paths: bake or
  synthesize `normal` for VDN cells if blocks are ever to be claimed;
  per-instance `cellFade` channel instead of `onObjectUpdate` uniform.
- `packages/app/features/game/world/vd-port/furniture/std-material.ts:100`:
  `alphaTestNode` → `alphaTest` where possible (un-gates structure materials).
- `packages/app/features/game/world/vd-instanced.ts`,
  `vd-port/furniture/pool-instancer.ts`: convert to `InstancedMesh` or rely
  on the exclusion hunk.
- `docs/performance/*`: re-baseline on the Duo before any merge.

## Per-path verdicts

| Path | Verdict |
|---|---|
| blocks (shells) | NO-GO — `no normal` + `drawRange`; biggest mesh in the scene is the least eligible. |
| blocks (near/lite streamed cells) | NO-GO today — `no normal`; also `cellFade`/`isShell` per-object uniforms break under batching even if normals were baked. |
| structures (vk/pk/lk, storefronts) | NO-GO today — `alphaTestNode` unconditionally set; `flatShading`/transparent/`outputNode` on storefronts. Small material work could flip some slots. |
| fleets (living-city `InstancedMesh`) | NO-GO under physical — `storage` swap rejects 100 % of IMs; several materials are DoubleSide/transparent anyway. Eligible only with `storage` off. |
| vd-instanced (cars, pools) | NO-GO + hazard — silently claimed and misdrawn; patch hunk required before any flag ships. |
| web | Conditionally GO-able — `surface.web.tsx` never sets `reversedDepthBuffer`, so the gate passes; same object-level caveats; real fps evidence still needed in Chrome. |
| native (Duo/iPhone, physical on) | NO-GO today — `reversedDepthBuffer` makes the pipeline fully inert; needs either the physical-off lane or a reversed-depth-tolerant pipeline. |
