# Profiling — Phase 4 (PR 4), slice 4

Status: implemented behind `EXPO_PUBLIC_WORLD_PERF` (default OFF) for the
JS-thread canvas path; the worklet runtime's seam is named in §5 but not
wired. Host proofs on the recording GPUDevice only — no device evidence.
No runtime change with the flag off: the arming call never runs, no
resolve is ever submitted, and every report field is unchanged.

Skills consulted: `skills/threejs-skills/` (grep for
`timestamp`/`profiler`/`trackTime` — no coverage of the WebGPU timestamp
API; the mechanism was verified in installed `three@0.187.0` source
instead), repo `AGENTS.md`, the audit's measurement-gap notes
(`docs/performance/engine-audit-2026-10-31.md` §3 render-scale caveat, §5).

## 1. What the hooks measure

Two channels, one window (`features/game/perf/frame-sampler.ts`):

- **`cpuMs` + `stages`** (pre-existing): JS submission cost — scene
  `update()`, `advanceNodeFrame()`, `renderer.render()` (traversal +
  encode + queue submit), `present()`. This is what render-scale and the
  GAME_PERF probe have always measured. It is NOT GPU time.
- **`gpuMs`** (new): the GPU's own clock — the total of a frame's
  timestamped render passes, resolved through three's timestamp-query
  pool. Populates `FrameTimingSummary.gpu`
  (`{samples, p50Ms, p90Ms, worstMs}`) — `null` when no sample in the
  window carried a resolved value.

The split the audit flags missing ("can't distinguish CPU submission from
GPU time"): compare `cpuP50Ms`/`stages.renderP50Ms` against `gpu.p50Ms`.

- high cpu, low gpu → **encode-bound** (the Duo's §8.1 wall: per-draw
  TSL/JSI submit encode).
- low cpu, high gpu → **render-bound** (fill/dispatch; the honest target
  for render-scale and upscaling work).
- both low, slow intervals → **scheduling-bound** (the ~14 ms JS-timer
  floor; pacing, not drawing).

## 2. The three-native timestamp API (r187, exact symbols)

All in `node_modules/three/build/three.webgpu.js` @ 0.187.0:

- `renderer.hasFeature('timestamp-query')` — typed
  (`@types/three` `src/renderers/common/Renderer.d.ts:1023`). WebGPU
  backend: `device.features.has(name)` (`WebGPUBackend.hasFeature`,
  three.webgpu.js:51596). WebGL2 backend: maps to the
  `EXT_disjoint_timer_query_webgl2` extension (`GLFeatureName`, 34837).
- `renderer.backend.trackTimestamp = true` — arms the per-pass pool;
  the same post-init flip three's own Inspector performs
  (`examples/jsm/inspector/Inspector.js:314`). With it on, every render
  pass descriptor gets `timestampWrites`
  (`WebGPUBackend.initTimestampQuery`, 51209;
  `WebGLBackend.initTimestampQuery`, 35894).
- `renderer.resolveTimestampsAsync('render')` — typed
  (`Renderer.d.ts:1015`; impl 25601 → `Backend.resolveTimestampsAsync`
  30429 → `WebGPUTimestampQueryPool.resolveQueriesAsync`, 48173).
  Submits `resolveQuerySet` + `copyBufferToBuffer` + `mapAsync`, then
  resolves with the **last frame's** total render-pass duration in ms
  (u64 ns delta / 1e6, 48316). The same value lands on
  `renderer.info.render.timestamp`.
- Optional constructor route also exists (`trackTimestamp` renderer
  parameter, backend init `trackTimestamp &&= hasFeature(...)`, 48885) —
  not used: the app builds the renderer inside `ThreeSurface`, and the
  Inspector-style post-init flip keeps `rendererParams`' contract
  (native-only) untouched.

## 3. Wiring

`@acme/ui/three/gpu-timestamps` (`packages/ui/three/gpu-timestamps.ts`),
worklet-safe like `renderer-internals.ts` (no runtime imports):

- `WORLD_PERF_GPU_TIMESTAMPS` — the flag.
- `armGpuTimestamps(renderer)` — called once per renderer after
  `renderer.init()` in `ThreeCanvas`'s build effect (`ThreeCanvas.tsx`).
  `hasFeature` throws pre-init; flag off skips the call entirely.
  Returns the channel or `null` (feature absent).
- `kickGpuTimestampResolve(renderer, channel)` — called once per drawn
  frame from inside the `onFrameTiming` probe block, so the extra
  submit + `mapAsync` only ever runs while a timing consumer is
  attached. The resolved ms lands on `channel.gpuMs` when the GPU
  finishes and is attached to the NEXT sample.

`ThreeFrameTiming.gpuMs?: number | null` carries it; `FrameSampleWindow`
counts it in its own sparse channel (`null` = armed but unresolved, never
a 0 ms). `recordCityFrame` prints a `gpu` block in the usual
`[NYC-Mon/perf]` line.

## 4. Flags

| Flag | Effect |
|---|---|
| `EXPO_PUBLIC_WORLD_PERF` | Arms the timestamp pool at renderer init (one `hasFeature` call). Resolves still only run under a consumer. |
| `EXPO_PUBLIC_GAME_PERF=1` | Attaches `onFrameTiming` — the consumer that makes resolves fire and prints the summary (pre-existing). |

Both on: per-frame GPU resolve + `gpu` in the log. `WORLD_PERF` alone
arms but never resolves (no consumer, no spend). Flag off: zero overhead
— no `hasFeature` call, no `timestampWrites`, no resolve submissions.

## 5. TraceSift

TraceSift is in the repo as an **npx-run analyzer**, not a dependency:
`pnpm perf:tracesift` (`@callstack/tracesift@0.4.0`,
`docs/performance/tracesift.md`). It consumes React Profiler, Hermes and
JS CPU captures — all JS-side. It cannot see GPU time, and there is no
API to feed `gpuMs` into; do not invent one.

The pairing: a TraceSift JS CPU profile answers "where do the cpuMs go";
the sampler's `gpu` block answers "is the GPU even the wall". The
integration seam for a durable artifact is `recordCityFrame`'s
`[NYC-Mon/perf]` summary line (and the worklet runtime's `perf` emit,
`render-runtime/game-render.ts`) — a trace artifact would be a captured
logcat/JSON of those lines under `~/nyc-mon-artifacts` (audit §7: nothing
device-side is committed today).

The worklet render path has the identical draw seam
(`game-render.ts:133-185`, update → advanceNodeFrame → render → present
→ `probe.push`) and already emits the summary — the helpers are
worklet-safe by construction; wiring it is a follow-up, not this slice.

## 6. Caveats and device-pending items

- **Recording-device gpuMs is mock data.** The host tests inject scripted
  u64 clock readings; they prove the query path is plumbed, not that the
  GPU took 4 ms.
- **gpuMs lags.** A sample's `gpuMs` is the last *resolved* frame's
  pass total — at least one draw old, and under backpressure several
  frames batch into one resolve and only the last is kept (the pool's
  `frames[last]`). Sparse `gpu.samples` in a window is expected.
- **Device feature required.** `timestamp-query` must be on the
  `GPUDevice`. The app's own device requests every adapter feature
  (`acquire-device.ts` `ownDeviceDescriptor`), so it is there wherever
  the adapter offers it. The **Skia-shared device**
  (`EXPO_PUBLIC_WORLD_PHYSICAL`, default ON) carries only what Skia's
  Graphite device was created with — if that omits the feature, the
  channel is `null` on the default native lane. DEVICE-PENDING.
- **Dawn compat mode does not expose `timestamp-query`**
  (`compatibilityMode = !device.features.has('core-features-and-limits')`,
  48845). If react-native-webgpu hands three a compat device, gpuMs is
  `null` — honest degradation, not a bug. DEVICE-PENDING.
- **Resolve cost while armed+consumed:** one extra command encoder
  (`resolveQuerySet` + copy) + `queue.submit` + `mapAsync` per drawn
  frame. Real but small; it is precisely why resolves only run while a
  consumer is attached.
- **WebGL2 backend** works through the same pool
  (`EXT_disjoint_timer_query_webgl2`), so web's `forceWebGL` path can
  also produce gpuMs where the extension exists.
- iOS remains entirely unmeasured (audit §7).
