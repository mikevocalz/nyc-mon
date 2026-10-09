# M08 Meeting: critique

Reviewed 2026-10-08 against `docs/phase-1-brief.md` §0C, the 10 usability heuristics and `product-decisions` flow laws. Inputs: `03-direction.md`, `04-components.md`, `05-copy.md`.

## Canon conflicts resolved (canon wins)

| # | Brief says | Canon says | Resolution |
|---|---|---|---|
| C1 | M08: "Three live Mons, one scene … Hold: it leans in or refuses … the Mon turns to face the Caller" (§4.2) | Decision #5: Santoro presents three **eggs**; the Caller chooses one; Babies are not seen before the hatch (P3) | M08 is an egg choice. No Mon, no Baby art, no Baby name on this screen |
| C2 | States `browsing / approaching / refused / bonded` | Decision #14: the Mon's choice happens at the hatch; it never rejects the Caller; the egg is never sent back. Decision #8: the bond lives on `MonInstance` | `refused` is **struck**. `bonded` becomes `chosen` (no bond exists before a `MonInstance`). Added `confirming` so the labelled path can't commit by one mis-tap. Final states: browsing / approaching / confirming / chosen, plus error and offline |
| C3 | Flow M08 → M09 Naming → M10 → M11 → M12 → M13 | Decision #5: naming happens after the hatch | M09 sits **after M12**: M08 → M10 → (M06 sheet) → M11 → M12 → **M09** → M13. M12's "on completion → M13" becomes "→ M09"; the continuity transition moves to M12 → M09. Recorded in `screens/M09/06-critique.md` too |
| C4 | Card shows "species, line" | Decision #9: "The starter card's Dex number is the Baby form's" (written when the card showed a Baby) | The pre-hatch card depicts the egg, so it shows the egg's own number (#001, #008, #061) and the Bloodline label (#11). The Baby number appears from M09 on. Open for Mike (`05-copy.md` question 2) |
| C5 | Card shows "culture note (from canon), a food it likes" | `cultureNote: null` (Q12, Q13), `foodClassIds: null` (Q22, Q24); v7 "No eating at Egg" (`M7 L419`) | Rows omitted, not shown empty. They return with canon citations when the questions close |
| C6 | "one scene, horizontal pan" | No shared scene art exists; each egg still carries its own setting (`packages/assets/creatures`); models come later (Mike) | Three stills as a triptych; the flick steps between blocks. When models land, the triptych tiles become three render targets with the same contract |

## Proposed design decisions (for `docs/design/DECISIONS.md`)

- **D13 (proposed): no default egg.** Same reasoning as D9/L1: a preselected option steers the choice. First flick focuses slot 1 in canon slot order.
- **D14 (proposed): the egg choice is not persisted until M10 confirms.** It travels as a route param. A Caller who quits between M08 and M10 returns to M08 with nothing chosen (boot `egg-choice`). Persisting a half-made choice would need a new store field for no user gain.
- **D15 (proposed): hold commits directly; the labelled path confirms.** DIRECTION.md already specifies "activate, then confirm" as the hold alternative. A 600 ms hold is a deliberate act; a single button press is not.

## Scores against §0C

| §0C row | Score /10 | Evidence | Gap |
|---|---:|---|---|
| Delight and Fun | 7 | Three real blocks of the city; the egg answers attention with its own wobble; choosing is a held, deliberate act with a ring flash | 2D stills cap it until models arrive; Santoro is named but absent |
| Visuals and Graphics | 7 | Three strongly different egg skins carry the comparison; the chrome stays quiet; one orange face | Three art settings at three times of day may clash in one row; lookdev must grade them to one light |
| Interaction | 8 | Trackpad flick and hold, `TrackpadActions` twins, confirm on the button path, no default | `ChoiceTriptych` doesn't exist yet |
| Inclusivity | 8 | Radio semantics, every gesture labelled, no colour-only state, reduced-motion siblings | Bloodline names are long at XXL; the card scrolls inside the screen (`07-a11y.md`) |

Award bar (§8: M08 needs ≥ 8 on each row): **not met** on Delight and Visuals until egg models and a Santoro presence exist. Neither gap can close in design docs; both are blockers below.

## Heuristics

**H1 Visibility of system status.** The LED stays `off` until M10, matching DIRECTION.md (no egg in the case yet). The `chosen` announcement tells screen-reader users the choice landed.

**H3 User control and freedom.** "All three", "Keep looking", Back and Escape always step out. Nothing is written before M10, so backing out of M10 loses nothing.

**H5 Error prevention.** No default, a hold or a confirm before commit, and a one-line consequence ("You can't swap eggs later").

**H6 Recognition over recall.** Name and Bloodline stay under or on every egg; the Caller never has to remember which block held which egg.

**H8 Minimalist design.** The card carries three facts and one sentence. No stat bars, no personality copy.

## Blockers

1. `ChoiceTriptych` (missing primitive) with stories `Browsing`, `Focused`, `ReducedMotion`, `LargeText` (R3).
2. Lookdev grade on the three egg stills so they sit as one triptych (Visuals score).
3. Santoro: art and a canon line are `TODO(canon)`; the screen ships without them.
4. Egg 3D models (Mike: supplied later). The stills are the Phase 1 surface until then.

## Copy lint

`deslop.py --text` over every M08 String cell, 2026-10-08: **5/5 CLEAN** (81 words). Rival-model cleanse not run.
