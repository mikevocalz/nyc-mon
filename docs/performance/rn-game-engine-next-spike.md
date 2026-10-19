# `rn-game-engine-next` 0.2.0 compatibility spike

Master Directive v2 §11. Static evidence from the published tarball and the repo; no device benchmark was run in this lane (see "What was not measured").

- Package: https://www.npmjs.com/package/rn-game-engine-next · source: https://github.com/ahsanmunyr/rn-game-engine-next
- Evidence: `npm pack rn-game-engine-next@0.2.0` into the session scratchpad (never into the repo), 2026-10-15. shasum `5a74e7f5b0dfacd868dcb8c199f830ccabf9e8ac`, 92 files. Every claim below cites a file in that tarball (`package/…`) or in this repo.

## Decision

**STRIKE.** Do not add `rn-game-engine-next` to `@acme/app`, `@acme/ui` or `@acme/core`. The repo's own loop (`ThreeCanvas` drawing on demand, Zustand stores, the typed `GameInputRouter` contract) already covers what the engine offers, and integrating it would violate three of §11's rejection criteria at once: a competing render loop, duplicated authoritative state, and dependencies the repo does not want. A benchmark-backed rejection is allowed by §11; this one is backed by source reading and size measurement, and the "What was not measured" section says exactly what a device run would still add.

## What the package is

`package/package.json`: a `create-react-native-library` turbo-module (`codegenConfig.name: RnGameEngineNextSpec`) whose only native surface is `triggerHaptic(type)` (`package/ios/RnGameEngineNext.mm`, `package/android/.../RnGameEngineNextModule.kt`). Everything else is JavaScript:

| Piece | File | What it does |
| --- | --- | --- |
| Loop | `package/src/core/GameLoop.ts` | `createGameLoop({ fps, autoStart, onUpdate })`: a `requestAnimationFrame` loop on the JS thread with an optional fps cap (20 % tolerance for Android Choreographer jitter) and a 30-sample rolling fps. |
| Systems | `package/src/types.ts` | `System = (entities, context) => Entities`; run in array order each tick, each wrapped in `try/catch` that logs and continues (`GameEngine.tsx` lines "isolate failures"). |
| Entities | `package/src/core/EntityManager.ts` | `Record<EntityId, Entity>` with `Entity = { id; [key: string]: unknown }`; helpers copy the map on every add/remove/update. |
| Events | `package/src/core/EventEmitter.ts` | A `Map<event, Set<listener>>` emitter; `dispatch` in the engine pushes to a `pendingEvents` array drained once per tick. |
| Lifecycle | `package/src/components/GameEngine.tsx`, `SkiaGameEngine.tsx` | A React component owns the loop in a `useEffect([])`; `running` is a ref read each tick; unmount stops the loop. `GameEngine` calls `forceRender` (a `useState` setter) every tick. |
| Input | `package/src/input/TouchHandler.ts` | `PanResponder.create` with `onStartShouldSetPanResponder: () => true` on the engine's root view. Long-press via `setTimeout`. |
| Sensors | `package/src/input/SensorBridge.ts` | `require('react-native-sensors')` at call time; warns and no-ops when absent. |
| Physics | `package/src/physics/PhysicsBridge.ts` | AABB arcade physics in 60-fps-normalised units; optional `require('matter-js')`. |
| Scenes, haptics | `SceneManager.ts`, `HapticManager.ts` | Named entity/system sets; haptics through the turbo-module or `Vibration`. |

## API stability

- Version 0.2.0, pre-1.0, no CHANGELOG in the tarball. The README's Roadmap (`package/README.md` "## Roadmap") says Phase 2 will move both loop and systems into Reanimated worklets, which changes the `System` calling convention (systems would have to be worklets). The current public shape should be read as transitional.
- `SkiaGameEngine.tsx` resolves Skia and Reanimated with `require` at module load into `any`-typed slots (six `any` sites) and throws at render when a peer is missing. The Skia draw path uses `Skia.PictureRecorder` + `<Picture>` and comments "Skia v2 removed useDrawCallback/onDraw", so it tracks Skia's API by hand.
- `GameEngine.tsx` keeps `entities` in a ref and exposes `entitiesRef.current` through context captured in a `useMemo([dispatch])`, so context consumers see the entity map identity from the first render only. Reading live state goes through the per-tick `forceRender`.

## Peer conflicts with this repo

`package/package.json` `peerDependencies` (all optional except `react` and `react-native`):

| Peer | Engine wants | Repo has (`pnpm-workspace.yaml` catalog) | Verdict |
| --- | --- | --- | --- |
| `@shopify/react-native-skia` | `>=1.0.0` | `"@shopify/react-native-skia": npm:react-native-skia@3.0.2` (an alias to the `react-native-skia` 3.0.2 package, with a patch) | Resolves by name, but the engine's `require('@shopify/react-native-skia')` would load the aliased 3.0.2 package, which the engine has never been built against (its devDependency is `^2.5.5`). Graphite-era API drift is unverified. |
| `react-native-reanimated` | `>=3.0.0` | 4.7.0 | Satisfied. |
| `react-native-worklets` | `>=0.8.0` | 0.13.0 | Satisfied. |
| `react-native-sensors` | `>=7.0.0` | not installed anywhere in the workspace (`grep` of every `package.json` and the catalog: no hit) | Optional, but `GameEngine` constructs `new SensorBridge()` on every mount regardless of `inputs`; the sensor paths warn and no-op. Adding the peer is a new native dependency for a feature the arcade controller does not use (the stick is touch, keyboard and gamepad, §9). |
| `react` / `react-native` | `>=18` / `>=0.76` | 19.x / 0.88.0-rc.3 | Satisfied. |

## Competing render loop vs `ThreeCanvas`

`packages/ui/three/ThreeCanvas.tsx` owns one frame loop gated on visibility, pause and reduced motion, and `packages/app/features/game/GameScreen.tsx` mounts it `paused`: the city is static, every camera change calls `invalidate()` once (`gameCameraStore.subscribe(() => canvas.current?.invalidate())`), and no idle frame loop runs. `ThreeCanvas` even stops three's own internal `Animation` loop after `init()` so there is exactly one scheduler.

Every engine entry point starts a second `requestAnimationFrame` loop on the JS thread that runs every frame while mounted (`GameLoop.ts` `loop()` re-requests unconditionally; `SkiaGameEngine.tsx` does the same inline). `GameEngine` additionally calls `forceRender` per tick, re-rendering its React subtree at display rate. Neither loop knows about `ThreeCanvas`'s `paused`/on-screen gating, reduced motion, or the §3 rule that the lobby must never keep a full-speed loop alive during gameplay. Adding it means two schedulers and a JS-thread tick with nothing to draw into.

## Duplicated authoritative state

`CONTRIBUTING.md` Law 4 and the directive's "Zustand is the only state container" put game state in Zustand (`gameCameraStore`, `gameScreenStore` in `game-session.ts`; this lane's `worldSessionStore` and `worldSaveStore`). The engine keeps its state in `entitiesRef` inside a component, exposed through React context, with systems mutating an untyped `Record<string, unknown>`. The world's camera would exist twice (store and entity) or the store would become a per-tick mirror of the entity map, which is the "placement data round-trips through JS per frame" the directive forbids. The engine's `TouchHandler` also claims the whole root view with `onStartShouldSetPanResponder: () => true`, which conflicts with the RNGH 3 gesture tree in `use-city-camera-gestures.ts` and with §14's "no gameplay-input interception outside active control bounds".

## Bundle size (measured)

- Tarball: 55 362 B compressed, 280 064 B unpacked (`gzip -l`).
- Shipped JS the bundler would see (`package/lib/module/**/*.js`, excluding source maps): 42 610 B before minification. Largest: `SkiaGameEngine.js` 10 055 B, `GameEngine.js` 7 116 B, `PhysicsBridge.js` 5 044 B.
- Plus one iOS podspec and one Android Gradle module for the haptic turbo-module, both of which duplicate what `@acme/ui/haptics` (`packages/ui/haptics.native.ts`) already provides.

Small in bytes; the cost is the second native module and the second scheduler, not the kilobytes.

## What the engine does well, and why it still does not earn a slot

- `GameLoop.ts`'s Choreographer tolerance and O(1) rolling-fps sum are sound. The repo does not need a capped loop: `ThreeCanvas` draws on demand.
- The `System` pipeline is a clean way to compose per-tick logic. The sim core already has a pure, deterministic `step()` (`packages/core/sim/step.ts`) run headless in Vitest; the engine's untyped entity map would be a regression in type safety.
- Error isolation per system (`try/catch` and continue) hides bugs; the repo's standard is to throw.

## What was not measured

No device benchmark was run in this lane: no main-thread or JS-thread cost, no FPS distribution, no input-to-visual latency, no memory or mount/unmount timing, no fold/unfold interruption test. The numbers in this document are file sizes and source facts. A device run (lane F, `agent-device`, Callstack method) would only be worth doing to measure the second loop's idle cost, and the static reasons above are already disqualifying under §11's "competing render loops, duplicated authoritative state, or unneeded dependencies" clause.

## Sources

- https://www.npmjs.com/package/rn-game-engine-next (read 2026-10-15)
- https://github.com/ahsanmunyr/rn-game-engine-next (read 2026-10-15)
- `packages/ui/three/ThreeCanvas.tsx`, `packages/app/features/game/GameScreen.tsx`, `packages/app/features/game/game-session.ts`, `packages/ui/game-controls/contract.ts`, `pnpm-workspace.yaml`
- Master Directive v2 §1, §3, §9, §11, §14
