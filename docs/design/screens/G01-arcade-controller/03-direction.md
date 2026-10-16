# G01 Arcade controller overlay: direction

Inputs: `01-research.md`, `02-references.md`, `docs/design/research/arcade-ergonomics.md` (the six centres), `docs/DESIGN_SYSTEM.md`, `docs/design/DECISIONS.md` (D3, D5, D11), canon Decisions #4, #7, #16, `packages/theme/tokens.ts`, `packages/ui/control-look.ts`, `packages/ui/game-controls/contract.ts`. Directive §2 (requirements), §4 (identity, three concepts), §8 (View Model).

## What every concept shares

- Three modular parts: the stick (round), the six-button cluster (round caps on the `arcade-ergonomics.md` §7 arc), the START/STOP pill (corner-cut). Nothing else on the overlay. Repo rule: nothing rounded by default except what is physically round; the caps and the stick housing are round, the pill and any panel are corner-cut.
- The controller is hardware, like the H-Lynk Core (Decision #16): it does not change colour with the daylit/night scheme. The world behind it does. Illumination is the only thing that varies, and it varies by state, never by time of day.
- Default labels X Y Z over A B C (`BUTTON_IDS`), painted in `silver-300` on the cap, `type-label` weight, 17 pt at scale 1.0 so a 1.4 scale lands at 24 pt and 0.8 at 13.6 pt (the floor is 13).
- The pill carries one orange face: `cta` in its `start` state only (D5: one orange button per screen). While `playing` and `paused` the pill is graphite with an engraved legend; in `stopConfirm` the hold ring is `apple-500` on `signage-black`.
- Pressed feedback is depth plus value: the cap sinks 4 dp into its well and the glyph goes `signage-white`; the well's rim brightens one step. Never colour alone (D3). Haptics are additive (`ControllerProfile.haptics`), never the only cue.
- Reduced motion is an authored sibling for every animation (§ Motion), not a shortened tween.

## Token set (names from `tokens.ts`)

| Part | Token | Note |
|---|---|---|
| Cap face (graphite) | `concrete-800` #303337 | `concrete-900` was tried; `royal-500` keylines fail on it (2.98:1) |
| Cap well, stick well, pill well | `signage-black` | the H-Lynk's control black |
| Housing plate | `concrete-900` #1C1E21 | decorative; the wells and keylines carry the controls |
| Glyph idle / pressed / disabled | `silver-300` / `signage-white` / `concrete-700` | the H-Lynk key glyph set |
| Structure keyline | `royal-400` #4082FA | 4.61:1 on `concrete-900`, 3.52:1 on `concrete-800` (computed, § `07-a11y.md`); `royal-500` is kept for the lobby page, not here |
| Held / focus ring | `carolina-500` | 8.16:1 on black, 6.49:1 on `concrete-900` |
| START face / legend | `cta` (orange-500) / `on-cta` (signage-black) | 8.02:1 |
| Stop hold ring | `apple-500` on `signage-black` | 4.99:1, the LED pair |
| Cooldown sweep | `concrete-700` on `signage-black` | disabled-class, exempt; the state is also a legend change |
| Paused scrim over the world | `scrim-scene` | measured over white and black scene pixels |

Type: `type-label` (cap letters, pill legend fallback), `type-tag` (the pill's engraved START / PAUSE / RESUME legend, uppercase, tracked; Decision below), `type-caption` (the "Hold to stop" line). Space: 4 dp grid. Motion: `motion-tap` for presses (full: scale 0.97; reduced: colour change) extended with a 4 dp depth sink on the full variant; `motion-enter` for the overlay mounting.

**Decision: BUILD.** The pill's legend is a `type-tag` uppercase signage label (START / PAUSE / RESUME / HOLD TO STOP), the only uppercase on the overlay. DESIGN_SYSTEM's sentence-case rule covers buttons and prose; `tokens.ts` adds `type-tag` as "uppercase signage labels: section eyebrows, photo place tags, readout headers", and a legend machined into a pill is a readout header. The accessible name stays sentence case ("Start", "Pause", "Resume"). If `design-director` overrules, the fallback is `type-label` sentence case with no other change.

## Concept A: Metro Arcade

Industrial arcade hardware. Graphite caps in black wells on a `concrete-900` plate; a single `royal-400` keyline runs the plate's edge like the stripe on a subway car; the lit edge is crisp, 2 dp, no bloom. The stick is a black well with a graphite pad and four cardinal ticks in `silver-300`; a pressed direction's tick goes white. The pill is a corner-cut slab, `cta` orange when it says START, graphite when it says PAUSE or RESUME, with the legend engraved (`type-tag`). Materials: matte graphite, black polycarbonate, one painted stripe. Lighting: none at rest; a cap lights only while held (`carolina-500` ring inside the well). Typography: `type-tag` legend, `type-label` letters, Space Grotesk 500, the station-sign register without a station name.

```
 ┌──────────────────────────────────────────────────────────────┐
 │                       ╔══════════╗                           │  pill 120×44, corner-cut 8
 │                       ║  START   ║  ← cta face, on-cta legend│  (graphite + engraved when playing)
 │                       ╚══════════╝                           │
 │                                                              │
 │                 world (three.js) shows through               │
 │                                                              │
 │   ╭────────╮                                 (X)  (Y)  (Z)   │  caps Ø56 on the §7 arc
 │  (   ◯·    )  ← stick Ø128, pad Ø56             (A)  (B)  (C)│  bottom row +8 dp right
 │   ╰────────╯                                                 │
 │  └─ royal-400 keyline on the plate edge, 2 dp ──────────────┘│
 └──────────────────────────────────────────────────────────────┘
```

## Concept B: H-Lynk Command

The controller as an H-Lynk accessory. Black wells and caps as in A, but the housing plates are `apple-600` red like the Core's body, with `signage-white` ink for any printed legend and black control faces (the measured H-Lynk pairs: black edge on body 3.83:1, white on body 5.48:1). The stick well carries a thin `apple-500` ring like the trackpad's (4.99:1 on black). The pill sits in a black band across the top like the scanner head, with the START face still `cta` orange. Materials: matte red plastic, black polycarbonate. Lighting: the red ring and the pill band; nothing else lit at rest. Typography: `type-tag` legend in white on red for the band's label (if any; default none), cap letters `silver-300` on black.

```
 ┌──────────────────────────────────────────────────────────────┐
 │ ████████████████████ ╔══════════╗ ████████████████████████████│  black band (scanner-head cue)
 │ ████████████████████ ║  START   ║ ████████████████████████████│  pill in the band
 │                      ╚══════════╝                            │
 │                 world shows through                          │
 │ ▓▓▓▓▓▓▓▓▓▓▓▓                             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  apple-600 plates
 │ ▓ ╭────────╮ ▓                           ▓ (X)  (Y)  (Z)  ▓ │  black caps in the red plate
 │ ▓(   ◯·    )▓  ← apple-500 ring on black ▓   (A)  (B)  (C)▓ │
 │ ▓ ╰────────╯ ▓                           ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
 │ ▓▓▓▓▓▓▓▓▓▓▓▓                                                 │
 └──────────────────────────────────────────────────────────────┘
```

## Concept C: Night Circuit

Shallow glass over metal. Caps are `concrete-800` under a 1 dp `silver-500` glass rim; each cap has a concentric illumination ring (`carolina-500`) that is dark at rest and lights on press; the stick has three concentric rings whose lit count follows deflection (one at the dead zone, three at the clamp). A circuit trace in `royal-400` runs the plate between the parts and animates a pulse along it on START (Rive). The pill's perimeter carries the same trace. Materials: smoked glass, brushed metal, printed circuit. Lighting: everything can light; at rest nothing is. Typography: as A.

```
 ┌──────────────────────────────────────────────────────────────┐
 │                      ╔══════════╗                            │  pill with perimeter trace
 │           ┈┈┈┈┈┈┈┈┈┈╢  START   ╟┈┈┈┈┈┈┈┈┈┈┈┈┈                │  royal-400 circuit line
 │           ┊          ╚══════════╝             ┊              │
 │           ┊     world shows through           ┊              │
 │   ╭─◎─╮   ┊                              ((X))((Y))((Z))    │  caps with dark rings
 │  (( ◯ ))┈┈┘                                ((A))((B))((C))   │  ring lights on press
 │   ╰───╯  three deflection rings                              │
 └──────────────────────────────────────────────────────────────┘
```

## Critique of the three (design-critique format)

Stage: exploration. Core job: move and act without looking, with the world visible.

| Concept | First impression | Usability | Hierarchy | Consistency | Accessibility | Performance |
|---|---|---|---|---|---|---|
| A Metro Arcade | A machine, not a HUD | Every state is depth + value; nothing to learn | The pill is the one orange thing; caps recede | NYC-Tron corner cuts on the pill, H-Lynk glyph set, royal structure as `structure` intends | Every pair measured or computable; no state by colour alone | Fewest layers: wells, caps, one keyline; Rive can draw it in two artboards per part |
| B H-Lynk Command | A red accessory; strong brand | Same contract as A | The red plates compete with the orange pill (D5 budget stays at one, but red is the second loud colour) | Borrows Decision #16's object onto a surface that is not the H-Lynk; Decision #8 warns against the device owning play | Black-on-red edge is 3.83 (ui pass) but a red plate over a daylit city is a 4.98 decorative block that hides the world | Same as A plus a plate fill; fine |
| C Night Circuit | Holographic; the most "future" | Lit rings over a dark city read well; over a daylit city the dark-at-rest rings vanish and the glass rim (1 dp `silver-500`) is below the 3:1 edge on concrete-50 | The trace competes with the pill | The directive rejects indiscriminate glow; DESIGN_SYSTEM: "Glow belongs to night" and daylit is the default (Decision #4) | Rings as the press cue fail D3 unless depth is added back (then it is A with rings) | Most layers and a running trace; the lobby rule "never keep a full-speed loop alive during gameplay" also bites the controller |

Ten-heuristic verdict: A ⚠️ one issue (H6: the pill's three meanings need the legend to be legible at `type-tag` 14 pt); B ⚠️ H8 (red plates fight the world) and H2 (an H-Lynk is a scanner, not a controller); C 🚨 H1 at daylit (lit-only states disappear) and H8.

Rams read: A honours 5 (unobtrusive), 6 (honest: lights mean held, nothing else), 7 (long-lasting: it is a machine, not a trend) and 10 (as little as possible). B is 3 and 1 at the cost of 5. C is 1 at the cost of 5, 6 and 9.

## Recommendation: A, Metro Arcade

- **Usability:** state is carried by depth, value and legend, which survive haptics-off, daylit, night and reduced motion. B is equal; C depends on illumination.
- **Recognizability:** the six-cap arc on black wells is the Astro City silhouette; the royal stripe and the station-sign legend are New York without a logo. Players who have stood at a cabinet know it in a second.
- **Performance:** the fewest layers, no resting animation, no trace loop; the Rive artboards are a well, a cap, a glyph and a ring per button.
- **NYC-Tron consistency:** corner cuts only on the pill, round only where physical, `structure` royal as the one line, orange budgeted to one face, the H-Lynk glyph set reused rather than a second one invented.

Carry from C into A, as Rive polish not identity: the stick's deflection rings (one to three `carolina-500` rings at the dead zone, half and clamp) because they give the analog reading a visible value, and the pill's perimeter pulse on START only (one pulse, 300 ms, absent under reduced motion). Carry from B: nothing. The H-Lynk stays the companion object (Decision #8).

**Decision: BUILD A** with the two C details above. B and C are recorded here and not drawn further.

## Motion and reduced motion

| Animation | Full | Reduced (authored sibling) |
|---|---|---|
| Cap press | 4 dp sink + `motion-tap` scale 0.97, 120 ms `standard`; release springs back 160 ms `emphasized` | glyph goes white and the well rim brightens, 120 ms, no sink, no scale |
| Cap held | ring `carolina-500` holds at full | same (static) |
| Cap cooldown | `concrete-700` sweep around the well over the cooldown length | legend "wait" chip on the cap, no sweep |
| Stick deflect | pad follows the finger; tilt 0–8° toward travel; rings light by radius | pad follows the finger with no tilt; rings light by radius (the reading must stay visible) |
| Stick release | spring home 200 ms `emphasized`, 1 overshoot of 4 dp | steps home in one frame |
| Pill press | 2 dp sink, 120 ms | colour change only |
| Pill START pulse | one perimeter trace, 300 ms | absent |
| Pill state change | legend cross-fades 120 ms | cuts |
| Hold to stop | `apple-500` ring fills clockwise over 600 ms; a release before the end unwinds in 200 ms | ring fills in four quarter steps at 150 ms each, no unwind animation, resets on release |
| Paused | world dims to `scrim-scene` over 200 ms | cuts |
| Overlay mount | `motion-enter` | `motion-enter` reduced |

## No-list

- No generic purple gradients, no indiscriminate glow, no opaque HUD blocks, no stock gamepad art, no copied controller SVGs (directive §4).
- No orange on the six caps or the stick (D5; the pill in `start` is the one).
- No colour-only state (D3).
- No first-run tooltip in Phase 1; no onboarding overlay.
- No scheme-following colour on the controller; it is hardware.
- No rectangular grid for the six buttons; the centres are `arcade-ergonomics.md` §7 or the artboard fails review.
- No invented action names: labels come from `ControllerBindings`, default to `CameraCommand`.
