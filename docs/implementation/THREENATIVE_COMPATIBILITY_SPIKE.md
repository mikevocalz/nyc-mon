# ThreeNative compatibility spike — NYC-Mon G01

Status: **test specification, not an implementation or passing test**. Parent: mobile Game/world plan PR #29. This is a gated experiment; do not replace the existing renderer or introduce a second shipping runtime unless the evidence supports it.

## Hypothesis

ThreeNative's portable game systems can drive a city-block scene through NYC-Mon's existing Expo/React Native WebGPU + Three.js WebGPURenderer surface. The availability of WebGPU alone is **not** proof of compatibility: ThreeNative may assume its own host, frame scheduler, filesystem, input devices, or graphics initialization.

## Implementation slice

1. Pin the exact examined ThreeNative version/commit and identify the portable packages and host-specific imports. Record current published versions; do not assume the proposed `@threenative/*` names are published or stable without confirming.
2. Create an opt-in test scene behind a development flag in the existing mobile Game screen; preserve existing production rendering paths and React Native navigation.
3. Render **one NYC-only metro-live derived city block** from the existing world dataset (or a clearly labeled deterministic small fixture if the dataset is not yet landed): roads, buildings, sidewalks, one animated Mon placeholder. No arbitrary worldwide tiles or second rendering engine.
4. Drive ThreeNative scene/update lifecycle from a single authoritative fixed-step simulation clock, with interpolated rendering where possible. Ensure mounts, foreground/background, navigation away/back, resizing, and GPU device loss release resources safely.
5. Test Rapier collisions and deterministic avatar movement against one sidewalk curb and one building; ensure physics runs independently of frame rate.
6. Adapt input to touch + one controller through the existing app input boundary, not direct assumptions about DOM/window/native host APIs. XR remains an exploratory follow-up, not a gate for the mobile prototype.
7. Keep React Native UI, Zustand ownership, TypeGPU integration points, Kinetrell UI animation, Expo and the existing WebGPU renderer. Avoid adding an alternative native executable or silently switching to WebGL.
8. Measure dependency/JS bundle costs and memory/GPU footprint compared with the existing scene.

## Executable verification required before claiming compatibility

- Unit tests: deterministic 30/60/120 Hz render stepping with one fixed-step simulation result; collision and movement; lifecycle cleanup; unsupported host imports fail clearly.
- Integration tests: real `GPUCanvas`/WebGPU device connected to Three.js WebGPURenderer with a ThreeNative-driven update loop; 3D block and one moving entity visible; HUD navigation intact.
- Cross-platform smoke: **iOS, Android, web**. Record actual device/browser, OS, build SHA, WebGPU backend, captured frame, errors, and CPU/GPU timings. An untested platform must be marked NOT RUN, never PASS.
- Regression: navigation back and forth 10x; fold/unfold/tabletop resizing and hinge-safe HUD; background/resume; missing assets; GPU device-loss/failure fallback; reduced-motion accessibility for UI.
- Performance: median/p95 frame time, dropped frames, peak JS/native/GPU memory when measurable, startup time and scene-switch latency; compare against the same scene without ThreeNative. No fabricated FPS numbers.
- CI: fast deterministic unit tests on the PR; label device GPU tests manual/required-for-adoption until runners genuinely support them. Avoid forcing live GPU availability in generic headless CI.

## Decision gates

**ADOPT portable systems** only if scene, simulation, physics and lifecycle work on the existing surface without changing the shipping host; no meaningful regression against measured baseline; supported target platforms are evidenced.

**ADAPT selectively** if only core logic/physics are portable or host-specific dependencies can be isolated behind small maintained adapters.

**REJECT for now** if ThreeNative demands exclusive swapchain/renderer ownership, a second native host, unsupported Node/browser globals, unacceptable size/performance, or brittle patches to Expo/React Native WebGPU.

Capture a compatibility matrix mapping every imported package to JS-only / browser-only / native-host-only APIs, upstream commit, adapter responsibility and observed test outcome. Keep TypeGPU and Viro XR paths unaffected.

## Owners and mandatory review

- Principal React Native/Expo Engineer — GPUCanvas lifecycle, navigation, native packaging
- Principal Rendering / WebGPU Engineer — Three.js renderer compatibility, memory, loss recovery
- Principal Game Engine Engineer — fixed-step loop, scene/asset architecture
- Principal Physics Engineer — Rapier determinism / collision
- Performance Engineer — comparable device baselines
- QA / Device Engineer — iOS, Android, web matrix, foldables
- Independent reviewer — cross-platform architecture and security

Use repository-required skills and strongest available equivalents of `expo/skills`, `mattpocock/skills`, `Argent/agent-device`, `pbakaus/impeccable`, `petergyang/no-ai-slop`, plus existing NYC-Mon adaptive layout guidance. Run typecheck, lint, relevant tests, actual device validation, and CodeRabbit review before reporting complete.

## Explicit non-goals

No citywide streaming rewrite; no combat or production gameplay feature in this spike; no replacement of Three.js, TypeGPU, Viro or the existing Expo host; no merge on specification alone.
