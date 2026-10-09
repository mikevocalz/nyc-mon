# M18 Journal / lineage: direction

Route `/(home)/journal`. Shell: none. Scheme: OS appearance (D8).

## The one move

A record of days together, never a record of days apart. The calendar marks a day with a dot when the Caller and the Mon did something together; every other day, past or future, is the same faint outline. Below it, a timeline of firsts and moments in plain sentences. The page counts "days together" upward and never counts a run.

## Layout (compact)

```
 │ ‹  Journal                       │
 │ {name} and you                    │ type-title
 │ 12 days together                  │ type-body; counts days with a dot, never consecutive days
 │ ┌ October 2026 ───────── ‹  › ┐  │ DaysCalendar, month view
 │ │ ·  ·  ●  ●  ·  ●  ·          │  │ ● day together, · any other day (past or future)
 │ │ ●  ◉  ·  ·  ·  ·  ·          │  │ ◉ today (ring)
 │ └──────────────────────────────┘  │
 │ Today                             │ section per day, newest first
 │  ▸ {name} played Peek with you    │ Timeline items
 │ 4 October 2026                    │
 │  ▸ {name} hatched                 │
 │  ▸ First meal                     │
```

| Breakpoint | Change |
|---|---|
| Compact | single column |
| Medium | `content-detail` centred; calendar and timeline stacked |
| Expanded / Quest 2D 1280×800 | two columns: calendar left (5/12, sticky), timeline right (7/12); selecting a day scrolls the timeline to it. Hover on day cells and items |

## States

| State | Content |
|---|---|
| empty-ish (day 1) | "1 day together"; today ringed with a dot; timeline holds "{name} hatched" and, if logged, "named {name}". No "start your streak", no locked placeholders for future entries |
| populated | calendar with dots; timeline grouped by day, firsts marked with a small "First" label |

Phase 2 evolution entries render as timeline items with the same component; nothing reserves space for them now.

## Type and colour

Title `type-title`; counts `type-body`; day headings `type-label` `text-muted`; items `type-body`. Calendar dots `structure`; other days `concrete-300` hairline outline at 1 pt (decorative: the day grid's meaning is carried by dots and the spoken label, see `07-a11y.md`). Today: 2 pt `focus` ring. No orange, no red, no heat scale.

## Motion

Month change: `motion-step` slide 24 pt; reduced: cross-fade. New entry since last visit: none (no "new!" pulses). Calendar draws instantly; Skia draws state, never owns it.

## No-list

- No streak count, no "longest streak", no flame, no broken-chain line between dots.
- No visual difference between a missed past day and a future day.
- No entry for needs-attention, food requests, or anything that records the Caller being away.
- No later form names, no evolution teasers.
