# M02 Welcome: direction

Inputs: `01-research.md`, `docs/design/DECISIONS.md` (P1, P3, D7, D8), `docs/DESIGN_SYSTEM.md`. Route `/(onboarding)/welcome`. Shell: none (D1). States: panel 1–3, reduced motion.

## The one move

Each panel is a real photograph or capture cut into the top two-thirds of the screen with a hard corner-cut edge, like a transit ad panel; a solid concrete band below carries one sentence in signage black. The city reads as a place, not a backdrop.

## Layout (all three panels)

```
 ┌──────────────────────────────┐
 │                       Skip   │  ghost text button, top-right, always visible
 │┌────────────────────────────┐│
 ││                            ││  image, 62% of height, corner cut bottom-right
 ││      panel image           ││
 │└──────────────────────────╲─┘│
 │  One sentence, type-title    │  concrete-50 band, left-aligned, 16 pt gutter
 │  Optional second line, body  │
 │                              │
 │  ‹   ■ □ □   ›               │  progress tiles + prev/next
 │  [ Next                    ] │  panel 1–2: royal outline-free ghost "Next"
 └──────────────────────────────┘
```

Panel 3 replaces Next with the two intents (P1):

```
 │  [■■■■ Get started ■■■■■■■■] │  orange CTA face, black label (one per screen)
 │        Sign in               │  ghost text button, royal
```

## Panels

| # | Image | Caption intent (final words: `ux-writer`, `05-copy.md`) |
|---|---|---|
| 1 The city | One real block from `packages/assets/photos/` (candidate: `harlem-brownstone-stoops.webp`, a stoop-level street, not a skyline). No Mon in frame. | A real block where Mons live alongside people |
| 2 The Mons | P3: the three eggs, #001 Metro Egg, #008 Corner Egg, #061 Prism Egg, on one ground line, still. Each with a caption line: "Hood Ratti Bloodline", "Bodega Baddiee Cee Bloodline", "Yote Bloodline" (D7). | One of these will hatch for you |
| 3 The Caller | The H-Lynk Entry front view on the concrete band, with no Mon | What a Caller is; partnership is mutual (`V11 ¶43`). Research flags "Scanning isn't recruiting" as a likely non-sequitur in Phase 1: test before shipping it |

Research risk on panel 1 (`01-research.md`, culture): the block photo must not sit next to a starter. Panels 1 and 2 never share a frame.

## Type

`type-title` for the sentence, `type-body` for the optional second line, `type-caption` for the Bloodline captions. Sentence case. No eyebrows, no all-caps, no numbering (the dots already show sequence).

## Motion and reduced motion

Swipe or tap arrows: `motion-step` (24 pt slide). Reduced: 120 ms cross-fade, no slide. No autoplay (the kit's `CardSlider` starts paused under reduced motion, but we turn autoplay off entirely: Caller controls pace).

## Skip

Skip jumps to panel 3's two actions rather than past them, so the create/sign-in split (P1) is never bypassed.

## No-list

- No skyline hero (`§4.1`: "a real block, not a skyline").
- No Baby or Mid forms (P3, Law 7).
- No paywall, no notification ask, no age ask here (P1, P2).
- No glow, no neon grid on the daylit page; NeonBlade appears only as the corner cut and the segmented progress tiles.
- No "owner", "trainer", "wild", "device" (Law 9).
