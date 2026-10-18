# NYC-Mon / Klipp cinematic camera integration (phase 1)

Stacked on the existing #46 world. Camera project: [pmndrs/klipp](https://github.com/pmndrs/klipp), **MIT**, version **0.14.0** (renamed from deprecated `@kvvasuu/klipp`), installed in `@acme/app` after it passed the repo's 24-hour release-age guard on 2026-10-17.

## Implemented now

- `camera/klipp-shot-bridge.ts` builds one `KlippThree` per scene (`createKlippShotRig`). Every write to the real camera goes through `KlippThree.write()`: transform, lens and `viewOffset` (three's `setViewOffset`), including lens updates without a projection rebuild when nothing changed.
- Two virtual cameras: `explore` (priority 10) replays the chase pose every frame and keeps tracking in standby; `shot` (priority 40) activates while a caller feeds a `KlippCameraShot`. Klipp arbitrates and blends (0.65 s easeInOut by default, a cut under reduced motion).
- Out-of-range lens values clamp (`fov` 20 to 95, `near`/`far` bounded) instead of rejecting, so nothing snaps back mid-blend. A shot too corrupt to write never activates; one that goes corrupt while live blends back to `explore`.
- No per-frame allocation: `setChase`/`setShot` write into reused buffers and the pieces write scalars into `out`. `sanitizeKlippShot` (normalise quaternion, clamp lens) runs at store-set time, not in the frame path.
- LOD, fog and the sky follow `klipp.shot` (the blended output) and the rendered camera position — during a shot, `setViewDistance`/`setFocus` key to the shot's look point, not the chase camera's.
- `cinematicCameraStore` is a minimal JS-side request seam (`shot`, `setShot`, `clear`). GameScreen still feeds it through `params.cinematicShot` and invalidates on change; no React rerenders, no new render loop or R3F canvas.
- The rig needs no real dt from the canvas: while a blend is in flight it measures wall-clock gaps like the actor clock does, so blends finish on the on-demand canvas.
- Default: cinematic shot is `null`; exploration behaves as before, still through the rig.

## Follow-up: real shot cameras

1. Register the doc's named shots as their own virtual cameras (ride 15, scan 20, encounter 30, battle 40) with Klipp bodies/aims — `FollowBodyThree`/`OrbitFollowBodyThree`/`HardLockToTargetBodyThree`, `HardLookAtAimThree`/`RotateWithFollowTargetAimThree`/`PanTiltAimThree`, `GroupFramingExtensionThree` + `TargetGroup` for compositions, `BasicMultiChannelPerlinNoiseThree` for texture. Targets bind as `Object3D`s through `klipp.targets`, read once per frame, never from React state.
2. Collision/occlusion safety (Klipp does not do it): keep the existing near-wall clamp as a `CameraPiece` after the body.
3. `klipp.whileOnScreen(cam, start)` for look-around/manual input precedence while a camera is live; `mode = 'standby'` freezes writes on tab blur.
4. Mirror shot state through the render-snapshot channel before enabling shots in `renderThread="worklet"` mode: the rig itself is worklet-safe (Klipp core and `/three` import no React or react-native), but `params.cinematicShot` is JS-thread only today.
5. Set test scenarios at Apollo Theater: walking/chasing, scan target near wall, wild Mon encounter, turn-based battle, mounted Mon, resume after cancel, rotated Surface Duo, foldable hinge (the `viewOffset` field is the hinge-friendly framing seam), XR.
6. Add camera frustum/collision tests, snapshot continuity and compositor frame timing. No camera shake at rest; accessible reduced motion (already wired: blends become cuts).

## Reviewer roster and skills

- Distinguished gameplay camera engineer — Klipp v0.14 lifecycle, shot priorities, blend interruption, returning control.
- Three.js/WebGPU engineer — one renderer, lens update without projection churn.
- React Native/foldable engineer — gesture ownership, hinge safety, reduced motion; Rive remains controller UI.
- Tech artist/cinematographer — anime-monster RPG shot language, distinctive NYC-Mon composition rather than copying Digimon.
- QA — 2D web/canvas parity, native worklet snapshot, crash/reconnect and baseline frame time.
- Use Game Visual Debugging, React Best Practices, and game performance skill. No external subagent execution has been reported.

**This phase does not claim an animated follow rig has run on hardware.** Draft, no merge/deploy.
