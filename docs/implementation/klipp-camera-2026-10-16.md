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

## Reviewer roster and skills

- Distinguished gameplay camera engineer — Klipp v0.14 lifecycle, shot priorities, blend interruption, returning control.
- Three.js/WebGPU engineer — one renderer, lens update without projection churn.
- React Native/foldable engineer — gesture ownership, hinge safety, reduced motion; Rive remains controller UI.
- Tech artist/cinematographer — anime-monster RPG shot language, distinctive NYC-Mon composition rather than copying Digimon.
- QA — 2D web/canvas parity, native worklet snapshot, crash/reconnect and baseline frame time.
- Use Game Visual Debugging, React Best Practices, and game performance skill. No external subagent execution has been reported.

**This phase does not claim Klipp is installed or that an animated follow rig has run on hardware.** Draft, no merge/deploy.
