# GPU budget — G1 attribution + BundleGroup + render scale (Surface Duo, 2026-10-17)

Lane G1 / PR 3 of the performance pass. Companion to `baseline-duo-2026-10-17.md`
(M0), `worklet-ab-2026-10-17.md` (R1), and `ui-thread-attribution-2026-10-17.md`
(U1). All device numbers below are the physical Surface Duo 1 (serial
913949703467, Android 14, 2700×1800, ~60 Hz), release builds, JS render path,
`EXPO_PUBLIC_GAME_PERF=1`, same ~90 s scripted walk
(`input swipe 200 1540 200 1250 4500` ×18).

## The finding, up front

**The ~18 ms JS render submission is ~73% three.js command encoding, ~22%
native present, ~1% scene update.** The cost is inside `renderer.render()` —
not scene logic, not the node-frame tick, and only partly the swapchain
hand-off.

Per-stage medians across 28 probe windows (~3,300 frames, flag-off build):

| stage | p50 ms | p90 ms | share of p50 |
| --- | --- | --- | --- |
| scene `update()` | 0.20 | 0.26 | ~1% |
| `advanceNodeFrame` | 0.01 | 0.02 | ~0% |
| `renderer.render` (encode+submit) | 13.18 | 17.66 | ~73% |
| `surface.present()` | 3.93 | 9.07 | ~22% |
| **total `cpuMs`** | **17.97** | **21.45** | 100% |

`worstMs` p50 25.4 (one 1.5 s load hitch excluded by the sampler's parked-gap
cutoff). Device-side renderer counters: `drawCallsP50` 40, `trianglesP50`
~297,600 (matches the host-side ~284k–306k floor), drawing buffer 2160×1440.

Two consequences:

1. **Nothing in the JS scene graph is the problem.** Update+node is 0.2 ms of
   an 18 ms frame. The encode/submit inside three's WebGPU backend — render
   list traversal, node/binding refresh, wgpu command encoding, JSI hops —
   owns the budget.
2. **`present()` has a fat tail** (p50 3.9, p90 9.1): it blocks on
   swapchain-buffer availability when the GPU is behind — consistent with the
   gfxinfo GPU p50 of ~16–17 ms. CPU and GPU are both near budget; shrinking
   either side alone cannot reach 16.7 ms.

## What shipped

### Staged probe (this lane's instrumentation)

`FrameTimingSample`/`FrameTimingSummary` carry optional `updateMs`, `nodeMs`,
`renderMs`, `presentMs`, `drawCalls`, `triangles`, `bufferW`, `bufferH`; the
sampler reports per-stage p50/p90 in one `stages` block. Wired into both draw
paths — `ThreeCanvas.tsx` (JS) and `render-runtime/game-render.ts` (worklet) —
behind the existing `EXPO_PUBLIC_GAME_PERF=1` gate. Flag off: the four extra
`performance.now()` reads don't run, the reused probe object is untouched, and
`stages` reports `null`. No per-frame allocation in either state (the sample
object and the 120-frame window are reused).

Files: `perf/frame-sampler.ts` (+`.test.ts`), `perf/record-city-frame.ts`,
`render-runtime/game-render.ts`, `ui/three/types.ts`, `ui/three/ThreeCanvas.tsx`.

### BundleGroup for the static city — `EXPO_PUBLIC_WORLD_BUNDLES` (default OFF)

three@0.186.1 `renderers/common/BundleGroup.js` records a group's draws into a
WebGPU render bundle once and replays them via `executeBundles`, skipping
per-frame re-encoding. In `world/index.ts` a `BundleGroup` gets `ground`
and every `city.meshes` entry except the two `mutableMeshes` (contact-shadow +
detail meshes `setFocus` re-ranges per move — a recorded bundle freezes draw
parameters). Trees/furniture/props stay out (instanced sets whose counts/
visibility change), lights stay out (BundleGroup forbids non-renderable
children), the Caller stays out.

The sky dome stays *out*: `executeBundles` replays at the END of the render
pass (`WebGPUBackend.finishRender`), so a `depthTest:false` dome inside the
bundle would repaint over every direct draw, and the bundled city would then
fail depth wherever a non-bundled object wrote nearer — canopy-shaped sky
holes (the Duo's white-tree bug, fixed 2026-11). Outside the bundle the dome
still leads the opaque list via renderOrder -10. `world.skyBundled` means the
dome rides inside `world.group`, so `city-scene.ts` adds `world.group` only.

### Device results — same walk, bundles ON vs OFF

| metric | flag off | bundles on | Δ |
| --- | --- | --- | --- |
| submission `cpuP50` ms | 17.97 | 17.23 | −0.74 (−4%) |
| submission `cpuP90` ms | 21.45 | 20.43 | −1.0 |
| `render` p50 ms | 13.18 | 12.57 | −0.6 |
| `render` p90 ms | 17.66 | 16.16 | −1.5 |
| `present` p50 ms | 3.93 | 3.69 | −0.2 |
| `info.render.drawCalls` p50 | 40 | 30 | −10 |
| `info.render.triangles` p50 | ~297.6k | ~128.1k | bundled tris exit the counter |
| gfxinfo frame p50 ms | 48 | 44 | −4 |
| gfxinfo jank | 38.5% | 35.1% | −3.4 pt |

Honest read: a real ~0.6–1.5 ms encode saving (~57% of triangles went into the
bundle), but far short of 16.7 ms — the per-frame cost that remains is
traversal/node-work plus the non-bundled draws' encode, not just command
recording. Kept behind the flag; the counter caveat (bundled draws no longer
appear in `info.render`) is why drawCalls "improved" 40→30.

## Render-scale controller — `EXPO_PUBLIC_WORLD_RENDER_SCALE` (default OFF)

Source chain: `mountRenderScale` → `renderer.setPixelRatio(base × scale)` →
three `CanvasTarget.setSize` → `canvas.width/height` → rn-webgpu
`GPUCanvasContext.getCurrentTexture` sees the size change →
`SurfaceRegistry.reconfigure`. **Device-verified this lane**: the probe's
`bufferW/H` tracked scale exactly — 0.9 → 1944×1296, 0.992 → 2143×1428,
1.0 → 2160×1440. The swapchain really does shrink; the "DEVICE-PENDING" note
in `render-scale.ts` can be retired.

90 s walk outcome: 57 decision windows → 53 holds, 3 ups, 1 down; scale ranged
0.9–1.0 and **settled at 1.0 (ceiling)**. During the brief 0.9 window render
p50 dropped to ~10.8 ms and present p50 to ~0.2 ms — the mechanism saves real
encode+present time — but the controller climbed back because its measured
cadence (JS `update()` interval → 40–53 fps) sits *above* the phone band
[27, 38]. That cadence is frame-*production*, not presented frames: gfxinfo
still showed p50 46 ms / 38.5% jank — the UI thread (Rive overlay, compositor)
gate U1 documented remains the window-level ceiling, exactly the caveat the
controller's header predicts. Take-away: verified working, but on this device
the phone band is miscalibrated for a UI-bound presentation path; it cannot
push presented fps into its target while UI-thread cost dominates.

## Audits (no code needed)

- **Instancing — already done.** Trees (`world/foliage.ts`), cars, poles, sign
  blades, lamp heads, light pools (`world/street-props.ts`,
  `street-furniture.ts`) are `InstancedMesh`/merged. 40 device draw calls for
  ~298k triangles is already efficient; nothing repeated warrants BatchedMesh.
  The Caller stays ~14 primitives — a unique animated actor.
- **Grass/rain/clutter — absent.** No such systems exist in this world ("grass"
  is an area fill in the baked mesh); nothing to loop-patch.
- **Material compile — already done.** `load-game-scene.ts` calls
  `renderer.compileAsync(scene, camera)` before first-render signalling; all
  material variants compile during load, not first frame.
- **KTX2/Draco — deferred, justified.** World textures are procedural
  `DataTexture`s; no glTF pipeline exists to compress.

## Test / verification status

- `node --test 'features/game/**/*.test.ts'`: **309/309 pass** (7 sampler
  tests, incl. staged order-statistics and flag-off `stages: null`).
- `tsc --noEmit`: clean in `packages/app` and `packages/ui`.
- Device: JS path verified for all three configurations above; worklet path
  instrumented identically but walked under R1 numbers (same scene code).
- Remaining gap to the pass state ("no frame over 16.7 ms"): submission p50
  ~17.2 ms with bundles → ~55% of the gap is CPU encode that BundleGroup does
  not remove; the rest is present backpressure + UI-thread cost outside this
  lane. A CPU-encode path (thinner render lists, fewer node-graph updates) or
  an actual GPU-fill reduction are the remaining levers.
