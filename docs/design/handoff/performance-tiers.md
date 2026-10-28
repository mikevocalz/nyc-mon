# Performance pass: frame budgets and quality tiers — handoff

The design contract for the performance pass's budgets and tiers. Every constant below is cited, not redefined — the values live in `packages/app/features/game/perf/tier.ts`, `perf/render-scale.ts` and `world/look.ts`; this doc says what they mean visually and what the controller's states must look like under them. Inputs: `../research/performance-feel.md`, `../review/performance-a11y.md`, `docs/plans/performance-pass-prompt.md`, `docs/implementation/worklet-rendering.md`, `docs/performance/ui-thread-investigation-2026-10-16.md` (merged as a superseded record; current numbers in `docs/performance/baseline-duo-2026-10-17.md`), `docs/COPY_DECK.md` § Graphics quality. Laws: `CONTRIBUTING.md`; the spec's "no literals in code" rule — design names constants, code owns them.

Roster bars: Rauno Freiberg (controls that feel instant), Massimo Vignelli (legibility at the low render scale), Emil Kowalski (motion that survives the frame rate), Pentagram (tiers that keep the identity intact).

## Frame budgets

The display ceilings the spec fixes (§ What the display allows). These are walls, not targets: a tier must hold its band *inside* the budget with headroom (PR 3 done-when).

| Display | Frame budget | Design meaning |
|---|---|---|
| Surface Duo 1, 60 Hz | 16.7 ms | The pass's headline device. 60 is the ceiling; the whole feel test is judged here first. |
| Surface Duo 2, 90 Hz | 11.1 ms | Needs the frame-rate request (PR 4 `setFrameRate`) and a vsync-paced loop — the 16 ms `setTimeout` rAF poll on a worker runtime cannot pace it. |
| ProMotion iPhones, up to 120 Hz | 8.3 ms | Needs `CADisableMinimumFrameDurationOnPhone` in `app.config.ts` (PR 4); the system still picks the rate. |

Steady before fast (spec law): hold 60 with no frame over 16.7 ms before requesting more, and request only rates the build can hold — a requested 90 that swings to 60 reads worse than a held 60.

## The named constants

Where each budget and tier knob lives today. Values marked PROVISIONAL or `TODO(device)` are exactly that in the source files — this contract does not firm them up; M0's measurements do.

| Constant | Where | Value | Status |
|---|---|---|---|
| `EXPO_PUBLIC_WORLD_TIER` | `perf/tier.ts` | `phone` (default) \| `high` | shipped |
| `WORLD_TIER`, `WORLD_TIER_SELECTED` | `perf/tier.ts` | selector + "was the flag actually set" gate | shipped |
| `TIER.phone.envWidth` | `perf/tier.ts` | `SKY_RIG.envWidth` = 1024 equirect → 256 px PMREM cube | measured (Flying Roadster) |
| `TIER.phone.glassTier` | `perf/tier.ts` | `'flat'` — the cheap interior path | shipped |
| `TIER.phone.post` | `perf/tier.ts` | `bloom: false, ao: false, aa: true` (FXAA), `tier: 'phone'` | shipped |
| `TIER.phone.scale.band` | `perf/tier.ts` | 27–38 fps | Flying Roadster measured |
| `TIER.high.envWidth` | `perf/tier.ts` | `envWidth` × 2 = 2048 → 512 px PMREM | measured |
| `TIER.high.glassTier` | `perf/tier.ts` | `'full'` — the room boxes | shipped |
| `TIER.high.post` | `perf/tier.ts` | `bloom: true, ao: true, aa: true`, `tier: 'high'` | shipped; AO exists only when the effective post tier is `'high'` |
| `TIER.high.scale.band` | `perf/tier.ts` | 45–60 fps | **PROVISIONAL — `TODO(device)`**, no measured values |
| `RENDER_SCALE_FLOOR` | `perf/render-scale.ts` | 0.5 | **PROVISIONAL — the spec's floor item pending Mike's sign-off** |
| `RENDER_SCALE.intervalMs` | `perf/render-scale.ts` | 1500 ms between evaluations | Flying Roadster measured |
| `RENDER_SCALE.downFactor` / `upFactor` | `perf/render-scale.ts` | ×0.9 below band / ×1.05 above | measured; the asymmetry biases settling downward on purpose |
| `RENDER_SCALE.ceiling` | `perf/render-scale.ts` | 1 — the controller only ever lowers fill cost | shipped |
| `RENDER_SCALE.activeIntervalMaxMs` | `perf/render-scale.ts` | 250 ms — longer gaps are parked, not slow frames | the frame probe's convention |
| `RENDER_SCALE.minWindowFrames` | `perf/render-scale.ts` | 3 active intervals to decide a window | shipped |
| `RENDER_SCALE.reversalWindows` | `perf/render-scale.ts` | 2 windows a direction reversal must persist | the hysteresis — no down-up pumping inside a window |
| `RENDER_SCALE.decisionCap` | `perf/render-scale.ts` | 120 decisions logged (~3 min at cadence) | shipped |
| `RESOLUTION.dropStep` / `riseStep` / `adjustWindowMs` / `floor` | `world/look.ts` | 0.1 / 0.05 / 1500 / 0.5 | the same Flying Roadster schedule, named in the look file |
| `RESOLUTION.phoneFpsTargetMin` / `Max` | `world/look.ts` | 27 / 38 | measured |
| `RESOLUTION.envSizePhone` / `envSizeHigh` | `world/look.ts` | 256 / 512 px | measured |
| `AO.samplesHigh` | `world/look.ts` | 12 | Flying Roadster measured |
| `BLOOM.strength` | `world/look.ts` | 0.045 | measured; lands when a post path runs on react-native-webgpu (realism B1) |
| `EXPO_PUBLIC_WORLD_RENDER_SCALE` → `EXPERIMENTAL_WORLD_RENDER_SCALE` | `perf/render-scale.ts` | opt-in flag, default OFF | flags-and-fallbacks law: the default build is byte-identical with it off |

What the governor measures, honestly (`render-scale.ts` header): the interval between scene `update()` calls — frame-*production* pacing on whichever thread the canvas runs. It is not the GPU's frame time and not the Android UI thread; a UI-bound frame reads as a long interval and pushes the scale down without the cause being GPU load. The bands must never be tuned against the UI-thread ceiling.

How scale applies: `renderer.setPixelRatio(deviceRatio × scale)` on the WebGPU renderer — the world canvas's drawing buffer shrinks and the view upscales on present. **Render scale does not touch the native view tree**: HUD text, the Rive controller and the settings surfaces stay at device resolution. Only in-world detail resolves softer.

## What changes visually per tier

The code knows two bundles (`phone`, `high`); the copy deck names three player-facing tiers (Auto, Performance, Quality — `docs/COPY_DECK.md` § Graphics quality). The mapping is the realism handoff's contract (`handoff/realism.md` § Frame governor and tiers): **Auto** runs the governor over the phone bundle; **Performance** pins the floor-side scale plus the small env map and reduced AO; **Quality** holds full scale, the 512 px env map and `AO.samplesHigh` 12 — i.e. the `high` bundle. The third user-facing option maps onto a code bundle that exists; no third bundle is implied.

| Visual element | `phone` (Auto / Performance) | `high` (Quality) |
|---|---|---|
| Environment map | 256 px PMREM (equirect 1024) | 512 px PMREM (equirect 2048) — glass and car paint get the deeper reflections |
| Glass interiors | `flat` — lit-window glow, no rooms | `full` — room boxes behind the panes (the realism pass's ROOM spec) |
| Ambient occlusion | off | on, 12 samples (`AO.samplesHigh`) — contact grounding under eaves, stoops, street furniture |
| Bloom | off | on at `BLOOM.strength` 0.045 — halos lit windows, neon, lamp heads only |
| Anti-aliasing | FXAA | FXAA |
| Render scale | governor free inside the band, floor `RENDER_SCALE_FLOOR` 0.5 | governor free inside the 45–60 provisional band, same floor |

What must *not* change between tiers (the Pentagram/Bierut bar — the identity survives the tier): the palette (`CITY_COLORS` is tier-blind), sky looks (`SKY_BY_TIME`), signage hierarchy and storefront bands, cap/pill/stick glyphs, HUD surfaces. A `phone`-tier frame must read as the same city with cheaper materials, never as a different city. The lit-window seeds stay identical — a lit window stays lit on every tier (also the 2.3.1 rule in `../review/performance-a11y.md`).

Individual env flags still force-on over a bundle (`perf/tier.ts` header: e.g. `EXPO_PUBLIC_WORLD_POST_BLOOM=1` under `phone`; there is no force-off flag), and the lane master flags (`_SKY_RIG`, `_PBR`, `_GLASS`, `_POST`) stay the gates — a tier tunes what exists; it never enables a lane.

## The controller's three states

The controller is native overlay views (Rive today), not world geometry — so the tier table above does not restyle it. What the pass changes is *when its views draw*. The three states the design must keep honest, from `ui-thread-investigation-2026-10-16.md` and `G01-arcade-controller/08-handoff.md`:

| State | What happens | The design rule |
|---|---|---|
| **Idle** | 600 ms after the last value-changing view-model write, `RIVE_QUIET_MS` quiet-park calls `pause()` on each `ArcadeRiveSurface`; the native settled-draw patch (`patches/@rive-app__react-native@0.5.5.patch`) skips `advanceStateMachine` + `worker.draw()` when paused or settled. The render canvas parks after 2 quiet ticks (worklet design; the JS path is on-demand the same way). | The settled frame is the resting face — pad centred, caps graphite, pill lit for its legend. Parked must look *identical* to drawn; a parked view that dims, snaps or re-renders on settle is a defect. |
| **Active** | While a stick is held, continuous view-model writes keep its two views (housing, thumbpad) awake — correct, they are being touched. Cap press feedback paints on the gesture thread before the router round trip. | Press-to-sink under one frame at the display's rate (`../research/performance-feel.md` S7). Waking a parked view must not replay an intro burst — the view resumes from its settled frame, not from frame zero (also the 2.3.1 check). |
| **Paused** | Session `paused`: pill shows RESUME, `scrim-scene` over the world; the world canvas stops drawing (on-demand parked, not burning frames behind the scrim); quiet-park covers the controller views. A backgrounded app gets no vsync, so nothing draws regardless. | Paused is a *still*, not a renderer's resting state: nothing animates behind the scrim, and resume repaints without a flash. Reduced-motion builds park the same way — reduced motion changes the art's motion map (`G01-arcade-controller/07-a11y.md`), not the parking. |

If any controller part moves from Rive to Skia (the investigation's ranked action 4 — the thumbpad, whose motion is already Reanimated, is the named candidate): the hit regions, sizes and the idle/pressed/held/released/disabled/cooldown visual vocabulary are contract-stable (`G01-arcade-controller/08-handoff.md` § States). The renderer is an implementation detail; the state table is not. Touch targets are layout, not art — `../review/performance-a11y.md` rows 1–2.

## Legibility at the floor

Vignelli's check for the 0.5 floor: render scale softens the *world*, never the UI — cap letters, the pill legend and HUD text are native views at device resolution and stay sharp at every scale. What softens is in-world type: street blades (`signGreen`/`signText`), fascia lettering, the Apollo marquee. The design rule: **nothing the player is required to read may live only in the world** — a street blade that must be legible at 0.5 scale is authored large enough to read there, or its information is duplicated in the HUD (the realism pass's signage hierarchy already ranks blades as small, ambient content). Verify on the M0 captures at the floor before `RENDER_SCALE_FLOOR` is signed off — it is PROVISIONAL for exactly this reason.

## Device verification (open — no device yet)

From `docs/DEVICE_CHECKS.md` plus this pass; release builds only.

- [ ] The 90-second walk at 60 on the Duo 1 with the `decisions` log attached — no `down` verdict caused by a UI-thread stall (the governor's honest-measurement caveat above).
- [ ] `HardwareBufferView` A/B on `surface.native.tsx` if walking frames stay slow with Rive proven parked — the only candidate that moves compositing cost while keeping the reveal fade (investigation § Corrections).
- [ ] Per-tier captures at the same anchors as `../research/realism.md`: `phone` at floor scale for the legibility check; `high` for the AO/bloom check once a post path exists.
- [ ] Idle → active → paused → active transitions captured: no pop on wake, no flash on resume, parked face identical to drawn face.
- [ ] Duo 2 at the requested 90 Hz and a ProMotion device at its picked rate — the pass's "higher where allowed" gate.
