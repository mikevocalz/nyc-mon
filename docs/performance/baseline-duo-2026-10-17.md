# Baseline — Surface Duo, 2026-10-17

Lane M0 (MEASURE). Every number below came from one release build on the
physical bench Surface Duo (adb serial `913949703467`, Android 14, SDK 34,
2700×1800 @ 60.000004 Hz — see `docs/DEVICE_CHECKS.md`). Nothing here is from
a dev client, simulator or estimate.

## Build under test

- `apps/mobile` release APK: `apps/mobile/android/app/build/outputs/apk/mobile/release/app-mobile-release.apk`, 140,402,822 bytes.
- `EXPO_PUBLIC_GAME_PERF=1 ./gradlew :app:assembleMobileRelease` — final rebuild 1 m 23 s; an identical APK without the probe was already measured once (see "caveats").
- Hermes bundle: 15,480,356 bytes (`index.android.bundle`).
- The build bundled **this worktree's** `packages/*`: the per-package `node_modules` had to be real copies with `@acme/*` pointing at the worktree (symlinking the whole dir resolves `@acme/*` to the main checkout — first build silently bundled `main`). Same for `EXPO_PUBLIC_GAME_PERF`: the Gradle daemon does not inherit the caller's env, so the flag is set via `apps/mobile/.env` (`env: load .env` / `env: export EXPO_PUBLIC_GAME_PERF` in the `export:embed` log). `.env` is gitignored; the probe defaults off and cost is one `console.info` per 120 frames.

## Run under test

Cold start → deep link `nycmon://game` → lobby → START → city loaded
(~14 s) → held the analog stick deflected for ~84 s: ~35 s north (blocked
against a tree at the corner), then redirected east and walked ~50 s along
the sidewalk. Stick hold was injected via `argent gesture-custom` — `Down` at
the stick centre, `Move` to full deflection, 18 s `Move` keeps, no `Up`
between calls; released at the end. Frame deadline is 16,666,666 ns (60 Hz).

## Results

All values are from the walk window unless labelled otherwise.

| Metric | Value | Method |
| --- | --- | --- |
| Frame time | p50 36 ms, p90 53 ms, p95 57 ms, p99 65 ms (n = 4 927) | `dumpsys gfxinfo com.nycmon.app` after `reset` at walk start; histogram covers scene idle + the walk + release |
| Janky frames | 33.7 % (1 659 / 4 927); deadline missed 1 659 | same `gfxinfo` dump |
| Frames at ≥ 4 missed vsync equivalents | slowIntervals 83–120 of every 120-frame window (median 118) | JS probe `intervalMs > 1000/60` |
| JS render submission (update + `renderer.render` + `present()`) | p50 ≈ 18 ms, p90 ≈ 20–21 ms, worst ≈ 21–24 ms per 120-frame window; settled-scene windows p50 16.0–18.7 / p90 16.4–21.1 | opt-in probe `EXPO_PUBLIC_GAME_PERF=1` → `ThreeCanvas.onFrameTiming` → `console.info` via `ReactNativeJS` logcat; 96 windows between 02:10:21 and 02:18:11 |
| UI thread (anim→issue draw commands) | p50 7.0 ms, p90 18.8 ms, p99 27.5 ms | `gfxinfo framestats` PROFILEDATA, last 120 frames before dump |
| Draw→swapBuffers | p50 25.6 ms, p90 37.0 ms | same PROFILEDATA |
| swap→GpuCompleted | p50 16.2 ms, p90 24.2 ms | same PROFILEDATA |
| GPU (gfxinfo histogram) | p50 15 ms, p90 25 ms; p95/p99 land in the 4 950 ms cap bucket — bimodal, see caveats | same `gfxinfo` dump GPU histogram |
| Memory | PSS 601 928 kB at scene-loaded start → 648 658 kB after the walk (+46.7 MB); lobby idle before START was 377 716 kB | `dumpsys meminfo com.nycmon.app` |
| Draw calls | 26 visible mesh objects at spawn and every sampled walk position (host scene-graph count — a floor, not `renderer.info`) | node script over `createCityScene` scene graph, `harlem-apollo.json` |
| Triangles | 283 553 at spawn (all camera distances), max 286 281 along the 125th St walk | `visibleTriangles` helper (same rule as the world budget test), host, not device |
| Scene build | 195 ms fastest-of-three on this Mac's node | `world/budget.test.ts` — host timing, not device |
| Effective fps | ~28 fps at p50 frame time (60 Hz vsync-pacing applies: real cadence lands near 30/20/15 fps) | derived from `gfxinfo` percentiles |

## Corrections to `docs/implementation/worklet-rendering.md`

The stale figures there were from an earlier dev build; this release run
corrects them:

| Stale claim | Measured on this run | Verdict |
| --- | --- | --- |
| "~15 fps walking" | frame p50 36 ms ≈ 28 fps effective (vsync-quantized cadence; avg 4 927 frames over ~145 s ≈ 34 fps wall) | Corrected upward, but nowhere near 60 fps. |
| `renderer.render` JS p50 9 ms, p90 14 ms | JS submission p50 ~18 ms, p90 ~20–21 ms | Corrected upward ~2×. (The probe spans update+render+present, so it is a superset of `renderer.render` alone.) |
| "UI thread p50 44 ms idle, 38 ms walking" | framestats UI stage (anim→issue) p50 7 ms, p90 19 ms; total vsync→completed p50 41 ms | The UI stage alone is not 38–44 ms in this build — Rive control views now sit on worker threads (logcat shows `RiveReactNativeView ... worker=true`). The 38–44 ms figure is not reproduced; the present bottleneck is downstream (draw→swap p50 26 ms, GPU p50 16 ms). |

JS submission ~18 ms alone exceeds the 16.7 ms budget before the
RenderThread/GPU pipeline adds ~26 + ~16 ms on top — explaining ~28 fps.
Both sides are over budget; neither is a rounding error away.

## GPU timestamps — `resolveTimestampsAsync`

`three@0.186.1` `WebGPURenderer.resolveTimestampsAsync()` exists and returns
early when `renderer.info.trackTimestamp` is false or no timestamp query pool
exists. The app never enables it:

- `packages/ui/gpu/gpu-store.ts` calls `adapter.requestDevice()` with no
  `requiredFeatures` — `timestamp-query` is never requested.
- `packages/ui/three/surface.native.tsx` constructs the renderer without
  `trackTimestamp: true`.

`react-native-webgpu@0.16.0` does carry timestamp-query support
(descriptor + native structs), so a later lane can: request the
`timestamp-query` feature at `requestDevice` (guarded — verify the Adreno 640
adapter actually advertises it), set `trackTimestamp`, and read
`resolveTimestampsAsync()` after render. Not measured here; the `gfxinfo`
GPU histogram above is the only device GPU evidence.

## Artifacts (bench machine, `/tmp/m0-duo/`)

| File | Size | Contents |
| --- | --- | --- |
| `m0-walk.perfetto-trace` | 33,481,871 B | perfetto `--txt` cfg: ftrace sched/sched_switch+wakeup, cpu_freq/idle, atrace `gfx view sched sf am wm hal` + app `com.nycmon.app`, `android.surfaceflinger.frametimeline`, process_stats; 150 s TTL covering scene load + full walk |
| `gfxinfo-framestats.txt` | 41,259 B | `dumpsys gfxinfo com.nycmon.app framestats` — histogram + last-120-frame PROFILEDATA CSV (×2 windows) |
| `gfxinfo-summary.txt` | 3,518 B | `dumpsys gfxinfo com.nycmon.app` summary dump |
| `meminfo-start.txt` / `meminfo-walk-start.txt` / `meminfo-walk-end.txt` | ~3.2 KB each | `dumpsys meminfo` at lobby, at scene-loaded walk start, and after release |
| `logcat.txt` | 1.4 MB | full logcat from launch through walk; probe lines tagged `[NYC-Mon/perf]` |
| `perfetto.pbtxt` | 818 B | trace config (pushed via stdin — `perfetto -c` cannot read `/data/local/tmp` on this GSI) |

`/tmp` is wiped on reboot; copy these into a durable location if they are
still needed after this session.

## Caveats and gaps

- The gfxinfo histogram window mixes ~10 s of scene settle before the hold,
  ~84 s of held walking, and a few seconds after release — the fast bucket
  cluster at 5–12 ms is settle-time compositor frames, not walking frames.
- PROFILEDATA is a ring of the last 120 frames per window — it reflects the
  tail of the walk and just after, not the whole run.
- GPU histogram p95/p99 = 4 950 ms is the capped top bucket, not a real
  5-second frame; treat as "tail exists", magnitude unquantified.
- Draw calls counted host-side on the scene graph (26 drawables); real
  `renderer.info.render.calls` needs renderer-side instrumentation — later
  lane. Meshes can emit >1 GPU draw call (multi-material groups), so 26 is
  a floor.
- Scene-build 195 ms was measured in node on the Mac — the Duo runs Hermes
  without JIT and will be slower; device-side scene-build timing still needs
  a probe.
- Walk was ~84 s held input, not exactly 90 s, and ~35 s of it was blocked
  against a tree before steering east. Direction/state was verified on the
  accessibility tree (`Move, Analog stick, North` → `East` → `Centre`).
- **Onboarding is broken in release builds**: `startIncubation` throws on
  this build ("The egg didn't go into the case. Nothing was saved."). The
  likely cause is `crypto.randomUUID` being absent on release Hermes
  (`packages/app/features/mon/create-mon-store.ts` `defaultNewEggId` throws
  when `globalThis.crypto?.randomUUID` is not a function; the world-save
  store already guards the same API with `?.()`). The run bypassed
  onboarding via the `nycmon://game` deep link. This is a product bug to
  report, not fixed in M0.
- The Perfetto trace was captured but not opened — `trace_processor` is not
  installed on this machine. UI/RenderThread slices, SurfaceFlinger
  FrameTimeline rows and per-process stats are in the trace for a later
  pass.
