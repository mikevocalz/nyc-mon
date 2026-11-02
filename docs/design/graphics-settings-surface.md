# Graphics and battery settings surface — design only

**Status: design only, awaiting Mike's go.** The spec's frontend-design step ships this surface "if Mike wants one" (`docs/plans/performance-pass-prompt.md` § Design skill sequence). Nothing in this file is built; the settings rows it describes are the copy in `docs/COPY_DECK.md` § Graphics quality and § Battery and frame rate, and the controls are the repo's existing semantic UI — no new components are proposed.

Owner: `frontend-design`. Inputs: `docs/COPY_DECK.md` (the strings), `handoff/performance-tiers.md` (what the tiers change), `research/performance-feel.md` (why a Caller would touch this), `screens/G03-game-control-settings/` (the sibling screen's conventions), Mobbin cards already collected in `research/realism.md` § Settings. Roster bar: Rauno Freiberg (settings that answer like the controls do — change applies as you make it, `g03.intro`), Michael Bierut (hierarchy that holds when detail drops).

## Where it lives

A sibling of G03 Game controls on the game's settings surface — the copy deck already places it there ("the game's settings surface next to Game controls, G03's sibling"). Same page skeleton as G03 (`04-components.md`): `SafeArea` edges top, `KeyboardAwareScroll`, `Container width="detail"`, `FieldGroup` sections. On foldables it follows the same hinge-safe rule every screen does (`skills/mikevocalz-foldable-layouts` per `AGENTS.md`): the surface lives inside one usable region, nav rail keeps its right edge; nothing in this design touches the hinge column.

## Layout

Top to bottom, matching G03's rhythm — title, `g03`-style "changes apply as you make them" line, then sections. Three sections, in this order:

| Order | Section | Control | Strings |
|---|---|---|---|
| 1 | Graphics | `SegmentedControl<GraphicsTier>` — Auto / Performance / Quality; per-option consequence line under the row | `settings.graphics.*` |
| 2 | Frame rate | `SegmentedControl<FrameRateChoice>` — Match the screen / 60 fps; one caption under the row | `settings.framerate.*` |
| 3 | Battery | `Switch` — Battery saver; consequence caption under it | `settings.battery.*` |

Conditional rows, both the existing `StatusRow` pattern:

- **Reduced motion** (`settings.graphics.reduced.*`): shown only when the OS reports reduced motion — same pattern as `g03.reduced.*`, neutral tone, "Change" opens system settings.
- **Warm** (`settings.battery.thermal.note`): shown only while the Thermal API reports the phone is warm and the build has stepped down — status only, no action (PR 5).

## Affordance decisions

Each a call, with the reason:

- **Segmented pills, not a radio list.** The Mobbin cards in `research/realism.md` already ruled this: borrow Riveo's compact fps-pill row (density fits a three-option pick) and the NBA "automatic first, consequence per option" ordering; reject Ultrahuman's card chrome — cards sell the pick, pills present it. Graphics leads with **Auto** because it *is* the recommended default and carries no badge — the copy deck's "no pressure" rule.
- **Consequence line under each section, not per option.** Prime Video's per-option cost pattern is borrowed once per section (`settings.graphics.render_scale.note`, `settings.framerate.caption`, `settings.battery.caption`) — three short lines total, not a wall.
- **No live preview.** G03's `ControllerPreview` mounts a second full controller; a world preview would mount a second WebGPU canvas — out of budget on a surface whose whole purpose is making the device work less. The consequence lines carry the information instead. (Borrowed-and-rejected: this is the one place a preview would help and can't afford to exist.)
- **No render-scale slider.** The governor owns scale (`perf/render-scale.ts`); the floor is PROVISIONAL pending Mike's sign-off. Exposing it would bury the honesty the `render_scale.note` is written to provide — the note says what Auto does instead of handing the Caller a knob.
- **No per-effect toggles.** Bloom, AO, env-map size and glass tier are bundle internals (`handoff/performance-tiers.md`); the `EXPO_PUBLIC_*` flags are developer gates, not player settings. Three tiers is the whole public surface — Pentagram's bar: the identity survives the tier, so the Caller chooses a *tier*, not a parts list.
- **Battery saver is one switch.** It composes the lighter tier + capped rate (COPY_DECK notes); it does not fork the tier picker.
- **Frame rate exposure is deliberately thin.** "Match the screen" is the spec's behavior (request the top rate the build can hold; 60 otherwise). The 60 option exists for battery, not tuning — nothing names 90 or 120 because the screen, not the Caller, decides (PR 4).

## What this surface must never do

- **Change copy under reduced motion.** The reduced-motion row appears; every other string is identical (COPY_DECK rule).
- **Ship a tier the build can't hold.** If Mike wants the surface before the pass lands, the Frame rate section waits with it — a "Match the screen" option on a build capped at 25 fps promises what doesn't ship (COPY_DECK rule: promise only what ships).
- **Add latency to apply.** Settings apply as you make them (`g03.intro` precedent); a tier change may re-author the world options between frames, never inside one (the zero-allocation law — re-tiering is a scene-option change at the next `update()`, not a mid-frame rebuild).

## Open questions for Mike

1. Does the surface exist at all this pass, or do the tiers stay env-flag-only until M0's captures prove the bands? (The flag-gated path already works: `EXPO_PUBLIC_WORLD_TIER` + `EXPO_PUBLIC_WORLD_RENDER_SCALE`.)
2. If it exists: is "Match the screen / 60 fps" the whole Frame rate section, or does a battery-cap 30 fps option belong? (No spec source for 30 — not drafted.)
3. `RENDER_SCALE_FLOOR` sign-off — the surface's `render_scale.note` says "never drops below half"; it reads true only once 0.5 is confirmed.
