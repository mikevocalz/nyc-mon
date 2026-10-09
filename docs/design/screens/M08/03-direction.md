# M08 Meeting: direction

Inputs: `01-research.md`, `02-references.md`, `docs/design/hlynk/DIRECTION.md`, `docs/DESIGN_SYSTEM.md`, canon Decisions #5, #9, #11, #14, design D3, D7, D8, D11, P2, P3. Route `/(onboarding)/meet`. Shell: H-Lynk Core. Screen states (remapped, `06-critique.md` C2): browsing / approaching / confirming / chosen.

## Position

M07 Caller name → **M08** → M10 Incubation choice (→ M06 sheet, P2) → M11 → M12 Hatch → M09 Naming → M13. Boot sends a Caller with no egg and no Mon here (`resume-onboarding`, `step: 'egg-choice'`, `packages/core/sim/boot.ts`).

## The one move

Three blocks, side by side, each holding one egg. The Metro Egg sits on a Harlem stoop, the Corner Egg on a bodega step, the Prism Egg on a Times Square ledge: three stills cut into one triptych inside the H-Lynk screen. Nothing is selected. Tapping a block, or flicking the trackpad, steps in: that block grows to fill the screen, the egg answers the attention with its one quiet wobble (v7 "small safe wobble", `M7 L421`), and a card rises with the egg's name, number and Bloodline. The Caller is looking at three places in the city, and picks one.

The blocks are art-direction settings, never a culture claim (`01-research.md`).

## Layout (phone, inside the 3:4 screen)

```
 ┌ scanner head: LED off, no chip ───────────────┐
 │ status row: (consent pending item, if any)    │
 │ Choose an egg                                 │ type-title, h1
 │ Dr. Alessandra Santoro brought three eggs.    │ type-body, text-muted
 │ ┌───────┐ ┌───────┐ ┌───────┐                 │
 │ │ stoop │ │bodega │ │ Times │  4:5 tiles      │ each tile: egg still, cover-cropped
 │ │ (egg) │ │ (egg) │ │ (egg) │  12 pt gaps     │ on the egg (focal point centre-low)
 │ └───────┘ └───────┘ └───────┘                 │
 │ Metro Egg  Corner Egg Prism Egg               │ type-label under each tile
 │ [ Look closer ] (TrackpadActions, outline)    │
 └───────────────────────────────────────────────┘
   [⌂] [≡]   ┏ trackpad ┓   [‹] [›]                 control row (bottom 40%)
```

Approaching (one egg focused):

```
 │ ┌─────────────────────────────────────────┐   │
 │ │        block + egg, full screen         │   │ the tile scales up to fill the screen
 │ │               (wobble once)             │   │
 │ │  ┌───────────────────────────────────┐  │   │
 │ │  │ Metro Egg                 #001    │  │   │ card: SolidPanel surface="page", notch top-left
 │ │  │ Hood Ratti Bloodline              │  │   │ type-title / type-label
 │ │  │ Each egg holds one Mon. You meet  │  │   │ type-body
 │ │  │ your Mon when the egg hatches.    │  │   │
 │ │  │ [‹ Prev] [All three] [Next ›]     │  │   │ TrackpadActions, outline
 │ │  │ [■■■ Choose the Metro Egg ■■■■■]  │  │   │ cta, the only orange on screen
 │ │  └───────────────────────────────────┘  │   │
```

Confirming (after the labelled Choose button, not after a hold):

```
 │  card body swaps in place (no modal stack):    │
 │  Choose the Metro Egg?                         │ type-title
 │  You can't swap eggs later.                    │ type-body
 │  [■■■ Choose this egg ■■■] [ Keep looking ]    │ cta + outline, equal height
```

Chosen: the card collapses, the egg settles to centre, the trackpad ring flashes once, focus moves on to M10 (`motion-step`). The LED stays `off`: there is no egg in the case until M10 confirms (DIRECTION.md LED table).

## States

| State | Treatment |
|---|---|
| browsing | triptych, no tile focused, no default. Trackpad label "Eggs, 3"; first flick focuses tile 1 (slot order, Decision #1), not a "recommended" one |
| approaching | one block full-screen, wobble, card up. Flick steps to the next block with `motion-step`; the card content cross-fades, it does not re-rise |
| confirming | card body asks; Back key and "Keep looking" return to approaching on the same egg |
| chosen | the choice is passed to M10 as a route param; nothing is written yet (`08-handoff.md` § Data) |
| error | content failed its schema at load. One line and a "Try again" that re-reads; no eggs drawn from partial data |
| offline | identical to browsing. Everything on M08 is bundled |

The brief's `refused` state is struck (Decision #14: no egg or Mon rejects the Caller). The brief's `bonded` is `chosen`: the bond forms at the hatch (#14) and lives on the `MonInstance` (#8).

## Type and colour

Daylit or night by the clock (D8, shell). Page text `text` / `text-muted`. Card face `surface-raised` with `signage-black` text (21:1), Bloodline in `concrete-700`. Dex number in `type-body-strong` with tabular figures. The CTA is the one orange face (D5). No orange elsewhere, no red outside the H-Lynk chrome.

## Motion

| Moment | Full | Reduced |
|---|---|---|
| Tile → full screen (approach) | 300 ms `emphasized` scale from the tile's frame (`motion-enter` timing) | 200 ms cross-fade, no scale |
| Egg wobble on focus | two ±3° rotations about the egg's base, 600 ms total, once per focus | none; the card appearing is the response |
| Card rise | `motion-enter` 300 ms, 8 pt rise | 200 ms fade |
| Flick to next egg | `motion-step` 200 ms, 24 pt slide | 120 ms cross-fade |
| Chosen | ring flash 120 ms + `motion-step` to M10 | ring colour change, cut to M10 |

Motion answers the Caller's action; nothing moves in browsing. On the 3D model's arrival the wobble becomes the egg's `attention` vignette from the v7 idle notes (stripes pulse, fur fluffs, flames ripple), still once per focus.

## No-list

- No Baby, no silhouette of a Baby, no Baby form name (P3, glossary).
- No culture-note row, no liked-food row, no "Unknown" placeholders (`01-research.md`).
- No default egg, no "popular", no "rare", no timer, no price.
- No Santoro portrait or invented Santoro line (`TODO(canon)`).
- No pronoun for the Mon inside (PS-005, Q14).
- Never "catch", "capture", "pick a pet" (`COPY_DECK.md`).
