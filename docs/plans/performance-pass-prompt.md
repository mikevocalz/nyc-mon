# Agent prompt: performance pass (lag-free, then past 60 fps)

16 Oct 2026

## Mission and ground truth

You are making NYC-Mon feel instant on the Surface Duo: no hitches, a steady frame rate, and more than 60 fps wherever the display allows it. Work in [mikevocalz/nyc-mon](https://github.com/mikevocalz/nyc-mon) on branches off `main`, one draft PR per step in the work plan. This pass runs before the realism pass's heavier PRs: its budgets become the gates those PRs must pass.

### What is slow today

All figures are from the repo on `main`, 16 Oct 2026. Re-measure before you change anything.

| Fact | Source |
| --- | --- |
| About 15 fps walking on the Duo | `docs/implementation/worklet-rendering.md` |
| JS render submission p50 9 ms, p90 14 ms; cutting triangles 4× and pixel ratio 2→1 barely moved fps, so the GPU is not the limit | same |
| Android UI thread p50 44 ms idle with four autoplay Rive views, and still 38 ms walking with Rive paused | same |
| Three.js renders on the JS thread today; a worklet render runtime exists behind `EXPO_PUBLIC_WORKLET_RENDER` and has not run on a device | same |
| On a worker runtime, `requestAnimationFrame` is a 16 ms `setTimeout` poll, not vsync | same, citing `react-native-worklets` 0.13.0 |
| The arcade controller loads three separate `.riv` files (stick, six-button cluster, pill) | `packages/ui/game-controls/use-arcade-rive-files.native.ts` |
| `@rive-app/react-native` 0.5.5 (the Nitro runtime), `react-native-webgpu` 0.16.0, `react-native-worklets` 0.13.0, Reanimated 4.7.1, three 0.186.1, Expo 58 / React Native 0.88 | `pnpm-workspace.yaml` |
| `app.config.ts` sets an iOS `infoPlist` without `CADisableMinimumFrameDurationOnPhone` | `apps/mobile/app.config.ts` |
| The web baseline recorded a 3.77 s mount stall, likely WebGPU pipeline compilation, unconfirmed | `docs/design/site/PREMIUM_SITE_BASELINE.md` |

The UI thread caps the screen near 25 fps no matter which thread three.js uses. Rive is only part of it: pausing Rive took 44 ms to 38 ms. The first job is naming the rest.

### What the display allows

| Display | Frame budget | Note |
| --- | --- | --- |
| First-gen Surface Duo, 60 Hz | 16.7 ms | 60 is the ceiling on this device |
| Surface Duo 2, 90 Hz | 11.1 ms | Needs a frame-rate request and a vsync-paced loop |
| ProMotion iPhones, up to 120 Hz | 8.3 ms | Needs the Info.plist key; the system still picks the rate |

The repo doesn't record which Duo is in use. Record its model and Android version in PR 0.

### APIs confirmed in three.js 0.186.1

From the release tarball: `BundleGroup` (render bundles), `BatchedMesh`, `InstancedMesh`, `renderer.compileAsync()`, `renderer.resolveTimestampsAsync()`, `PMREMGenerator`, `RenderPipeline`. Cite the installed file and symbol before using any of them, and prove each on react-native-webgpu on the Duo.

## Roster

Judge every change by whether its creator or spec author would sign off on that exact file. "Senior" and "principal" are below the bar. The repo's [reference roster](https://github.com/mikevocalz/nyc-mon/blob/main/docs/design/reference-roster.md) stays canonical.

### Engineers

| Domain | Bar | Source |
| --- | --- | --- |
| Nitro, JSI, native threading | Marc Rousavy | [Nitro](https://nitro.margelo.com/) · [react-native-skills](https://github.com/margelo/react-native-skills) |
| Native 3D on its own render thread | Hanno J. Gödecke (react-native-filament) | [react-native-filament 0.15.0](https://github.com/margelo/react-native-filament/releases/tag/v0.15.0) |
| WebGPU in React Native, worklet rendering | William Candillon | [react-native-webgpu](https://github.com/wcandillon/react-native-webgpu) |
| Worklets and the UI runtime | Krzysztof Magiera | [Reanimated](https://github.com/software-mansion/react-native-reanimated) · [performance guide](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance) |
| three.js renderer and TSL | Ricardo Cabello (mrdoob), Michael Herzog (Mugen87), sunag, Renaud Rohlinger | [three.js](https://github.com/mrdoob/three.js) |
| WebGPU and Dawn | Kai Ninomiya, Corentin Wallez, Brandon Jones | [WebGPU spec](https://www.w3.org/TR/webgpu/) |
| Rive runtime | Guido Rosso, Luigi Rosso | [Rive best practices](https://rive.app/docs/getting-started/best-practices) |
| Android rendering and frame timing | Romain Guy, Chet Haase | [Frame pacing (AOSP)](https://source.android.com/docs/core/graphics/frame-pacing) · [Perfetto](https://perfetto.dev/) |
| Display refresh and heat on Android | Android Games team (Swappy, ADPF) | [Optimize refresh rates](https://developer.android.com/games/optimize/display-refresh-rate-change) · [ADPF](https://developer.android.com/stories/games/unisoc-adpf) |
| ProMotion | Apple Core Animation team | [ProMotion guide](https://developer.apple.com/documentation/quartzcore/optimizing-iphone-and-ipad-apps-to-support-promotion-displays) |
| Real-time 3D on the web, at scale | Bruno Simon | [2025 portfolio case study](https://www.awwwards.com/brunos-portfolio-case-study.html) |
| State | Daishi Kato | [Zustand](https://zustand.docs.pmnd.rs/) |
| TypeScript | Anders Hejlsberg, Ryan Cavanaugh, Daniel Rosenwasser | [TypeScript](https://www.typescriptlang.org/) |
| Accessibility | Alastair Campbell (WCAG 2.2 editor); Val Head for motion | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) |

### Designers

| Designer | Applies to | Source |
| --- | --- | --- |
| Rauno Freiberg | Controls and HUD that feel instant | [rauno.me](https://rauno.me) |
| Emil Kowalski | Motion that survives a lower frame rate | [emilkowal.ski](https://emilkowal.ski) |
| Massimo Vignelli | Legibility of signs at any render scale | [NYCTA Graphics Standards Manual](https://standardsmanual.com/) |
| Michael Bierut | Hierarchy that holds when detail drops on low tiers | [Pentagram](https://www.pentagram.com/) |
| Ken Sugimori lineage | Mons readable at reduced resolution | [reference roster](https://github.com/mikevocalz/nyc-mon/blob/main/docs/design/reference-roster.md) |
| Kazuo Ikeda-tier creature animator | Idle animation that reads at 60 and 90 alike | [reference roster](https://github.com/mikevocalz/nyc-mon/blob/main/docs/design/reference-roster.md) |

### Design agencies

| Agency | Applies to | Source |
| --- | --- | --- |
| Pentagram | Quality tiers that keep the identity intact | [pentagram.com](https://www.pentagram.com/) |
| Studio Dumbar | Motion language under a frame budget | [studiodumbar.com](https://studiodumbar.com) |
| Collins | Brand surfaces on the low tier | [wearecollins.com](https://www.wearecollins.com) |

### Dev agencies and studios

| Studio | Applies to | Source |
| --- | --- | --- |
| Margelo | Nitro, render threads, the Rive Nitro runtime | [Rive on Nitro](https://margelo.com/blog/rewriting-rive-react-native-with-nitro-modules) |
| Callstack | Measured React Native performance | [agent-skills](https://github.com/callstackincubator/agent-skills) |
| Software Mansion | Worklets, Reanimated, TypeGPU | [TypeGPU](https://docs.swmansion.com/TypeGPU/) |
| Shopify (React Native Skia) | Static controller art off Rive | [React Native Skia](https://shopify.github.io/react-native-skia/) |
| Utsubo | three.js performance practice | [100 Three.js tips](https://www.utsubo.com/blog/threejs-best-practices-100-tips) |
| Flying Roadster (Arbaaz Tanveer) | A procedural three.js city that holds frame rate on phones | [flying-roadster](https://flying-roadster.arbaazt.workers.dev/) |
| Active Theory | Real-time 3D craft bar | [activetheory.net](https://activetheory.net/) |
| Lusion | Real-time 3D craft bar | [lusion.co](https://lusion.co/) |
| 14islands | Interactive 3D craft bar | [14islands.com](https://14islands.com/) |

## Skills and subagents

Load every skill a lane names before that lane writes code, from the repo copy under `skills/` where one exists. Vendor the new packs first, each with a `SOURCE.md` (URL, commit, date, subpaths), as `skills/README.md` requires. Where a pack's advice conflicts with these laws (Zustand only, no bare `useState`), the laws win. Every skill produces a file; if one can't be invoked in your environment, produce its file anyway and say so in the PR.

### Margelo react-native-skills

[margelo/react-native-skills](https://github.com/margelo/react-native-skills) at `1e9e17b` (the commit `skills/` already pins). Any native code at all loads one of these first; C++ is Nitro.

| Skill | In `skills/` | Load for |
| --- | --- | --- |
| `build-nitro-modules` (MIT) | Yes | The frame-rate request, a display-link tick, the Thermal and Performance Hint APIs, as HybridObjects with Nitrogen output committed |
| `api-design` | Yes | The public shape of any new module |
| `kotlin` | Yes | `Surface.setFrameRate`, Choreographer, `PowerManager` thermal headroom, Performance Hint sessions |
| `swift` | Yes | `CADisplayLink`, `preferredFrameRateRange` |
| `cpp` | Yes | Any C++ inside a HybridObject |
| `react-native-nitro-fetch` (MIT) | No: vendor | Asset prefetch and cold-start cache warming, and its native Perfetto and Instruments tracing guidance |
| `react-native-mmkv` (MIT) | No: vendor if used | Persisting the chosen quality tier synchronously, with its Zustand integration |
| `react-native-vision-camera-realtime` | No | Read only, for its frame-budget and latency-profiling method; no camera work here |

### three.js skills

| Pack | Commit | License | Load for |
| --- | --- | --- | --- |
| [emalorenzo/three-agent-skills](https://github.com/emalorenzo/three-agent-skills) `three-best-practices` | `f950f95` | MIT | `draw-call-optimization`, `geometry-instanced-mesh`, `mobile-optimization`, `object-pooling`, `memory-dispose-geometry`, `render-delta-time`, `webgpu-renderer`, `tsl-compute-shaders`, `asset-compression`, `gltf-loading-optimization`, `debug-devtools`. Skip `r3f-best-practices` |
| [CloudAI-X/threejs-skills](https://github.com/CloudAI-X/threejs-skills) | `b1c6230` | MIT | `threejs-fundamentals`, `threejs-geometry`, `threejs-loaders`, `threejs-textures`; translate any GLSL or `EffectComposer` to TSL |
| [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) | `0a70cfc` | Apache-2.0 | `performance-optimization` (frame budget, CPU vs GPU split, pooling, batching, GC spikes), `threejs-scene-setup`, `threejs-gltf-loading`, `game-feel`, `camera-systems` |
| [pixijs/pixijs-skills](https://github.com/pixijs/pixijs-skills) `pixijs-performance` | `83760c6` | MIT | Overlay cost, once PixiJS joins three's device |

### React Native and device skills

| Pack | Commit | Load for |
| --- | --- | --- |
| [callstackincubator/agent-skills](https://github.com/callstackincubator/agent-skills) `react-native-best-practices` | `59e9d17` | Profiling, the threading model, Reanimated, measured before/after |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `react-native-skills` (MIT) | `063bee9` | `animation-gpu-properties`, `animation-derived-value`, `react-compiler-reanimated-shared-values`, `monorepo-native-deps-in-app` |
| [callstackincubator/agent-device](https://github.com/callstackincubator/agent-device) | `22ae872` | Scripted 90-second Duo walks and captures |
| [callstack/react-native-testing-library](https://github.com/callstack/react-native-testing-library) | `5678d04` | Tests for controller and settings changes |
| [petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop) | `000650b` | Every PR body, commit message and comment |
| [WorldFlowAI/everything-claude-code](https://github.com/WorldFlowAI/everything-claude-code) | `ecc:*` plugin | Subagent coordination and the review loop |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | `abf5779` | Visual audit of each quality tier |
| [mattpocock/skills](https://github.com/mattpocock/skills) | `49dd158` | Types for budgets, tiers and the frame-timing data |
| `mikevocalz-foldable-layouts` | blob `d60f539` | Any controller or HUD change on the Duo |

Read only, never vendored (no license found): [avinashbest/android-performance-skill](https://github.com/avinashbest/android-performance-skill) `6812553` for Perfetto and jank triage, and [Makio64/advanced-threejs-tsl-webgpu-rendering](https://github.com/Makio64/advanced-threejs-tsl-webgpu-rendering) `b39d60c` for TSL and WebGPU optimization notes.

### Design skill sequence

Run once for the pass, in order, each producing its file:

1. **user-research** → `docs/design/research/performance-feel.md`: what reads as lag to a player (input delay, hitches, low frame rate), the scenarios to measure, and the pass/fail feel test.
2. **design-system** → frame budgets and quality-tier settings as named constants (target fps, render-scale floor, pixel-ratio cap, environment-map size, effect switches). No literals in code.
3. **ux-copy** → labels for any graphics or battery setting and its tiers, in `docs/COPY_DECK.md`.
4. **design-handoff** → `docs/design/handoff/performance-tiers.md`: what changes visually per tier, and the controller's idle, active and paused states.
5. **frontend-design** → the settings surface if Mike wants one, and the controller if any part moves from Rive to Skia, with the repo's semantic UI.
6. **accessibility-review** → touch targets unchanged when controller art changes renderer; reduced motion still honored when Rive pauses; no effect flashes more than three times a second (WCAG 2.3.1); text legible at the lowest render scale.
7. **design-critique** → each tier's captures side by side, controls and world.
8. **code-review** → every PR, then a CodeRabbit pass with each finding fixed and retested.

### Mobbin per screen

At least three [Mobbin](https://mobbin.com) cards per screen, each tagged borrow or reject, saved in `docs/design/research/`.

| Screen | Mobbin search | Output |
| --- | --- | --- |
| Game tab, controls and HUD | game controller overlay; on-screen joystick | Which controller parts must animate and which can be static |
| Lobby | game lobby; matchmaking screen | Which Rive moments justify always-on animation |
| Settings: graphics and battery | graphics quality settings; battery saver mode | Whether tiers are exposed, and how |
| Loader | loading progress for games; first-launch setup | Progress while shaders compile and assets warm |

### Subagent lanes

| Lane | Runs | Owns | Output |
| --- | --- | --- | --- |
| M0 Measure | First, then throughout | PR 0 | Traces, device record, budgets in CI |
| U1 UI thread | After M0 | PR 1 | The named 38 ms, Rive fixes, Skia fallback if needed |
| R1 Render thread | After M0, parallel with U1 | PR 2 | Worklet render A/B, vsync pacing, zero per-frame allocation |
| G1 GPU | After R1 | PR 3 | Bundles, instancing, compile-ahead, compression, dynamic resolution |
| N1 Native | After U1 and R1 | PR 4 and PR 5 | Frame-rate requests, thermal and hint modules (Nitro) |
| V1 Verification | Throughout | Every PR | Device walks, critique, accessibility and review reports |

## Laws

### Truth

- **No invented APIs.** Cite the installed file and symbol for every call. If a shape is uncertain, stop and ask.
- **Release builds on the device.** Frame rate is judged only in a release build on the Duo; dev clients and simulators are labeled as such and never used for a pass/fail.
- **Measure, then change.** Every PR has before/after numbers taken the same way: frame time, UI-thread time, JS time, render-thread time and GPU time, separately.

### Craft

- **No slop.** No placeholders, stubs, narrating comments, speculative abstractions, assertion-free tests or "should work" claims.
- **History a reviewer can read.** Commits grouped by change, no repeated messages, the repo's formatter on every file.
- **TypeScript strict.** `tsc --noEmit` is a hard gate.
- **State.** Zustand only; bare `useState` and `useReducer` are banned. No React state changes per frame.
- **Native code.** C++ is Nitro HybridObjects with Nitrogen output committed and a Margelo skill loaded first.
- **Dependencies.** pnpm's 24-hour release-age guard stands.

### Performance

- **Zero allocations in the frame loop.** Preallocate vectors, matrices and quaternions; pool particles and effects.
- **Nothing compiles during play.** Every material and pipeline variant compiles in the loader.
- **Steady before fast.** Hold 60 with no frame over 16.7 ms before requesting more; request only rates you can hold.
- **Flags and fallbacks.** Every change sits behind a flag until its device capture passes, and the JS-thread path stays as a fallback.
- **Stable world.** Building ids, the tile projection, saved Caller positions and #46's gates stay intact.

## Work plan

Six draft PRs. Each passes its gates on the Duo before the next that depends on it starts.

### PR 0: Measure (M0)

1. Record the Duo's model and Android version in `docs/DEVICE_CHECKS.md`.
2. In a release build, capture a 90-second scripted walk from the Apollo east along 125th Street with Perfetto, covering the UI thread, RenderThread, the JS thread and the render runtime, plus `adb shell dumpsys gfxinfo <app> framestats`.
3. Add GPU timing with `renderer.resolveTimestampsAsync()` where the adapter supports timestamp queries, and draw calls from `renderer.info`.
4. Take heap snapshots at start and after 10 minutes.
5. Put the budgets in CI beside #46's gates: draw calls (target under 100), triangles, scene build time.

Done when: one baseline doc holds every number above, and CI fails on a budget breach.

### PR 1: Free the UI thread (U1)

1. From the PR 0 trace, name what fills the 38 ms that remain with Rive paused (layout passes, Fabric commits, gesture handling, Skia, anything else), and fix the largest item first.
2. Rive: pause every view that's offscreen or idle; set state-machine inputs only when values change; leave blend states when done so the runtime can pause itself; avoid blend modes and heavy clipping in the controller art ([Rive best practices](https://rive.app/docs/getting-started/best-practices)).
3. Merge the controller's three `.riv` files into one file with three artboards, or share loaded files across views, so each file is parsed once ([Margelo on Rive and Nitro](https://margelo.com/blog/rewriting-rive-react-native-with-nitro-modules)).
4. If Rive's per-frame cost stays high, draw the static controller art in Skia and keep Rive for moments that animate.

Done when: the UI thread holds under 16.7 ms through the walk, with the trace attached.

### PR 2: Render off the JS thread, paced by vsync (R1)

1. A/B the worklet render runtime behind `EXPO_PUBLIC_WORKLET_RENDER` against the JS path on the same build, following `worklet-rendering.md`. Watch Bundle Mode's effect on Reanimated, Gesture Handler and Skia worklets.
2. Replace the 16 ms `setTimeout` poll with a vsync tick: Reanimated's frame callback on the UI runtime once PR 1 frees it, or a native display-link tick through a Nitro module that schedules the render runtime.
3. Zero allocations per frame in `city-scene.ts`, the actors and the camera; frame data keeps flowing through the existing snapshot channel.

Done when: the render runtime draws at the display's rate in the walk, with frame times steadier than the JS path, and Bundle Mode breaks no other worklet.

### PR 3: GPU budget (G1)

1. `BundleGroup` for the static city, so its draw commands are recorded once and replayed.
2. `InstancedMesh` or `BatchedMesh` for every repeated prop, Mon and car.
3. Looping patches for grass, rain and ground clutter that follow the camera, instead of covering the tile ([Bruno Simon's case study](https://www.awwwards.com/brunos-portfolio-case-study.html)).
4. Every material variant compiled in the loader with `compileAsync`, including the realism pass's variants as they land.
5. KTX2 textures at 1K–2K; Draco or Meshopt for models.
6. Pixel ratio capped per tier; render scale steps down 10% when under target and up 5% with headroom, every 1.5 s, never below a floor Mike signs off on.

Done when: GPU time per frame sits inside the tier's budget with headroom, and no frame over budget appears in a walk after loading.

### PR 4: Ask for the frame rate (N1)

1. iOS: add `CADisableMinimumFrameDurationOnPhone` set to true in `app.config.ts`'s `infoPlist`, and confirm it in the prebuilt Info.plist ([Apple](https://developer.apple.com/documentation/bundleresources/information-property-list/cadisableminimumframedurationonphone)).
2. Android: request the display's top supported rate on the game surface with `setFrameRate()` ([Android](https://developer.android.com/games/optimize/display-refresh-rate-change)). If react-native-webgpu doesn't expose this, write a small Nitro HybridObject with `build-nitro-modules` and `kotlin`.
3. Request 60 when the tier can't hold a higher rate, so the display switches mode instead of frames swinging.

Done when: on a 90 Hz Duo 2 or a 120 Hz iPhone, the walk holds the requested rate; on a first-gen Duo, it holds 60.

### PR 5: Heat and memory (N1)

1. Poll thermal headroom with Android's Thermal API (Android 11+) and step the quality tier down before the device throttles.
2. Open a Performance Hint session for the render thread where Android 12+ allows ([ADPF](https://developer.android.com/stories/games/unisoc-adpf)).
3. Dispose geometries, materials and textures on unmount and when leaving the Game tab.
4. Run a 20-minute soak on the Duo with the render scale and thermal state logged.

Done when: the soak holds its target without throttling to a lower tier more than once, and the heap shows no growth.

## Gates, evidence and stopping

### Every PR must show

- `tsc --noEmit` clean and every existing test passing, with counts.
- #46's gates and the new budgets passing in CI.
- Before/after numbers from the same release build and walk: frame time, UI-thread, JS, render-thread and GPU time, separately, each with its method.
- The flag that controls the change, and proof the default build is unchanged with it off.
- The skill output files this PR owns, the roster member each change answers to, and a no-ai-slop pass on the PR body.

### The pass is done when

- A first-gen Duo holds 60 with no frame over 16.7 ms through the 90-second walk, after loading.
- Any 90 Hz or 120 Hz device in hand holds its requested rate.
- A 20-minute soak holds its tier.
- Design-critique, accessibility-review and code-review reports are in, with every finding fixed or answered.

### Stop and ask Mike when

- A trace points at something outside this prompt's scope.
- Worklets Bundle Mode breaks another library and can't be scoped.
- A fix would change how the controller looks or behaves, or remove a Rive moment.
- A tier can't hold its target without dropping something the look depends on.
- A three.js, worklets or react-native-webgpu API you need isn't in the installed versions.

## Sources

- Repo: [worklet-rendering.md](https://github.com/mikevocalz/nyc-mon/blob/main/docs/implementation/worklet-rendering.md) · [PREMIUM_SITE_BASELINE.md](https://github.com/mikevocalz/nyc-mon/blob/main/docs/design/site/PREMIUM_SITE_BASELINE.md) · [AGENTS.md](https://github.com/mikevocalz/nyc-mon/blob/main/AGENTS.md) · [skills/README.md](https://github.com/mikevocalz/nyc-mon/blob/main/skills/README.md) · [reference roster](https://github.com/mikevocalz/nyc-mon/blob/main/docs/design/reference-roster.md) · [#46](https://github.com/mikevocalz/nyc-mon/pull/46)
- three.js practice: [Bruno Simon's portfolio case study](https://www.awwwards.com/brunos-portfolio-case-study.html) · [100 Three.js tips (Utsubo)](https://www.utsubo.com/blog/threejs-best-practices-100-tips) · [WebGPU performance thread](https://discourse.threejs.org/t/webgpu-performance-issue/87939) · [R3F performance pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls) · [Flying Roadster](https://flying-roadster.arbaazt.workers.dev/)
- React Native: [react-native-filament 0.15.0](https://github.com/margelo/react-native-filament/releases/tag/v0.15.0) · [react-native-webgpu](https://github.com/wcandillon/react-native-webgpu) · [Reanimated performance guide](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance) · [Rive on Nitro (Margelo)](https://margelo.com/blog/rewriting-rive-react-native-with-nitro-modules) · [Rive best practices](https://rive.app/docs/getting-started/best-practices)
- Frame rate and heat: [CADisableMinimumFrameDurationOnPhone](https://developer.apple.com/documentation/bundleresources/information-property-list/cadisableminimumframedurationonphone) · [ProMotion guide](https://developer.apple.com/documentation/quartzcore/optimizing-iphone-and-ipad-apps-to-support-promotion-displays) · [Optimize refresh rates (Android)](https://developer.android.com/games/optimize/display-refresh-rate-change) · [Frame pacing (AOSP)](https://source.android.com/docs/core/graphics/frame-pacing) · [ADPF (Android)](https://developer.android.com/stories/games/unisoc-adpf) · [Surface Duo 2 displays](https://androidauthority.com/microsoft-surface-duo-2-1154511) · [Perfetto](https://perfetto.dev/)
- Skills: [margelo/react-native-skills](https://github.com/margelo/react-native-skills) · [emalorenzo/three-agent-skills](https://github.com/emalorenzo/three-agent-skills) · [CloudAI-X/threejs-skills](https://github.com/CloudAI-X/threejs-skills) · [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) · [pixijs/pixijs-skills](https://github.com/pixijs/pixijs-skills) · [callstackincubator/agent-skills](https://github.com/callstackincubator/agent-skills) · [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) · [callstackincubator/agent-device](https://github.com/callstackincubator/agent-device) · [react-native-testing-library](https://github.com/callstack/react-native-testing-library) · [no-ai-slop](https://github.com/petergyang/no-ai-slop) · [everything-claude-code](https://github.com/WorldFlowAI/everything-claude-code) · [impeccable](https://github.com/pbakaus/impeccable) · [mattpocock/skills](https://github.com/mattpocock/skills)
