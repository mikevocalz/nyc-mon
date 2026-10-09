# M13 Home (Baby): critique

Scored against §0C (Apple Design Awards rows) and the 10 usability heuristics. Reviewer stance: lead of a shipped live-service creature game, plus creature animation, motion, accessibility and spatial interaction.

| §0C row | Score /10 | Evidence | Gap |
|---|---:|---|---|
| Delight and Fun | 7 | The body-language ask answered by one trackpad tap is the right core verb; idle vignettes keep the Mon alive | No authored ask vignette per species yet (Q31, Q44); without it the ask is a ring dip, which is a dashboard |
| Visuals and Graphics | 6 | One fill colour for rings, no HUD red, the Mon owns the frame | Placeholder webp art until models; the scene plate and time-of-day rig are not designed here |
| Interaction | 8 | Thumb-reach bar inside the screen bottom; trackpad tap answers the ask; every gesture has a labelled twin | `attention` intent missing (P3) |
| Inclusivity | 8 | Meter state in words, not colour; no numbers on screen but spoken percentages; reduced-motion siblings for every performance | Dynamic Type XXL in the ring captions needs a test on SE |

Heuristic findings: H1 (system status) is met by the chip; H2 met by "Asking for food" over "Fullness 22%"; H3 Wake is never one tap from Home (it routes to M15 where the cost is shown); H8 four buttons plus a trackpad is the ceiling.

## Product decisions (recorded)

| # | Decision | Disposition | Reason |
|---|---|---|---|
| H-1 | No care push notifications in Phase 1. The only notification is M23 (hatch ready, one per egg) | STRIKE | A pet-needs-you push is the textbook dark-pattern return trigger, and the audience includes under-13s. The return trigger is the Mon's greeting in-app. Can return only as an opt-in, quiet-hours-bound setting after a canon and product review |
| H-2 | Background-resumed shows the current state and a greeting, never an absence summary | BUILD | "Nothing is lost while you are away" (site `care.closing`) must hold on screen, not only on the website |
| H-3 | LED is dark when nothing is requested, including asleep | BUILD | The LED is a request light (§2.4). Kit doc wording change only |
| H-4 | The care bar labels the Social action "Play"; the meter stays "Social" | BUILD | The button names the Caller's action; the ring names the canon meter |
| H-5 | No level, no currency, no bond number on Home | STRIKE | Not canon (Q41, Q42, Q26); bond stays on `MonInstance` and off-screen until Q26 |

## Blockers

1. **Tuning (Q19–Q21).** With `DEFAULT_CARE_TUNING`, Fullness reaches the needs-you line 2 h after hatch, so needs-you is the default state on almost every open (`01-research.md`). Before M13 ships, `sim-core` and the lead pick Phase-1 numbers. Proposal for Mike (not canon): fullness awake decay about 1/24 per hour, and a return floor so no meter reads below the request line on the first frame after more than 8 h away (v7's "floor of 35" is the precedent, Q21). Without one of these, H-2 is undermined by arithmetic.
2. **P3** `attention` / `refuse` intents in the scene contract.
3. **P1** `CareMeterRing` with stories (`Content`, `Low`, `AllLow`, `Night`, `LargeText`, `ReducedMotion`).
4. **P2** `selectCareNow`.
