# NYC-Mon / Klipp cinematic camera integration (phase 1)

Stacked on the existing #46 world. Camera project: [pmndrs/klipp](https://github.com/pmndrs/klipp), **MIT**, version **0.14.0** (renamed from deprecated `@kvvasuu/klipp`). This branch uses its verified `CameraState` shape, not vendored Klipp code or a synthetic substitute for the package.

## Implemented now

- `camera/klipp-shot-bridge.ts` consumes Klipp's actual `shot.position`, `shot.quaternion`, `shot.fov`, `shot.near` and `shot.far` tuple contract.
- Rejects non-finite/corrupt values before changing the Three `PerspectiveCamera`; normalizes quaternions and clamps unsafe lens values.
- `city-scene.ts` optionally applies a cinematic shot and restores the original chase/overview camera on exit. No teleport to a saved/world position; game state stays authoritative.
- `cinematicCameraStore` is a temporary input seam. GameScreen subscribes without React rerenders; no new render loop or R3F canvas. Unit and real scene tests cover rollback.
- Default: cinematic shot is `null`; exploration behaves exactly as before.

## Follow-up: real Klipp coordinator (pending lock update)

1. Install/pin `@pmndrs/klipp@0.14.0` and regenerate the pnpm lockfile using the repository's release-age policy. No package installed in this draft because this runtime cannot access npm.
2. Create one `Klipp` per game session, with `targetPose` tied to the Caller and nearby Mons; never tie it to global React re-renders.
3. Register virtual cameras: `explore` Follow/Orbit (10), `ride` (15), `scan` target composition (20), `encounter` (30), `battle` (40). Use proper damping/blends and reduced-motion equivalents.
4. Drive `klipp.update(dt)` in the same world loop, then apply `klipp.shot` to the existing renderer. Preserve collision/occlusion, near-wall camera safety, look-around/manual input precedence.
5. For worklet rendering, mirror only the shot state through the existing worklet snapshot channel. The current JS store is **not** mirrored to the render worklet; this is an explicit blocker before enabling the new cameras in worklet mode.
6. Set test scenarios at Apollo Theater: walking/chasing, scan target near wall, wild Mon encounter, turn-based battle, mounted Mon, resume after cancel, rotated Surface Duo, foldable hinge, XR.
7. Add camera frustum/collision tests, snapshot continuity and compositor frame timing. No camera shake at rest; accessible reduced motion.

## Lane F rebuild plan — verified against the 0.14.0 tarball (2026-10-16)

The package was fetched straight from the registry (`npm view` tarball) without installing, so every signature below is real. Install is still gated on pnpm `minimumReleaseAge` — `math@0.0.0-canary-20260930-56e1c4d3` (Klipp's only runtime dep) is already past the window.

**Entry point:** `@pmndrs/klipp/three` — `new KlippThree(camera, options)`. All four peers (`react`, `@react-three/fiber`, `camera-controls`, `three`) are `optional` in `peerDependenciesMeta`; the `/three` entry needs only `three` (repo has 0.186.1 ≥ the `>=0.156` floor). No R3F, no DOM input sources required.

**What the in-tree seam becomes:**

| Now (stand-in) | Real Klipp |
| --- | --- |
| `CameraWithKlippPose` + `applyKlippShot` + `validKlippShot` | gone — `KlippThree.write()` owns transform+lens writes to the real camera; `CameraState` uses typed `Vec3`/`Quat` fields so the tuple validator and clamps are unnecessary. Lens safety moves to per-camera `initialState` / blend config |
| `chooseCameraShot(triggers)` + `cinematicCameraStore` (Zustand) | five `VirtualCameraThree`s with fixed priorities (explore 10, ride 15, scan 20, encounter 30, battle 40); triggers toggle `camera.active`/`setPriority` — Klipp arbitrates and blends. `subscribeActiveId`/`subscribeLiveId` replace the store for UI listeners |
| manual viewOffset gap | `CameraState.viewOffset` is a native field — the offset framing the Duo hinge needs is a lens field, not a workaround |
| `recordCityFrame`-style frame gating | `klipp.update(dt)` returns `true` while anything still moves → drives the on-demand canvas invalidate directly |
| manual input precedence | `klipp.whileOnScreen(cam, start)` connects player look-around only while that camera is live; `mode = 'standby'` freezes writes on tab blur |

**Per-camera pieces** (from `dist/three`): `FollowBodyThree`/`OrbitFollowBodyThree`/`HardLockToTargetBodyThree` bodies, `HardLookAtAimThree`/`RotateWithFollowTargetAimThree`/`PanTiltAimThree` aims, `GroupFramingExtensionThree` + `TargetGroup` for the scan/encounter compositions, `BasicMultiChannelPerlinNoiseThree` for shot texture. Targets bind as `Object3D`s through `klipp.targets` (read once per frame — Caller and nearby Mons register there, never React state).

**Still required from the original plan:** collision/occlusion safety (Klipp does not do it — keep the existing near-wall clamp as a `CameraPiece` after the body), reduced-motion blend overrides (`setCustomBlends`), `setSize(w,h)` on canvas resize, session lifecycle (one Klipp per game session, `mode='disabled'` on exit), and the worklet-snapshot mirror in step 5.

## Reviewer roster and skills

- Distinguished gameplay camera engineer — Klipp v0.14 lifecycle, shot priorities, blend interruption, returning control.
- Three.js/WebGPU engineer — one renderer, lens update without projection churn.
- React Native/foldable engineer — gesture ownership, hinge safety, reduced motion; Rive remains controller UI.
- Tech artist/cinematographer — anime-monster RPG shot language, distinctive NYC-Mon composition rather than copying Digimon.
- QA — 2D web/canvas parity, native worklet snapshot, crash/reconnect and baseline frame time.
- Use Game Visual Debugging, React Best Practices, and game performance skill. No external subagent execution has been reported.

**This phase does not claim Klipp is installed or that an animated follow rig has run on hardware.** Draft, no merge/deploy.
