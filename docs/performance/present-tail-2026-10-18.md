# Present tail — the swapchain hand-off lane (Surface Duo, 2026-10-18)

Companion to `ui-thread-attribution-2026-10-17.md` (U1), `gpu-budget-2026-10-17.md`
(G1), `worklet-ab-2026-10-17.md` (R1) and `vd-lane-2026-10-18.md`. Lane scope:
the `present()` half of the frame on the physical Surface Duo 1 (2700×1800,
~60 Hz), at `feat/valdrada-look` tip (3b13394).

## Where we are

The in-app probe (`EXPO_PUBLIC_GAME_PERF=1`, staged in G1) now reads, on the
worklet render path while walking:

| stage | p50 | p90 | verdict |
| --- | --- | --- | --- |
| `updateMs` | ~0.9 ms | — | scene work is free |
| `renderMs` (encode + submit) | ~11.4 ms | ~13.8 ms | **inside the 16.7 ms budget** |
| `presentMs` | 0.15–4.8 ms | **16–20 ms** | one full vsync whenever it misses |

`present()` is `GPUCanvasContext::present` → `SurfaceInfo::presentFrame()` →
`wgpu::Surface::Present()` (`vkQueuePresentKHR`). It is a hand-off, not work:
a ~16.7 ms tail is a *wait for a queue slot*, exactly what U1 attributed to
`dequeueBuffer` back-pressure plus SurfaceFlinger GPU-deadline / buffer-stuffing
misses.

## The present path, end to end (as shipped)

```
GameScreen (paused canvas, on-demand draws — one invalidate per store write)
  → ThreeCanvas → ThreeSurface → react-native-webgpu <Canvas opaque={false}>
  → WebGPUView.resolveKind() → KIND_TEXTURE_VIEW → WebGPUTextureView
  → SurfaceTexture → ANativeWindow → Dawn wgpu::Surface (Vulkan swapchain)
  → BufferQueue producer → GLConsumer latched on the RenderThread traversal
  → app-window BufferQueue → SurfaceFlinger
```

Two BufferQueues sit in series. The canvas queue's consumer is the app's own
RenderThread (`GLConsumer` latch during traversal), which is itself gated by
the window queue's back-pressure — the U1 worst frame was a 52 ms
`postAndWait`/`dequeueBuffer` stall on exactly that thread. When the
RenderThread misses a traversal, the canvas queue stays full for a whole
vsync and the next `present()` parks the render thread for ~one frame. That
is the p90 tail.

The producer can also simply outrun vsync: the canvas is `paused`
(on-demand), but each camera/caller write draws a frame, and input writes can
land several per vsync. Every draw presents; the fifo has nowhere to put the
extras.

## Knob audit — what exists, and where

| Knob | Exists? | Reachable from app code? |
| --- | --- | --- |
| `presentMode` (fifo vs mailbox) | Hardcoded `wgpu::PresentMode::Fifo` twice: `GPUCanvasContext.cpp:31` (`configure`) and `SurfaceRegistry.h:332` (`configure`) | **No** — `GPUCanvasConfiguration` has no presentMode field, and both sites force Fifo after whatever JS sends. Changing it means a Dawn/rnwgpu patch; on Android the window surface usually only advertises FIFO(+FIFO_RELAXED) anyway. |
| Swapchain buffer depth / `setMaxDequeuedBufferCount` / `native_window_set_*` | Nothing in rnwgpu calls them; the ANativeWindow is `ANativeWindow_fromSurface` → handed to Dawn | **No** — queue depth is the platform default inside the TextureView's SurfaceTexture. |
| `Surface.setFrameRate` vote | `SurfaceFrameRateVote.java` exists, wired via `onAnimating`/`AnimationReporter` | **Only for `SurfaceView` canvases** (`WebGPUView.java:158` — `votesFrameRate = kind == KIND_SURFACE_VIEW`). A TextureView surface can't vote; the window-level vote already exists via the local GamePerf module (`EXPO_PUBLIC_WORLD_FRAME_RATE`, `display-rate.ts`). The gen-1 Duo exposes a single ~60 Hz mode — moot here. |
| `SurfaceControl.Transaction` flags | `WebGPUSurfaceViewWithSC.java` exists in the package | Not wired into `WebGPUView.resolveKind` — dead code upstream, not reachable via props. |
| Frame pacing | JS path: RN `requestAnimationFrame` (Choreographer/vsync). Worklet path: 16 ms `setTimeout` poll ('poll', default) or the UI-runtime native rAF ('vsync', `EXPO_PUBLIC_WORKLET_VSYNC`, `render-runtime/worklet-host.ts:49`) | **Yes**, already flag-gated. Pacing the producer doesn't remove the tail — it prevents over-production, but a single missed vsync still stalls the fifo. |

## App-side present waste — audited, none found

- **No per-frame reconfigure.** three configures the context once per canvas
  target (`WebGPUBackend.js` `get context()`); `backend.updateSize()` on
  `setSize` drops the cached context, so a resize re-`Configure`s once — a
  real swapchain rebuild, but bounded to the render-scale cadence (≤1 step /
  1.5 s, damped) and to actual layout changes. `mountRenderScale` re-asserts
  `setPixelRatio` every frame but `CanvasTarget.setPixelRatio` early-returns
  on an unchanged value (`CanvasTarget.js:138`) — verified, no churn.
- **No present-without-draw.** Both paths present only inside `draw()`
  (`ThreeCanvas.tsx`, `game-render.ts:157`). The worklet loop parks after two
  quiet ticks (`idleTicks >= 2`) and wakes once per snapshot write.
- **No double present.** One `context.present()` per draw on both paths; the
  vsync driver ticks the same `tick()` — it does not present independently.
- `onSurfaceChanged` → `SurfaceInfo::resize` updates only the dp client size;
  it never touches the swapchain (the drawing buffer tracks
  `canvas.width/height`, applied lazily in `getCurrentTexture`).

## What this lane changed

Upstream react-native-webgpu 0.16.0 already ships a third presentation
backend we weren't using: `WebGPUHardwareBufferView`, opt-in via
`<Canvas android={{ surfaceType: 'HardwareBufferView' }}>` (API 29+, falls
back to TextureView below). In pool mode (`SurfaceRegistry.h` §"AHB-pool"),
frames render into a 5-slot pool of `AHardwareBuffer`s imported as Dawn
`SharedTextureMemory`; `presentFrame()` → `poolPresent()` is `EndAccess` +
fences onto a waiter thread — **no BufferQueue, no fifo**. A waiter thread
polls each frame's render-complete sync fd, publishes the *latest* signaled
slot (superseded ready frames go straight back to Free), and the view wakes
on the UI thread to draw it inline via `Bitmap.wrapHardwareBuffer` — mailbox
semantics at the app level. Slot release rides a `HELD_MAX = 2` ring on the
UI thread (`WebGPUHardwareBufferView.java:41`), so the producer never waits
on the compositor; its only block is a bounded 1 s free-slot wait that drops
the frame instead of stalling (`SurfaceRegistry.h:1023`).

The flag:

- `ThreeCanvasProps.androidSurfaceType` threads through
  `JsThreeCanvas`/`WorkletThreeCanvas` → `ThreeSurface` → `Canvas`
  (`types.ts`, `surface.native.tsx`, `surface.web.tsx` no-op fork).
- `EXPO_PUBLIC_GAME_SURFACE` (default OFF → `auto` → today's TextureView)
  selects the game canvas's backing view in `GameScreen.tsx` via
  `perf/surface-type.ts`: `ahb`/`hardwarebuffer` → HardwareBufferView,
  `surfaceview` → SurfaceView (own SurfaceFlinger layer + frame-rate vote,
  but behind-window stacking and no parent-opacity fade), `textureview` →
  explicit TextureView. Parsed by `parseGameSurfaceFlag`; tested in
  `perf/surface-type.test.ts`.

Flag-off diff is zero: `androidSurfaceType: undefined` → `surfaceType:
undefined` → `resolveSurfaceType` → `'auto'` → the same TextureView.

**Predicted effect:** `presentMs` collapses to the mutex+push it actually is
(sub-ms); the ~16.7 ms fifo stall is gone by construction — a late frame is
superseded by the next, not queued behind it. The window-side leg (the
RenderThread's `dequeueBuffer` on the app-window queue, U1's dominant stall)
is untouched — the frames still land in the window, so total wall-frame rate
may not move; what moves is the *tail*: the render thread is no longer parked
by it, so production cadence stops compounding consumer misses.

## Risks to verify on-device before flipping the flag

1. **Feature gate.** Pool present requires Dawn's
   `SharedTextureMemoryAHardwareBuffer` feature (`SurfaceRegistry.h:631`);
   without it the pool marks `_poolUnsupported` and the canvas renders into
   the offscreen fallback — i.e. **a blank canvas, silently**. Adreno 640
   exposes `VK_ANDROID_external_memory_android_hardware_buffer`, but verify:
   `adb logcat | grep WebGPUNativeBufferView` warns "device lacks
   SharedTextureMemoryAHardwareBuffer" if not.
2. **Cost shift.** Per frame: one fence-waiter wake → one main-looper
   `consume()` → `invalidate()` → a fullscreen AHB `drawBitmap` inside the
   window traversal. That's the same class of per-frame compositor cost the
   TextureView layer already paid, plus a small UI-thread wake. Measure
   `gfxinfo`/FrameTimeline again — the RenderThread leg was already the
   window's bottleneck.
3. **Release heuristic.** Slots recycle when two later frames have been
   consumed, not when SurfaceFlinger finishes with them — safe by
   construction (AHB reads are fence-gated), but under a dead UI thread the
   producer drops frames instead of stalling. That is the intended trade.

## Deliberately not built

- **PresentMode/queue-depth patch.** Forcing mailbox through
  `GPUCanvasContext.configure` would need a C++ patch to rnwgpu plus Dawn
  capability plumbing, and Android window surfaces typically advertise FIFO
  only. The AHB pool delivers the same semantics one layer up, from existing
  upstream code, behind a JS prop — strictly cheaper to try.
- **Inflight-frame cap / frameLatency hints.** Not exposed anywhere in the
  chain (`ANativeWindow` buffer calls, `Surface.setMaxDequeuedBufferCount`,
  `ThreadedRenderer` knobs). Would need a native patch; revisit only if the
  `ahb` run shows the tail moved rather than removed.
- **Draw coalescing above one-per-vsync.** The on-demand canvas already
  dedupes queued invalidates, but a second write during an in-flight draw
  queues another rAF — deliberate lowest-latency semantics, and throttling it
  trades responsiveness for the same tail the AHB pool already removes.
  Revisit only if `ahb` shows over-production remains a cost.
- **Default flip.** `EXPO_PUBLIC_GAME_SURFACE=ahb` stays opt-in until a Duo
  run confirms (a) the feature exists, (b) presentP90 collapses, (c) the
  extra UI-thread consume doesn't move jank elsewhere.

## Remaining walls (product calls, not this lane)

- The **window queue / RenderThread** leg: TextureView *and*
  HardwareBufferView both land inside the composed window, so U1's
  `dequeueBuffer` back-pressure on the app window is unchanged by this flag.
  A `SurfaceView` canvas (same flag, `surfaceview`) moves the present onto
  its own SF layer and out of that queue — worth an A/B on-device, with the
  stacking caveats noted above.
- **Render-scale floor** (0.5, `render-scale.ts`): the flag doesn't interact;
  lowering it is the product decision noted in the lane brief.
- **UI-thread ceiling**: window-level jank (Rive overlay composition, Fabric
  sync) is orthogonal — the canvas present path no longer amplifies it, but
  it was never the root cause there.

## Verification status

- `node --experimental-strip-types --test 'features/game/**/*.test.ts'` from
  `packages/app`: **499/500 pass** — the single failure is
  `world/budget.test.ts`'s wall-clock scene-build gate (BUILD_BUDGET_MS 900,
  measured 1061 ms under the parallel suite; **259 ms solo**, passes on
  re-run — load flake, unrelated to this lane).
- `packages/ui` node tests (`three/**` + top-level): 94/94 pass.
- `tsc --noEmit`: clean in `packages/ui` and `packages/app` (typescript
  6.0.3 from `node_modules/.pnpm`).
- Device: **unrun** — `EXPO_PUBLIC_GAME_SURFACE=ahb` needs the Duo walk +
  probe + `gfxinfo` to confirm the predicted presentMs collapse and the
  feature gate.

## 2026-10-18 continuation — AHB + free-run on the Duo (measured)

Device verification done (Surface Duo, release build, VD + shadows off +
living city, GAME_PERF=1):

| Path | fps | cpuP50 | renderP50/P90 | presentP50/P90 | intervalP50 |
|---|---|---|---|---|---|
| TextureView + rAF | ~32 | ~16 | 11.4 / 13.8 | ~0.4 / 16–20 | ~31 |
| AHB + rAF | ~31.7 | 11.8 | 10.9 / 15.6 | 0.03 / 0.05 | ~31 |
| **AHB + free-run** (`GAME_FREERUN=1`) | **~30.7** | 22.5 | 22.0 / 37.2 | 0.04 / 0.08 | **30.06** |

The present tail is gone for real (0.08 ms p90) — but free-running the
producer buys **zero fps**: with the fifo gate removed, the ~30 ms/frame
stall re-materialises inside `renderer.render` itself (encode + queue
submit + swapchain texture acquire: renderP50 11.4 → 17 → 22 ms as the
producer is unthrottled). The cadence is a pipeline-throughput wall —
Dawn + driver + the 5-slot AHB pool at 570k tris / ~60 draws / 1275×850 —
not the scheduler. rAF, worklet-vsync and setTimeout pacing all converge
on ~30–33 fps on this hardware.

Verdict on pacing flags: `GAME_FREERUN` stays off by default (it only
moves the stall and burns CPU doing it), `GAME_SURFACE=ahb` stays opt-in
until proven on more devices. The instrumentation for this verdict —
interval p50/p90 in the submission report and the one-shot `canvas
pacing` vote log — ships in the sampler (`080153b`).

Remaining honest paths to 60 on the Duo, all work-reduction not
scheduling: (a) render-scale floor below 0.5 (product call — buffer is
1275×850 now), (b) a cheaper material stack for the merged far/mid tree
meshes (the TSL node path is the encode cost), (c) mid-tier imposters
pushing visible tris well under 500k.

### N1 soak (same build, ~2 min sustained walk)

intervalP50 **33.33 ms / P90 33.71** — the producer locks onto exactly two
60 Hz vsyncs. renderP50 21.8 / P90 23.5 at the 0.5 scale floor
(1080×720 buffer, 611k tris), presentP90 0.1 ms, cpuP50 22.3 / worst ~28,
zero parked intervals, zero thermal verdicts. Steady ~30–31 fps with no
jank spikes — a stable half-vsync cadence, not a degrading one.

This also settles the render-scale question empirically: even at the 0.5
floor the pipeline is encode-bound (render() ≈ 22 ms > one vsync), so a
sub-0.5 floor changes pixels, not the frame cap. The only remaining 60
fps lever is getting render() under ~12 ms — roughly half the current
work: mid-tier imposters (611k → ~300k tris) or a cheaper material path
for the merged tree draws.

### Lean tier + free-run — the last 1.4 ms (same device, `25db337`+`253326e`)

`VD_LEAN` (`25db337`) halves the near cap to 24 and writes every mid-tree
through the shared far cross-card pool (~8 tris a tree instead of ~900,
mid meshes idle at count 0). Measured walking, AHB + free-run, shadows
off, living city on, scale at the 0.5 floor (1275×850):

| | default tiers | `VD_LEAN` |
| --- | --- | --- |
| trianglesP50 | ~611k | **~422k** |
| drawCallsP50 | ~60 | **48** |
| renderP50 / P90 | 21.8 / 23.5 ms | **18.0 / 19.0 ms** |
| cpuP50 / worst | 22.3 / ~28 ms | **18.5 / 22.7 ms** |
| intervalP50 / P90 | 33.33 / 33.71 ms | **33.35 / 33.73 ms** |
| presentP90 | 0.08 ms | 0.13 ms |

The triangle cut is real (−31%) and render() dropped ~4 ms — but the
producer still locks onto exactly two vsyncs: **render() ≈ 18 ms misses
the 16.7 ms gate by ~1.4 ms**, so every frame lands on the second vsync
→ stable 30 fps. Not a jitter wall; a binary one. Under the rAF pacing
the same build reads intervalP50 ~23 ms (producer ~43 fps — the mailbox
drops the surplus, display stays ~30).

The remaining encode isn't triangle-bound (cuts didn't scale it
linearly) — it's the ~48 draws of TSL node-material encode, of which the
six-species near pool (24 full models, 12 draws) is the biggest slice we
can still trade away. `EXPO_PUBLIC_WORLD_VD_LEAN_NEAR` (`253326e`) makes
the lean near cap build-time probe-able; a near=12 run tests whether the
last ~1.4 ms is in that pool.
