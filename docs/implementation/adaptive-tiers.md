# Adaptive quality tiers — Phase 6 (PR 6), slice 1

Status: implemented behind `EXPO_PUBLIC_WORLD_ADAPTIVE` (default OFF) for
the JS-thread canvas path. Host-simulated only — every threshold below is
a chosen default; the iPad A12X run that retunes them is still pending
(`docs/performance/engine-audit-2026-10-31.md` §7: iOS entirely
unmeasured, and render-scale's own caveat — it measures JS submission
cadence — applies to `cpuMs` here too). Flag off: no sampler, no sink, no
policy object; the frame path is byte-identical.

Skills consulted: `skills/threejs-skills/` (`threejs-fundamentals` —
`renderer.setPixelRatio` is the documented resolution knob the
`renderScale` channel drives), `skills/no-ai-slop` (this doc's prose),
repo `AGENTS.md`, and the phase inputs the task pinned:
`docs/performance/engine-audit-2026-10-31.md`,
`docs/implementation/profiling.md`, `perf/tier-presets.ts`,
`perf/frame-sampler.ts`, `perf/record-city-frame.ts`,
`world/physical-rig.ts`, `post/pipeline.ts`.

## 1. The seam

The controller feeds on the same channel `recordCityFrame` reads —
`ThreeCanvas.onFrameTiming → perf/on-city-frame.ts` — the probe's real
`cpuMs` (update + nodeFrame + render + present), `intervalMs` and, when
`EXPO_PUBLIC_WORLD_PERF` armed it, `gpuMs`. Each pushed sample lands in
its own bounded `FrameSampleWindow`; a closed 120-sample report is what
the policy judges. `city-scene` registers its controller's `push` on
`adaptiveFrameBridge` while mounted and clears it on dispose — the
`living-city/adaptive-bridge.ts` convention — so `onCityFrame` forwards
samples without importing the scene, and `CITY_FRAME_SINK_ENABLED`
gained `|| EXPERIMENTAL_WORLD_ADAPTIVE` so the probe attaches.

Why this seam and not the scene's `update()`: `update` sees only the
scene's own JS cost; the canvas's probe block is the only place the full
draw (including `present()` and the timestamp pool's `gpuMs`) is
measured. The policy needs that split to classify encode- vs
render-bound (profiling.md §1).

## 2. The policy

Per closed window the report classifies:

- **over** — `cpuP50Ms > cpuOverMs` or a populated `gpu.p50Ms > gpuOverMs`
- **under** (headroom) — `cpuP50Ms <= cpuRestoreMs` and, when populated,
  `gpu.p50Ms <= gpuRestoreMs`
- **flat** — between the marks; resets both streaks (the hysteresis
  deadband)
- **inconclusive** — `activeIntervals < minActiveIntervals` (a mostly
  parked on-demand canvas) counts toward nothing

**Bound class.** When the gpu channel is populated (`gpu.samples >=
minGpuSamples`) a window is `render`-bound when the GPU half dominates —
`overGpu` and `gpu/budget` beats `cpu/budget` — else `encode`-bound. An
absent or sparse channel is `encode` by default: the measured wall is
per-draw submit encode (audit §8.1), so absent GPU evidence the policy
spends on the remedies that touch it.

**Steps.** `downWindows` consecutive over windows fire ONE downgrade
step; `upWindows` consecutive headroom windows restore ONE step — the
applied-step stack pops, so a restore lands the exact previous value and
a tier never rises past the mounted preset. After any applied step
`cooldownWindows` reports count nothing: a preset swap settles over
`evictAfterS` seconds and needs room to reach the metrics.

| Parameter | Default | Meaning |
|---|---|---|
| `downWindows` (K) | 2 | consecutive over windows before one downgrade |
| `upWindows` (M) | 4 | consecutive headroom windows before one restore — slower on purpose |
| `cooldownWindows` | 2 | post-action windows that classify nothing |
| `scaleDownFactor` | 0.85 | scale multiplier per step (render-scale's ×0.9 convention, a slower cadence) |
| `scaleFloor` | `RENDER_SCALE_FLOOR` (0.5) | provisional pending the same sign-off |
| `shadowSteps` | 2 → 4 → 8 | interval rungs; 8 is `parseShadowInterval`'s cap |
| `minGpuSamples` | 10 | resolved `gpuMs` a window needs to classify render-bound |
| `minActiveIntervals` | 30 | paced intervals below which a window is inconclusive |
| `actionCap` | 32 | bound on the action history (perf-log audit + restore stack) |

Per-tier budgets (`ADAPTIVE_TIER_BUDGETS`, keyed by the CURRENT rung):

| Rung | cpuOverMs | cpuRestoreMs | gpuOverMs | gpuRestoreMs |
|---|---|---|---|---|
| `high` | 13 | 10 | 12 | 9 |
| `ipad-a12x` | 15 | 12 | 14 | 10 |
| `phone` | 16.7 | 13.3 | 15 | 11 |

The phone row's over mark is the 60 Hz deadline; `high` expects headroom
and surrenders rungs earlier. All are host defaults — DEVICE-PENDING.

## 3. Action kinds and actuation

`AdaptiveAction` is `{kind, from, to, reason}` — a discriminated union so
the consumer's switch is typed. city-scene's `apply` maps them:

| Kind | Actuation |
|---|---|
| `tier` | `world.stream.setPreset(WORLD_PRESETS[to])` — want/keep thresholds, radius, hysteresis, budgets and the per-frame stream budget re-point; residency drains through `evictAfterS`, nothing vanishes instantly. Mount-time fields (vdPort layer budgets, `shadowTile`, the pipeline's mount-time `upscaleScale`) do NOT follow. |
| `shadowInterval` | `rig.setShadowInterval(n)` — the `WORLD_SHADOW_INTERVAL` `autoUpdate`/`needsUpdate` throttle, applied live; 1 restores every-frame refresh. The cascades are ~60 % of submit encode on the harness — the encode remedy with the most headroom. |
| `upscaleScale` | `post.scenePass.setResolutionScale(v)` — the upscale slot's scene-pass input scale (physical + `WORLD_UPSCALE`). Floor 0.25 — half the eval's 0.5 start — since the pixel-ratio floor would clamp every step. |
| `renderScale` | `renderer.setPixelRatio(baseRatio × v)` — the render-scale channel, re-asserted per frame like `mountRenderScale` (the canvas's `applySize` re-stamps the raw ratio on resize). |

Downgrade candidate order:

- **encode**: `tier` → `shadowInterval` → `scale` — cell budgets and the
  shadow throttle touch the per-draw encode wall; dropping pixels does not.
- **render**: `scale` → `tier` → `shadowInterval` — a dominating gpu
  means fill/dispatch, so the input-resolution step moves first.

## 4. Guardrails

- **Floor.** The ladder's last rung (`phone`), interval 8, `scaleFloor`.
  Steps clamp and the exhausted ladder emits nothing.
- **Explicit beats adaptive.** `EXPO_PUBLIC_WORLD_PRESET` set ⇒ `tier`
  actions suppressed (the env's row stands). `EXPO_PUBLIC_WORLD_SHADOW_INTERVAL`
  set ⇒ `shadowInterval` suppressed. An armed render-scale controller
  (`EXPO_PUBLIC_WORLD_RENDER_SCALE`, or the vd lane's implied mount)
  owns the scale channel outright ⇒ `scale` suppressed — two controllers
  on one channel would fight. A missing streamer or a sun-less rig
  suppresses the matching kind the same way.
- **Ceiling.** Restores pop the applied-step stack; a tier never climbs
  above the preset the canvas mounted.
- **History.** `controller.actions` is the bounded applied-action log;
  each action also prints one `[NYC-Mon/perf] adaptive {kind, from, to,
  reason}` line.
- **Flag off.** `EXPERIMENTAL_WORLD_ADAPTIVE` false ⇒ the scene never
  builds a controller, the bridge stays `null`, `onCityFrame` skips the
  forward, and `CITY_FRAME_SINK_ENABLED` doesn't even attach
  `onFrameTiming` unless another consumer asked. Zero policy cost.

## 5. Flags and composition

| Flag | Effect |
|---|---|
| `EXPO_PUBLIC_WORLD_ADAPTIVE` | Opt-in. Mounts the sampler+policy in city-scene and attaches the frame sink. |
| `EXPO_PUBLIC_WORLD_PERF` | Arms the `gpuMs` timestamp channel (profiling.md §4) — populated gpu blocks enable render-bound classification; without it everything is encode. |
| `EXPO_PUBLIC_WORLD_RENDER_SCALE` | When armed, owns the scale channel — adaptive `scale` steps are suppressed. |

## 6. Caveats and device-pending items

- **Host-simulated only.** The tests drive synthetic samples through a
  real `FrameSampleWindow`; they prove the policy math, not that these
  budgets are right for the A12X. Retune `ADAPTIVE_TIER_BUDGETS` and the
  K/M/cooldown table on the iPad run.
- **`cpuMs` is JS submission**, not GPU time and not the UI thread — the
  render-scale header's caveat carries over. `gpuMs` lags ≥1 draw and
  can be sparse or absent (compat-mode devices carry no
  `timestamp-query`); sparse channels fall back to the encode order.
- **Tier swap is streamer-scoped.** The streaming thresholds/budgets
  move; `vdPort` external-layer budgets, `shadowTile` and mount-time
  post settings stay where the mount put them — a full row swap needs a
  remount and is out of slice scope.
- **Restore is LIFO**, most-recent-step first — deterministic and
  drift-free, though not necessarily cheapest-visual-cost first.
- **Worklet render path unwired.** The runtime emits the same `perf`
  summary (`render-runtime/game-render.ts`); the bridge is JS-path only.
- The upscale slot's scale floor (0.25) is provisional — below the
  eval's tested 0.5 start; device eyes decide if the smear is
  acceptable at the bottom rung.
