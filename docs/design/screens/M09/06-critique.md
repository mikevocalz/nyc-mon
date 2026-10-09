# M09 Naming ceremony: critique

Reviewed 2026-10-08 against `docs/phase-1-brief.md` §0C, the 10 usability heuristics and `product-decisions`. Inputs: `03-direction.md`, `04-components.md`, `05-copy.md`.

## Canon conflicts resolved (canon wins)

| # | Brief says | Canon says | Resolution |
|---|---|---|---|
| C1 | Screen order M08 → **M09** → M10 → M11 → M12 → M13; M12 "On completion → M13 via a continuity transition" | Decision #5: "Naming happens after the hatch, so the naming ceremony names the hatched Baby, not the egg" | M09 sits **after M12**: M12 `hatched` → M09 → M13. The continuity transition moves to M12 → M09; M09 → M13 is a `motion-step` with the scheme hand-back. The route stays `/(onboarding)/name` (brief), reached from M12 |
| C2 | "The Mon reacts to the name as typed (species sound, head tilt)" | Decision #14: the Mon's choice already happened at the hatch's first look; Q32: Baby voice open | The reaction is attention only (a tilt on a typing pause), never approval or refusal. Sound is a slot, off until Q32 closes |
| C3 | "Suggested names from canon only when canon provides them" | No canon names for the player's starters (Q17); "Ratti" is Malik's (Decision #1) | No suggestions. No default name. "Ratti" handled as an open rule (`05-copy.md` question 1) |
| C4 | M12 states end at `complete` | `transitionHatch` ends in `hatched` with the minted `MonInstance`, `nickname: null` (`packages/core/sim/hatch.ts`) | M09 names that same `MonInstance`; it never creates or re-mints anything (Law 6) |
| C5 | (none) | PS-005 / Q14: no pronoun in Phase 1 | All copy uses the form name or "your Mon" |

## Proposed design decisions (for `docs/design/DECISIONS.md`)

- **D18 (proposed): M09 stays in the hatch's night scheme.** Decision #4 gives the hatch the dark surface; the naming is the end of that moment. M13 takes the clock scheme back with `motion-scheme`.
- **D19 (proposed): naming can't be skipped in Phase 1.** Nothing after M09 can add a name, and a nameless partner on Home would show the species name, which is the thing the ceremony exists to separate (§2.2). Boot must return a quitter to M09 (`08-handoff.md` B2).
- **D20 (proposed): keyboard-up forces the compact shell.** SE leaves 139 pt for the control row; a keyboard can't share the screen with it. The on-screen "Use this name" is the confirm while typing.

## Scores against §0C

| §0C row | Score /10 | Evidence | Gap |
|---|---:|---|---|
| Delight and Fun | 7 | The Baby stays on screen in the hatch pose; the name appears on a station sign under it; a head tilt answers a pause | 2D tilt on a still is a stand-in for the `attention` clip; no species sound yet |
| Visuals and Graphics | 8 | Night continuity from the hatch; signage plate reused from M07 (one visual system for names); one orange face | — |
| Interaction | 8 | One field, live plate, confirm above the keyboard, trackpad hold when the keyboard is down | Compact-shell switch on keyboard must be smooth on SE (device check) |
| Inclusivity | 8 | Same kind error timing as M07; no reaction to errors; scrimmed text over art; no pronoun | Baby still pivot for the tilt needs per-asset authoring |

## Heuristics

**H1.** The plate shows the name exactly as it will appear; "Name saved" confirms.

**H3 User control.** Clear button; errors keep the text; back is disabled (the hatch can't be un-done, and back would re-enter M12's `already-hatched` path for nothing).

**H5 Error prevention.** `maxLength={16}`, letters-only rule stated in the error, honest "no renaming yet" hint before commit.

**H9 Recover from errors.** Each rule has its own message; the filter message admits it can be wrong.

## Blockers

1. `MonStillReaction` (missing primitive) and per-still pivots (lookdev).
2. Mon-store action `nameActiveMon` (missing) and a server seam for the nickname: §1.4 has no endpoint that accepts it (`08-handoff.md` B3).
3. Boot step for a hatched Mon with `nickname === null` (`08-handoff.md` B2).
4. Schema: `MonInstanceSchema.nickname` (and `EggRecordSchema` / `CreateEggRequestSchema`) allow 64 characters; the rule is 16 (`08-handoff.md` B5).
5. M12's handoff (not yet written) must route `hatched` → M09, not M13.

## Copy lint

`deslop.py --text` over every M09 String cell, 2026-10-08: **5/5 CLEAN** (110 words). Rival-model cleanse not run.
