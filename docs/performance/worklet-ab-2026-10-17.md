# Worklet render A/B — R1 walk (Surface Duo, 2026-10-17)

Lane R1 of the performance pass: render the game world off the JS thread and
pace it by display vsync instead of the worklet runtime's 16 ms timeout poll.
Companion to `baseline-duo-2026-10-17.md` (M0) and
`ui-thread-attribution-2026-10-17.md` (U1).

## The finding, up front

**Pacing is now correct; the bottleneck moved to per-draw CPU cost.**

- The worklet renderer draws on a `react-native-worklets` runtime, one frame
  per UI-runtime vsync callback, and parks entirely while the scene is idle —
  the old path burned a `setTimeout`-paced rAF on the render runtime that could
  draw twice inside one display frame.
- But the draw itself costs **p50 ~18–20 ms** on both paths (JS: 17.9–18.6,
  worklet: 17.1–20.2 — the three.js scene code is identical). Anything over the
  16.7 ms budget means a frame per ~2 vsyncs, i.e. ~30–40 presented fps under
  sustained input. No scheduling change fixes that — it is lane G1's draw-cost
  work.
- Window-level jank did not improve in this build (see the caveat below): the
  canvas still presents into the same composed window and the JS-side input
  loop, store mirrors, and Rive controls still animate on the UI thread.

## What shipped

| Commit | Contents |
| --- | --- |
| `151f982` | `fix(ui): install WebGPU explicitly` — Bundle Mode's Metro `inlineRequires` never evaluated react-native-webgpu's entry side effect, so `navigator.gpu` was undefined and the worklet renderer fell back before init. `packages/ui/gpu/load-webgpu.native.ts` now calls the package's idempotent `installWebGPU()`. |
| `b30e7c4` | `perf(game): no per-frame allocations` — `cameraPose`, `poseFor`, `shadowBands`, snapshot packers/readers, the actor frame and the `ThreeCanvas` frame/probe objects all take `out` buffers; `position.set`/`lookAt` drop their spreads. Files: `city-scene.ts`, `caller-proxy.ts`, `render-snapshot.ts`, `world/{city-mesh,index,street-furniture,street-props}.ts`, `ui/three/ThreeCanvas.tsx`. |
| `91a030b` | `perf(game): vsync pacing + snapshot write fix` — `EXPO_PUBLIC_WORKLET_VSYNC`, the UI-runtime driver, `vsyncTickGameRender`, the wake/idle fix, the `[NYC-Mon/perf]` probe on the render runtime, and `game-render.vsync.test.ts`. Files: `render-runtime/{worklet-host,game-render,runtime-report}.ts`. |

## The vsync mechanism (installed-package-supported, cited)

- Worklet runtimes' rAF is a timer, not vsync:
  `react-native-worklets/src/runLoop/workletRuntime/requestAnimationFramePolyfill.ts`
  schedules `setTimeout(flushAnimationFrame, timeoutInterval)` (the
  `animationQueuePollingRate`, 16 ms here).
- The UI runtime's rAF is the native frame callback:
  `src/runLoop/uiRuntime/requestAnimationFrame.ts` loops on
  `globalThis.__nativeRequestAnimationFrame(nativeFlushQueue)` — Choreographer
  on Android.
- Driver: `worklet-host.ts` `vsyncDriverOnUI` runs on the UI runtime via
  `scheduleOnUI`; each vsync it reads `idle`/`driving` Synchronizables and, only
  when the session wants a frame, hops once via `scheduleOnRuntimeWithId` into
  `game-render.ts` `vsyncTickGameRender`, which calls `tick` if and only if the
  loop armed a scheduled frame. Parked sessions cost one `getDirty` per vsync
  and zero hops. Poll mode (`EXPO_PUBLIC_WORKLET_VSYNC` unset) is unchanged.

## The Synchronizable root cause — why the scene read version 1 forever

Symptom (05:28 run): JS logged `snapshot write 600+` while every render tick
read `ver=1` and drew nothing new — a black/frozen canvas despite a live
runtime.

Cause: worklets caches serializables **by JS-object identity**.
`serializable.native.ts` `createSerializable` → `getFromCache(value)` returns
the cached clone for the same object, and `cloneArray` does
`serializableMappingCache.set(value, clone)`. The zero-alloc pass had made the
JS writer reuse one `latest` array as its pack buffer and hand *that same
object* to `setBlocking` each write — every write re-stored the first
serialization (version 1). The nested-vs-top-level-argument theory was wrong;
the freeze was entirely write-side.

Fix/rule, now documented on `packSnapshot`/`bumpSnapshot` in
`render-snapshot.ts`: **never hand a Synchronizable a buffer that was already
serialized.** Each write carries a fresh 21-number array; the Serializable
clone the Synchronizable builds allocates anyway, so the reuse saved nothing.
Wake paths (`wakeGameRender`, `setGameRenderRunning`) also clear `idle` before
arming — a vsync driver that skips parked sessions would never pick up a wake
that left `idle` set.

## Method

- Device: Surface Duo 1, Android 14 (SDK 34), 2700×1800, ~60 Hz, serial
  913949703467. Physical hardware, release APKs — no simulator numbers here.
- Builds: `cd apps/mobile/android && ./gradlew :app:assembleMobileRelease` with
  flags inlined at bundle time (Gradle's `export:embed` inherits the shell env;
  the bundle task must be invalidated — it does not track env inputs):
  - JS: `EXPO_PUBLIC_WORKLET_RENDER` unset, `EXPO_PUBLIC_GAME_PERF=1`.
  - Worklet: `EXPO_PUBLIC_WORKLET_RENDER=1 EXPO_PUBLIC_WORKLET_VSYNC=1
    EXPO_PUBLIC_GAME_PERF=1`.
- Walk: `nycmon://game` deep link → lobby → `input tap 1999 1019` (START; the
  a11y "Close drawer" scrim swallows accessibility-driven taps, so use raw
  `input tap`) → after `load stage: firstRender`, `dumpsys gfxinfo
  com.nycmon.app reset` → ~90 s of held-stick drags
  (`input swipe 200 1540 200 1250 4500` ×18) → `dumpsys gfxinfo … framestats`
  + summary + logcat grep for `[NYC-Mon/perf]`.
- Probes: `FrameSampleWindow`, 120-draw windows. `cpuPMs` = time inside the
  draw call (scene update + `renderer.render` + `present`); `intervalMs` =
  time between consecutive draw starts — on the worklet path that interval is
  the pacing under test. Same `EXPO_PUBLIC_GAME_PERF=1` tag on both paths.
- Fairness note: the JS numbers (`gfxinfo-js-*.txt`, `logcat-js.txt`, captured
  03:27) predate the sync fix, but the fix only touched the worklet write path
  (`worklet-host.ts`), so they stand. Their 8,499-frame window is longer and
  mixes in calmer time; the worklet window is 3,519 frames of pure sustained
  stick drive. Treat the gfxinfo delta as directional, not precise.

## Results

| Metric (method) | JS path (`EXPO_PUBLIC_WORKLET_RENDER` off) | Worklet + vsync (`=1`, `VSYNC=1`) |
| --- | --- | --- |
| Window frames rendered (gfxinfo) | 8,499 | 3,519 |
| Frame p50 / p90 / p95 / p99 (gfxinfo) | 32 / 48 / 53 / 61 ms | 48 / 69 / 73 / 85 ms |
| Janky frames (gfxinfo) | 27.50 % | 43.00 % |
| Missed vsync / slow UI thread / slow issue-draw (gfxinfo) | 12 / 45 / 2,332 | 384 / 662 / 1,512 |
| Render submission cpuP50 (`[NYC-Mon/perf]` probe) | 17.9–18.6 ms | 17.1–20.2 ms |
| Render submission cpuP90 | 20.0–21.0 ms | 20.7–22.8 ms |
| Steady-state worst | ~22–24 ms (first window 1,531 ms = compile) | ~23.5–25.8 ms (first window 1,579 ms = compile) |
| slowIntervals / 120 | ~103–112 | ~112–119 |
| Pacing evidence | rAF on JS thread | `driver vsync` heartbeat at ~60 Hz; parks (`idle=true`, zero hops); `drawnVer` tracks `ver` every draw |

Reading it honestly:

1. **Draw CPU is path-invariant** (~18–20 ms p50 both ways) — moving the draw
   off JS freed the JS thread but did not make the scene cheaper. This is the
   remaining gap and belongs to draw-cost work, not scheduling.
2. **Window jank did not improve** in these captures. The worklet window is a
   harsher sample (pure input), but the mechanism is real too: at ~19 ms/draw
   the canvas can only present every other vsync, so each presented surface
   forces composition mid-window; the JS input loop and Rive controls still
   animate on the UI thread regardless of where the city draws.
3. **The pacing fix is verified, not assumed**: the driver heartbeats at
   display cadence, parks cold (a still city costs one `getDirty`/vsync),
   wakes on the first new snapshot, and `drawnVersion` follows `ver` on every
   tick — versus the prior poll driver which parked permanently because its
   wakes raced `idle`.

## Bundle Mode smoke (the worklet build runs Bundle Mode)

- App launches; the `nyc-mon-render` worklet runtime is the only extra runtime
  — no second React Native instance.
- Forwarded worklet imports resolve: WebGPU installs on the runtime
  (`installWebGPUOnRuntime`), three.js loads, `compileAsync` resolves, first
  and second draws present.
- Rive views render and animate state: the controller artboards
  (`useArcadeRiveFiles` → stick / right-six / start-stop `.riv`) draw their
  artwork, and the top pill visibly transitions PAUSE → RESUME → HOLD TO STOP
  across background/resume — the state machine is running.
- Gesture handler works: the RESUME pill tap and the held-stick drags both
  register; the Caller moved intersections between screenshots (visible at
  St Nicholas Av crosswalk).
- Controller input drives worklet redraws: each drag produces snapshot writes
  → version bumps → `want=true` draws at the next vsync tick.
- No new logcat errors; runtime exceptions from worklet entry points route to
  logcat via `scheduleOnRN` + `routeRenderEvent`.

## Crashes, regressions, limitations

- No crashes on either build. No black screen after the sync fix.
- `game-render.ts` must stay free of `react-native` imports (it runs on the
  worklet runtime); the probe and error paths honour that.
- `dumpsys gfxinfo` window stats include every composed frame — lobby, loading
  overlay, control animations — not just canvas presents. The per-draw CPU
  numbers come from the in-runtime probe, not gfxinfo.
- The UI-driver vsync callback paces *this* renderer only; other
  worklet-based libraries (Reanimated animations, Rive) already use the UI
  runtime's native callback and were not modified — verified by the smoke pass
  rather than assumed.
- `Uniwind … Invalid calc` warnings during bundling are pre-existing and
  unrelated.

## Reproduce

```bash
# worklet+vsync release build (invalidate the bundle task first — it does not
# track EXPO_PUBLIC_* env inputs)
cd apps/mobile/android
rm -f app/build/generated/assets/react/mobileRelease/index.android.bundle* \
      app/build/outputs/apk/mobile/release/app-mobile-release.apk
rm -rf app/build/intermediates/{compressed_assets,assets,sourcemaps/react}/mobileRelease \
       app/build/generated/sourcemaps/react/mobileRelease
EXPO_PUBLIC_WORKLET_RENDER=1 EXPO_PUBLIC_WORKLET_VSYNC=1 EXPO_PUBLIC_GAME_PERF=1 \
  ./gradlew :app:assembleMobileRelease
adb -s 913949703467 install -r app/build/outputs/apk/mobile/release/app-mobile-release.apk

# walk
adb -s 913949703467 shell am start -a android.intent.action.VIEW -d "nycmon://game" com.nycmon.app
adb -s 913949703467 shell input tap 1999 1019            # START (raw tap; a11y scrim swallows argent taps)
adb -s 913949703467 shell dumpsys gfxinfo com.nycmon.app reset
for i in $(seq 1 18); do adb -s 913949703467 shell input swipe 200 1540 200 1250 4500; done
adb -s 913949703467 shell dumpsys gfxinfo com.nycmon.app framestats
adb -s 913949703467 logcat -d | grep 'NYC-Mon/perf'
```

Artifacts: `/tmp/r1-duo/` — `gfxinfo-js-framestats.txt`, `gfxinfo-js-summary.txt`,
`logcat-js.txt` (pre-fix JS run, still valid), `gfxinfo-wk-framestats.txt`,
`gfxinfo-wk-summary.txt`, `perf-wk-walk.txt`, `logcat-wk-final.txt`,
`bundle-lobby.png`, `bundle-btn.png`.

## Tests

`node --experimental-strip-types --test 'features/game/**/*.test.ts'`:
305/305 pass on `lane-r1` (includes `render-snapshot.test.ts` and the new
`game-render.vsync.test.ts`, which asserts the loop waits for
`vsyncTickGameRender` instead of self-scheduling). `tsc --noEmit` is clean on
every touched file; the repo carries pre-existing node-types/URL drift in
unrelated `.test.ts` files.
