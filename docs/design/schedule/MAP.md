# Schedule feature map

Read-only survey of `packages/app/features/schedule` and the routes that mount it, taken on `main` at `8325c2a` (2026-10-04). Nothing in the repo was changed. Paths are repo-relative; `file:N` is a line number.

`docs/REPO_MAP.md:88` already classifies the feature as starter code: "Solito feature screens from the starter ... Nothing NYC-MON-specific." This map confirms that. The domain is a lesson studio (instructors, lessons, bookings), and every row comes from fixtures.

## 1. What it does today

### Screens

| Surface | Route | What renders |
|---|---|---|
| Mobile split view | `/split`, drawer item "Schedule" (`apps/mobile/components/DrawerContent.tsx:18`) | Three panes: sidebar (Instructors list + Appearance theme switch), supplementary ("Studio": MiniCalendar, staff search, swipe-to-hide rows), detail (`ScheduleScreen`), plus an inspector that opens when an event is selected. `apps/mobile/app/(drawer)/split/_layout.tsx`, `split/index.tsx` |
| Mobile booking sheet | Root overlay, not a route | `BookingSheet` mounted in `apps/mobile/app/_layout.tsx:43`, opened by the "New booking" button through `useScheduleStore.openBooking` |
| Web page | `/schedule`, top nav item "Schedule" (`apps/web/components/site/nav.ts:8`) | `ScheduleScreen` alone, no split panes, no booking sheet. `apps/web/app/(site)/schedule/page.tsx` |

`ScheduleScreen` (`screen.tsx:19`) picks one of two bodies by window size class (`Schedule.tsx:76-80`):

- **Wide (not compact): resource day grid.** One column per instructor, 8 AM to 8 PM, sticky header with avatar and accent dot, hour gutter, live "now" rule, overlapping events split into lanes (`ScheduleGrid.tsx`). A Day/Week segmented control switches to week view: seven day columns for the first visible instructor (`columns.ts:37-65`).
- **Compact (phone): booking surface.** A Sunday-first week strip, a list of 30-minute slots for the first instructor, and a "Book appointment" button (`BookingSurface.tsx`).

### Interactions

| Interaction | Where | Platform | What happens |
|---|---|---|---|
| Tap an event | `EventBlock.tsx:42` | all | `selectEvent(id)`; on `/split` the inspector opens with title, time range, instructor, kind badge (`_layout.tsx:368-381`) |
| Drag an event vertically | `event-drag.native.tsx:47-73` | iOS/Android | Pan follows the finger on the UI thread, snaps to 15 min on release with a spring, writes the store once via `scheduleOnRN` |
| Arrow Up/Down on a focused event | `EventBlock.tsx:45-50` | web (keyboard) | Nudges by 15 min. Web mounts no gesture (`event-drag.web.tsx:19-25`) |
| Reschedule policy | `reschedule.ts:34-84` | shared | Snap to quarter hour, clamp inside 8-20, keep duration, pin over-long events to day start. Moves are stored as overrides keyed by id and layered over fixtures at read time (`reschedule.ts:108-115`) |
| Day/Week toggle | `Schedule.tsx:63` | all | Week view is one instructor across seven days |
| Pick a date in MiniCalendar | `_layout.tsx:254-260` | mobile split | Writes `selectedDate` / `visibleMonth`. The grid does not read either (see Known bugs) |
| Search staff | `_layout.tsx:266-270` | mobile split | Debounced filter of the Studio list |
| Swipe a staff row | `_layout.tsx:290-304` | mobile split | Toggles the instructor out of `resourceFilter`, which hides their grid column |
| Event menu (Duplicate, Reschedule, Delete) | `_layout.tsx:50-56, 171-180, 397-412` | mobile split | All three work. Duplicate calls `duplicateEvent` — a `createdEvents` copy with a new id and a " (copy)" title, then selects the copy. Reschedule calls `openReschedule`, reopening `BookingSheet` prefilled; submit writes a `moveEvent` override (start/end/resource only — duration, title and kind are preserved). Delete removes the event and its calendar/notification integrations |
| Event actions on compact | `_layout.tsx:205-215, 450-459` | mobile split | Whenever the inspector cannot be on screen (compact always, medium width, a hidden-inspector override), an "Event actions" button in the screen header opens `EventActionsSheet`, which runs the same three actions |
| New booking | `BookingForm.tsx` in `BookingSheet` | mobile | Title (required), instructor chips, available start-time chips grouped Morning/Afternoon, rich-text notes, Cancel / Create |
| Notes with images | `NotesEditor.tsx`, `pick-note-image.*` | all | `react-native-enriched-html` editor (Fabric native, Tiptap web). Toolbar comes from `features/editor` and supports image, file, link/YouTube, audio recording, undo/redo. Images come from `expo-image-picker` on native and a hidden `<input type=file>` on web. Audio links render as `AudioPlayer`s under the field |
| Compact slot booking | `BookingSurface.tsx:92-125` | phone | Selecting a slot stores its ISO time in `selectedEventId`; "Book appointment" calls `onBook`, which selects the slot again (`screen.tsx:23-27`). No booking is created |

## 2. Files and responsibilities

All under `packages/app/features/schedule/` unless noted. 28 files, 2,837 lines.

| File | Lines | Responsibility |
|---|---|---|
| `screen.tsx` | 38 | `ScheduleScreen`, the Solito entry. Binds `DEMO_DAY` and `useNow()`, maps `onBook` to `selectEvent` |
| `Schedule.tsx` | 83 | Header (title, Day/Week, New booking), loading/empty states, compact vs wide switch |
| `ScheduleGrid.tsx` | 297 | Resource day/week grid: columns, sticky header, gutter, lanes, now rule, drag commit, keyboard nudge, measured column stretch |
| `EventBlock.tsx` | 105 | One event: tint + accent bar, selected state, a11y label, arrow-key nudge. Memoised with an explicit comparator |
| `event-drag.tsx` | 6 | TS resolution anchor; re-exports the web fork (comment explains why it must be `.tsx`) |
| `event-drag.native.tsx` | 95 | Gesture Handler pan + Reanimated shared value; one store write on release |
| `event-drag.web.tsx` | 30 | Positions the block, no gesture; defines `EventDragProps` |
| `reschedule.ts` | 116 | Pure snap/clamp policy, `EventOverride`, `applyOverrides`, `withRescheduledEvent` |
| `lanes.ts` | 107 | Greedy lane assignment, then transitive-overlap clusters share one lane count |
| `geometry.ts` | 115 | Pixel math: event rects, grid height, hour rules, now-rule offset, layout constants |
| `columns.ts` | 103 | Day view (per resource) vs week view (per day) columns, event-to-column keying, day filtering |
| `slots.ts` | 54 | Fixed-increment slots for one resource with availability against its events |
| `month.ts` | 60 | Six-week month matrix, month stepping, title format (date-fns) |
| `model.ts` | 108 | Types (`Resource`, `ScheduleEvent`, `ScheduleDay`), accents, `zonedMinutesOfDay` (Intl), `eventsOverlap` |
| `store.ts` | 59 | `useScheduleStore` (zustand), see section 3 |
| `fixtures.ts` | 88 | `buildDemoDay`, `DEMO_DAY`, `DEMO_RESOURCES` (5 instructors, DiceBear avatars), `DEMO_EVENTS`, `DEMO_NOW` |
| `format.ts` | 34 | Hour labels, time range and start-time formatting in the calendar zone |
| `use-now.ts` | 62 | Shared minute clock via `useSyncExternalStore`, SSR-safe snapshot |
| `accent-classes.ts` | 78 | Literal Tailwind class sets per accent (bar, tint, selected, dot) so the scanner emits them |
| `MiniCalendar.tsx` | 126 | Month grid with prev/next, today ring, selected chip, `role="grid"` semantics |
| `BookingSurface.tsx` | 129 | Compact week strip + slot list + Book button |
| `BookingForm.tsx` | 230 | New-booking form on TanStack Form (`useAppForm`) |
| `NotesEditor.tsx` | 215 | Uncontrolled rich-text editor, coalesced undo history, audio players |
| `pick-note-image.ts` | 2 | Resolution anchor, re-exports web |
| `pick-note-image.native.ts` | 25 | `expo-image-picker` with permission request; returns uri + size or null |
| `pick-note-image.web.ts` | 38 | File input + `Image` to read natural size; leaves the object URL to the editor |
| `index.ts` | 41 | Barrel for the feature (the app barrel `packages/app/index.ts:9-16` re-exports a subset) |
| `schedule.test.ts` | 393 | `node:test` suite, see section 7 |

Outside the feature:

| File | Role |
|---|---|
| `apps/mobile/app/(drawer)/split/_layout.tsx` (411) | Split view shell: header with pane toggles, sidebar, Studio pane, inspector, compact actions sheet |
| `apps/mobile/app/(drawer)/split/index.tsx` (9) | Detail pane: `<ScheduleScreen onNewBooking={openBooking} fill />` |
| `apps/mobile/app/(drawer)/_layout.tsx:39` | Registers `split` with `headerShown: false` |
| `apps/mobile/components/BookingSheet.tsx` (28) | Kit `BottomSheet` hosting `BookingForm`; routes to `/editor-settings` |
| `apps/mobile/components/EventActionsSheet.tsx` | Compact event actions sheet |
| `apps/mobile/components/DrawerContent.tsx:18` | Drawer entry "Schedule" -> `/split` |
| `apps/web/app/(site)/schedule/page.tsx` (8) | Web route wrapper |
| `apps/web/components/site/nav.ts:8` | Web nav entry |
| `packages/theme/contrast.ts:184,199-201,249,257-260` | Contrast registry rows that cite schedule files |

## 3. Data model and store

### Model (`model.ts`)

- `Resource { id, name, avatarUrl?, accent }`. `accent` is one of `ember | gold | forest | sky | rose` (`model.ts:18`). Colour belongs to the resource, never the event (`model.ts:68-77`).
- `ScheduleEvent { id, resourceId, title, start: Date, end: Date, kind: 'lesson' | 'block' | 'break' }`. Start and end are instants; wall-clock placement goes through `zonedMinutesOfDay` (Intl, DST-aware, `model.ts:89-103`).
- `ScheduleDay { dayStart, timeZone, startHour, endHour, resources, events }`. One day, one IANA zone. `dayStart` is expected from the data layer because wall-clock to instant is ambiguous across DST (`model.ts:48-56`).
- Overlap is half-open: touching events do not collide (`model.ts:106`).
- `EventOverride { start, end, resourceId }` lives in `reschedule.ts:95-99`.

### Store (`store.ts`)

One global zustand store, `useScheduleStore`, created with plain `create()`. **No MMKV, no `persist` middleware.** Every move, filter and selection is lost on reload. (MMKV in this repo lives in `features/editor/preferences.store.native.ts` per `docs/REPO_MAP.md:88`, and the split view's pane overrides persist per the comment at `_layout.tsx:160-164`; the schedule store does not.)

| Field | Purpose | Written by | Read by |
|---|---|---|---|
| `view` | `'day' \| 'week'` | `Schedule.tsx:63` | `Schedule`, `ScheduleGrid` |
| `resourceFilter` | ids to show, empty = all | swipe in `_layout.tsx:120-131` | `ScheduleGrid`, `_layout` |
| `selectedEventId` | event id **or** slot ISO string | `EventBlock`, `BookingSurface:95`, `BookingForm:67`, `screen.tsx:26` | grid, slot list, inspector |
| `hourHeight` | px per hour, steps `[48, 64, 88, 120]` | nothing (no zoom UI) | `ScheduleGrid` |
| `selectedDate` | ISO date | `BookingSurface:58`, MiniCalendar in `_layout.tsx:258` | `BookingSurface`, `_layout` only |
| `visibleMonth` | ISO month | MiniCalendar | `_layout` |
| `overrides` | moved events keyed by id | `moveEvent` from grid and the reschedule-mode form | `ScheduleGrid`, `_layout` selection lookup and `BookingForm` via `applyOverrides` |
| `bookingOpen` | sheet presented | `openBooking`/`openReschedule`/`closeBooking` | `BookingSheet` |
| `rescheduleEventId` | event the sheet reschedules; null = new booking | `openReschedule`, cleared by `openBooking`/`closeBooking` | `BookingSheet` (title + form remount), `BookingForm` (prefill, `moveEvent` submit) |

Unused actions: `setHourHeight`, `clearMoves`. The `loading` prop on `Schedule` is never passed, so `LoadingSkeleton` never shows.

Per-instance stores in refs (repo rule "no useState"): grid width (`ScheduleGrid.tsx:269-280`), editor history/selection (`NotesEditor.tsx:49-69`), split sidebar/sheet disclosure (`_layout.tsx:59-76`). Form state is TanStack's store (`BookingForm.tsx:49`).

## 4. Kit components vs raw elements

No raw HTML anywhere in the feature. Layout primitives are the kit's styled RN wrappers from `@acme/ui/tw` (`View`, `Text`, `Pressable`, `ScrollView`).

| From the kit (`@acme/ui`, `@acme/ui/primitives`, `@acme/ui/icons`) | Hand-built in the feature from `tw` primitives | Third-party, used directly |
|---|---|---|
| `Button`, `Container`, `EmptyState`, `LoadingSkeleton`, `SegmentedControl`, `useSizeClass` (Schedule) | Event blocks (`EventBlock.tsx`) | `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets` (`event-drag.native.tsx`) |
| `Avatar` (grid header, form chips) | Grid, gutter, rules, now line (`ScheduleGrid.tsx`) | `react-native-enriched-html` `EnrichedTextInput` (`NotesEditor.tsx:175`) |
| `IconButton`, `ChevronLeft/Right` (MiniCalendar) | Instructor and time chips (`BookingForm.tsx:122-197`) | `expo-image-picker` |
| `useAppForm`, `useFormStore`, `notify`, `Section` (BookingForm) | Week strip and slot rows (`BookingSurface.tsx:50-118`) | `date-fns` (`month.ts`, `fixtures.ts`) |
| `AudioPlayer`, `Section`, `palette` from `@acme/theme` (NotesEditor) | Calendar cells (`MiniCalendar.tsx:82-122`) | |
| `EditorToolbar` and history from `features/editor` (sibling feature) | | |

Split shell uses kit `Avatar`, `Badge`, `BrandWordmark`, `EmptyState`, `KeyboardAwareScroll`, `Menu`, `SafeArea`, `SegmentedControl`, `Header`, plus app-local `split-view` components (`PaneToggle`, `PaneSearchBar`, `SwipeableRow`, `PaneListHeader`, `DetailNavbar`, `SidebarSection`). `IconButton` is imported at `_layout.tsx:20` and unused.

Chips, slot rows and calendar cells repeat the same "black-on-yellow selected" pattern in three places with no shared `Chip`/`ToggleChip` kit component. `NotesEditor` uses hard-coded `palette` style objects (`NotesEditor.tsx:186-202`), so the field stays white with ink text in dark mode by design.

## 5. Platform forks

| Fork | Native | Web | Anchor |
|---|---|---|---|
| `event-drag` | Pan gesture + Reanimated spring | Static positioned `View`, keyboard nudge only | `event-drag.tsx` re-exports `.web`; must be `.tsx` or Metro ships the web build to device (`event-drag.tsx:3-5`) |
| `pick-note-image` | `expo-image-picker` | `<input type=file>` + `Image` size probe | `pick-note-image.ts` re-exports `.web` |
| `NotesEditor` | Fabric editor | Tiptap | Forked inside `react-native-enriched-html`'s exports map, not in this repo |
| Size class | Same code | Same code | `Schedule.tsx:76` swaps grid vs booking surface by window width, not pane width |

The split view itself forks per platform under `apps/mobile/src/navigation/split-view/` (e.g. `index.ios.tsx`, `AdaptiveSplitView.tsx`). Web has no split view and no booking sheet.

## 6. Routes and navigation entry points

- **Mobile:** drawer item "Schedule" -> `/split` (`DrawerContent.tsx:18`). The drawer header is hidden for this route (`(drawer)/_layout.tsx:39`); `_layout.tsx:151-166` draws its own night header with `MenuButton`, wordmark, title "Schedule" and three `PaneToggle`s (primary, supplementary, inspector).
- **Split panes:** primary = sidebar column (`_layout.tsx:169-228`), supplementary = Studio column (`230-336`), detail = the router child `split/index.tsx`, inspector = `SplitView.Inspector` shown while `selectedEvent != null` (`168`, `338-393`). The primary pane drops to an icon rail at medium width (`116`, `171-185`). At compact width only the detail pane shows.
- **"Today" button** in the sidebar is `<Link href="/split">` to the current route (`_layout.tsx:174`). It does not reset `selectedDate`.
- **Booking sheet** is global, mounted at the app root (`apps/mobile/app/_layout.tsx:43`), and links out to `/editor-settings` (`BookingSheet.tsx:21-24`).
- **Web:** nav item "Schedule" -> `/schedule` (`nav.ts:8`), renders `ScheduleScreen` with no `onNewBooking`, so "New booking" falls back to `selectEvent(null)` (`screen.tsx:34`) and does nothing visible.

## 7. Tests and coverage

`schedule.test.ts` runs on `node:test` via `packages/app` `"test": "node --test '**/*.test.ts'"`. Ran it read-only on 2026-10-04: **33 tests, 9 suites, 33 pass, 0 fail** (~0.8 s).

| Suite | Covers |
|---|---|
| `zonedMinutesOfDay` (3) | zone vs host, DST shift, midnight = 0 |
| `eventsOverlap` (1) | touching is not overlap |
| `assignLanes` (6) | sequential, concurrent, spanning cluster, disjoint clusters, empty, order independence |
| `geometry` (5) | 9 AM offset, min-height clamp, lane width, inclusive rules, now rule hidden out of range |
| `slotsForResource` (3) | fixed increments, availability, other resources ignored |
| `rescheduleByOffset` (7) | snap, clamp at both ends keeps duration, over-long pin, resource reassignment, no mutation, re-lane after move |
| `applyOverrides` (3) | layering, no-op, keeps title/kind |
| `monthMatrix` (3) | six weeks, Sunday start with real padding dates, in-month flags |
| `addMonths` (2) | 31-day clamp, year crossing |

Not covered: `columns.ts` (week view keying, `eventsForView`), `format.ts`, `use-now.ts`, the store, every component, both platform forks, `BookingForm` submit, `NotesEditor` history, the split layout. No component or e2e tests exist for the feature. The resource-reassignment test exercises a code path the UI never calls (see bug 6).

## 8. Fixtures vs real data

Everything is fixture data. There is no query, API, Payload collection or Supabase table behind any of it.

- `DEMO_DAY = buildDemoDay()` is built once at module load from the host clock (`fixtures.ts:83`), so it goes stale if the app stays open past midnight.
- `DEMO_RESOURCES`: Maya Rodriguez, Daniel Okafor, Priya Raman, Kenji Watanabe, Elena Fischer, with pinned DiceBear avatar URLs (`fixtures.ts:47-55`). Elena has no events (the empty-column case).
- 10 events across four instructors, chosen to exercise layout edge cases (`fixtures.ts:57-80`).
- Hard-wired imports of fixtures outside `screen.tsx`: `BookingForm.tsx:5` (instructors, slots, zone), and `_layout.tsx:23-31, 87, 122-138, 257, 372` (roster, selected event lookup, today, zone). Swapping in real data means touching all three, not just `screen.tsx` as its comment suggests (`screen.tsx:9-10`).
- Comments still describe an earlier roster: "Ada", "Grace", "Alan", "Katherine", "Edsger" (`fixtures.ts:59-78`), with event ids `a1`, `g1`, `t1`, `k1` to match.
- `BookingForm.tsx:58-59` says "Swap for a mutation when Payload lands." Whether NYC-MON has a Payload backend is not stated in the docs read for this map.

## 9. Accessibility state

### Contrast (760ba4e, "fix(a11y): clear the 10 failing contrast pairs at the class level")

Two schedule files changed:

- `MiniCalendar.tsx:111` out-of-month days: `text-muted/50` -> `text-muted`. Registry row "out-of-month day" (`packages/theme/contrast.ts:199`).
- `BookingSurface.tsx:74` past days: `text-muted/50` -> `text-muted`. Registry row "past day" (`contrast.ts:200`).

Both stay pressable, so they are held to text contrast, not exempted as disabled. Other registry rows citing the feature: muted text on surface (`contrast.ts:184`, `BookingSurface.tsx:63`), unavailable slot `text-muted/60` on `surface-sunken` with role `disabled` (`contrast.ts:201`, exempt because `accessibilityState.disabled` is set at `BookingSurface.tsx:96`), white on the ember selected block (`contrast.ts:249`, cites `accent-classes.ts:43`), and white on gold/forest/sky/rose-700 selected blocks (`contrast.ts:257-260`). The same commit reports 228 rows, 0 fail, in `docs/design/CONTRAST.md`. Event titles use `text-text` rather than the accent hue for the reason given at `accent-classes.ts:16-20`.

### Semantics and input

| Area | State |
|---|---|
| Event blocks | `accessibilityLabel` = title + time range, `accessibilityState.selected` (`EventBlock.tsx:43-44`) |
| Reschedule without a pointer | Web: Arrow Up/Down on a focused block. Native: drag only. No `accessibilityActions` (e.g. "move 15 minutes later"), so VoiceOver/TalkBack users cannot reschedule. Nothing on screen tells web users the arrow keys exist |
| MiniCalendar | `role="grid"/"row"/"columnheader"/"cell"`, per-day `accessibilityLabel` via `toDateString()`, selected state, labelled month buttons |
| Booking week strip | Day buttons have `selected` state but no `accessibilityLabel`; a reader hears the initial and the number as separate text ("T", "16") with no month or weekday name |
| Slot rows | Disabled state set; label is the visible time range |
| Form chips | `selected` state; time chips have explicit labels; `py-3` clears 44 dp (`BookingForm.tsx:184-186`) |
| Touch targets | Week strip day cells are `h-9 w-9` (36 dp, `BookingSurface.tsx:65`); calendar day squares are `h-7 w-7` (28 dp) inside a `flex-1` cell, so the pressable height is about 32 dp (`MiniCalendar.tsx:89-97`). Both are below 44 dp |
| Short events | 15-min "Check-in" is clamped to 24 px tall with one line of text (`geometry.ts:31`); a 24 px drag target |
| Hidden staff rows | Shown with `opacity-40` plus a "Hidden" text label (`_layout.tsx:307-322`), so state is not colour/opacity alone |
| Event actions trigger | A non-pressable `View` with `aria-label` inside `Menu` (`_layout.tsx:401-411`); whether the label reaches the native menu's own Pressable was not verified. Where the inspector can't open, a labelled "Event actions" `Pressable` in the screen header opens the sheet (`_layout.tsx:205-215`) |

No on-device screen-reader pass was run for this map.

## 10. Known bugs

Found by reading code; none were reproduced on a device for this map.

1. **New bookings never appear.** `BookingForm` stores the booking as an override keyed `booking-<iso>` (`BookingForm.tsx:62-66`), but `applyOverrides` only maps over existing fixture events (`reschedule.ts:112-115`), so an id with no source event is dropped. The toast still says "Booking created" (`BookingForm.tsx:71`). False success.
2. **Submitting without a time does nothing and says nothing.** With no slot chosen, `onSubmit` skips the booking and closes the sheet (`BookingForm.tsx:60-76`). Only the title has a validator.
3. **Picking a date changes nothing in the grid.** MiniCalendar writes `selectedDate` (`_layout.tsx:258`), but `ScheduleScreen` always renders `DEMO_DAY` and `ScheduleGrid` never reads `selectedDate`. The header keeps saying "Today's Schedule" (`Schedule.tsx:58`).
4. **Compact day strip is cosmetic.** Selecting a day highlights it, but slots always come from `day.dayStart` and `day.events` (`BookingSurface.tsx:37-43`). A date picked in MiniCalendar is stored at local midnight while strip days carry 8:00, so the ISO compare at `BookingSurface.tsx:53` never matches and no day appears selected.
5. **Slot selection reuses `selectedEventId`.** Slot ISO strings go into the event-id field (`screen.tsx:26`, `BookingSurface.tsx:95`, `BookingForm.tsx:67`). The inspector lookup by id fails for these, so it stays closed, and "Book appointment" on a phone only re-selects the slot.
6. **Drag is vertical only.** `rescheduleByOffset` accepts `resourceId` for cross-column moves, and a test covers it (`schedule.test.ts:279`), but `ScheduleGrid.tsx:139-150` never passes it and the pan has no X handling.
7. ~~Event actions are stubs.~~ **Fixed.** Duplicate, Reschedule and Delete all act: `runEventAction` (`_layout.tsx:171-180`) backs both the inspector's anchored `Menu` and the compact `EventActionsSheet`. Duplicate goes through a new `duplicateEvent` store action that persists a "(copy)" event and selects it. Reschedule reopens the booking sheet via `openReschedule`; `BookingForm` enters a reschedule mode (Mon + time chips only) that writes a `moveEvent` override, preserving id, title, kind and duration. On compact — and anywhere else the inspector can't open — an "Event actions" header button calls `setActionsOpen(true)`.
8. **Moves and filters do not survive reload.** The store has no persistence (section 3), and `clearMoves` has no UI, so there is no undo for a drag either.
9. **Web "New booking" is dead.** No `onNewBooking` is passed on `/schedule`, so the button calls `selectEvent(null)` (`screen.tsx:34`). Web has no booking sheet.
10. **Fixture times assume the host is in New York.** `buildDemoDay` sets 8:00 with `startOfDay` in the host zone (`fixtures.ts:25`), but the grid draws in `America/New_York`. On a device in another zone the events shift on the grid and can fall outside 8-20.
11. **Week view is thin.** Fixtures hold one day, so six of seven columns are empty. The focused instructor is whoever is first in the filter, with no picker. `weekStart` uses host `getDay()` (`columns.ts:33-35`) while columns key by calendar-zone day.
12. **Dead references.** `ScheduleGrid.tsx:45` and `BookingSurface.tsx:26` point to a `README.md` that does not exist in the feature folder. Fixture comments name a roster that no longer exists (section 8). `IconButton` import unused (`_layout.tsx:20`).
13. **No zoom.** `HOUR_HEIGHT_STEPS` and `setHourHeight` exist; no control calls them.
14. **Loading state unreachable.** `loading` is never passed to `Schedule`.

### Heuristic notes (UX)

Verdict: several issues to address.

**H1: Visibility of system status**
- "Booking created" toast fires for a booking that never renders (bug 1).
- Date selection gives a highlight with no change to the data (bugs 3, 4).

**H3: User control and freedom**
- A drag has no undo and no reset; `clearMoves` is unwired.
- Cancel in the booking form is present and labelled (`BookingForm.tsx:219-222`).

**H5: Error prevention**
- The form lets you submit with no time and closes silently (bug 2).

**H6: Recognition rather than recall**
- Time chips state duration once ("30 min each") and group Morning/Afternoon, which works.
- Web keyboard rescheduling is invisible; nothing on screen mentions the arrow keys.

**H2: Match with the real world**
- Every label is lesson-studio language: "Instructors", "Studio", "lesson", "Theory I", "Book appointment". None of it is NYC-MON vocabulary (the copy deck's glossary, `docs/COPY_DECK.md:17-30, 80`).

## Priority actions (if the feature stays)
1. Make the date controls drive the data, or remove them.
2. Make a created booking render, or stop claiming it was created.
3. Give screen-reader users a non-drag way to move an event.

## 11. Where could this fit in NYC-MON?

Options only. No recommendation is made here. Canon references are limited to what the repo's docs already say; nothing below adds lore.

What the docs establish that touches scheduling:
- The player's role is **Caller** in every UI string (`docs/COPY_DECK.md:19`).
- Canon includes "care data" for Mon (`docs/canon/DECISIONS.md:11`, citing `NYC_Mon_Master_Bible_v11.md`).
- The **H-Lynk** is the in-world device whose chrome the UI wears (Decisions #8 and #16, cited in `docs/DESIGN_SYSTEM.md:5`).
- `docs/REPO_MAP.md:282` lists kit parts the H-Lynk still lacks, including `StreakCalendar`, `CareMeterRing`, `IncubationRing` and `HatchCountdown`.
- A string `m11.status.schedule_failed` exists (`docs/COPY_DECK.md:306`, from M06). From its neighbours it reads as notification scheduling, not this feature; not confirmed.

I found no canon for city events or meetups in the docs read for this map.

| Option | What would carry over | What would not | Open dependency |
|---|---|---|---|
| **A. Caller care schedule** (feeding, rest, play routines for a Mon) | Time grid, lanes, drag-to-reschedule policy, slots, `use-now`, zone handling, notes editor for care notes | Resource-major columns (one Mon per column only if a Caller has several), instructor roster, booking form, studio copy | What canon's care data actually specifies: fixed times, windows, or meters with no clock |
| **B. H-Lynk calendar** (a calendar view inside the device chrome) | `MiniCalendar` and `month.ts` as a base for the missing `StreakCalendar`; `use-now`; contrast-registered cells | The resource grid, split-view panes and booking sheet are tablet/desktop patterns; the H-Lynk is a handheld frame | What the H-Lynk calendar shows (streaks, hatch dates, care) and whether it needs dates at all |
| **C. Events in the city** (dated happenings at NYC places) | Day/week grid with columns re-keyed to places or boroughs, slot math, booking form shape as RSVP | Instructors, lessons; drag-to-reschedule makes no sense for public events | No canon found; would need a decision first |
| **D. Keep as a starter reference only** (not shipped) | Code stays for the pure modules and tests | Drawer and web nav entries come out | Whether starter demos stay mounted while M01-M07 screens land |
| **E. Remove the feature** | Nothing; pure modules could be salvaged into a later feature from git history | Everything, including `/split` demo, `BookingSheet` at app root, web `/schedule`, nav entries, 9 contrast rows, the app barrel exports | Split view, `features/editor` and `EventActionsSheet` also have other potential users; check before deleting |

Shared cost for A, B or C: every option needs real data in place of `DEMO_DAY` across three files (section 8), a persisted store, and the bugs in section 10 that touch the parts kept.

## 12. Open questions

1. Which option in section 11, if any? Is a care schedule part of canon, or only care meters?
2. Should `/split` stay as the adaptive split-view showcase even if the schedule content goes? The split view is generic (`_layout.tsx:40-43`) and the schedule is its only tenant.
3. Is there a planned backend (the code assumes "Payload", `BookingForm.tsx:58-59`), or will NYC-MON data live elsewhere?
4. Should schedule state persist (MMKV) the way editor preferences and pane overrides do?
5. Does `m11.status.schedule_failed` refer to notification scheduling (as it seems) or to this feature?
6. If anything stays, does web need parity (booking sheet, split panes), or is web `/schedule` dropped with the other starter pages listed in `docs/REPO_MAP.md:65`?
7. Should the bugs in section 10 be fixed now while the feature is still mounted, or left until the decision?
