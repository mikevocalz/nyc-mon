# M18 Journal / lineage: components

| Element | Component | Source |
|---|---|---|
| Page | `Main` + `ScrollView` | kit |
| Back | `IconButton` | |
| Title, counts | `Heading level={1}`, `Text` | |
| Timeline | `Timeline` (`items`, `accessibilityLabel`; `animate={false}`, `dotAnim` off) | `packages/ui/elements/Timeline` |
| First label | `Badge` | `packages/ui/Badge.tsx` |

## New

### `DaysCalendar` (NEW, Skia; replaces the brief's `StreakCalendar` name)

The brief's §3.4 names `StreakCalendar`. Renamed because the component must not model a streak (J-1). Same role in §3.4.

```ts
export interface DaysCalendarProps {
  /** Month shown, as { year, month 1–12 } in the device time zone. */
  month: { year: number; month: number };
  /** ISO dates (YYYY-MM-DD) that have at least one journal entry. */
  daysTogether: ReadonlySet<string>;
  today: string;
  selected?: string;
  onSelectDay?: (isoDate: string) => void;
  onMonthChange: (direction: -1 | 1) => void;
  /** Earliest month reachable: the hatch month. */
  minMonth: { year: number; month: number };
  reducedMotion: boolean;
  testID?: string;
}
```

There is deliberately no `streak` or `run` prop, and no visual connection between adjacent dots. Native grid `accessibilityRole="grid"`; each day a button "October 5, together" or "October 6". Web: CSS grid of `<button>`s inside a `<table>`-free `role="grid"`, per `/ui/html` rules.

### `JournalEntrySchema` + save v2 (NEW, `@acme/core`)

Missing primitive; the journal cannot be built without it.

```ts
export const JournalEntrySchema = z.object({
  entryId: IdSchema,
  monInstanceId: IdSchema,
  at: EpochMsSchema,
  kind: z.enum(['hatched', 'named', 'fed', 'rested', 'played', 'woke-rested']),
  first: z.boolean(),             // first of its kind for this Mon
});
// SaveV2 = SaveV1 + { journal: JournalEntry[] }; migration v1→v2 seeds one 'hatched' entry per mon from MonInstance.hatchedAt.
```

- Appended inside the store's `applyCare` from the `CareOutcome` (`eaten`/`overfed` → `fed`, `fell-asleep` → `rested`, `played` → `played`) and from naming (`named`). `woke` with cause `rested` from `advanceCare` events becomes `woke-rested`.
- Never logged: `needs-attention`, `food-requested`, `became-sluggish`, declined outcomes.
- Bounded: keep every `first: true` entry, and compact non-first entries older than 90 days into one per day per kind (the calendar only needs "a day with an entry").
- Server: syncs with the care queue so the journal survives a device change (`V11 ¶93`: the same Mon on every surface). Server schema change belongs to `platform`.

Token diffs: none.
