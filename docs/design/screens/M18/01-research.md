# M18 Journal / lineage: research

Route `/(home)/journal` · Shell: none · States: empty-ish (day 1) / populated · Spec: brief §4.3 M18 ("Timeline of real events (hatched, first meal, first nap, streaks) with Skia `StreakCalendar`. Evolution entries appear here in Phase 2."), §3.4; site care copy "A low meter is a request. Nothing is lost while you are away." (`apps/web/components/home/copy.ts` `care.closing`); OPEN_QUESTIONS Q21, Q43.

## Jobs

- **Sol (returning):** When I come back after weeks, I want to see our history still there, so the gap doesn't erase what we had.
- **Dani:** I want to look back at firsts: the day it hatched, its first meal.
- **Renée:** I don't want a calendar that shames my kid for skipped days.

## What exists (verified 2026-10-08)

- **No event log is persisted.** `SaveV1Schema` holds `caller`, `eggs`, `hatches`, `mons`, `care`, `queue` (`packages/core/schemas/save.ts`). `CareState` keeps only the latest `lastFedAt`, `lastRestedAt`, `lastSocialAt`; the write queue is drained after sync. "First meal" and "first nap" cannot be reconstructed from today's save.
- What can be shown today: `MonInstance.hatchedAt` (hatched). Naming has no timestamp.
- The sim already emits `CareEvent`s (`food-requested`, `needs-attention`, `woke`, `fell-asleep`, `became-sluggish`, `sluggish-ended`) and `CareOutcome`s from `applyCareAction`. A journal can be fed from those at the store's `applyCare`.
- No `StreakCalendar` component exists. `YearGrid` is a picker, not a calendar.

## The streaks conflict

The brief lists "streaks" as a journal event and names the component `StreakCalendar`. Against it:

- The site's public promise: "A low meter is a request. Nothing is lost while you are away."
- v7's absence proposals (Q21: vacation mode, sitter, return floor) all exist to stop absence from hurting; a streak is absence hurting by design.
- Product rule for anything a child sees: no streaks on obligations (product-decisions §4); under-13s are in this audience (ADR 0001).
- A broken streak is loss. The calendar would show the gap as a break in a chain.

Resolution is in `06-critique.md` (J-1).

## Risks

- **The calendar as a report card.** Empty days in a grid read as missed days unless they look exactly like days not yet lived.
- **Logging neglect.** `needs-attention` events exist in the sim; journaling them would turn the journal into a record of when the Caller was away.
- **Phase-2 leakage.** Evolution entries must not appear, and no entry may name a later form (Law 7, PS-029).

## Usability questions

1. On day 1, does the page feel like the start of something or like an empty screen?
2. After a 3-week gap, do returning players read the calendar as "our days together" or as "days I missed"?
3. Can players find a specific first (first meal) within 10 seconds?
