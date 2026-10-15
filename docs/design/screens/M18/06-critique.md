# M18 Journal / lineage: critique

| §0C row | Score /10 | Evidence | Gap |
|---|---:|---|---|
| Delight and Fun | 6 | Firsts in plain sentences make a small history; "days together" counts up only | Thin until more entry kinds exist (Phase 2 evolution) |
| Visuals and Graphics | 6 | Quiet dot grid, no heat scale | Needs Skia craft on dot rhythm and the month transition |
| Interaction | 8 | Tap a day to jump to its entries; month paging bounded by the hatch month | — |
| Inclusivity | 9 | Days spoken as dates with "together"; no colour-only meaning | — |

## Product decisions

| # | Decision | Disposition | Reason |
|---|---|---|---|
| J-1 | **Streaks are struck from M18.** No streak count, no longest streak, no chain between dots, no streak entry in the timeline. The brief's `StreakCalendar` becomes `DaysCalendar`, which counts days together cumulatively and never resets | STRIKE (deviation from brief §4.3 M18 and §3.4; lead to confirm) | The product's public care promise is "A low meter is a request. Nothing is lost while you are away." A streak makes absence cost something by design. v7's own absence proposals (Q21) protect returning players; under-13s are in the audience; product-decisions §4 bans streaks on obligations. A cumulative count keeps the "look how long we've been together" pleasure without loss |
| J-2 | The journal never logs needs-attention, food requests, sluggish, or declined actions | BUILD | A journal of when the Caller was away is a guilt ledger |
| J-3 | Missed past days render identically to future days | BUILD | The grid must not grade attendance |
| J-4 | The screen waits on `JournalEntrySchema` + save v2; until then it is not linked from the Menu | DEFER (missing primitive in `@acme/core`) | Without a log only "hatched" exists; a page that can never fill is a dead end. Nav row lands with the route and the log (no 404, product-decisions §2) |
| J-5 | "Lineage" in the route title waits for Phase 2 evolution entries; no lineage UI now | DEFER (Q43, Law 7) | Nothing to show without evolution |

## Blockers

1. `JournalEntrySchema`, save v1→v2 migration, append points in `applyCare` and naming (`sim-core`, `platform`).
2. `DaysCalendar` with stories (`DayOne`, `Populated`, `LongGap` — a 3-week gap that must look calm, `Night`, `LargeText`).
3. Lead sign-off on J-1, since it changes the brief's wording.
