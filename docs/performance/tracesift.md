# TraceSift performance workflow

TraceSift is the default local analyzer for React Profiler, Hermes, and JavaScript CPU captures in NYC-Mon.

## Setup

Requires macOS or Linux and Node.js 22.19 or newer.

```sh
pnpm perf:tracesift:init
pnpm perf:tracesift
```

## NYC-Mon scenarios

Profile one stable gameplay path at a time:

- NYC map exploration and map-to-encounter transitions;
- Mon spawning/encounter UI;
- battle HUD and animation/state updates;
- Rive/HMI state-machine updates;
- Three.js/WebGPU scene updates;
- Viro/OpenXR entry, exit, and spatial panel updates;
- camera/scan result presentation;
- inventory, Mon roster, and detail views with realistic data;
- cross-device handoff UI state restoration.

Use React Profiler exports for render/commit churn. Use Hermes/JS CPU profiles for expensive JavaScript work.

If the hotspot moves into Three.js/WebGPU, ViroCore, camera, native map, OpenXR, or GPU work, pair TraceSift with the appropriate native/GPU profiler.

## Performance PR evidence

Record the same scenario before and after the fix and include the device/build, TraceSift finding, and comparable measurements in the PR. Avoid committing raw profiles by default because they may contain paths, interaction details, or session data.
