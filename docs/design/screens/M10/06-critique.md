# M10 Incubation choice: critique

Reviewed 2026-10-08 against `docs/phase-1-brief.md` §0C, the 10 usability heuristics and `product-decisions`. Inputs: `03-direction.md`, `04-components.md`, `05-copy.md`.

## Canon and spec conflicts resolved

| # | Brief / earlier spec says | Canon / later ruling says | Resolution |
|---|---|---|---|
| C1 | Flow M09 Naming → M10 (§4.2 order) | Decision #5: naming after the hatch | M10 follows M08 directly. The egg is created with `nickname: null`; M09 names the `MonInstance` after M12 (`screens/M09/06-critique.md`) |
| C2 | M10 "Case closes with the egg" | v11 calls it a "capture/containment case" and doesn't say the egg incubates inside (Q4); "Scanning is not recruitment" (`V11 ¶43`) | The case closes over the egg as the brief asks, drawn to `V11 ¶65`. Copy says "case", never "capture". Flagged on Q4 |
| C3 | "longer = nothing extra in Phase 1" | Q27 open: canon silent | `m10.body` states Phase 1 behaviour, tied to Q27 for a rewrite if Mike rules |
| C4 | M06 notification pre-permission sits in onboarding (§4.1) | P2 moves it after M10 | M06 sheet rises after the case has closed and the LED breathes; M06 B4 is unblocked by this handoff |
| C5 | Brief names `IncubationRing` as if it exists | Kit has none | Named as a missing primitive with a contract; not built here |

## Proposed design decisions (for `docs/design/DECISIONS.md`)

- **D16 (proposed): no default incubation length.** A preset reads as advice (D9/L1 reasoning).
- **D17 (proposed): one egg per Caller in Phase 1, enforced in the store action.** `startIncubation` returns the existing pending egg on a repeat call instead of creating another. Decision #18 (merged accounts keep two Mons) is a merge outcome, not a second egg choice.

## Scores against §0C

| §0C row | Score /10 | Evidence | Gap |
|---|---:|---|---|
| Delight and Fun | 7 | The case closing on the hinge and the LED starting its breath turn a timer form into a handover | Case is a flat vector until lookdev; no sound |
| Visuals and Graphics | 7 | Loop-line ring, one orange face, red kept for LED and pad | `EggCase` and egg cut-out art don't exist |
| Interaction | 8 | Three big stops, flick/step on the trackpad, one CTA, honest "Ready at" | Two missing primitives |
| Inclusivity | 8 | Radio semantics, no default, plain time, no countdown here, reduced-motion case cross-fade | Ring stop labels at XXL need the list fallback (`07-a11y.md`) |

## Heuristics

**H1 Visibility of system status.** "Ready at 4:45 PM" before commit; the LED and its chip after. The M06 sheet waits until the case has closed.

**H2 Match with the real world.** Clock time, not "in 30 minutes" maths. "Shorter" / "Longer" for step labels.

**H3 User control.** Back before confirm returns to M08 with the same egg focused; nothing was written.

**H5 Error prevention.** Disabled CTA until a stop is chosen; idempotent `startIncubation`; the re-entry guard sends a Caller with an egg to M11.

**H8 Minimalism.** One question, one honest sentence, one ring, one button.

## Product-decision checks

- Six states designed (default, loading = starting, error, empty = choose, success = confirmed, offline).
- No dead button: Start is disabled with a spoken reason until a stop exists.
- No pay-to-skip, no urgency, no "recommended" (brief, PERSONAS).

## Blockers

1. `IncubationRing` and `EggCase` (missing primitives) with stories (R3).
2. `startIncubation` store action and the egg-creation queue (`08-handoff.md` B3, B4).
3. Egg cut-out art for the ring centre (lookdev); the block stills have backgrounds.

## Copy lint

`deslop.py --text` over every M10 String cell, 2026-10-08: **5/5 CLEAN** (94 words). Rival-model cleanse not run.
