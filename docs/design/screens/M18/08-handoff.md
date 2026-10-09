# M18 Journal / lineage: handoff

Inputs: `01`–`07` here; `packages/core/schemas/save.ts`; `packages/core/sim/care.ts`; `packages/app/features/mon/create-mon-store.ts`.

## Blockers

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | `JournalEntrySchema`, `SaveV2Schema` + migration (seed `hatched` from `MonInstance.hatchedAt`), append in `applyCare` and naming, server sync | `sim-core`, `platform` | the screen (J-4) |
| B2 | `DaysCalendar` (Skia via the `react-native-skia` alias; SVG/DOM on web) | kit | calendar |
| B3 | Lead sign-off on J-1 (streaks struck) | lead | copy and component name |

## Route

`/(home)/journal`. Entry: Menu key → Journal (Q42 keeps the screen name). Not linked until B1 lands. Shell: none.

## Data: exact calls

```ts
const mon = useMonStore(selectActiveMon);
const entries = useMonStore(selectJournal(mon.monInstanceId));     // NEW selector over save.journal (B1), sorted newest first, stable per save
const daysTogether = useMemo(() => new Set(entries.map(e => isoDateInZone(e.at))), [entries]);
const minMonth = monthOf(mon.hatchedAt);
```

- Device time zone for day boundaries (same rule as the time-of-day rig: device clock, §3.2).
- The screen writes nothing.

## States

| State | Condition | UI |
|---|---|---|
| empty-ish (day 1) | entries only on the hatch day | `m18.days.one`; calendar with today ringed and dotted; timeline: hatched (+ named) |
| populated | entries on more than one day | count, dots, grouped timeline |

Never empty: v2 migration seeds `hatched`, so a hatched Mon always has one entry. Before hatch the route is unreachable (Menu shows Journal only when `selectStage` is not `Egg`). Offline: unchanged. Corrupt journal (parse failure): M22's save-recovered path restores the last good snapshot.

## Layout

Compact: 16 pt gutter; heading `space.6` from top; count `space.2` below; calendar card `space.6` below (7 columns, 44 pt cells, `space.1` gaps); timeline `space.8` below calendar; day groups separated by `space.6`. Expanded/Quest 1280×800: calendar column 5/12 sticky, timeline 7/12, inside `content-screen`.

## Components and test IDs

| Element | testID |
|---|---|
| Back | `m18-back` |
| Heading | `m18-heading` |
| Count | `m18-days` |
| Calendar | `m18-calendar`, cells `m18-day-YYYY-MM-DD`, `m18-cal-prev`, `m18-cal-next` |
| Timeline | `m18-timeline`, items `m18-entry-{entryId}` |

## Motion

| Element | Trigger | Token | Reduced |
|---|---|---|---|
| Month | page | `motion-step` | cross-fade 120 ms |
| Day select | tap | scroll timeline, 300 ms | jump |

## Acceptance

- Fixture "3-week gap": the calendar's gap days are pixel-identical in style to future days (capture test).
- No string in the screen or the copy deck contains "streak".
- No entry kind outside `JournalEntrySchema.kind` renders.
