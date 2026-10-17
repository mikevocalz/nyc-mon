# NYC-Mon / Surface Duo frame-budget acceptance

Branch: `perf/nycmon-duo-frame-probe-20261016`, stacked on draft #46.
Baseline evidence in `docs/implementation/worklet-rendering.md`: roughly 15 FPS on Surface Duo, JS render submission p50 9 ms / p90 14 ms; reported Android UI thread 38–44 ms, including idle Rive activity. **These are not results from this PR.**

## Implemented in this increment

- JS-only `ThreeCanvas.onFrameTiming` probe, opt-in with `EXPO_PUBLIC_GAME_PERF=1`; 120-draw bounded windows and p50/p90 CPU submission timings.
- Samples update + `renderer.render()` + native `present()` return. No GPU fence, Choreographer timestamp, frame-presentation time or UI thread measurement. Do **not** infer an actual FPS improvement.
- On-demand frame gaps over 250 ms are excluded from active timing. No user account IDs, lat/lon, interactions or remote telemetry. Defaults off, including production.
- Worklet mode retains its existing runtime breadcrumbs. The callback runs only on the JS path; cross-runtime frame reporting and device validation are separate prerequisites.

## Device matrix (not yet run)

Record a sealed baseline and candidate with the same device, brightness, thermal state, app binary, route, power policy and 90-second duration. Clear Metro cache whenever toggling Bundle Mode.

| Device / mode | Path | 90-second warm-up + walk | JS submit p50/p90 | UI frame p50/p90 | Present FPS | Crash/blank |
|---|---|---|---|---|---|---|
| Surface Duo, default JS | Apollo to 125th St and back | pending | pending | pending | pending | pending |
| Surface Duo, `EXPO_PUBLIC_WORKLET_RENDER=1` | Same path | pending | n/a for this JS probe | pending | pending | pending |
| Contemporary Android, JS | Same path | pending | pending | pending | pending | pending |
| iPhone, native WebGPU | Same path | pending | pending | pending | pending | pending |
| Web WebGPU/WebGL2 fallback | Equivalent static test scene, not native Game | pending | pending | n/a | pending | pending |

Run with `EXPO_PUBLIC_GAME_PERF=1` on a **non-production dev client**, then watch `[NYC-Mon/perf] JS render submission` logs. For Android UI/compositor frames, capture `adb shell dumpsys gfxinfo <application-id> framestats` and Perfetto/Android Studio traces; do not substitute JS rAF intervals. To compare a threaded run, capture the separate worklet rendering trace; this hook does not run on that thread.

## Blocking goals before richer effects

1. Diagnose Rive animations and UI compositor cost separately; retain functional controller touch and focus on foldables.
2. Verify the existing worklet Bundle Mode prototype on Duo. The repo documents Metro, Uniwind and lazy-import hazards, so fallback must always remain.
3. Build a device performance baseline including frame pacing, P95 or P90 and memory/thermal trends; no invented measurements.
4. Preserve world-save coordinates, hinge-safe HUD, OSM attribution, WebGPU backend and WebGL2-on-web fallback.
5. Refuse bloom/DOF/SSR in the main driving loop until the baseline/candidate is comparable and within device budget.
6. Game visual-debugging/performance skill: a sealed GPU/physical-device run requires separately authorized device access and adapter confirmation. The `game-dev` CLI/device is not available in this ChatGPT environment.

## Skills and review roster

- Native performance lead — CPU vs UI vs GPU attribution, Surface Duo/Android Perfetto, rendering runtimes, thread handoff.
- Three.js/WebGPU lead — renderer timing caveats, device loss/fallback, no GPU submission mistaken for GPU duration.
- React Native/Rive lead — animation pause, gesture responsiveness, worklet cross-runtime safety, foldable layout.
- QA/SRE — route parity, repeatable traces, telemetry privacy, rollback and first-frame smoke.
- Apply Game Performance Optimization, Game Visual Debugging, React Native/foldable adaptive-layout conventions and Vercel React Best Practices as relevant.

**No hardware FPS claim and no merge permission are granted by this PR.**
