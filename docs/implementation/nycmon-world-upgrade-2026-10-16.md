# NYC-Mon: polish the existing world, do not rebuild it

**Baseline:** [PR #46](https://github.com/mikevocalz/nyc-mon/pull/46) was merged to `main` by another actor on 2026-10-16. This upgrade pack contains five independent, still-draft follow-up PRs; no further merge/deploy is authorized.

## Five scoped workstreams

| PR | Scope now | Explicit next phase |
|---|---|---|
| [#47](https://github.com/mikevocalz/nyc-mon/pull/47) | Opt-in 120-frame JS rendering submission metrics; focused tests and Surface Duo device matrix | Actual Duo UI/compositor+JS+GPU trace, worklet A/B, resolve ~15 FPS |
| [#48](https://github.com/mikevocalz/nyc-mon/pull/48) | Reversible, distance-fading masonry joint/asphalt grain experimental TSL shader | Licensed PBR atlases, physically sound light and per-device quality tiers |
| [#49](https://github.com/mikevocalz/nyc-mon/pull/49) | Validated Klipp v0.14 `CameraState` shot output wired into existing Three camera | Install/pin Klipp, virtual camera coordinator, worklet snapshot and player camera collision |
| [#50](https://github.com/mikevocalz/nyc-mon/pull/50) | Deterministic, replay-guarded district authority with no second save database | Colyseus 0.18 + @colyseus/sdk, Better Auth onAuth, schema state, shared live two-device scene |
| [#51](https://github.com/mikevocalz/nyc-mon/pull/51) | Strict comparable renderer capture validator/CLI | Actual PixiJS 3D beta access, scene adapter, matching visual captures and hardware timing |

## Technical rules and hierarchy

- Keep **three.js 0.186.1 WebGPURenderer + TypeGPU + react-native-webgpu Dawn** in production; native GameScreen and Rive controls stay intact. The OSM street map, stable identifiers, world coordinates, housing identity and Payload advertising surfaces are not replaced.
- No generic cyberpunk blanket over Harlem. Use distinctive ground-truth architecture with a believable stylized near-future layer. The desired *Digimon Story: Time Stranger* quality is an aesthetic goal, not a license to copy its assets/shaders.
- RenderPipeline bloom, AO, SSR, DOF, motion blur and reflections are **not enabled by this pack**. Previous native black-frame constraints and current ~15 FPS baseline make that unsafe until measured.
- Do not clone Mon inventories/saves into Colyseus. Better Auth owns identity, Neon owns persistence and Payload owns world creative/inventory.
- No default PixiJS 3D renderer. It's in closed beta. Even a web speed win does not prove React Native or XR support.
- Keep an accessibility and foldable matrix (Surface Duo cover/book/tabletop, iPad, Android, web, XR when available) and return the camera to saved coordinates after any cinematic shot.

## Specialist reviewer roster / handoffs

| Discipline | Critical files | Must produce before approval |
|---|---|---|
| Distinguished native performance engineer | `packages/ui/three/ThreeCanvas.tsx`, `WorkletThreeCanvas.tsx`, `packages/ui/game-controls/*` | Perfetto UI thread traces, Rive idle/active split, worklet vs JS real-device deltas |
| Principal WebGPU graphics engineer | `packages/app/features/game/world/*`, `packages/ui/three/*` | Native Dawn black-frame reproduction, TSL compilation, GPU/memory budget, screenshot parity |
| Cinematic camera engineer | `packages/app/features/game/camera/*`, `city-scene.ts` | Klipp v0.14 virtual cameras, follow/scan/encounter/ride/battle, collision and reduced-motion verification |
| Principal technical artist / NYC cultural designer | `world/materials.ts`, `world/facade-detail.ts`, OSM/asset registries | Landmark/stoop/bodega fidelity, PBR textures with license receipts, neutral historical source audits |
| Principal multiplayer simulation engineer | `packages/core/realtime/*`, `world/*`, planned game-server | 20 Hz server authority, input replay tests, two real users in one Colyseus district |
| Security and persistence engineer | Better Auth, Neon world-save, Payload CMS | Ownership checks, no GPS/public info leaks, rate limits, reconnect/revision conflicts |
| XR/foldable QA architect | GameScreen + adaptive panes + Viro/Specs | Supported GPU first frame, hinge-safe HUD, camera restore, no dual renderer |
| Release engineer | all five PR CI/evidence gates | reproducible captures; merge authority; no paid asset usage or production changes |

**Skills read and applied:** Game Development Studio orchestration, Game Asset Production, Game Asset Vendoring, Game Visual Debugging, Game Performance Optimization, and React Best Practices. Exact future paid/GPU/device work requires independent authorization. The `game-dev` CLI is absent from this execution environment, and no separate autonomous subagent process ran: this roster is an actionable handoff, not fabricated execution evidence.

## Acceptance sequence

1. Confirm #47 probe and worklet/device regressions on actual Duo. Separate CPU submission from GPU and UI frame/present metrics.
2. Accept or reject #48 shader on measured quality vs frame time, then build licensed PBR kit.
3. Add pinned Klipp dependency and verify #49 transitions with the same camera and performance benchmark.
4. Wire #50 to a real authenticated Colyseus server and prove two-device authority, conflicts and reconnect.
5. Run #51 only after beta access and feature-parity camera/world assets. Compare equivalent GPU/backend settings; no manufacturer demo numbers.
6. Preserve rollback for each flag/feature. **Every draft stays unmerged until separately approved.**
