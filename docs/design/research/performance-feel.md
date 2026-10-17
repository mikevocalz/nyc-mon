# Performance pass: what lag feels like

Owner: `user-researcher`. Written for the performance pass (docs-only): no hitches, a steady frame rate, more than 60 fps wherever the display allows it (`docs/plans/performance-pass-prompt.md`). Inputs: the spec's measured-facts table, `docs/implementation/worklet-rendering.md` (the Duo numbers), `docs/performance/ui-thread-investigation-2026-10-16.md` (on branch `lane-c-ui-thread`, not yet on main — the Rive inventory, the settled-draw patch and the framestats protocol), `packages/app/features/game/perf/render-scale.ts` and `perf/tier.ts` (the governor and bundles). Companion outputs: `../handoff/performance-tiers.md`, `../review/performance-a11y.md`, `../graphics-settings-surface.md`, the Graphics and Battery sections of `docs/COPY_DECK.md`.

Roster bars for this file: Rauno Freiberg (controls and HUD that feel instant), Emil Kowalski (motion that survives a lower frame rate), Romain Guy and Chet Haase (frame pacing). Design-critique is deferred to post-capture — see the tail.

## The measured facts

All numbers are from `worklet-rendering.md` and the spec, recorded 2026-10-16 on the Surface Duo unless noted.

| Fact | Source |
|---|---|
| ~15 fps walking on the Duo | `worklet-rendering.md` |
| JS render submission p50 9 ms, p90 14 ms | `worklet-rendering.md` |
| Android UI thread p50 44 ms idle with four autoplay Rive views; 38 ms walking with Rive paused | `worklet-rendering.md` |
| The UI thread caps the screen near 25 fps whatever thread three.js uses | `worklet-rendering.md` |
| Cutting triangles 4× and pixel ratio 2→1 barely moved fps — the GPU is not the limit | `worklet-rendering.md` |
| `requestAnimationFrame` on a worker runtime is a 16 ms `setTimeout` poll, not vsync | `worklet-rendering.md`, react-native-worklets 0.13.0 |
| Four `RiveView` instances over three `.riv` files, all inside `ArcadeController` | `ui-thread-investigation-2026-10-16.md` |
| Quiet-park (`RIVE_QUIET_MS` 600 ms) and the settled-draw skip patch are already on main; the 38–44 ms figures were recorded the same day and never re-measured | `ui-thread-investigation-2026-10-16.md` |
| Duo 1 budget 16.7 ms; Duo 2 (90 Hz) 11.1 ms; ProMotion (up to 120 Hz) 8.3 ms | spec § What the display allows |

One honesty caveat the spec itself carries: the lane-c investigation records that the settled-draw patch and quiet-park landed the day the 38–44 ms numbers were taken, and the binary was never re-measured. Whether the UI thread still holds that cost is M0's first question. This doc describes what the numbers *mean* to a player, not what the current build does — that is what the re-measurement is for.

## What reads as lag to a player

Three separate complaints get called "lag". They have different causes, different fixes, and a player can name the difference within one walk.

### 1. Input delay — "the buttons are spongy"

The cap sinks, the stick pad follows, the pill legend flips — each a frame or two behind the finger. G01's accessibility bar already names the design tolerance: **press-to-sink under one frame at the display's rate** (`screens/G01-arcade-controller/07-a11y.md`). The frame rate decides what that costs in milliseconds: under one frame at 60 Hz is 16.7 ms; at today's ~15 fps a "one frame" press delay is ~66 ms, and a two-frame visual lag is ~133 ms. G01's critique is blunt about what that does: "a 2-frame lag on the press sink turns the machine into a drawing" (`06-critique.md`).

The press feedback contract is what makes the budget honest: the cap sink fires on the gesture thread before the input round trip (`G01-arcade-controller/08-handoff.md` § Interaction contract). The player judges responsiveness by the *sink*, not by whether the game acted on it — so feedback must be painted by the frame after touch-down, not by the frame after the router call resolves.

### 2. Hitches — "it stutters"

A single frame over budget that stands out from the frames around it. This is the sharper sin on the Duo because the cadence is already uneven: the UI thread at p50 38–44 ms means the compositor's rhythm is broken, and any extra spike (a Rive view waking, a Fabric commit, a pipeline compile) lands as a visible lurch.

Two repo-specific rules:

- **A parked frame is not a hitch.** The canvas draws on demand and parks when nothing moves (`render-scale.ts` `activeIntervalMaxMs` 250 ms is the parked-gap cutoff; the worklet design parks after 2 quiet ticks). The player standing still must see a *settled* frame, not a frozen broken one — the distinction is whether the first moving frame after a park arrives without a lurch.
- **Nothing may compile during play** (spec law). A shader compile mid-walk is a hitch with a known cause; every variant compiles in the loader (PR 3).

### 3. Low frame rate — "it feels like a slideshow"

The baseline: ~15 fps walking today, against a 16.7 ms budget on the Duo 1 — the screen can't even show the 25 fps the UI thread allows. The Kowalski bar applies: motion that survives a lower frame rate is discrete, short-travel and never relies on smooth interpolation. In practice for NYC-Mon that means: state changes (cap pressed, pill legend, lit windows) must read as *steps*, so a dropped frame between them is invisible; only the camera and the stick pad move continuously, and those are the two things the player forgives least when they stutter.

The tier structure exists so "low frame rate" is a setting, not an accident: the governor steps the render scale down (`render-scale.ts`: ×0.9 below the band, ×1.05 above, every 1.5 s, floor 0.5 provisional) to hold the band the tier asks for — the phone bundle's 27–38 fps band today, the pass's 60 fps goal once the threads are freed.

## Scenarios to measure

The scenarios below are the investigation doc's protocol cast as feel tests, plus the spec's acceptance runs. Every scenario names what the player would feel so the numbers answer the right question.

| # | Scenario | What it exercises | What the player feels if it fails |
|---|---|---|---|
| S1 | Idle 30 s after the reveal | Quiet-park, settled-draw skip, parked canvas | The settled frame must not flicker, re-render or pop; battery burn with nothing moving |
| S2 | Walking 30 s, stick held forward along 125th Street | Continuous view-model writes keeping two Rive views awake, camera invalidates, render loop at full rate | Stutter, spongy stick, smeared pans |
| S3 | The spec's 90-second scripted walk from the Apollo east along 125th | The pass/fail route: UI, RenderThread, JS, render runtime, GPU timings separately (PR 0) | The full feel test, § below |
| S4 | Cold start: launch → Game tab → lobby → START → first frame | Scene build, `compileAsync`, the reveal transition | A dead pause or hitch on START reads as broken, not slow |
| S5 | Gamepad source: `hardwareInputStore.setActiveSource('gamepad')` | All four Rive views unmounted — the Rive-free baseline | How much of the felt lag is the controller at all |
| S6 | 20-minute soak | Thermal step-down, render-scale log, heap | The feel test is endurance: the 15th minute must feel like the 1st |
| S7 | Press-to-sink at the display's rate | Controller feedback latency | The "spongy" complaint, measured as distributions at 60 and 120 Hz |

Method per the investigation doc: `dumpsys gfxinfo framestats` parsed for `SyncQueued − HandleInputStart` and `FrameCompleted − IntendedVsync`; Perfetto on segment S2/S3 to attribute residual cost to Rive vs compositing; p50/p90/p95/p99 distributions, never single numbers.

## The pass/fail feel test

The spec's done-when criteria, translated into what a player would report:

1. **Steady 60, no spikes.** A first-gen Duo holds 60 fps through S3 with no frame over 16.7 ms after loading. Player-facing: the walk has a rhythm and nothing breaks it. (Steady before fast — the spec forbids requesting a rate you can't hold.)
2. **Higher where the display allows.** On a 90 Hz Duo 2 or 120 Hz iPhone, the walk holds the requested rate — 11.1 ms or 8.3 ms per frame. Player-facing: the pan is liquid, and it stays liquid for the whole walk, not just the first block.
3. **The controller feels painted on.** Press-to-sink under one frame at the display's rate (S7). Freiberg's bar: the machine answers the finger, every time.
4. **Wake without a lurch.** The first moving frame after a park (S1→S2 transition, resume from pause) arrives inside the frame budget — the player cannot tell the canvas ever stopped.
5. **The soak doesn't degrade.** S6 holds its tier with no more than one thermal step-down (PR 5's bar); the 15th minute feels like the 1st.
6. **Release builds only.** Every verdict above is from a release build on the device; dev-client and simulator numbers are labelled as such and never count (spec law, and `DEVICE_CHECKS.md`'s rule).

## Deferred: design-critique (step 7 of the sequence)

**Blocked, not skipped.** The design-critique — each tier's captures side by side, controls and world — waits on M0's device captures: the PR 0 baseline (`framestats`, Perfetto, GPU timestamps) and the per-tier screenshots it must produce first. There is nothing honest to critique until those exist; a critique written now would be commentary on drawings, not on the game.

When the captures land, the critique covers: each `TIER` bundle's world at the same camera anchors the realism pass uses (`research/realism.md` § Acceptance test), the controller's idle/active/paused states under both render paths, and the render-scale floor at 0.5 — with the Vignelli legibility check from `../review/performance-a11y.md`. Recorded here so the sequence shows its own gap rather than pretending it closed.
