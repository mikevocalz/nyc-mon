# Performance pass: accessibility review

Owner: `a11y-auditor`. Standard: WCAG 2.2 AA (https://www.w3.org/TR/WCAG22/), with Alastair Campbell's bar for the flash and target-size rows and Val Head's for the reduced-motion rows (reference roster); Apple HIG and Android accessibility apply as in `review/realism-a11y.md`. Inputs: `../research/performance-feel.md`, `../handoff/performance-tiers.md`, `packages/app/features/game/perf/render-scale.ts` and `perf/tier.ts`, `docs/performance/ui-thread-investigation-2026-10-16.md` (branch `lane-c-ui-thread`, pending merge), `screens/G01-arcade-controller/07-a11y.md` and `08-handoff.md` (the controller contract). Stage: design. Nothing is built, so every row below is a requirement, not a test result.

**Verdict:** accessible by construction if four rules hold: a controller-renderer swap changes paint and never geometry; quiet-park is never mistaken for reduced motion; every luminance or resolve change stays inside the 3-per-second flash ceiling; and nothing the player must read lives only in the world below the render-scale floor.

## Touch targets when the controller art changes renderer

The investigation's ranked action 4 may draw the thumbpad (or other static art) in Skia instead of Rive. The accessibility rule is simple because the layout contract already exists: **hit regions, sizes and focus order are layout, not art.**

| Contract element | Requirement | Source |
|---|---|---|
| Cap targets | Ø56 dp caps, ≥ 44 dp at scale 0.8, ≥ 48 dp on Android at the 0.86 clamped floor | `G01-arcade-controller/07-a11y.md` finding 4, `08-handoff.md` § Accessibility contract |
| Pill | fixed 120 × 44 (144 × 48 Android), never scales | `G01-arcade-controller/08-handoff.md` |
| Hit regions | the three rects (stick, cluster, pill) — no input outside them | `G01-arcade-controller/08-handoff.md` § Interaction contract |
| Focus order | pill → stick → X Y Z A B C → world; names spoken, letters hidden | `G01-arcade-controller/07-a11y.md` |
| Stick adjustability | `adjustable` with compass value + camera actions as the non-drag path (SC 2.5.7) | same |

A Skia skin must satisfy every row identically — same rects, same `accessibilityLabel`/actions the Rive views expose today, same `state` vocabulary the wrapper owns. If a renderer can't carry the semantics the Rive runtime currently proves via `--semantics` runs, the wrapper keeps owning the accessibility tree (the G01 handoff's fallback position) — that is a known, tested path, not a regression to invent.

## Reduced motion when Rive pauses

Two separate mechanisms must never be conflated:

- **Quiet-park** (`RIVE_QUIET_MS` 600 ms → `pause()`, plus the native settled-draw skip) is a *performance* behavior — it stops work, not motion. It applies to every player.
- **Reduced motion** (`useReducedMotion` through the sim-core adapter) is an *accessibility* behavior — it changes which art runs: the G01 reduced-motion map (no sink, no spring, no enter/exit transitions), not just less of the same.

The design rules that follow:

1. Under reduced motion, a view waking from a park runs its **reduced-motion art** — parking must not bypass the motion map on resume.
2. A wake is a resume, never an entrance. If the Rive files contain an intro or "present" burst, reduced-motion + park cycles must not replay it — a parked-then-woken view resumes from its settled frame.
3. A Skia or static replacement art carries the same map: reduced-motion builds draw the static variant the G01 map specifies, not "fewer frames of the animated one."
4. Reduced motion never changes copy (`docs/COPY_DECK.md` rule) — the settings surface's reduced-motion `StatusRow` is the only change under the OS flag.

## Flash safety (SC 2.3.1)

Nothing the pass adds may flash more than three times in any one-second window. The specific risks, in order of likelihood:

- **Render-scale pumping.** A scale step changes resolve and perceived luminance; a down-up-down cycle inside a couple of seconds would read as flicker. The controller's design already forbids it: asymmetric ×0.9 down / ×1.05 up, one step per 1.5 s window, and `reversalWindows` 2 so a verdict must persist two windows to reverse (`render-scale.ts` § Hysteresis). The requirement that survives implementation: steps stay **discrete** — a sliding resolve pumps luminance continuously and would breach both the letter and the feel of 2.3.1.
- **Rive wake bursts.** A control that flashes an entrance on every wake — touched repeatedly, that's a per-touch flash. The wake-from-settled rule above is also the 2.3.1 rule.
- **Bloom threshold crossing on the `high` tier.** At `BLOOM.strength` 0.045, small bright sources can cross the threshold on and off as the camera moves — the realism pass's finding 2 stands unchanged: static seeds, distance fade to average, never pop (`review/realism-a11y.md` § Flash safety).
- **Lit-window LOD.** `glowFar` must not re-seed across LOD steps (same finding 3 — the skyline shimmers if it does).
- **Status rows and legends.** The thermal `StatusRow` and tier changes announce once, politely; a repeated step-down/up during a soak is a once-per-event announcement, not a repeating alert.

## Legibility at the 0.5 render-scale floor

`RENDER_SCALE_FLOOR` 0.5 is PROVISIONAL pending Mike's sign-off — this row is why it needs one. Render scale shrinks the world's drawing buffer only (`perf/render-scale.ts`: `setPixelRatio(deviceRatio × scale)`); the HUD, controller and settings surfaces are native views at device resolution and stay sharp. What softens is in-world type: street blades, fascia lettering, marquee text.

Vignelli's rule for the floor: **no required reading lives only in the world.** The NYCTA hierarchy the game borrows already ranks blades and marquee type as ambient signage — the player is never asked to read the world to play (Caller position, objectives and prompts are HUD). The check that closes the floor: on the M0 captures at scale 0.5, in-world signage stays *readable as signage* — letterforms hold their shape, fascia reads as a storefront, the marquee reads as a marquee — even where words get soft. If a blade turns to mush at 0.5, the floor moves up or the type gets bigger; it does not become "fine because it's not required."

Second-order check: the `high`-tier AO/bloom and the `phone` floor produce different luminance fields, but the HUD-contrast rule from `review/realism-a11y.md` is unchanged — no HUD element relies on the world for contrast; wells and scrims own it on every tier.

## Findings

| # | Issue | WCAG | Severity | Fix |
|---|---|---|---|---|
| 1 | A Rive→Skia art swap could silently shrink or re-order targets | 2.5.5 (and G01 contract) | High | Hit rects and focus order are layout-owned; the swap changes paint only — verify target sizes in the swap's tests |
| 2 | A parked view waking under reduced motion replays an entrance burst | 2.2.2 / motion | Medium | Wake resumes from the settled frame; reduced-motion art is the only art under the OS flag |
| 3 | Render-scale oscillation pumps luminance inside a second | 2.3.1 | High | Discrete steps + `reversalWindows` hysteresis; log the `decisions` array in the soak and count reversals |
| 4 | A per-touch wake flash on the controller | 2.3.1 | Medium | No entrance burst on wake; if the Rive timelines contain one, it is skipped on resume |
| 5 | In-world signage turning to mush at 0.5 floor | usability, Vignelli bar | Medium | M0 capture at floor; `RENDER_SCALE_FLOOR` sign-off requires the blades/marquee still read as signage |

## Device checks (open — no device yet)

From `docs/DEVICE_CHECKS.md` plus this pass; release builds only.

- [ ] Controller at floor scale: the caps, stick and pill stay native-resolution over the softened world — confirm the UI does not scale with the canvas.
- [ ] Touch-target audit if the thumbpad (or any art) moves to Skia: all six caps and the stick at scale 0.8 and the Android 0.86 floor; VoiceOver/TalkBack order unchanged.
- [ ] Reduced motion on: park → wake cycles produce zero motion; cap sink, spring and enter transitions stay off; off: same frames, animated versions.
- [ ] A soak's `decisions` log: count scale reversals — any down-up pair inside one 1.5 s window is a finding.
- [ ] Walk at dusk on the `high` tier once a post path exists: bloom pulses over 3 Hz are a defect (realism finding 2, unchanged).
- [ ] The 0.5-floor capture: blades, fascia and marquee read as signage; if not, the floor rises before sign-off.
