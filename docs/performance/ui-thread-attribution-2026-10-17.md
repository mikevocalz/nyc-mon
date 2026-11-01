# UI-thread attribution — M0 walk (Surface Duo, 2026-10-17)

Companion to `baseline-duo-2026-10-17.md` (lane M0, commit `4fd4bd5`). The
baseline measured the walk; this note says *what the UI thread is actually
doing* during it, per lane U1 of the performance pass.

**Scope correction:** the performance-pass plan assumed UI-stage p50 ≈ 38–44
ms on the Duo. M0 measured p50 **7.0 ms** / p90 **18.8 ms** — the earlier
Rive views had already moved to worker threads. The device bottleneck is
`draw→swapBuffers` (p50 25.6 ms) plus `swap→GPU done` (p50 16.2 ms), not UI
work. This lane therefore attributes the UI p90 tail honestly and takes only
the cheap, evidence-supported Rive win; it does not rewrite the controller.

## Sources and their limits

| Source | Window | Notes |
| --- | --- | --- |
| `m0-duo/gfxinfo-framestats.txt` PROFILEDATA | 120 frames (~2 s of the walk) | Column-aligned stage timings |
| `m0-duo/gfxinfo-summary.txt` | 4,927 frames, full walk | p50 36 / p90 53 / p95 57 / p99 65 ms; 33.7 % janky |
| `m0-duo/m0-walk.perfetto-trace` | **20.03 s** of the ~84 s walk (ts 38576102.2→38596131.3 ms; 574 FrameTimeline frames) | Config asked 150 s; the buffer filled — `traced_buf_patches_failed=12754`, DISCARD semantics. Jank in this window (14.5 %) is lower than the full-run 33.7 %, so the trace is a *calmer sample*, not the worst part of the walk |
| `m0-duo/logcat.txt` | full run | No controller/Rive warnings |

Trace thread map: `com.nycmon.app` pid 9597, UI thread tid 9597,
RenderThread tid 9629, JS `mqt_v_js` tid 9635, `Rive CmdServer` tid 9773,
`GPU completion` tid 10130.

## Frame pipeline, from `gfxinfo` PROFILEDATA (n = 120, device-side)

| Stage (PROFILEDATA columns) | p50 ms | p90 ms | p99 ms | max ms |
| --- | ---: | ---: | ---: | ---: |
| vsync → input handling done | 0.67 | 8.23 | 11.13 | — |
| input handling | 0.00 | 0.00 | — | — |
| animation | 0.73 | 3.43 | 6.07 | 6.17 |
| traversal (measure/layout/draw record) | 0.17 | 0.28 | 0.36 | — |
| draw → sync queue | 0.12 | 0.17 | — | — |
| **sync queued → sync start** | **5.61** | **14.56** | **23.67** | — |
| sync → issue (submit to RenderThread) | 0.25 | 0.61 | — | — |
| **UI stage total (handle → issue)** | **6.96** | **18.81** | **27.47** | **28.42** |
| issue → swapBuffers | 17.39 | 29.76 | — | — |
| swapBuffers → GPU done | 16.15 | 24.25 | — | — |
| `dequeueBuffer` (RenderThread wait) | 16.32 | 28.73 | — | 32.61 |
| `queueBuffer` | 0.32 | 4.79 | — | 6.66 |

UI compute excluding the sync wait ≈ p50 **1.39 ms** / p90 **4.14 ms** / p99
6.73 ms (total minus `syncq→syncstart`). The sync wait is ~**76 %** of the UI
stage at p50 and ~**86 %** at p90 — it is the tail.

## Trace evidence (device-side, the 20 s window)

UI-thread slices (tid 9597):

| Slice | n | total ms | avg ms | max ms |
| --- | ---: | ---: | ---: | ---: |
| `animation` (per-frame callbacks: RN/Reanimated + `Rive/PollMessages` + Fabric mounts) | 1,187 | 1,026.2 | 0.86 | 5.61 |
| `traversal` | 285 | 993.5 | 3.49 | 52.39 |
| `draw` | 285 | 936.6 | 3.29 | 52.26 |
| `postAndWait` (UI blocked on RenderThread sync) | 285 | 868.3 | 3.05 | 52.09 |
| `input` | 3 | 6.7 | 2.23 | 6.52 |
| `Rive/PollMessages` (inside `animation`) | 1,187 | **36.4** | **0.031** | 0.439 |

RenderThread (tid 9629): `Drawing` 285 × avg 3.32 / max 18.04 ms;
`dequeueBuffer` 285 × avg 2.56 / **max 54.79 ms**; `queueBuffer` 570 ×
0.73 ms; `eglSwapBuffersWithDamageKHR` 340.9 ms total; `flush commands`
253.6 ms; `syncFrameState` 230.7 ms.

Per-thread running time in the window (sched): JS 4.18 s, UI 1.77 s (~9 %
of wall), RenderThread 0.91 s, `Rive CmdServer` 83.8 ms, `GPU completion`
70 ms. The UI thread is mostly *sleeping*, waiting on the pipeline.

FrameTimeline jank verdicts (574 frames): `None` 491; involving
**SurfaceFlinger GPU deadline** 60; involving **Buffer Stuffing** 32;
involving **App Deadline Missed** 15. The app rarely misses its own
deadline — the misses are downstream.

The worst frame (`doFrame`, 58.15 ms): traversal 52.39 ms of which
`postAndWait` 52.09 ms; Fabric mount work inside `animation` ≈ 1.19 ms.
That is one RenderThread-side `dequeueBuffer` stall (54.8 ms on the matching
frame) propagating back to the UI thread — **buffer backpressure, not UI
compute**.

## Attribution

| Suspect | Verdict | Evidence |
| --- | --- | --- |
| Fabric commits / mounts | Minor | Appears inside `animation`, ~1.2 ms on the worst frame; nothing near the p90 tail |
| Layout / traversal | Minor | `traversal` p90 ≈ 0.28 ms compute; its 52 ms outliers are `postAndWait` inside |
| Gesture / input | Minor | `input` column p50/p90 = 0 ms; one 27.6 ms `deliverInputEvent` outlier, not a p90 driver |
| Choreographer overruns | Symptom, not cause | Large `doFrame`s are `postAndWait`/`dequeueBuffer` stalls |
| **Rive wake/poll storm** | **Real but tiny** | `Rive/PollMessages` fires every vsync (1,187×) at avg **0.031 ms** — ~1.8 ms/s of UI time. The settled/paused render-skip patch (`patches/@rive-app__react-native@0.5.5.patch`) already gates `worker.draw`; a parked view still reposts a no-op `doFrame` per vsync — a wake, but microseconds |
| Sync / buffer backpressure | **Dominant** | `syncq→syncstart` ≈ 76–86 % of UI stage; RenderThread `dequeueBuffer` max 54.8 ms; FrameTimeline blames SF GPU deadline + buffer stuffing |
| Unattributed | ~remainder | The trace cannot say *why* SurfaceFlinger/GPU is behind (scene triangle count, TextureView composition, vsync pacing); that is lane G/N territory, not UI-thread work |

**Bottom line:** the UI p90 tail is a *wait* on RenderThread/buffer
availability, echoed by FrameTimeline's GPU-deadline and buffer-stuffing
verdicts. Cutting JS/Fabric/Rive UI work cannot close the 36→16 ms gap; the
swap/GPU half of the frame owns that.

## Rive audit (`packages/ui/game-controls`)

- **Value-gated writes:** already in place. `rive-binding.ts` caches property
  handles and returns early when `values.get(path) === value`; all setters
  (`setStick`, `setButtonState`, `setButtonLabel`, `setPillState`,
  `setPillHoldProgress`, `setReducedMotion`) go through it.
- **Idle playback:** `ArcadeRiveSurface.native.tsx` wakes via `playIfNeeded()`
  on a changed write and calls `pause()` after `RIVE_QUIET_MS` (600 ms); the
  package patch additionally skips `worker.draw` once `settled`. No blend
  state is left running — the three RMLs contain no blend states.
- **Clipping/blend modes:** none found in the three controller RMLs.
- **Three separate parses:** fixed, behind a flag — see below.
- Residual (documented, not fixed here): the shared `CommandQueue`'s
  Choreographer `pollMessages` posts on the main thread every vsync even
  when all views are parked, and each parked view reposts a no-op
  `doFrame`. Measured cost ~0.03 ms/frame — not worth an unverifiable
  native change in this lane; candidate for lane N1's Nitro pass
  (stop reposting while `paused && !needsRedraw`, re-arm on
  `play/playIfNeeded/configure/handlePointerEvent/attach`).

## What this lane changed

- `packages/ui/rive/arcade-controls/arcade/` — merged project. `merge.mjs`
  generates `stick.rml` / `cluster.rml` / `pill.rml` from the three sibling
  `scene.rml` files: every `0:` object id is renumbered per document
  (`1:`/`2:`/`3:`), including dash-separated `sourcePathIds` lists (the
  earlier naive merge left those unresolved); the Space Grotesk
  `FontAsset` is declared once (right-six's), with start-stop's duplicate
  dropped and its `fontAssetId` references rewritten; artboards keep their
  authored stage layout, offset so none overlap. `rive inspect --summary`
  reports **0 problems** and 5 artboards; headless screenshots of
  LeftStick/Thumbpad/RightSix/StartStop are **byte-identical** to the
  per-project renders. `build/arcade.riv` is **155,273 B** vs the three
  files' 292,301 B (one font instead of two).
- `EXPO_PUBLIC_ARCADE_MERGED_RIVE` (default OFF, `parseSkyRigFlag`-style
  truthy set) selects it in `use-arcade-rive-files.native.ts`; each
  surface resolves its view model by `artboardName` so the merged file
  works. When the flag is off, behavior is unchanged.
- `merge.test.ts` pins the regeneration byte-for-byte, the id-space
  isolation, the single FontAsset and the non-overlapping stage.

Expected effect: **load-time only** — one `RiveFile` parse instead of three
(~137 kB less to decode) and fewer `RiveFile` objects to track. The trace
shows no per-frame savings to claim; flipping the flag on requires a Duo
verification run before it can become the default.

## Deliberately not built

- **Skia static-art fallback for the controller.** The measured per-vsync
  Rive UI cost is ~0.03 ms (PollMessages) plus sub-µs no-op reposts; draws
  run on the Rive worker thread; and the stick/caps/pill still need live
  animation during play. A Skia rewrite would trade an interactive
  controller for static art to save ~1 % of a UI stage that is itself not
  the bottleneck. Revisit only if a post-flag device trace shows
  controller Rive work material in the UI or RenderThread.
- **Native repost-elimination patch** (see above): the design is clear and
  low-risk, but it is a native behavior change that cannot be verified in
  this lane (device is on lane R1). Written up for N1 instead of shipped
  blind.

## Pending device verification (after lane R1 frees serial 913949703467)

1. Re-run the M0 walk with `EXPO_PUBLIC_ARCADE_MERGED_RIVE=1`: confirm the
   four controls render and animate identically, PSS drops by ~0.4 MB
   (two fewer parsed files + one font), and cold `nycmon://game` load is
   faster on the Rive-file parse path.
2. Same walk flag-off: confirm the lane changed nothing.
3. If `Rive/PollMessages` or view `doFrame` wakes ever show up meaningful
   in a new trace, hand the repost-skip design to lane N1.
