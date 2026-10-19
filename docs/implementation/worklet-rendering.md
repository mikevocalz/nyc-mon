# Worklet rendering for ThreeCanvas

Question from Mike: "are we not using worklets?" No. Today `packages/ui/three/ThreeCanvas.tsx` builds the renderer, runs the scene update and submits the draw on the React Native JS thread, from a `requestAnimationFrame` loop, and the Caller simulation (`use-game-input.ts`) runs on the same thread. This file records what the installed versions allow, the opt-in design now in the tree, and how it compares with margelo's react-native-runtimes and with staying put.

Everything below was read from `node_modules` on 2026-10-16 unless it says otherwise. Nothing here has run on a device.

## Versions checked

| Package | Version | Where |
| --- | --- | --- |
| react-native-worklets | 0.13.0 | `apps/mobile`, `packages/app` (not declared by `packages/ui`) |
| react-native-webgpu | 0.16.0 | `apps/mobile`, `packages/ui` (not declared by `packages/app`) |
| react-native-reanimated | 4.7.1 | all three |
| three | 0.186.1 | `packages/ui`, `packages/app` |
| expo / react-native | 58.0.12 / 0.88.0 | |
| @react-native-runtimes/core, /state | not installed; npm has 0.1.0-alpha.0, alpha.1, alpha.2 (last publish 2026-08-05) | |

## What the Duo numbers say

The Duo shows about 15 fps walking. `renderer.render` costs p50 9 ms, p90 14 ms of JS time; cutting triangles 4x and the pixel ratio 2 to 1 barely moved fps, so the GPU is not the limit. The Android UI thread runs p50 44 ms idle (four autoPlay Rive views) and 38 ms walking with Rive paused. Two conclusions follow:

- Moving the draw off the JS thread frees 9 to 14 ms per frame for the simulation, gestures and React. That helps the JS frame budget.
- It does not touch the UI thread. At 38 to 44 ms per UI frame the compositor alone caps the screen near 25 fps whatever thread three.js uses. A worklet renderer presents its own surface (Dawn, explicit `present()`), but the frame still composites with the rest of the view tree. Fix the UI-thread cost (Rive views, layout) as its own track; this work cannot make up for it.

## Worklets Bundle Mode (react-native-worklets 0.13.0)

**What it is.** In Bundle Mode a worklet runtime evaluates the whole Metro bundle, so code a worklet calls can be ordinary module code, not only closures copied across (`react-native-worklets` docs, Bundle Mode overview). Without it, a worklet can only carry serializable closures; three.js is classes and module state and cannot be copied into a runtime that way.

**Config it needs**, from `bundleMode/index.js` and `plugin/index.js`:

- Metro: `getBundleModeMetroConfig(config)` for Expo. It replaces `serializer.createModuleIdFactory` (worklet modules get fixed ids, the worklets entry gets -2), adds the `prepareBundleMode.js` polyfill, wraps `resolver.resolveRequest` (keeps the existing resolver as the fallback, and routes `react-native` through a shim that refuses Turbo Module access on worklet runtimes in dev), and forces `transform.inlineRequires: true`.
- Babel: `['react-native-worklets/plugin', { bundleMode: true, importForwarding: {...} }]`. The plugin flips `globalThis._WORKLETS_BUNDLE_MODE_ENABLED` to `true` in the worklets entry and the polyfill, and writes each worklet to `react-native-worklets/.worklets/<hash>.js` in the package directory (under `node_modules/.pnpm/...` here).
- Import forwarding: a worklet's imports are re-required on the target runtime only for allow-listed modules (`moduleNames`, default `['react-native-worklets']`) or for worklets in files under allow-listed `relativePaths`. Only named and default imports qualify (`isImport` checks `ImportSpecifier`/`ImportDefaultSpecifier`); `import * as X` is captured as a closure instead.
- Native: nothing to rebuild. `prepareBundleMode` already exists in the installed native module (`WorkletsModule.kt`, `WorkletsModule.mm`); the polyfill calls it at bundle start when the flag is on, and native loads the bundle into worklet runtimes on a background thread.

**Expo SDK 58 / RN 0.88.** The package peer range is `react-native: 0.86 - 0.88`. The docs publish an Expo variant of the Metro setup. Not verified: how the Expo serializer and Expo Router's async routes behave with the replaced module-id factory, and dev lazy bundling of the `import()` chunks on a worklet runtime (`bundleModeInit` receives the networking module, which suggests dev fetches are handled). These are the first things to watch on the device.

**Limits.**

- Bundle Mode changes how every worklet in the app compiles: Reanimated styles, gesture callbacks, Skia, the lot. It is not scoped to the render runtime. That is the main risk, and the reason it sits behind a flag.
- A library that imports `react-native` must not load on a worklet runtime (docs: "can cause runtime instability by attempting to load a second instance of React Native"). The render path checks out: `three/webgpu`, `@acme/ui/three/cel` (TypeGPU), `@acme/theme` (its index re-exports tokens only), `zod`, `zustand/vanilla`, and `packages/app/features/game/{city-scene,city-data,city-dataset,load-game-scene,game-session,render-snapshot}.ts`, `world/*`, `character/caller-proxy.ts`, `character/caller-store.ts`, `character/locomotion.ts`. None imports `react-native`. react-native-webgpu itself does (its entry calls a Turbo Module), so the render runtime never imports it; `installWebGPU` crosses as a worklet closure instead.
- `requestAnimationFrame` on a worker runtime is a `setTimeout` poll (`runLoop/workletRuntime/requestAnimationFramePolyfill.ts`, default 16 ms, `animationQueuePollingRate`). It is not vsync. Frames will not line up with display refresh as tightly as the JS thread's Choreographer-backed rAF.
- Toggling Bundle Mode needs `expo start --clear`.

## react-native-webgpu 0.16.0 on a worklet runtime

- `registerWebGPUForReanimated` (called on import of the package) registers a worklets custom serializable, so `GPUDevice`, `GPUCanvasContext` and every other WebGPU object cross into any worklet runtime by reference (`src/external/reanimated/registerWebGPUForReanimated.ts`).
- `installWebGPU()` is a worklet that installs `navigator.gpu` and the `GPU*Usage` globals on the runtime that calls it (`src/install.ts`). Limits it states: on a device created on a worklet runtime `device.lost` never settles and `uncapturederror` never fires. Here the device comes from the main runtime (the TypeGPU root), so those events stay observable there.
- Devices are created with Dawn's `implicit-device-synchronization` by default "so one device can be handed from the JS thread to a worklet runtime" (`src/index.tsx`). Never share a command encoder across threads; three.js on the render runtime encodes there only.
- `GPUCanvasContext.present()` "is explicit on every runtime (main JS, Reanimated UI, and dedicated worklet runtimes). It runs synchronously on the calling thread" (`cpp/rnwgpu/api/GPUCanvasContext.h`). `context.canvas` is a native `Canvas` object with `width`, `height`, `clientWidth` and event stubs, so it crosses too.
- No example of three.js on a worklet runtime ships in the package (the README is a stub); `apps/` and `example/` are not in the published package.

## Can three.js run on a worklet runtime?

Yes with Bundle Mode, no without it.

- Module loading: Bundle Mode evaluates `three/webgpu` on the runtime like any module. Without Bundle Mode there is no way to get its classes there.
- DOM: `build/three.webgpu.js` has no unguarded `window`/`document` at top level; `self` and `navigator` are behind `typeof` checks (lines 76951, 81637 in 0.186.1). WebGPURenderer gets `canvas`, `context` and `device` passed in, so it never looks up `navigator.gpu` for a device.
- Frame loop: three's internal `Animation` loop is stopped after `init()` exactly as on the JS path (`renderer-internals.ts`); the render runtime runs its own loop on the polyfilled rAF.
- Not verified: Hermes on a worker runtime running the full city build (190 ms in node; the JS path takes much longer on the Duo) and `compileAsync`'s promise chain there. Worklet runtimes drain microtasks after each rAF callback, so the promises should settle.

## The design (in the tree, off by default)

```
JS thread                                         render runtime ("nyc-mon-render")
---------                                         ------------------------------------
use-game-input: Caller sim (rAF, unchanged)
  -> callerStore / gameCameraStore
       -> worklet-host mirror(): packSnapshot  ---- Synchronizable<number[]> ---->  tick(): getDirty()
          (21 numbers, version++)                                                    draw(): update, render, present
       -> if idle: one scheduleOnRuntime(wake)  ------------------------------->     parks after 2 quiet ticks
ThreeCanvas (worklet mode): size, visibility,                                        idle.setBlocking(true)
  reduced motion -> session.resize/setRunning
gameScreenActions.loadStage / firstFrame  <---- scheduleOnRN('stage'|'firstFrame'|'failed')
```

- **What moves.** Renderer init, scene build, `compileAsync`, every `update` (camera placement, tree LOD, Caller pose), `renderer.render` and `present()`. That is the 9 to 14 ms measured on the Duo.
- **What stays on JS.** The Caller simulation and both stores, gestures, the HUD, Rive, the lobby. `character/` and `world/` are untouched and run on the runtime as they are: the Caller proxy is built with `createCallerProxyWith(mirror)`, where `mirror.getState()` returns the Caller read from the latest snapshot.
- **Data flow.** Per input event the JS thread packs 21 numbers and writes one Synchronizable; no hop onto the render runtime. The runtime reads the latest snapshot once per tick. A hop happens only on the parked-to-drawing edge (`idle` flag, double-checked after parking so a write between the last read and parking is never lost), so a held stick costs one hop for the whole hold.
- **On demand, as today.** The Game canvas stays `paused`: the loop runs while snapshots change or an actor reports motion, and parks otherwise. `invalidate()` from the canvas handle bumps the snapshot version.
- **Milestones.** `withFirstFrameSignal` now takes a reporter (default `gameScreenActions.loadStage`, so the JS path is unchanged). On the runtime the reporter relays `worldBuilt` and `firstRender` with `scheduleOnRN`; `onFirstFrame` relays `firstFrame`. The compile-then-one-more-frame rule is the same code.
- **Dispose.** Unmount disposes the session (stores unsubscribed on JS, scene and renderer disposed on the runtime). The runtime itself lives for the app's life, so three.js loads there once.
- **Cost.** The runtime parses its own copy of the 985 KB tile and holds its own three.js and city, so memory for the world roughly doubles in worklet mode (the JS side still parses the tile for walkability). Not measured.
- **Fallbacks.** `resolveRenderThread` keeps `js` on web, without a host, or when `isBundleModeEnabled()` is false, and warns once. A runtime failure reports `failed`; the canvas shows its fallback and `onBackendChange(null)` fires, so the status layer shows the error as it does on the JS path.
- **Not carried over.** Pointer tracking (the Game passes `tracksPointer={false}`); `load` and `params` (JS closures; the host owns the scene).

### Files

| File | Change |
| --- | --- |
| `packages/ui/three/render-thread.ts` (+ test) | `parseRenderThreadFlag`, `resolveRenderThread`. Pure. |
| `packages/ui/three/worklet-host.ts` | `WorkletRenderHost`/`Session`/`Start`/`Event`, `NativeCanvasContext`. Types only. |
| `packages/ui/three/WorkletThreeCanvas.tsx` | The worklet-mode canvas: layout, surface, loop gate, fallback, handle. |
| `packages/ui/three/ThreeCanvas.tsx` | `ThreeCanvas` resolves the thread once per mount and renders `WorkletThreeCanvas` or the old body, now named `JsThreeCanvas`. The JS body is unchanged; its two renderer helpers moved to `renderer-internals.ts` verbatim. |
| `packages/ui/three/renderer-internals.ts` | `stopInternalLoop`, `advanceNodeFrame`; exported as `@acme/ui/three/internals` so the runtime can import them without `react-native`. |
| `packages/ui/three/install-webgpu{,.native}.ts` | `installWebGPUOnRuntime` (react-native-webgpu's `installWebGPU` on native, a no-op on web). |
| `packages/ui/three/surface.{native,web}.tsx`, `types.ts`, `index.ts`, `package.json` | `getContext()` on the surface handle; `renderThread` and `workletHost` props; exports; the `./three/internals` subpath. |
| `packages/app/features/game/render-snapshot.ts` (+ test) | Snapshot layout, pack, bump, read. Pure. |
| `packages/app/features/game/render-runtime/game-render.ts` | Runs on the render runtime: renderer, city, loop, park/wake. |
| `packages/app/features/game/render-runtime/worklet-host.ts` | JS side: runtime, Synchronizables, store mirroring, event relay. |
| `packages/app/features/game/render-thread-choice.ts` | Reads `EXPO_PUBLIC_WORKLET_RENDER` at module load; loads the host module with `import()` only when the flag is on. |
| `packages/app/features/game/load-game-scene.ts` | `withFirstFrameSignal(setup, report?)`. |
| `packages/app/features/game/GameScreen.tsx` | Passes `renderThread` and `workletHost`; waits for the host module before mounting the canvas when the flag is on. |
| `apps/mobile/babel.config.js`, `metro.config.js` | Bundle Mode only when `EXPO_PUBLIC_WORKLET_RENDER` is `1`, `true` or `worklet`. |

**Default build proof.** Loading both configs in node with the flag unset gives the worklets plugin as the bare string `'react-native-worklets/plugin'` (as before), no replaced module-id factory and no Bundle Mode polyfill. With the flag set: `bundleMode: true` with the forwarding path, the replaced factory and the polyfill. `api.cache(true)` became `api.cache.using(() => flag)`, which caches the same way for a fixed flag.

## react-native-runtimes (margelo, with Callstack)

Read from github.com/margelo/react-native-runtimes on 2026-10-16: `packages/core/README.md`, the open issues, the commit log, and npm metadata.

1. **Native views and JSI modules on a secondary runtime.** Each threaded runtime is a full `ReactHost` (Android) or `RCTHost` with a Fabric surface (iOS). It "does not inherit the host package list"; extra packages go through `ThreadedRuntime.setExtraReactPackagesProvider { … }` (README lines 660 to 672), or `setMainReactPackagesProvider` for a business runtime that sees the app's whole list. So `WebGPUViewPackage` would have to be registered there. Then react-native-webgpu's install breaks it: Android keeps one process-wide `std::shared_ptr<RNWebGPUManager> manager` (`android/cpp/cpp-adapter.cpp:30`) and `initializeNative` replaces it on every `install()`. Installing on the world runtime would swap out the manager the main runtime uses (CityBlocks and the TypeGPU root live there). The `GPUDevice` cannot cross either: props are JSON only. Reanimated and worklets on that runtime would need their packages registered too, and nothing in the README covers them. Not tested; this is from reading the source.
2. **Metro and Expo.** The Metro wrapper swaps `babelTransformerPath` for the bare RN transformer, which breaks Expo apps (issue #34: "Cannot read properties of undefined (reading 'transformFile')", reported on Expo 56 / RN 0.85 with a hand-written workaround). Nothing documents Expo Router, SDK 58, RN 0.88, pnpm workspaces or `@acme/*` imports. The `OnRuntime` rewrite needs the threaded component in project roots that its scanner reads; our world lives in `packages/app`.
3. **Gestures.** RNGH detectors on the main runtime wrap a `ThreadedRuntimeSurface` native view. Native touch delivery should reach a view inside it, but whether RNGH's root-view handling claims touches inside another runtime's surface is not documented. Unverified.
4. **Startup and memory.** A second Hermes runtime and a second React tree; release builds evaluate the whole embedded bundle there (README "Load The Generated Entry"). `prewarm` exists. No numbers are published.
5. **Maturity.** 0.1.0-alpha.2 on npm (2026-08-05; the coordinator's note of alpha.0 was the first publish), 10 open issues including #34 (Expo build breaks) and #43 (a failed runtime module reports the wrong error), #11 (refactor of the core native API pending). Android is listed as supported.

## Side by side

| | Stay on JS | Worklets Bundle Mode | react-native-runtimes |
| --- | --- | --- | --- |
| Installed | yes | yes (0.13.0) | no (alpha) |
| What moves off JS | nothing | renderer, scene build, update, draw, present | the whole world subtree: canvas, scene, possibly the sim |
| WebGPU on that thread | n/a | supported by react-native-webgpu (serializer, `installWebGPU`, explicit `present`) | blocked on Android by the single global `manager`; device cannot cross |
| Config change | none | Metro + Babel, behind the flag; affects every worklet when on | Metro transformer swap (breaks Expo, #34), config plugin, native package list |
| Native rebuild | no | no (Metro only, dev client) | yes (prebuild + new binary) |
| Code moved | 0 | 2 new app modules, 1 ui component; character/world unchanged | Game world becomes a threaded component; stores move to `createSharedStore`; webgpu patched |
| Frame pacing | Choreographer rAF | setTimeout poll at 16 ms | that runtime's own rAF |
| Main risk | 15 fps stays | Bundle Mode side effects on Reanimated/RNGH/Skia worklets; Expo serializer interplay | alpha; webgpu manager clobbering; Expo integration bugs |

## Recommendation

1. **Fix the UI thread first.** 38 to 44 ms UI frames cap the screen near 25 fps on any rendering thread. The four autoPlay Rive views and layout work are the next measurement, not this.
2. **Try worklets Bundle Mode on the Duo with the flag.** It is the only option the installed packages support end to end, it needs no native rebuild, and it is off in the default build. If the Bundle Mode build breaks unrelated worklets or Expo Router, drop it.
3. **Defer react-native-runtimes.** STRIKE it for the render path until react-native-webgpu holds one manager per runtime (an upstream change) and #34 is fixed. It may suit headless work later (a world-tile parse, say), where no WebGPU view is involved.
4. **Next best, if Bundle Mode fails on the device.** Keep three.js on JS and cut what the 9 to 14 ms is made of: render bundles for the static city, fewer per-frame `setFocus` rebuilds, frustum culling of the banded meshes. That is a smaller win and needs no new runtime.

## Running both modes on the Duo

Same binary for both: the installed mobile debug dev client (`mobileDebug`). Bundle Mode is a Babel and Metro change, and the native half (`prepareBundleMode`) is already compiled into worklets 0.13.0, so no prebuild or Gradle run. Metro on 8081 may belong to another session; check before starting one.

```sh
export PATH=/opt/homebrew/opt/node@24/bin:$PATH
cd apps/mobile

# JS mode (default)
npx expo start --dev-client --clear
# open the app on the Duo, START, walk the 125th Street route, record fps and the JS/UI frame times as before

# Worklet mode
EXPO_PUBLIC_WORKLET_RENDER=1 npx expo start --dev-client --clear
# reload the app (not Fast Refresh: the Babel output changes), same route, same capture
adb logcat -s ReactNativeJS:V | grep -E "ThreeCanvas|GameRender|Worklets"
```

`--clear` is required on every switch. Check in the log that no `renderThread="worklet" fell back` warning appears; that warning means Bundle Mode was off and the run measured the JS path. A release comparison needs a release build made with the variable set in the environment, since Metro inlines `EXPO_PUBLIC_*` at bundle time.

Watch for: a black canvas after START (context or present on the runtime), Reanimated or gesture worklets throwing (Bundle Mode side effects), and the load bar stuck at 75 (`compileAsync` on the runtime).

## Device result, 2026-10-16 (Surface Duo, mobileDebug dev client)

Worklet mode does not start yet. Two failures, in order:

1. First bundle request: Metro `Failed to get the SHA-1` for `react-native-worklets/.worklets/<hash>.js`. Bundle Mode writes these files during transform, before Metro's file map has seen them. A reload after the files exist gets past it. 1,290 files were generated.
2. Startup: `[runtime not ready]: TypeError: Cannot convert undefined value to object` in uniwind's `copyComponentProperties`, reached from `get Image`. In Bundle Mode a worklet runtime evaluates the whole bundle. Uniwind's component wrappers run there too, and on a worklet runtime the `react-native` component exports they copy statics from are undefined.

So the blocker is Uniwind's module-scope component wrapping, not the render code. Options:
- keep Uniwind modules off worklet runtimes;
- lazy-load the wrappers on the RN runtime only;
- or ask upstream (worklets / uniwind) for a guard.

Until one of those lands, the flag stays off and the JS path is the only supported mode.

### Cause and fix (same day)

The startup crash is on the React Native runtime, not a worklet runtime. A worklet runtime never runs the app entry: worklets' `ScriptLoader` intercepts Metro's entry points while it evaluates the bundle, and modules load there only when a worklet requires them. `[runtime not ready]` is the main runtime's prefix.

The cycle is in the resolvers. Uniwind (outermost) redirects `react-native` to `uniwind/components` unless the importer is inside uniwind or react-native. Bundle Mode redirects `react-native` to its shim, and the shim did `require('react-native')`. The shim lives under `react-native-worklets/`, so Uniwind redirected that request too: `uniwind/components/native/Image` -> shim -> `uniwind/components` -> `get Image` -> the half-initialised `native/Image` module, whose `Image` is still undefined, and `copyComponentProperties(undefined, …)` throws. Upstream: software-mansion/react-native-reanimated#9817 and #10750 (same cycle; older Uniwind overflowed the stack instead).

- `patches/react-native-worklets@0.13.0.patch` applies upstream PR #10751 (open): the shim requires `react-native-worklets/bundleMode/realReactNative`, which only Bundle Mode's resolver answers, with Metro's default resolution of `react-native`. Uniwind is unchanged and keeps styling app code.
- `patches/metro@0.87.1.patch` is the worklets-documented fix for `Failed to get the SHA-1` (Bundle Mode setup docs, "patch metro"; the file is `bundleMode/patches/patch-package/metro/metro+0.87.1.patch` on worklets main). The `.worklets` directory is already inside a watch folder (`<root>/node_modules`, not block-listed); the files are written during transform and the watcher has not indexed them yet when Metro asks for their SHA-1. The patch answers that call for `.worklets` paths without the file map, and only when `EXPO_PUBLIC_WORKLET_RENDER` is set for the Metro process (same test as `metro.config.js`); with the flag unset Metro runs unpatched code paths.
- Any patch to worklets moves every package that peers on it (Skia, uniwind, reanimated) to a new `.pnpm` directory. A Metro that stays up across that install keeps the old paths in its file map and can bundle Skia twice (`Tried to register two views with the same name SkiaView`). Restart Metro with `--clear` after the install. A clean default-mode `expo export:embed` has one Skia directory and one `uiViewClassName: "SkiaView"`.
- Checks: `expo export --platform android --dev` with the flag succeeds on a fresh `.worklets` directory, and in that bundle uniwind's `Image.tsx` depends on the shim, whose one dependency is `react-native/index.js`. `apps/mobile/src/bundler/bundle-mode-resolver.test.ts` covers the resolver chain with the flag on and off and the Metro patch; `packages/app/features/game/render-runtime/game-render.worklet-runtime.test.ts` imports `game-render.ts` under a fake worker runtime in which react-native, uniwind, React and Expo throw on load.
- Not applied: the worklets `metro-runtime` patch that forwards Fast Refresh updates to worklet runtimes. Without it, editing a worklet needs a reload.

### Second device run: START fails with "Unable to resolve worklet with hash"

With the two patches in, the lobby renders. START fails with `[Worklets] Unable to resolve worklet with hash 7699091469073` (also 12676968083120 and 6261070730378), then `world not ready: 20000 ms without progress`. Those three are the worklets in `render-runtime/worklet-host.ts` (start, running, stop). That module loads through `import()` in `render-thread-choice.ts`. Expo's dev bundle URL has `lazy=true`, so Metro puts an `import()` target in a separate chunk that only the RN runtime fetches; a worklet runtime evaluates the main bundle and nothing else. Checked against the running Metro: the `lazy=true` main bundle has none of the three module ids, the `worklet-host.bundle?…modulesOnly=true` chunk has all three, and the same main URL with `lazy=false` has all three and no chunk paths. Upstream: software-mansion/react-native-reanimated#10162; lazy chunks on worklet runtimes are PR #10711 (open).

Fix, worklet mode only: `metro.config.js` wraps Expo's `server.rewriteRequestUrl` and turns `lazy=true` into `lazy=false`. Metro applies that rewrite to bundle requests and to HMR entry-point registration, so the URL the dev client already holds is covered. The dev bundle grows (28 MB to 34 MB on 2026-10-16) because every async dependency is in it. With the flag unset, URLs pass through unchanged. Tests are in `apps/mobile/src/bundler/bundle-mode-resolver.test.ts`.

### Third device run: the runtime starts, `loadProgress` stays 0

With lazy bundles off, START reaches the render runtime (logcat has `WebGPU [RuntimeContext] Created` for it) and then nothing: no milestone, no error, `WorldNotReadyError … without progress` after 20 s. Two causes, both found by reading the code, neither confirmed on the device yet:

- **`renderer.init()` never settles.** three's `Renderer.init()` builds an `Animation` whose `_context` is `typeof self !== 'undefined' ? self : null`, then calls `_context.requestAnimationFrame`. React Native sets `self` in `setUpGlobals.js`, which runs from InitializeCore; a worklet runtime never runs that, so `self` is undefined there. The call throws inside init's async promise executor, the rejection is unhandled, and the promise stays pending. Worklet runtimes report neither, so the start went silent. `render-runtime/runtime-report.test.ts` reproduces it against the installed three (pending without `self`, resolved with it). Fix: `installFrameGlobals()` aliases `self` to the runtime global before the renderer is built, as `setUpGlobals.js` does on the RN runtime.
- **`requested` and `moduleLoaded` were never reported in worklet mode.** The JS path reports them from `loadGameScene`, which the worklet canvas never calls, and the relay forwarded only `worldBuilt` and `firstRender`. Now the JS side reports `requested` when it hands the start to the runtime, the runtime reports `moduleLoaded` once `renderer.init()` resolves, and the relay accepts all four.

Instrumentation, worklet mode only: every worklet entry (start, wake, setRunning, stop) and the frame tick catch and send `error` events with the stack; the start path sends `trace` breadcrumbs; `withFirstFrameSignal` takes an optional tracer for the compile (the JS path passes none, so its behaviour is unchanged). On the RN side they are console lines:

```
[GameRender] load stage: requested
[GameRender] render runtime reached: start worklet entered
[GameRender] render runtime reached: installWebGPU
[GameRender] render runtime reached: startGameRender (session 1, device shared)
[GameRender] render runtime reached: self aliased to the runtime global
[GameRender] render runtime reached: city parsed
[GameRender] render runtime reached: three loaded, renderer constructed; init pending
[GameRender] render runtime reached: renderer init resolved
[GameRender] load stage: moduleLoaded
[GameRender] load stage: worldBuilt
[GameRender] render runtime reached: compileAsync started
[GameRender] render runtime reached: scene built
[GameRender] render runtime reached: first draw presented
[GameRender] render runtime reached: compileAsync resolved
[GameRender] load stage: firstRender
[GameRender] render runtime reached: second draw presented
```

The first draw usually lands before the compile resolves (the scene asks for a frame as soon as it is built), so those two lines can swap. The last line before a stall names the step that hung.

A failure prints `[GameRender] render runtime error in <where>: <name>: <message>` with the stack on the following lines. `render-runtime/game-render.start.test.ts` runs the start path in node with no `self`, a 16 ms rAF and a fake device, and checks this sequence up to the compile plus the error relay.
