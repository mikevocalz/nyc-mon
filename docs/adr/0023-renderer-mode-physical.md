# 0023 — Renderer mode: the physical path, and the simulator rule it overturns

- **Status:** Proposed. The decision to build is Mike's (2026-10-26, D19). The claim that the path renders on hardware is open until the Phase 0 device rows are filled (G5).
- **Date:** 2026-10-27
- **Deciders:** Mike
- **Overrides:** the react-native-webgpu rule in `docs/implementation/city-world.md` (no shadow maps, no output pass, no `scene.background = Color`), D17's "Not done: bloom", and the matching comment in `city-scene.ts` ~L100–111. Only under `EXPO_PUBLIC_WORLD_PHYSICAL`.
- **Sources:** `docs/plans/slop-grade-city-prompt.md` §2.1, §5.1–5.2, §8 Phase 0. Slop New York @ `be65d0a`, `js/main.js` (renderer and pipeline, about L42–225), `js/lighting.js`, `js/post-processing.js`. react-native-webgpu @ `3f4b0f0`, `apps/example/src/ThreeJS/PostProcessing.tsx`. vg-demos-all `README.md` L23.
- **Related:** ADR 0024 (facade attribute layout) and ADR 0025 (vehicle recipe and worklet bundling) are reserved by this lane; ADR 0026 (one GPU device) belongs to the device lane.

## Context

The city renders linear, untonemapped and unshadowed. `city-scene.ts` sets `outputColorSpace = LinearSRGBColorSpace`, `NoToneMapping` unless `VD_TONEMAP` is set, and `shadowMap.enabled = VD_SHADOWS`. Its comment cites the metro-live README. The line it rests on is vg-demos-all `README.md` L23:

> On react-native-webgpu (checked on the iOS 27 simulator with three r186), shadow maps, three's output pass (tone mapping / sRGB) and `Color` scene backgrounds render a black frame.

That is a simulator result. Two things cut against treating it as a hardware rule:

1. react-native-webgpu's maintainer example (`PostProcessing.tsx` @ `3f4b0f0`, three 0.184.0) builds `new THREE.RenderPipeline(renderer)`, adds `bloom(scenePassColor)`, sets `NeutralToneMapping`, and calls `context.present()` after the pipeline renders (L58–77).
2. Slop's `lighting.js` L143–146 explains one of the three failures: a `Color` background sets `forceClear` in `WebGPURenderer`'s `Background.update`, which clears cascade 0 while cascade 1 renders. Slop leaves `scene.background = null` and draws the sky as a mesh.

Slop's look depends on the three things the rule bans: sRGB output through ACES, sun shadows and a post chain (SSR, bloom, grade).

## Decision

Add a physical renderer mode behind `EXPO_PUBLIC_WORLD_PHYSICAL`, off by default, with the same truthy table as the other world lanes. With the flag off the build stays byte-identical (spec N1).

With the flag on, following `main.js` and `post-processing.js`:

| Setting | Value | Slop source |
|---|---|---|
| Output | `SRGBColorSpace`; `ACESFilmicToneMapping` applied once, by the `RenderPipeline` | `post-processing.js` `createPostProcessing` |
| Depth | `reversedDepthBuffer: true`; the `SkyMesh` vertex node writes z = 0 | `main.js` renderer options; `lighting.js` L175–183 |
| Background | `scene.background = null`; sky is `SkyMesh` | `lighting.js` L143–146 |
| Shadows | `SunLight`, two cascades in one atlas, `normalBias` 0.05 | `lighting.js` L192–205 |
| Pipeline | The existing `post/pipeline.ts` mount, extended with MRT (`output`, `normalView`, `metalRough`), SSR and the grade. No second `RenderPipeline` | `main.js` scene pass, SSR, `createPostProcessing` |
| Instancing | `InstancedMesh.instanceMatrix` swapped to `StorageInstancedBufferAttribute` only when `renderer.backend.isWebGPUBackend` | `main.js` (about 2.5 MB/frame of uniform re-upload otherwise, per Slop's comment) |

`render-runtime/game-render.ts` already spreads `device` into the `WebGPURenderer` options when one is passed (~L288–293). Whether that device is Skia's Graphite device is ADR 0026's question, not this one.

## Phase 0: the evidence this ADR waits on

`EXPO_PUBLIC_WORLD_PROBE=<name>` isolates one feature on the Harlem tile per run. Each probe runs on the JS runtime and on the worklet runtime, on iPhone 17 and iPad Pro hardware, and records non-black yes/no, a capture and the frame time. The matrix is in `docs/DEVICE_CHECKS.md` § Slop-grade city. Control: react-native-webgpu's `PostProcessing.tsx` example on both devices.

Probes: `srgb`, `aces`, `shadow1`, `shadow2`, `bgnull`, `pmrem`, `mrt`, `ssr`, `bloom`, `clustered`, `storage`, `msaa`, `shared`, `skiatex`, `pipecache`.

**Results: not run.** This session runs the iPad Pro rows at the end; no iPhone 17 is cabled and no simulator is used. Every iPhone 17 row stays open. A simulator or browser result is labelled as such and never fills a row.

If a probe renders black or corrupt, G5 applies: stop, bisect the four suspects named in the spec (a missing `context.present()` after `pipeline.render()`, canvas format and alpha mode, depth format with `reversedDepthBuffer`, MSAA store mode), and propose a fix. No silent fallback to the linear path while the flag is on.

## Options considered

### A. Keep the simulator rule (status quo)

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Risk | Low; the path is known to draw |
| Look | Cannot reach the target. Tone mapping, sun shadows and bloom are the three things Slop's frame is built on |

### B. Physical mode behind a flag, gated by Phase 0 (chosen)

| Dimension | Assessment |
|---|---|
| Complexity | Medium. One flag, one pipeline, probes |
| Risk | Bounded: flag off is byte-identical, and G5 stops the lane on a black frame |
| Look | Matches Slop's renderer setup |

### C. Switch the default renderer path now

Rejected. It ships an unproven path to every build and breaks the flag-off invariant the existing snapshot tests pin.

## Consequences

- `city-world.md` § react-native-webgpu rules keeps the old rule as quoted history and points here.
- Every number in the table above is a start value. The per-tier values (shadow tile size, SSR on or off, clustered light count) live in the handoff and are replaced by measured ones in lane F1.
- Until Phase 0 passes on a device, the physical mode is a flag a developer turns on, not a mode a Caller sees. G8 holds default-on until Mike signs off D2 frames from both devices.

## Action items

1. [ ] Phase 0 rows on iPad Pro, JS and worklet runtimes (this session, end).
2. [ ] Phase 0 rows on iPhone 17 (open: no device cabled).
3. [ ] Update this ADR's status and `city-world.md` with the results.
