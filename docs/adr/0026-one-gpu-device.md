# 0026 — One GPU device for Skia, TypeGPU and three

- **Status:** Proposed. Nothing here is device-verified. Gate G9 decides adoption from the `shared` and `skiatex` probes on iPhone 17 and iPad Pro hardware, on both runtimes. Every behaviour below that depends on Dawn, Graphite or Metal is unverified until those rows exist.
- **Date:** 2026-10-27
- **Deciders:** Mike
- **Builds on:** ADR 0023 (renderer mode; Phase 0 probe matrix).
- **Sources:**
  - `docs/plans/slop-grade-city-prompt.md` §2.4, §4 (G9, G10), §5.1, §5.3 "No DOM: Skia draws the textures", §8 (probes `shared`, `skiatex`, `pipecache`), §9 N10.
  - William Candillon, *Hello, Graphite: Performance* (2026-10-26), https://wcandillon.dev/article/hello-graphite-performance.
  - react-native-skia 3.6.1, `lib/typescript/src/skia/types/`: `Skia.d.ts` `getNativeDevice`; `GPUTexture.d.ts` `GPUTextureHandle`; `Surface/SurfaceFactory.d.ts` `MakeFromGPUTexture`; `Surface/Surface.d.ts` `flush(sync)`; `Image/ImageFactory.d.ts` `MakeImageFromGPUTexture`, `MakeGPUTextureFromImage`. `src/skia/Skia.ts` and `NativeSetup.ts` (the `SkiaApi` global). `cpp/rnskia/RNDawnInterop.cpp` (`rnskia_getWGPUInstance`).
  - react-native-webgpu 0.16.0: `src/importDevice.ts` `importDevice`, `adoptTexture`; `src/mock.ts` (Jest mock); `src/index.tsx` (the `GPUTexture.nativePointer` augmentation); `cpp/rnwgpu/WebGPURuntime.cpp` L23 (`dlsym(RTLD_DEFAULT, "rnskia_getWGPUInstance")`). Upstream docs `apps/docs/content/docs/integrations/react-native-skia.mdx` (compatibility table, device loss, threading).
  - typegpu 0.12.7 `core/root/init.d.ts` `initFromDevice` (`core/root/init.js` L364: the root does not own the device).
  - three 0.186.1 `build/three.webgpu.js` ~L87169–87214 (`parameters.device`), `src/textures/ExternalTexture.js`, WebGPU texture utils ~L79611 (binds `sourceTexture`, no upload) and ~L79777 (never destroys it).
  - react-native-skia releases v3.6.2 through v3.8.0 (`gh release view`, 2026-10-27).
- **Code:** `packages/ui/gpu/{acquire-device,shared-device-source,shared-device-source.native,gpu-store,index}.ts`; `packages/app/features/game/render-runtime/{shared-device,skia-texture-bridge,device-probes,run-js-device-probes,game-render}.ts`; tests `packages/ui/gpu/acquire-device.test.ts`, `render-runtime/{shared-device,skia-texture-bridge,device-probes,game-render.shared-device}.test.ts`.

## Context

The app runs three GPU devices on iOS today:

1. `gpu-store.ts` calls `requestAdapter()` and `requestDevice()` and builds the TypeGPU root on the result.
2. three already shares that device. `ThreeCanvas.tsx` and `WorkletThreeCanvas.tsx` (L49) read `gpu.root.device`; the JS path spreads it into `WebGPURenderer` in `surface.native.tsx`, and the worklet path hands it through `worklet-host.ts` (L223) to `game-render.ts`, which spreads `args.device` into the constructor (~L288). So TypeGPU and three are one device already.
3. React Native Skia 3 renders with Graphite on its own Dawn device.

Slop New York draws plates, sign blades and bus destinations on DOM canvases. React Native has no DOM canvas. With Skia on the same device as three, Skia can draw those straight into a WebGPU texture that three samples, with no copy and no `document`.

## Decision

**Under `EXPO_PUBLIC_WORLD_PHYSICAL`, gpu-store takes Skia's device.** `startShared()` calls `importDevice(Skia.getNativeDevice())` (`shared-device-source.native.ts`) and builds the TypeGPU root with `tgpu.initFromDevice({ device })`. three inherits the device through `root.device` on both render paths, so no change is needed in `ThreeCanvas` or `WorkletThreeCanvas`. The store records `deviceSource: 'shared' | 'own'`, readable with `readGpuDevice()`. With the flag off, `start()` runs the existing adapter and device path; the only change there is that the tail moved into `adopt()`.

**A failed import is a logged fallback.** G9's default is separate devices. If `importDevice` throws (web, Jest, a missing native install), `acquireSharedOrOwnDevice` returns the app's own device with the reason, and gpu-store warns. Nothing is silent: the reason is in the log and `deviceSource` says `own`.

**The shared device is not replaced on loss.** Under 3.6.1 a lost Skia device is fatal (react-native-webgpu docs, "Device loss"); re-importing would wrap the same dead device and loop on `lost`. gpu-store goes `unsupported` instead. Skia 3.7.3 changes this (see G10).

**game-render resolves the device it was handed first.** `resolveRendererDevice(args.device, args.deviceSource, globals)` returns the handed device unchanged. Only if nothing is handed does it import Skia's device on the render runtime through the `SkiaApi` and `RNWebGPU` JSI globals. That is the same call `importDevice` makes, and it avoids importing either package, which would pull `react-native` onto the worklet runtime. Whether those globals exist on the Bundle Mode render runtime is unknown and is part of the `shared` probe. The trace line `renderer device: <source>; <note>` records the outcome.

**Skia draws labels into WebGPU textures (`skia-texture-bridge.ts`).** Each texture is `rgba8unorm` with `RENDER_ATTACHMENT | TEXTURE_BINDING | COPY_SRC`; `COPY_SRC` is there for the probe read-back. `Skia.Surface.MakeFromGPUTexture(texture)` draws into it. `draw()` calls `flush()`, or `flush(true)` when asked, before the frame that samples it. three samples it through `THREE.ExternalTexture`, tagged sRGB, with nearest filtering and no mipmaps. Glyphs are the `pixel-font.ts` table drawn as rects, so no font file is loaded and the lettering matches the vertex-quad signs already in the city. Colours come from `world/palette.ts` tokens. When the device is not Skia's, or Skia is not on the runtime, or Skia refuses the texture, `makeLabelTexture` builds the same rects into a `DataTexture` and reports `path: 'bitmap'` with `fallbackReason`. The API the materials and vehicles lanes call is `makeLabelTexture(THREE, label('plate' | 'blade' | 'destination', text), env)`.

**Probes (`device-probes.ts`), selected by `EXPO_PUBLIC_WORLD_PROBE` with the flag on:**

- `shared` clears a texture on three's device, reads one texel back and checks it is lit. It then hands the texture to `Skia.Image.MakeImageFromGPUTexture`, which accepts only textures of Skia's device. Pass means the texel is lit and Skia accepts the texture.
- `skiatex` has Skia draw a sign blade six times, with a new ground colour each frame. After each draw it samples the corner texel and classifies it as `fresh`, `stale` (last frame's colour), `black` or `timeout`. It runs once with `flush()` and once with `flush(true)`. On the worklet runtime the sample is a three render of the `ExternalTexture` into a 4 × 4 `RenderTarget` plus `readRenderTargetPixelsAsync`. On the JS runtime it is a WebGPU `copyTextureToBuffer` on the shared queue.
- `pipecache` times the render session from start to the first presented frame, with the stage marks in between. Run it on a cold launch and again on a second launch.

Every record is one `probe {json}` line: through game-render's trace on the worklet runtime, and through `runJsDeviceProbe()` on the JS runtime. Read-backs time out after 3 s so a hung device shows as `timeout` and the world still loads.

## G10: react-native-skia 3.6.1 → 3.8.0 (no bump in this lane)

Read from the GitHub releases v3.6.2 to v3.8.0 and the commits behind the interop items.

- **Bump coupling.** react-native-webgpu's compatibility table pairs webgpu 0.13.1–0.16.1 with Skia 3.4.0–3.6.3, and webgpu 0.17.0+ with Skia 3.7.0+. The two link one Dawn, and a mismatch fails the native build with `Dawn version mismatch`. Skia 3.8.0 therefore means react-native-webgpu 0.17 too, and the repo's `react-native-webgpu@0.16.0.patch` has to be re-cut. 3.7.0 also moves Skia to m157.
- **iOS link bug that can break the shared device in this install (3.7.3, #4306, fixes #4305).** react-native-webgpu finds Skia's `wgpu::Instance` with `dlsym(RTLD_DEFAULT, "rnskia_getWGPUInstance")` (`WebGPURuntime.cpp` L23). With CocoaPods' default static linkage, nothing references `RNDawnInterop.o`, so the linker drops the symbol. react-native-webgpu then never pumps Skia's instance, and `mapAsync` on an imported device never settles. The issue reproduced this on an iOS 26.5 simulator with Skia 3.7.2 and webgpu 0.17.0. Installed 3.6.1 has the same `RNDawnInterop.cpp` and no `-u _rnskia_getWGPUInstance` in its podspec, so the iPad run may hit it. That is why the probes time out their read-backs. If `shared` or `skiatex` shows `timeout` on hardware, this is the first suspect. The fix is a linker flag (`-Wl,-u,_rnskia_getWGPUInstance` in `user_target_xcconfig`), which is native build configuration, so §6.6 applies: ask Mike before patching it.
- **Device loss (3.7.3, #4291).** `Skia.gpu.lost` resolves after Skia replaces a lost device. The device `getNativeDevice()` returned is gone for good and "WebGPU code imports again". Once on 3.7.3+, gpu-store's shared branch can re-import on `Skia.gpu.lost` instead of going `unsupported`.
- **Threading.** 3.6.3 keeps the render pool one frame ahead of the display (#4263). 3.7.3 reads shared values on the UI thread rather than while recording (#4300) and makes each recorder the only owner of its image provider (#4277). 3.7.4 uses a recorder pool instead of a recorder per Canvas (#4309). None changes the documented rule that Dawn synchronises device access across Skia's recording threads and other users of the device. Whether three on the worklet runtime and Skia's recorders contend on that lock is what `shared` and the §6.5 UI-thread fps measurement have to show.
- **Pipeline caching.** No release between 3.6.1 and 3.8.0 mentions persisted pipelines or time to first frame. The article says that work is still in progress. `pipecache` measures it rather than assuming it.
- **API renames (3.8.0, #4323).** `Skia.Image.MakeImageFromGPUTexture` becomes `Skia.Image.MakeFromGPUTexture`. `SkiaInterop` in `skia-texture-bridge.ts` names the 3.6.1 method, so a bump must change that one line. `Skia.Surface.MakeFromGPUTexture` and `flush(sync)` are unchanged. 3.8.0 also removes `SkiaPictureView` (#4327).
- **Other.** 3.7.1 presents at the full ProMotion rate on iOS (#4273), which bears on G4's 120 fps question. 3.7.3 makes `Surface` own its `Canvas` (#4278).

## Consequences

- Three users on one device: TypeGPU's root, three's renderer and Skia's Graphite context. GPU memory is counted once, and textures move between them without copies.
- Skia's command queue is shared with three's. A long Skia recording can delay three's submit and the reverse. The §6.5 measurement (Reanimated fps beside the world canvas) is the check.
- The bridge's Skia path is used only when `deviceSource === 'shared'` and Skia is on the runtime. The city scene builds on the worklet runtime. If the `SkiaApi` global is not installed there, labels on that runtime take the bitmap path. The other option is for the JS runtime to draw them and pass the `GPUTexture` across, which needs a `worklet-host.ts` change.
- No dependency, native or podspec change in this lane.

## Open items for the orchestrator

1. `worklet-host.ts` should pass `deviceSource: readGpuDevice()?.source ?? null` next to `device` in the `startOnRuntime` args. Until it does, the trace says `unknown` for a handed device.
2. `runJsDeviceProbe()` needs one call on the RN runtime when the Game screen mounts (for example in the worklet host's `start`). It is a no-op unless the flag and a `shared` or `skiatex` probe are set.
3. `pipecache` on the JS render path (`ThreeCanvas` / `loadGameScene`) needs the same timer that `game-render.ts` uses: `createPipecacheTimer('js')`, `mark(stage)` on each load stage, and `finish()` on the first frame.
4. `physicalRendererParams()` (for example `reversedDepthBuffer: true`) does not exist yet in `world/physical-look.ts` or `world/physical-rig.ts`. When it lands, spread it into the `new THREE.WebGPURenderer({...})` options in `game-render.ts` under `WORLD_PHYSICAL`, after `device`, and do the same in `packages/ui/three/surface.native.tsx`.

## Verification status

- **Node-verified:** 5 `acquire-device` tests (ui), and the render-runtime suite (37 tests, 24 of them new for this ADR, plus a flag-off assertion added to `game-render.start.test.ts`). Both use react-native-webgpu's own Jest mock for `importDevice` and the `GPUTextureUsage` constants. `tsc --noEmit` is clean for every file listed under Code.
- **Device-verified:** nothing. The `shared`, `skiatex` and `pipecache` rows on iPhone 17 and iPad Pro, JS and worklet runtimes, are open.
- **Not verified:** that `SkiaApi` and `RNWebGPU` exist on the Bundle Mode render runtime; that Skia's device accepts `rgba8unorm` render attachments from react-native-webgpu; that `flush()` without `sync` is enough for three's queue; that persisted pipelines help three.
