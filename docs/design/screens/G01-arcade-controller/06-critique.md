# G01 Arcade controller overlay: critique

Scored against `docs/phase-1-brief.md` §0C rows, the design-critique framework, Dieter Rams' ten principles and the ten usability heuristics. Stage: direction (concept A chosen in `03-direction.md`; nothing built). Reviewer: `design-director`; `verifier` co-signs at implementation. Standards this is measured against (standards, not contributors): Dieter Rams and Teenage Engineering for restraint in a control surface; Sega, Capcom and Bandai Namco cabinet UX and Yu Suzuki's AM2 lineage for the six-button cluster; Pentagram (Bierut, Scher) and Vignelli's NYCTA manual for the legend typography; Persona 5 and Nier: Automata UI for typographic contrast on a dark field; the WCAG 2.2 authors and the Xbox Accessibility Guidelines for the input rules; Studio Dumbar for motion that has a reason; Mobbin per screen for the references in `02-references.md`.

| §0C row | Score /10 | Evidence | Gap |
|---|---:|---|---|
| Delight and Fun | 7 | Caps that sink 4 dp with a 55 g-style stop, a stick that springs home, a pill whose legend flips: a machine you can feel | Only delightful once latency is proven; a 2-frame lag on the press sink turns the machine into a drawing |
| Visuals and Graphics | 8 | Graphite in black wells on the Astro City arc, one royal stripe, one orange face; reads as hardware over both a daylit and a night city | The `royal-400` on `concrete-900` pair (4.61) is computed, not in the registry yet; the artboard has no Editor polish pass |
| Interaction | 8 | Pressed, held, released, disabled, cooldown, cancelled: each a visible state with a spoken sibling; STOP cannot happen by one tap | Two-button chords and stick-while-held are a lane C proof, not a design |
| Inclusivity | 8 | 44 pt at the smallest scale, mirror preset, reduced-motion siblings keep the stick's reading visible, focus never fires an action | Rive semantics on native are a runtime claim until `--semantics` runs show a tree |

## Design-critique

**Overall impression.** The first thing the eye lands on is the orange START pill, which is right before play and wrong during it; the graphite swap when the session starts fixes that. The biggest opportunity is restraint: the overlay is already three parts, and the temptation during Rive polish will be to add light.

**Usability**

| Finding | Severity | Recommendation |
|---|---|---|
| The pill's three meanings live in a 14 pt legend | 🟡 Moderate | Keep the legend and add the face change (orange only at `start`), the scrim at `paused`, and the spoken announcement; test question 3 in `01-research.md` decides if the scrim is load-bearing |
| Z (top-right cap) is the furthest from the thumb pivot | 🟡 Moderate | Default map puts the least-used action (reset view) on Z; hallway test question 1 checks the miss rate at 1.0 scale |
| Floating stick placement can start a drag on a cap | 🟡 Moderate | Floating mode only claims touches that begin outside every cap's hit circle plus 8 dp; lane C owns the hit test, this doc names the rule |
| Cooldown is a visual sweep | 🟢 Minor | The legend chip "wait" plus the spoken "Ready in n seconds" carry it for everyone |

**Visual hierarchy.** Reading order in play: world, stick (left thumb), cluster (right thumb), pill (top, glanced at). The pill is quieter than the caps during play on purpose: it is the thing you must not hit by accident.

**Consistency.** The glyph set (`silver-300` / white / `concrete-700` on black) is the H-Lynk key set, so a Caller who learned the Core's keys reads these caps the same way. Corner cuts on the pill match `Button`'s `CornerCutFrame`; round caps are the documented exception.

**Accessibility.** Every pair in `07-a11y.md` passes or is exempt with a reason; targets 44.8 dp at 0.8 scale; the stick is `adjustable` with a compass value; focus does not play the game.

**What works well.** Zero resting illumination means the world is the hero in daylight, which is Decision #4 made physical. The six centres are numbers, so "subtle arch" is testable.

## Rams review

```
DIETER RAMS REVIEW — G01 arcade controller overlay (concept A)
Core job: move and act in the city without looking at your thumbs, with the city visible

SCORECARD
 1. Innovative          Adequate — a virtual Astro City cluster is not new; the published arc and the semantic tree are
 2. Useful              Strong — three parts, every one doing a job the current camera column does worse
 3. Aesthetic           Strong — graphite, black, one stripe, one orange face
 4. Understandable      Strong — legend plus face plus depth; letters on caps
 5. Unobtrusive         Strong — nothing lit at rest; opacity is a setting
 6. Honest              Strong — a light means held, a ring means hold, a sink means pressed; no fake loading
 7. Long-lasting        Strong — a machine, not a glow trend
 8. Thorough            Adequate — cancelled, cooldown and disabled are designed; chords and latency are unproven
 9. Efficient/clean     Strong — no resting loop; on-demand redraw stays as GameScreen.tsx has it
10. As little as possible Strong — the no-list is longer than the parts list

⚠ TOP VIOLATIONS
1. Thorough (8) — the held/chord case has no visual spec → add the "two caps held" and "stick moving while A held" rows to the AllButtonStates story and the agent-device script before sign-off
2. Innovative (1) — the deflection rings carried from concept C are the one new idea; if they fail the daylit contrast check in 07-a11y they go, and the stick keeps the pad travel only

✓ KEEP
• Zero resting illumination; orange budgeted to the start face; the six centres as data

▶ THE ONE EDIT
Drop the START perimeter pulse carried from concept C. The face going orange already says "start"; the pulse is the first step back toward glow.
```

**Decision: STRIKE** the START perimeter pulse (the Rams edit). `03-direction.md` keeps the deflection rings pending the contrast check. The pulse may return as lobby-only motion on `AngledStartButton` (G02), where there is no world to compete with.

Ten-heuristic verdict for A after the edit: ✅ solid foundation. H1 (status) is carried by legend, face, depth and speech; H3 (freedom) by the hold-to-stop with release-to-cancel; H5 (error prevention) by STOP never being a tap; H7 (efficiency) by scale, handedness and bindings as settings.

## Blockers (must clear before 07-a11y / 08-handoff are implementable)

1. `ArcadeController`, `AnalogStick`, `DigitalDPad`, `ArcadeSixButtons`, `ArcadeActionButton`, `StartStopPill`, `AdaptiveControlLayout` do not exist; each needs a story (R3). Owners: lane B (Rive sources), lane C (input wrappers), lane D (layout).
2. `packages/theme/contrast.ts` lacks the two `royal-400` rows and the `carolina-500` on `concrete-800` row; Law 10 says the pair does not exist until measured. Owner: theme.
3. `GameInputRouter` has no implementation; the cancelled-input strings in `05-copy.md` assume `cancelAll` pauses the session. Owner: lane C with lane E.

## Non-blocking

- Measure press-to-sink latency on iPhone SE 3 and Pixel 8 (DEVICE_CHECKS, §14 performance).
- Hallway: questions 1–5 in `01-research.md` (`docs/design/research/HALLWAY_TESTS.md`).
- The 10° clockwise slant slagcoin reports as a player preference is not applied; revisit only if the hallway test shows the ring column is missed.
