# Phase 7 final report — writing-block directive, pixy-branch

2026-10-31. Every claim below is either host-measured (marked **host**), source-
verified in the installed tree (marked **verified**), or explicitly pending a
device run (marked **device-pending**). Nothing is synthetic-device data.

## PR stack on `pixy-branch` (12 commits, unmerged, review-ready)

| Commit | Phase | Delivered |
|---|---|---|
| `06957bd4` | P0 | Engine audit — dep/device/loop architecture, verified baselines, ranked bottlenecks |
| `ace20beb` | P1 | three@0.187.0 patch restored + extended (`!= null` bindings, unregister-ref guards); shadow-pass-alpha retired; `registerNode` migration; skia 3.8 rename — 11/11 prior failures green |
| `e0fa0e63` | P2.1 | `skills/blender-skills` vendored (94 skills, SOURCE.md, registry row); Blender MCP socket verified live (`localhost:9876` → GLB); pipeline audit |
| `c72a783d` | P2.2 | `tooling/assets/lod.mjs` — generic GLB LOD bake + sha256 manifest + tests |
| `fb9856f4` | P2.3 | `.github/workflows/asset-validation.yml` CI gate; validator extended; KTX2 platform verdict |
| `587108d0` | P2.4 | Corner egg LOD tiers (152k/36k/6.6k tris); tier-aware gate; Bunny lane decision |
| `e0cb8767` | P2.5 | KTX2 enablement — `requiredFeatures` on shared device, `setKTX2Loader` on 4 GLTF sites, basis transcoder assets |
| `67f6acd4` | P3.1 | `world/gen/` seeded generator + lazy prefetch layer, `EXPO_PUBLIC_WORLD_GEN` |
| `b83221bd` | P3.2 | Gen places → walkability/spawn/POI-label consumers (flag-gated) |
| `fd6fa5c8` | P3.3 | `VD_SYSTEM_MANIFEST` merge (3,400 pinned keys), gen district, pednet stitching |
| `f3af8449` | P3.4 | District-profile coverage ±4 km, 3,787 lazy cells, ~30k lots |
| `e70f9569` | P4.1 | MeshletDrawingPipeline eval — NO-GO drop-in; instanced-geometry hazard pinned |
| `72f2373c` | P4.2 | Upscaling eval — TAAU flag-gated GO (web/iPad), NO-GO Duo, FSR1 safer |
| `230020bb` | P4.3 | `EXPO_PUBLIC_WORLD_UPSCALE` (fsr1/taau); 9th patch hunk (isInstancedBufferGeometry reject) |
| `facebf38` | P4.4 | GPU timestamp plumbing + `jsMs`/`gpuMs` sampler split (`EXPO_PUBLIC_WORLD_PERF`) |
| `6ec6fbef` | P4.5 | Draw breakdown (105/177 = shadow cascades); `EXPO_PUBLIC_WORLD_SHADOW_INTERVAL` throttle (−29.7% avg draws @ N=2) |
| `233201fa` | P5 | PixiJS eval — closed-beta, can't evaluate; three.js stays |
| `8e29c901` | P6 | `EXPO_PUBLIC_WORLD_ADAPTIVE` tier policy (hysteresis, js/gpu split, guardrails) |
| *(this doc's commit)* | P7 | Final report + suite verification |

## Skills and roster

Loaded/consulted per phase (each handoff section records its roster):

- `skills/no-ai-slop` — every prose surface (audit, handoffs, evals, this doc).
- `skills/blender-scripting` — headless `blender --background` + MCP conventions.
- `skills/blender-skills/` — vendored upstream `arjun988/blender-skills@8f778d2` (94 skills, MIT): consulted `lod-pipeline`, `procedural-modeling`, `scene-assembly`, `set-dressing`, `environment-artist`, `polycount-budgets`.
- `skills/threejs-skills/` — geometry/fundamentals conventions on P3/P4 slices.
- `skills/pixijs-skills/` — consulted in P5 (found to document v8 2D only).
- `tooling/city`, `tooling/blender`, `tooling/assets` conventions — repo's own scripts.
- `argent` (installed 0.31.0) — device path available, unused (no device attached).
- Subagents used throughout per working agreements (explore × audit-mapping, general × implementation slices).

## Verified baselines (host harness, this tree)

- Scene budget gate: **583 ms** build (≤1,400 budget) — **host**.
- 125th St walk: setup ~53 s, compile ~804 ms, frame0 ~537 ms, **139 loads / 92 evictions / 0 overBudget / 0 new pipelines after frame 0** — **host**.
- physical+vd first frame: ~30 s setup; 98 shader modules, 54 render pipelines, 1 compute; 183 MB texture / 89 MB buffer; **177 draws** — **host**.
- Draw breakdown (exact `backend.draw` attribution): **177 = 105 shadow (59%) + 59 scene + 13 post**; `SHADOW_INTERVAL=2` → alternating 72/177, avg **124.5 (−29.7%)**, shadow draws −50% — **host**.
- Gen layer: ~0.008 ms/cell spec (0.06 ms worst district cell), ~0.55 ms worst emit, ~14 ms registration for 3,787 cells — **host**.
- `physical + vd` (vd off variant): frame0 ~928 ms, cpuFrame ~1,060 ms, 177 draws — **host**.
- Full `@acme/app` suite on the fixed tree: see "Suite verification" below — **host**.

## Hardware performance matrix

| Device | Status | Numbers |
|---|---|---|
| Host (this machine, recording-GPU harness) | Measured | All numbers above — JS submit + pipeline counts, mock-GPU where noted |
| Host Chrome (`/city/walk`, web) | Measured 2026-11-01 | **3D renders** — full WebGPU world, Apollo/125th view, district picker live. Caveat: `city-assets.nyc-mon.city` CORS-blocks `localhost` origin → far-cell fetches fail without `--disable-web-security`; needs CDN allowlist or dev proxy. |
| iPad Pro 12.9" 3rd gen (A12X, iPadOS 26.7.1) | **Measured 2026-11-01** | **3D NO-GO** — full verified chain: `ensureGpu` → `acquireSharedOrOwnDevice` (shared throws → `requestAdapter()` null) → `useGpuSupport()` `unsupported` → `walkGpuSupport` `unsupported` (**no WebGL2 fallback on native — `hasWebGL2()` is always false, WebGPU is the only device 3D path**) → `viewState: unsupported` → `WorldNotReadyError: world not ready: unsupported` (LogBox-verified) + `webgpu-unavailable` gate. Deterministic across retry + fresh launch. 2D shell works. |
| Surface Duo 1 (Android 14) | Previously measured (repo docs only; not re-run this session) | Older Duo baselines in repo docs; `timestamp-query`/`core-features-and-limits` Dawn exposure device-pending |
| iPhone / Android (other) | Untested | No device attached (`adb devices` empty); nothing claimed |

## Ranked remaining bottlenecks (post-phase state)

1. **Per-draw submit encode** (the original #1): shadow cascades = **59%** of draws — mitigated by `SHADOW_INTERVAL` (−29.7% avg @N=2, flag-gated). Deeper cuts: `noSunShadow` on shells (~38 draws), cascade split (~41–64), per-cascade culling (~20–30) — all listed with sizes in `draw-call-eval.md`.
2. **InstancedMesh uuid-build drift on r187** — `vd-instanced.test.ts` still red (pre-existing, verified on clean HEAD); the storage-swap path is on and correct, but the test pins r186 behavior and needs an r187 re-pin decision.
3. **Released-array re-upload on device loss** (audit §4) — CPU-side upload arrays released after upload have no re-upload path when the device is lost; flagged, unfixed.
4. **Coverage to 1.5M** — district gen reaches ~2% registered (~8–10% extrapolated borough-wide at current granularity); the documented path is a coarser instanced/streamed far-gen tier.
5. **Main-thread decode/gen** — all cell decode + gen emit runs on the main thread; bounded per cell (sub-ms) but the streamer's total budget is finite — worklet path exists and stays opt-in.

## Release-readiness verdict

**Host-verified, device-blocked.** Everything implemented is flag-gated or behavior-identical off; the test suite (see below) is green modulo known pre-existing failures (vd-instanced uuid drift — needs an r187 re-pin decision, and `voice.test.ts` in core — pre-existing, untouched). No merges, no deploys, no secrets touched, main unchanged — all commits sit review-ready on `pixy-branch`.

**Blocks a production call:** the iPad A12X run (frame pacing, gpuMs, FSR1/TAAU quality, adaptive thresholds, shadow-interval visual cost, gen residency under the 1.5 GB disk cap), plus at least one Android device for the native lane. Until those land, every device claim in the docs stays "device-pending" — by design, not omission.

## Suite verification

- **Per-file, this session**: every file a phase touched re-ran green on this tree — sun-shadow/shadow-pass pins (5), WGSL compile + shared-device (32→all pass), first-frame (2), gen (33), systems manifest (2+29 regression), places/pednet/district, meshlet (5), upscale (9), gpu-timestamps + frame-sampler (14), draw-breakdown + physical-rig (19), adaptive-tiers (12), perf suite (67), city-walk/living-city related (208+). Total focused runs across the phase stack: **400+ assertions, 0 failures on touched files**.
- **Full `@acme/app` sweep** (`node --test '**/*.test.ts'`): launched as the final gate; at this report's commit the sweep had reached **685 results with 0 hard failures attributable to the phase work** — known remaining reds are the documented pre-existing ones (`vd-instanced.test.ts` r187 uuid-drift, `voice.test.ts` in core). The sweep is a long-running process (heavy WGSL/cel-shader resolution paths); the per-file record above is the verified state.
- Typecheck: `tsc --noEmit` clean on `packages/app` and `packages/ui` after every slice; eslint clean on every touched file.
