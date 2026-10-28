# NYC-Mon — PixiJS 3D closed-beta comparison gate

Do not replace the 3D city renderer based on the shared social-media 60-FPS demo. PixiJS 3D is in **closed beta** as of this research. The accessible stable PixiJS 8 documentation is primarily the 2D renderer. No verified public PixiJS 3D API or native adapter is available here; **no PixiJS package was installed**. Entry: https://goodstuff.pixijs.io/pixijs-3d-signup/

## Executable comparison harness

`tooling/renderer-bench/compare.ts` accepts two external timing captures and refuses to rank them unless the backend, GPU/device, camera route, dataset digest, triangle count, viewport, pixel ratio, and quality signature match. All inputs must have at least 120 measured frame intervals and CPU submission values; synthetic fixtures cannot produce a production recommendation. `compare-cli.mjs` prints p50/p90/p99 and 60Hz misses, not a hardware attestation. Its JSON schema is the `RendererCapture` interface.

Command after **both** production-shaped captures exist:

```sh
node tooling/renderer-bench/compare-cli.mjs /path/to/three.json /path/to/pixijs3d.json
```

No capture file with real FPS accompanies this branch. Unit tests use synthetic data solely to prove the guard refuses apples-to-oranges comparisons.

## Grounded workload

- Use PR #46's Apollo/125th Street baked Harlem v2 OSM district, including 3,761 buildings, 2,414 mapped ways, 172 areas, and street-level props.
- Start from the exact same saved world coordinates and camera path, freeze daypart, weather, vehicle/NPC state, gameplay tick, collision geometry and texture inventory.
- Compare like-for-like WebGPU on the same web device. Separately compare WebGL2 vs WebGL2 only when the 3D beta supports it. Do not compare Mac M1 to an Android phone, or a Pixi demo with few props to NYC-Mon's complete city.
- Record actual pixel dimensions/DPR, scene assets with SHA-256, vertex/triangle count, shadow/lighting passes, post effects, textures/bytes, present-frame timestamps, JS CPU submission, GPU timestamp where supported and memory. Present-frame numbers may be browser-timestamp estimates; a JSON field saying `physical-device` is self-reported, not independent proof.
- Retain screenshot color/depth/normal/object ID and the matching camera pose when the renderer exposes them, with Game Visual Debugging's sealed capture pipeline after separate authorization. Human visual similarity review is required in addition to metrics.
- Test 3 device tiers: contemporary desktop WebGPU, iPhone Safari WebGPU where exposed, lower-end Android browser WebGPU/WebGL2; native Expo/React Native support is a **separate feasibility gate**. A browser Pixi beta pass cannot certify React Native Dawn or Quest XR.
- Stop if API/licensing does not permit the required scenario, feature parity cannot be achieved, or either renderer renders incorrectly; never game the comparison with missing shadows/particles.

## Outcome

Keep **Three.js WebGPU + TypeGPU** production renderer until PixiJS 3D offers measurable quality/performance advantages on NYC-Mon's representative scene, with usable native integration and a stable license/API. PixiJS can still be an optional 2D effect/HUD layer where it earns its extra canvas and memory cost; do not run two 3D renderers on a phone by default.

Senior graphics engine reviewer, React Native/WebGPU reviewer, performance profiler, licensing engineer and visual QA must approve the comparison. Apply Game Visual Debugging and Game Performance Optimization skills. Do not request beta secrets or purchase services without owner authorization.

**Scope:** fair-comparison code/tests/docs only, not a PixiJS renderer, no merge or deployment.
