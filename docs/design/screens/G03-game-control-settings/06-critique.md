# G03 Game-control settings: critique

Scored against `docs/phase-1-brief.md` §0C. Stage: direction (no build yet). Reviewer: `design-director`; `verifier` co-signs at implementation. Standards the review measures against: Dieter Rams and Teenage Engineering (restraint, as little design as possible); Pentagram (Bierut, Scher) and Massimo Vignelli (signage typography, sentence case, one weight doing the work); Sega, Capcom and Bandai Namco arcade UX (the preview is the cabinet's control panel, read before touched); Persona 5 and Nier: Automata UI (typographic contrast between the engraved button legends and the page type); the WCAG 2.2 authors and the Xbox Accessibility Guidelines (remapping, dragging alternatives, spoken values); Studio Dumbar (motion only where it shows what changed); Mobbin (the nine screens in `02-references.md`). They are standards, never contributors.

Verdict: ⚠️ Several issues to address (all in the direction, none structural).

| §0C row | Score /10 | Evidence | Gap |
|---|---:|---|---|
| Delight and Fun | 6 | The live controller at the top responds to every dial; tapping a cap plays the press and the haptic you chose | A settings page is a workbench; the fun is borrowed from G01's hardware, and only if the preview is the real component |
| Visuals and Graphics | 7 | One sunken well, four sections, eight controls, no cards within cards; G01's graphite caps against the daylit page | The 16:9 well on a 375 pt phone gives the cluster 56 dp caps at 0.6 scale, which is a picture of the controls, not the controls; see Blocker 2 |
| Interaction | 8 | Commit on change, no Save; three paths to move a cluster (drag, nudge, keys); restore asks first with outcome-named buttons | Sliders with fractional ranges need spoken units; `Slider` has no `valueText` today |
| Inclusivity | 8 | OS reduced motion shown and linked, never duplicated; left-handed is a mirror, never a lesser layout; every control has a visible label and a caption | VoiceOver reading of `Slider` as "adjustable" must be verified on device; the preview's single-element label is long (about 90 characters) |

## Design critique

**Overall impression.** The page reads as a control panel with its dials under the object. The risk is that a phone-sized preview demotes the controller to an illustration while the dials become the content, the opposite of the intent.

| Finding | Severity | Recommendation |
|---|---|---|
| Preview too small on compact phones to show opacity and scale differences | 🟡 Moderate | Let the well grow to the controller's landscape height at 0.75 scale (about 150 pt) and scroll the dials under it; or pin the well while the list scrolls (`use-sticky-header` exists in `adaptive-panes`) |
| Nine sliders and segments in one column feel like a form | 🟡 Moderate | Keep four section headers, put the two `SegmentedControl`s of a section on one row from `md` up, so the page is three screens on a phone and one on a tablet |
| "Dead zone" and "Sensitivity" are engineering words | 🟢 Minor | Keep the names (they are what every controller settings screen calls them, and Callers who search for them expect them) and let the captions carry meaning |
| Bindings section promises a thing that is read-only today | 🟢 Minor | The caption says remapping comes with the game rules; keep it a `KeyValueList`, never a disabled picker |

**Visual hierarchy.** Eye lands on the preview, then the first section title, then the first slider's value. Correct. The Restore button at the bottom is the only outline button on the page, so it reads as the one thing that undoes everything.

**Consistency.** Every control is an existing kit component with its documented props. The only kit change is a `valueText` prop on `Slider`. Section titles use `FieldGroup.Section`, the same panel header the forms use.

**What works.** The page has no CTA and no orange, so the controller's own START pill in the preview is the only orange on screen and it is the hardware's. Restore is the only destructive path and it names its outcomes.

## Dieter Rams review

```
DIETER RAMS REVIEW — G03 Game-control settings
Core job: let a Caller fit the controller to their hand and feel, then get back to the game

SCORECARD
 1. Innovative          Adequate — the live preview is the only new idea; the rest is a settings page
 2. Useful              Strong — every field is a ControllerProfile key the router reads
 3. Aesthetic           Adequate — one well, four groups; depends on the preview holding its size
 4. Understandable      Strong — each slider has a one-line caption saying what it does to the game
 5. Unobtrusive         Strong — no Save, no banners, no tips beyond the captions
 6. Honest              Strong — reduced motion is the OS's, bindings say remapping is not here yet
 7. Long-lasting        Strong — fields come from the typed contract; a new field is a contract change
 8. Thorough            Adequate — clamp, invalid placement and no-haptics states are designed; VoiceOver values are not verified
 9. Efficient/clean     Strong — the preview is a paused Rive mount; no idle loop on a settings page
10. As little as possible Adequate — eight controls; two of them are candidates to cut

⚠ TOP VIOLATIONS
1. As little as possible — opacity and show-icons are the weakest earners.
   Opacity: the overlay already sits at 0.9 by default and the world shows through; a Caller
   who wants more city would shrink the controls. Show icons: no binding has an icon today.
   → Keep both because directive §13 lists them, but ship show-icons hidden until a binding
   carries an icon (the Switch would toggle nothing), and put opacity last in Layout.
2. Thorough — Slider has no spoken-unit prop, so "0.15" is what VoiceOver says today.
   → Add `valueText` to Slider (08-handoff § Kit changes) before this screen ships.

✓ KEEP
• The preview is the real ArcadeController, input off. Never a capture.
• Commit on change. No Save, no Apply, no "unsaved changes" chip.
• The OS owns reduced motion; the page shows it and links out.

▶ THE ONE EDIT
Hide the "Show icons on buttons" switch until ControllerBindings carries at least one icon.
```

Decision: BUILD opacity and show-icons (directive §13 names both); show-icons renders only when `bindings` carries an icon. Recorded in `08-handoff.md` § States.

## Blockers (must clear before 07-a11y / 08-handoff)

1. `ArcadeController` and G01's hardware look do not exist; `ControllerPreview` is a mount of them and cannot be built first. Owner: G01 lane and lane B (Rive) and lane C (components).
2. The preview's size on compact phones: `design-director` picks sticky well (preferred) or a taller scrolling well before the layout is handed off. Default until ruled: sticky well at 150 pt.
3. `Slider.valueText` (kit change) so spoken values are units, not fractions.
4. `ControllerLayoutResolver.validate(placement, metrics)` contract from lane D, so the placement editor has something to call.

## Non-blocking

- Hallway test: do players understand "Dead zone" from its caption alone? (`docs/design/research/HALLWAY_TESTS.md`)
- Hallway test: after switching to Left, do players expect the START pill to move? It stays top-centre.
- Measure the settings page at Dynamic Type XXL on iPhone SE: the haptics 2×2 grid and the slider value labels are the tight spots.
