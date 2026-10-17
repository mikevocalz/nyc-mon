# UI-thread investigation: Rive views, Bundle Mode, measurement

Owner: `performance`. Written 2026-10-16. Status: findings; nothing here is implemented. Read next to `docs/implementation/worklet-rendering.md`, which has the frame numbers this builds on.

Context: the Duo caps near 25 fps. `worklet-rendering.md` records JS submission at p50 9 ms / p90 14 ms and the Android UI thread at 38–44 ms. The review's directive was "pause or consolidate the autoplay Rive views, then run the Worklets Bundle Mode A/B; measure with `gfxinfo framestats` and Perfetto." This investigation found the pause work is already partially landed, so the honest first step is a re-measurement, not new code.

## The Rive views: actual inventory

Four `RiveView` instances across three `.riv` files — all inside `ArcadeController`, mounted by `GameScreen`'s HUD overlay (`GameScreen.tsx`, gated on `worldReady && handedOver`). The lobby contributes zero Rive views during gameplay.

| View | File / artboard | Component | autoPlay | Pause today |
| --- | --- | --- | --- | --- |
| Stick housing | `left-stick.riv` / `LeftStick` | `AnalogStick.tsx` | yes | `RIVE_QUIET_MS=600` quiet-park → `pause()` |
| Stick thumbpad | `left-stick.riv` / `Thumbpad` | `AnalogStick.tsx` (inside the Reanimated `Pad`) | yes | same |
| Six-cap cluster | `right-six.riv` / default | `ArcadeSixButtons.tsx` | yes | same |
| START/STOP pill | `start-stop.riv` / default | `StartStopPill.tsx` | yes | same |

Mounting chain: `(tabs)/game.tsx` → `GameTab` → `GameScreen` → `ArcadeController` → `AdaptiveControlLayout` (three slots). Files via `useArcadeRiveFiles` / `useRiveFile`.

## What is already landed

Two fixes for exactly this problem are on `main`, both dated to the 2026-10-16 Duo findings:

1. **JS quiet-park** — `ArcadeRiveSurface.native.tsx` arms a 600 ms timer on every value-changing view-model write; the view pauses when it fires. While a stick is held, writes keep its two views awake — correct, they are being touched.
2. **Native settled-draw patch** — `patches/@rive-app__react-native@0.5.5.patch` skips `advanceStateMachine` + `worker.draw()` when the view is paused or settled, and clears to transparent. This is the fix the commit describes as "four idle game controls held the Surface Duo's UI thread at ~44 ms a frame."

The 38–44 ms numbers in `worklet-rendering.md` were recorded the same day these fixes landed. The doc never re-measures. **Whether the current binary still carries Rive `doFrame` cost is unknown** — that is what the framestats protocol below answers first.

## Corrections to the review's premise

- **Lobby Rive is dead code on native.** `GameLobbyScreen.tsx` never passes the `rive` prop to `GameLobby`; `lobbyRiveFromFiles` has no caller in product code. During `game` phase the lobby unmounts entirely; during `transition` `isLobbyCovered` pauses it. Nothing to optimize there — either wire it or delete the assets in a separate decision.
- **The four views are three files.** The thumbpad is split out of the housing view only because a settled state machine could not be woken by view-model writes — the upstream bug the 0.5.5 patch fixes. Re-merging is a possible consolidation but the thumbpad must still ride inside the Reanimated-transformed `Pad` wrapper; replacing it with a static skin is cheaper than re-merging.
- **Inactive tabs keep all four mounted.** Expo-router tabs have no `unmountOnBlur`/freeze; quiet-park is the only protection off-screen.
- **`paused` prop: deferred, not built.** Mirroring `LobbyRiveSurface` (prop + AppState listener) would need plumbing through six-plus files. Marginal gain is near zero until measurement shows residual cost: quiet-park covers idle, the patch covers settled draws, a backgrounded app gets no vsync anyway. Revisit if framestats disagrees.
- **The walking-state residual may not be Rive.** `ThreeSurface` mounts `Canvas opaque={false}` (`surface.native.tsx`) so the reveal fade's parent opacity applies — that forces a `TextureView`, which composites inside the app's view pipeline every frame. react-native-webgpu 0.16.0 offers `android.surfaceType: "SurfaceView" | "TextureView" | "HardwareBufferView"`; `HardwareBufferView` (Android 10+, experimental opt-in) draws each frame's `AHardwareBuffer` inline with no extra copy and honors normal view compositing. `SurfaceView` alone is not an option — it cannot honour the parent opacity fade. A `HardwareBufferView` run is the highest-value single experiment if walking frames stay slow with Rive fully parked.

## Worklets Bundle Mode: actual state

Fully wired and flag-gated, not hypothetical:

- `apps/mobile/babel.config.js`: `react-native-worklets/plugin` with `bundleMode: true` + `importForwarding` for `features/game/render-runtime` when `EXPO_PUBLIC_WORKLET_RENDER` matches `/^(1|true|worklet)$/i`.
- `apps/mobile/metro.config.js`: `getBundleModeMetroConfig` + `rewriteRequestUrl` forcing `lazy=false` (upstream reanimated#10162 workaround).
- Patches committed: `patches/react-native-worklets@0.13.0.patch` (Uniwind cycle, upstream #10751), `patches/metro@0.87.1.patch` (SHA-1 for `.worklets/` files).
- Runtime path exists: `render-thread-choice.ts`, `render-runtime/worklet-host.ts`, `render-runtime/game-render.ts`, `runtime-report.ts` (`installFrameGlobals`), `packages/ui/three/WorkletThreeCanvas.tsx`.

**Bundle Mode has never produced a frame on device.** `worklet-rendering.md` records three failed runs, all fixed in-tree; the fourth run was never recorded. The A/B is currently "does it draw at all", not "is it faster". Per that doc's own warning, moving render off JS does not touch the UI thread — the honest Bundle Mode metric is JS-thread p50 freed (9 → ~0 ms) at unchanged-or-better UI framestats, plus functional parity.

## Measurement protocol (Duo, `com.nycmon.app`)

No UI-thread instrumentation exists in the repo (no `FrameMetrics`/`Choreographer`/`dumpsys` usage; only `nyc-carousel` and `nyc-gamepad-input` under `packages/ui/modules/`). Start with adb; a Nitro/expo-module `FrameMetrics` capture is a later option if in-app numbers are wanted.

1. Cold Metro start per mode (`--clear`), launch app, Game tab → lobby → START → first frame.
2. `adb shell dumpsys gfxinfo com.nycmon.app reset`
3. Segment A, idle 30 s — stand still after reveal. Exercises quiet-park + settled-draw skip.
4. `adb shell dumpsys gfxinfo com.nycmon.app framestats > run-idle.txt`, then reset.
5. Segment B, walking 30 s — hold stick forward along the 125th Street route. Exercises continuous view-model writes plus camera invalidates.
6. `framestats > run-walk.txt`. Parse `SyncQueued − HandleInputStart` (UI draw+sync) and `FrameCompleted − IntendedVsync` (total) per frame.
7. Repeat under `EXPO_PUBLIC_WORKLET_RENDER=1` for the Bundle Mode run.
8. Perfetto 30 s during segment B: `sched freq gfx view am input` + `android.surfaceflinger.frametimeline`; check the `com.nycmon.app` main thread for `RiveReactNativeView`/Choreographer slices and RenderThread `DrawFrames` duration — this is what attributes residual cost to Rive vs compositing.
9. Controls: `hardwareInputStore.setActiveSource('gamepad')` forces `hideTouchControls` — all four views unmount, the "Rive-free" baseline. `mode="preview"` in Controls settings mounts a second full controller if finer attribution is needed.
10. Only if walking frames stay slow with Rive proven parked: repeat B with `android={{ surfaceType: 'HardwareBufferView' }}` on the canvas.

Report distributions (p50/p90/p95/p99), not single numbers, per `docs/evidence/verification/device-plan.md` §Performance.

## Ranked actions

1. **Measure first** (this protocol). If UI frames are already down, Rive is exonerated and the target becomes compositing.
2. **`HardwareBufferView` A/B** on `surface.native.tsx` if walking frames stay slow with Rive parked — the only candidate that can move compositing cost while keeping the fade.
3. **`paused` prop on `ArcadeRiveSurface`** (mirroring `LobbyRiveSurface`, driven by screen focus + session pause) — only if measurement shows the quiet-park gaps matter.
4. **Consolidation** — thumbpad → static/Skia skin (its motion is already Reanimated), or re-merge housing+thumbpad now that the settle bug is patched. Higher effort, saves one of four views.
5. **Bundle Mode green run** — precondition for its A/B; fixes are in-tree but the fourth device run is unrecorded.

## Sources read

`GameScreen.tsx`, `GameTab.tsx`, `GameLobbyScreen.tsx`, `AnalogStick.tsx`, `ArcadeSixButtons.tsx`, `StartStopPill.tsx`, `AdaptiveControlLayout.tsx`, `ArcadeRiveSurface.native.tsx`, `LobbyRiveSurface.native.tsx`, `lobby-rive.ts`, `lobby-playback.ts`, `use-arcade-rive-files.native.ts`, `surface.native.tsx`, `render-thread-choice.ts`, `render-runtime/{worklet-host,game-render,runtime-report}.ts`, `apps/mobile/{babel,metro}.config.js`, `patches/@rive-app__react-native@0.5.5.patch`, `patches/react-native-worklets@0.13.0.patch`, `patches/metro@0.87.1.patch`, `docs/implementation/worklet-rendering.md`, `docs/implementation/arcade-control-review-findings.md`, `docs/performance/tracesift.md`, `docs/evidence/verification/device-plan.md`, react-native-webgpu 0.16.0 `Canvas.d.ts`.
