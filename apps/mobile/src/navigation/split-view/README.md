# Split view (app binding) + Schedule Calendar

The split view itself is a kit component: `packages/ui/adaptive-panes`
(`@acme/ui/adaptive-panes`). Its README covers breakpoints, visibility policy,
foldables (hinge snapping, book/tabletop postures, trifold), the navigation
rail, Back behaviour and the platform forks. This folder only binds it to the
app:

| File | Role |
|---|---|
| `index.ios.tsx` | expo-router's native `SplitView` (UISplitViewController), plus the kit's pane chrome |
| `index.android.tsx`, `index.web.tsx`, `index.tsx` | the kit's adaptive `SplitView` via `AdaptiveSplitView.tsx` |
| `AdaptiveSplitView.tsx` | passes `<Slot />` as the detail, `router.canGoBack` for Android Back, and `paneControls={false}` |
| `pane-storage.ts` | persists pane overrides in MMKV (`split-view` / `pane-overrides`, unchanged from before the move) |
| `SwipeableRow.tsx`, `swipe-actions.ts` | swipe-to-reveal rows; stays here because it needs Gesture Handler and Worklets, which `@acme/ui` does not declare |

The call site is identical on every platform:

```tsx
import { SplitView } from '@/src/navigation/split-view';

<SplitView topColumnForCollapsing="primary" showInspector>
  <SplitView.Column>{/* sidebar */}</SplitView.Column>
  <SplitView.Column>{/* supplementary list */}</SplitView.Column>
  <SplitView.Inspector>{/* inspector */}</SplitView.Inspector>
</SplitView>
```

Fold geometry on Android comes from `apps/mobile/modules/reserved-regions`
(Expo Modules 2, Jetpack WindowManager `FoldingFeature`), autolinked through
`expo.autolinking.searchPaths` in `apps/mobile/package.json`.

## Schedule calendar

Lives in `packages/app/features/schedule` and knows nothing about the split
view — it reads the window size class exactly as it would if it were the only
thing on screen.

- **Resource-major.** Columns are resources; the date is fixed. That inverts the
  usual date-column calendar and is why the axis that grows is resources.
- **Times are instants + an explicit IANA zone.** Wall-clock placement goes
  through `Intl.DateTimeFormat` with `hourCycle: 'h23'`. No date library. The
  reverse direction (wall clock → instant) is deliberately *not* done in the UI;
  `ScheduleDay.dayStart` is supplied by the data layer, because that direction is
  ambiguous twice a year.
- **Overlap lanes are two-stage.** Greedy interval colouring assigns the lane;
  then events are grouped into transitively-connected clusters and every event in
  a cluster shares one `laneCount`. Sizing per-event instead would give two
  non-touching short events different widths under one long spanning event, and
  the blocks would not line up.
- **Accent belongs to the resource, never the event.** Accent classes are spelled
  out literally in `accent-classes.ts` because Tailwind scans source as text —
  `bg-${accent}-500` is never emitted.

### Compact fallback — decision

At compact the resource day grid is **replaced**, not squeezed, by the booking
surface: a one-week date strip over a vertical list of time slots with a
full-width primary action.

Rationale: several proportional-height columns on a phone gives each appointment
a few characters of width and turns reading the day into a horizontal-scroll
puzzle. The alternative considered was a single-resource agenda list. The booking
surface won because it matches the task a phone user actually has — pick a day,
pick a time — and it degrades to a genuinely useful screen rather than a worse
version of the grid.

### Known limits

- **One scroll per axis.** A horizontally-pinned time gutter *and* a vertically
  sticky resource header cannot coexist under a single pair of scroll views; one
  must be driven from the other's offset. That synchronization is a UI-thread
  Reanimated concern whose smoothness can only be judged on a device, so it was
  not shipped on an unmeasured guess. Today the resource header is sticky
  vertically and the gutter shares the body's vertical scroll by construction, so
  neither axis can drift; the gutter scrolls horizontally once resources overflow.
  Upgrade path: `useAnimatedRef` + `useScrollViewOffset` + `scrollTo` in a
  `useAnimatedReaction`, measured on device.
- **Resources are not virtualized.** Resource counts here are bounded (tens, not
  thousands), so a plain scroll container costs less than a windowing pass.
  `@legendapp/list` is the swap-in if a deployment exceeds ~50 columns.
  Note `@shopify/flash-list` is **not** installed; this repo standardises on
  `@legendapp/list`.
- **No frame-budget numbers.** The optimization gate requires measured before/after
  FPS or TTI. None were taken — no device was driven in this pass — so no
  performance claim is made here at all.
- **Pinch-to-zoom is not implemented.** Zoom is discrete via `HOUR_HEIGHT_STEPS`.
- **The divider's drag is unverified on a device.** The resize policy is pure
  and tested in the kit (`packages/ui/adaptive-panes/resize.ts`); the pan has
  never been driven by a finger.
