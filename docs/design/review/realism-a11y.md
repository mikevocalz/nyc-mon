# Harlem realism pass: accessibility

Owner: `a11y-auditor`. Standard: WCAG 2.2 AA (https://www.w3.org/TR/WCAG22/), Apple HIG accessibility (https://developer.apple.com/design/human-interface-guidelines/accessibility), Android accessibility (https://developer.android.com/guide/topics/ui/accessibility), Xbox Accessibility Guidelines (https://learn.microsoft.com/en-us/gaming/accessibility/guidelines) for the frame-rate and flash concerns. Inputs: `../research/realism.md`, `../handoff/realism.md`, `world/look.ts`, `hud-layout.ts` (the hinge-safe HUD policy), `docs/design/CONTRAST.md`, `docs/DESIGN_SYSTEM.md`. Stage: design. Nothing is built, so every row below is a requirement, not a test result.

**Verdict:** accessible by construction if three rules hold: HUD text keeps its own faces over the glossier city, no luminance change repeats faster than 3 Hz, and reduced motion lands as a fully static look. The measured constants carry no inherent violation.

## HUD contrast over a brighter, glossier city

The pass raises peak luminance in the world (specular glass, lit rooms, bloom at `BLOOM.strength` 0.045, vignette `GRADE.vignette` 0.22 pulling the corners dark while the centre brightens). The HUD's problem is no longer "dark text on a dark city" but the opposite: signage-white HUD text over a bright storefront glow, or a sun glint sliding under a label as the camera walks.

| Pair | Foreground | Background | Role (min) | Requirement |
|---|---|---|---|---|
| HUD status banner text | `text` | banner's own `surface` face | text 4.5 | **Pass by design — keep the face.** The banner never draws text straight on the world; it keeps its opaque kit face (`GameStatusLayer` already does). |
| HUD controls (arcade stick, caps, START/STOP) | `signage-white`, `carolina-500` keylines | world beneath, including glass glints and lit windows | ui 3 (SC 1.4.11) | Controls sit in their own wells/washes per the G01 group (`concrete-800`, `signage-black` wells). The bright background must never be the only thing separating a glyph from the world — the well provides the contrast floor. |
| Controller opacity option | — | — | ui 3 | G03's Opacity slider drops the controller toward the city; the realism pass makes that city brighter. The minimum opacity step must still clear 3:1 glyph-on-background over a lit shopfront — check at the capture session, worst case dusk. |
| Loader progress over the world build | `text` | kit surface | text 4.5 | The loader covers the canvas (`bg-surface` today); if it moves to a progress bar over the live world it gets the same scrim rule as the banner. |
| Settings graphics rows | `text`, `text-muted` | `surface` | text 4.5 | Unchanged; the settings surface follows the OS appearance (D8), not the world grade. |

The world's own contrast is not governed by WCAG — a 3D scene is not UI. What is governed: any luminance the HUD sits on. Rule for implementation: **no HUD element may rely on the graded world for its contrast.** Every HUD surface keeps a kit face, well or scrim, exactly as the LED well precedent (D3) already establishes.

## Flash safety (SC 2.3.1)

Nothing in the look may flash more than three times in any one-second window. The risks are specific:

- **Bloom flicker.** At `BLOOM.strength` 0.045, small bright sources (a lamp head, a marquee bulb, a glint on a tilted pane) can cross the bloom threshold on and off as the camera moves — blooming, not blooming, blooming. Fix by design: the bloom threshold and the seeded glints are static per pane; what changes is coverage, and coverage must fade by distance the way `materials.ts` already fades sub-pixel panes to their average (`detail`/`glowFar`), not pop.
- **Lit-window shimmer.** The `windows.ts` seeds are stable per building — a lit window stays lit. The far-distance average (`glowFar`) must not re-seed as LOD steps change it, or the skyline flickers on camera moves. Same rule as today's moire fade.
- **Governor pumping.** Render-scale steps (`RESOLUTION.dropStep`/`riseStep`) change resolve, which changes edge shimmer and perceived brightness. Steps must be discrete and the asymmetric 0.1-down / 0.05-up schedule exists partly so resolve does not oscillate; a visible luminance step is a change, not a flash, but a 1.5 s cycle of down-up-down would read as one — the hysteresis holds.
- **Marquee and neon.** `marqueeLights` and neon accents are steady-state emissive; any chase/bulb animation added later is capped at the same 3 Hz ceiling, and under reduced motion runs its static sibling.

## Reduced motion

`useReducedMotion` through the sim-core adapter gates the look, the same single gate the rest of the app uses. Under reduced motion:

- The grade is static: vignette, contrast and saturation values hold; nothing sweeps or pulses.
- No animated glow: lamp halos, bloom shimmer on movement, marquee bulbs and any storefront flicker run their steady versions.
- The governor still works — dropping resolution to hold the frame rate is not motion; the steps stay discrete and silent.
- Settings copy never changes (`settings.graphics.reduced.*` status row shows the same strings; `docs/COPY_DECK.md`).

## Duo hinge line

Policy already encoded in `hud-layout.ts`: the world canvas spans the container uninterrupted (PR #29's rule); every HUD element sits wholly inside one usable region. The realism pass adds a readability requirement, not a layout change:

- The vignette (`GRADE.vignette` 0.22) darkens frame corners; on a book-posture Duo the vertical hinge sits near screen centre, outside the vignette's strongest zone — but a tabletop horizontal hinge lands mid-frame where the horizon band and `sunGlow` gather. The sky dome's horizon glow must not be authored to peak exactly at the hinge line, or the fold reads as a seam splitting the sunset. Keep the horizon band broad, not a line.
- Specular glints sliding across the hinge column (tilted panes, curtain glass) are fine as world content — the skill's rule is that no content or touch target occupies hinge bounds; a reflection crossing the fold is scenery, not content. The HUD's status banner and the controller stay in their usable regions regardless.
- Lit-window "story" cues (a lit room you are meant to notice) should seed away from the hinge column on foldables where possible; not a hard rule, a seed-preference `TODO(tune)` once a Duo capture exists.

## Findings

| # | Issue | WCAG | Severity | Fix |
|---|---|---|---|---|
| 1 | HUD glyph contrast can dip under 3:1 when a glint or lit shopfront slides behind a control | 1.4.11 | High | Wells/scrims own the contrast floor; verify worst case on the dusk capture grid |
| 2 | Bloom threshold crossing on small bright sources can produce >3 Hz bloom pulses while walking | 2.3.1 | High | Static seeds + distance fade to average, never pop; measure on device |
| 3 | LOD re-seeding of the far lit-window average would shimmer the skyline | 2.3.1 (and malaise) | Medium | `glowFar` average is a function of the same building seed at every LOD step |
| 4 | Controller at minimum opacity over a lit shopfront | 1.4.11 | Medium | Capture check; if it fails, the opacity floor rises or the well darkens |
| 5 | Horizon glow peaking at a tabletop hinge line | usability, foldable | Low | Broad horizon band in the sky dome; verify in book and tabletop postures |

## Device checks (open, no device yet)

From `docs/DEVICE_CHECKS.md` plus this pass:

- [ ] Dusk capture grid (three Apollo positions): HUD banner, controller and loader text over the brightest graded frames; measure, don't eyeball.
- [ ] Walk one block at dusk and night on the target phone watching bloom sources and the lit-window far average; record any >3 Hz pulse as a defect.
- [ ] Reduced motion on: grade static, no animated glow, governor steps invisible; off: same frames, animated versions.
- [ ] Book posture on a foldable: HUD wholly in one usable region, horizon band readable across the hinge; tabletop: the fold does not bisect a thin glow line.
- [ ] Auto tier on the target phone inside the 27–38 fps band: scale steps are discrete, no pumping cycle within a 1.5 s window.
