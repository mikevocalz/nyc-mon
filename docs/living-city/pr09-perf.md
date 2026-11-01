# PR09 — Mobile GPU performance + adaptive quality, Surface Duo, 2026-10-17

Living City PR stack row 09 (`docs/plans/living-city-prompt.md` §13):
baseline/after traces for the PR02–07 vertical slice (vehicles,
pedestrians, signals, lamps, clock) on the physical bench Surface Duo,
actor/LOD tiers wired through the existing perf tier system, adaptive
render-scale verification, and fold/background safety. Lane
`lane-lc-perf`. Every device number below came from one release build on
the physical Duo (adb serial `913949703467`, Android 14 GSI, SDK 34,
2700×1800 @ 60.000004 Hz — device record in `docs/DEVICE_CHECKS.md`).
Method mirrors M0 (`docs/performance/baseline-duo-2026-10-17.md`) and F1
(`docs/performance/v3-f1-2026-10-17.md`); nothing here is from a dev
client, simulator or estimate.

## Scope landed

- **Actor/LOD caps** (`perf/tier.ts`, `LIVING_CITY_CAPS`): four rungs —
  `low` / `medium` / `high` / `xr`. Resolution order: explicit
  `EXPO_PUBLIC_LIVING_CITY_TIER` > the selected world tier's bundle row
  (`phone` → `medium`, `high` → `high`) > `'high'`. With nothing set the
  answer is `high`, which is byte-identical to the authored PR05–07
  counts — the default build is zero-diff.
- **`xr` honesty note**: the rung reserves the spec's headset-class name
  but carries the authored ceiling (identical to `high`). There is no
  measured headset budget to raise counts into; inflating numbers without
  a device would be dishonest. A future XR measurement raises only that
  row.
- **Runtime population caps** (`vehicle-sim.ts`, `ped-sim.ts`,
  `sim-host.ts`): `setTargetVehicles` / `setTargetPeds` retarget the
  *ambient* population live. Scripted slice spawns (the two-car + six-ped
  ACP scenario) never carry the `ambient` mark and are never culled.
  Excess ambient actors are marked `retiring` and despawned only past the
  anti-pop distance — the crowd thins off-camera rather than popping.
- **Adaptive crowd step-down** (`bundled-host.ts`, `city-scene.ts`):
  `livingCityAdaptiveFrame` is fed the render-scale controller's current
  scale each frame (flag-gated on both `EXPO_PUBLIC_LIVING_CITY` and the
  render-scale lane). First step below scale 0.75 → one tier down; each
  further step needs another ×0.75 of surrendered scale; `low` is the
  floor. **One-way by design** — a recovered scale does not re-fill the
  crowd mid-session (a refill burst is exactly the hitch the step-down
  avoids). Fires `[NYC-Mon/perf] living-city crowd tier` on a step.
- **Mount-time caps**: `signalHeadCap`/`pedBoxCap` (signal-viz near-field
  instance caps) and `lampGlow` (the cosmetic lamp actor) are baked at
  scene build on both render paths — `livingCityActorFactories()` (JS)
  and `game-render.ts` (worklet) consume the same `livingCityCaps()`
  row. Runtime tier moves adjust populations only; documented honestly.

### Caps table

| Rung | vehicles (total cap) | peds (total cap) | lamp glow | signal head cap | ped box cap |
| --- | --- | --- | --- | --- | --- |
| `low` | 4 | 4 | off | 160 | 160 |
| `medium` | 8 | 8 | on | 224 | 224 |
| `high` (= authored PR05–07) | 12 | 16 | on | 320 | 320 |
| `xr` (reserved) | 12 | 16 | on | 320 | 320 |

Targets are **total** caps including scripted spawns — `high` = the
pre-PR09 `LIVING_CITY_AMBIENT`/`_PED_AMBIENT` values exactly (pinned by
`tier-caps.test.ts`).

## Build under test

- `apps/mobile` release APK `app-mobile-release.apk`, **138,117,945 B**
  (v3 F1: 137,978,841 → +139,104).
- Hermes bundle `index.android.bundle`, **15,847,040 B** (v3 F1:
  15,707,936 → +139,104 — identical delta to the APK, consistent with the
  bundle riding uncompressed inside it; growth is the PR02–09 lanes).
  Bundle grep confirmed `living-city:signals`, `living-city:lamps`,
  `living-city:vehicles`, `[NYC-Mon/perf]`, `living-city crowd tier`,
  `harlem-apollo-20261017`.
- Build recipe: `npx expo prebuild --platform android` then
  `./gradlew :app:assembleMobileRelease`. First Gradle attempt failed at
  `:react-native-webgpu:buildCMakeRelWithDebInfo` ("Could not read
  standard output" from Gradle's ninja capture); running ninja directly
  in the generated `.cxx` dir completed the native link
  (`libreact-native-webgpu.so`), and the Gradle retry then passed —
  **BUILD SUCCESSFUL in 6 m 21 s**, 1,419 tasks.
- `apps/mobile/.env` (gitignored): `EXPO_PUBLIC_GAME_PERF=1`,
  `EXPO_PUBLIC_LIVING_CITY=1`. Both inlined at bundle time: the perf
  probe emitted on device and the actor mounts below could only have
  come from the flag-on build.
- Flags **off** behaviour: `livingCityActorFactories()` → `[]`,
  `livingCityHost()` → `null`, render-scale/crowd hooks dead-called.
  Node tests cover the gate.

## Run under test

Release onboarding is still broken on release Hermes (M0/F1 caveat —
`crypto.randomUUID`); bypassed via `nycmon://game` as before. Lobby →
"Start a new game" → city loaded (accessibility: "3D map of Harlem,
around the Apollo Theater"). Scripted drive mirroring M0/F1:

- `dumpsys gfxinfo com.nycmon.app reset` at 22:42:07 (post scene-build
  settle), drive 22:42:20–22:43:46 (**~86 s**): stick deflected ~35 s
  north then ~50 s east from the Apollo-area spawn toward 125th/ACP —
  `argent gesture-custom`, 89 events (Down + deflect + 1 s Move keeps +
  Up), same pattern as M0/F1.
- Dumped `gfxinfo` + `gfxinfo framestats` at ~22:43:50. Window ≈ 13 s
  scene-idle + 86 s drive + ~5 s tail. 3,713 frames total.

## Results

| Metric | PR09 (this lane) | v3 F1 | M0 v2 | Method |
| --- | --- | --- | --- | --- |
| APK / Hermes bundle | 138,117,945 B / 15,847,040 B | 137,978,841 / 15,707,936 | 140,402,822 / 15,480,356 | build outputs |
| Frame time | **p50 15 ms, p90 30, p95 34, p99 40** (n = 3,713) | p50 36, p90 48, p95 53, p99 61 (n = 3,457) | p50 36, p90 53, p95 57, p99 65 (n = 4,927) | `dumpsys gfxinfo` |
| Janky / deadline missed | **33.34 %** (1,238 / 3,713); legacy 9.0 % | 44.32 % (1,532 / 3,457) | 33.7 % (1,659 / 4,927) | same dump |
| Missed vsync / slow UI | 2 / 1 | — | — | same dump |
| JS render submission (probe) | cpuP50 per-window **~10.3–11.5 ms** across drive windows; renderP50 ~8.8–9.6; presentP50 0.2 | cpuP50 median 17.34 (13.1–20.2) | p50 ≈ 18, p90 ≈ 20–21 | `EXPO_PUBLIC_GAME_PERF=1`, 90 windows 22:42:05–22:46:54 |
| Draw calls / triangles | **drawCallsP50 53–54, trianglesP50 319,366–335,336** during drive | drawCalls 40–41, tris ≈310k, max 320,044 | 26 host-counted; 283,553–286,281 tris | probe `stages` (`renderer.info`) |
| Render buffer | **2160×1440** the entire run (= 0.80 × 2700×1800) | 2160×1440 | — | probe `bufferW/H` |
| Memory (PSS) | scene start **735,846 kB** → post-drive **916,798 kB** | 630,389 → 650,548 | 601,928 → 648,658 | `dumpsys meminfo` |
| Crashes / ANRs | none; same benign `Destroyed texture [Surface]` class as v3 | none fatal | none fatal | logcat |

## Reading — honest deltas

- **Headline frame numbers are better than both baselines — but do not
  read this as a performance win.** The gfxinfo window mixed ~13 s of
  post-load idle frames into an 86 s drive, and the drive viewed
  different content than M0/F1's routes. Both baselines' histograms were
  explicitly bimodal; this window's mode sits lower. The honest claim is
  narrower: **the living-city slice did not make the Duo worse — p50
  stayed at/below the 36 ms baseline with actors live** (draw calls
  +12–13 over v3 ≈ the dynamic-actor layer set; triangles +10–15 k ≈
  PR07's ~15 k typical near-field estimate).
- **JS submission ≈ 10.4 ms cpuP50 during the drive** — below v3's 17.3
  median. Both are submission cost, not GPU completion; the gfxinfo GPU
  histogram still shows the capped 4,950 ms tail bucket (timestamp
  queries not enabled — same caveat as M0/F1, still PENDING).
- **Memory grew +181 MB scene-start → post-drive** (735,846 → 916,798
  kB) vs v3's +20 MB over its walk. Scene start also sits +105 MB above
  v3's. Part is the living-city stack (topology, signals, sims, instanced
  buffers) plus longer session residency, but the slope is steep —
  **watch item**, not explained away. No OOM/pressure kill occurred.
- **Adaptive render scale engaged and held at 0.80** (2160×1440 buffer)
  for the whole captured session — the controller had already stepped
  down during scene build and never climbed or fell further.
- **Adaptive crowd step-down armed but never fired**: scale held 0.80 ≥
  the 0.75 mark, so the expected zero `living-city crowd tier` log lines
  is correct evidence of *arming*, not of a step. Step mechanics are
  pinned in `tier.test.ts` / `tier-caps.test.ts` (165 tests pass);
  forcing a device-visible step-down would need a heavier sustained load
  than this scene produces at 0.8 — honestly noted, not faked.

## Tier/adaptive verification on hardware

- Resolved tier this run: `high` (no selectors set) — authored counts
  ran: draw/tri deltas above match the full actor set, including the
  lamp layer (`lampGlow: true` — 4 factories, not 3).
- `EXPO_PUBLIC_LIVING_CITY_TIER=low|medium|high|xr` explicit override
  exists and is test-pinned; `phone` world tier maps to `medium`.
- Runtime population moves are graceful (ambient-only retirement past
  the anti-pop radius); mount caps are fixed per scene lifetime — both
  halves are documented in `bundled-host.ts`'s header.

## Fold / posture / lifecycle (Scenario D)

Method: `cmd device_state` posture overrides — the Duo exposes
`CLOSED(0)`, `HALF_OPENED(1)`, `OPENED(2)`, `FOLDED(3)` — plus a real
background/foreground cycle while the city ran.

- Cycled OPENED → HALF_OPENED → FOLDED → CLOSED → OPENED, ~4 s dwell
  each. Accessibility tree showed the live scene ("3D map of Harlem…",
  Pause pill, stick) at every posture; the controller pill re-laid out
  in HALF_OPENED (x 0.433 → 0.683). No `FATAL`, no ANR, same PID
  (10101) throughout — no restart, no remount.
- **Honest limitation**: `cmd device_state` overrides the *reported*
  posture; the logical display stayed 2700×1800 through every override
  on this Duo (the physical hinge was not moved — remote bench). The
  app-visible fold transition path (config change → remount →
  continuity) is exercised by the override; actual hinge travel remains
  **PENDING — requires physically folding the device**.
- Background/foreground: `KEYCODE_HOME` → process parked in LRU (sleep
  state, alive) → `[NYC-Mon/perf]` windows gapped 22:46:12 → 22:46:33
  (~21 s ≈ dwell) → relaunched via `nycmon://game` → perf cadence
  resumed at ~3 s on the same PID with no doubled emission → rendering
  paused cleanly in background, resumed without a duplicate ticker,
  sim/clock state continuous (same host above the canvas).
- `dumpsys window`/`SurfaceFlinger` evidence saved in
  `posture-evidence.txt`.

## Verified / not verified

- **Verified on device:** flag-on release build runs the living city
  (draw-call/triangle deltas, persisted session); 86 s scripted drive;
  gfxinfo/meminfo/perf-probe numbers above; adaptive scale at 0.80;
  posture override cycle; background/foreground resume without crash or
  duplicate ticker; zero-diff flag-off behaviour is node-test pinned.
- **PENDING — physical hinge fold**: `cmd device_state` overrides the
  reported posture but did not reconfigure display geometry on this
  unit; a real fold by hand is required to exercise the full path.
- **PENDING — GPU completion timing**: capped histogram tail persists;
  timestamp queries remain unenabled (inherited from M0/F1).
- **PENDING — forced crowd step-down on device**: scale never reached
  0.75; the path is test-covered but not observed live.
- **PENDING — memory growth attribution**: +181 MB over the session
  needs a heap breakdown to attribute (sims vs textures vs buffers).
- **Not claimed:** 30/60 fps "goal reached" language — vsync-paced
  numbers are reported raw.

## Artifacts (`/Users/mikevocalz/nyc-mon-artifacts/pr09-duo/`)

| File | Contents |
| --- | --- |
| `app-mobile-release.apk` | the tested binary, 138,117,945 B |
| `index.android.bundle` | extracted Hermes bundle, 15,847,040 B (markers grepped) |
| `logcat.txt` | ~944 KB — lobby, drive, posture cycle, bg/fg; 90 `[NYC-Mon/perf]` windows |
| `gfxinfo.txt` / `gfxinfo-framestats.txt` | drive-window histogram + PROFILEDATA |
| `meminfo-scene-start.txt` / `meminfo-end.txt` | PSS 735,846 → 916,798 kB |
| `lobby.png` / `city-loaded.png` / `drive-mid.png` / `drive-end.png` | lobby → city → mid-drive → end frames |
| `fold-half-opened.png` / `fold-folded.png` / `post-resume.png` | posture + resume evidence frames |
| `posture-evidence.txt` | `cmd device_state` states/cycle + `dumpsys window`/`SurfaceFlinger` excerpts |

Device: `Surface Duo`, `913949703467`, Android 14 SDK 34. Runs at
22:40–22:47 local bench-machine time.
