# SplitView / AdaptivePanes

The adaptive list-detail layout: up to three tiled panes (two columns plus the
detail) and an inspector drawer, laid out by window width class and, on a
foldable, by the hinge. `SplitView` and `AdaptivePanes` are the same component.

Ported from MoyoLearn's `packages/ui/adaptive-panes` (branch `dev`, through
`ab3307fc`, which already contains the trifold work from
`feat/android-foldable-windowmanager-v2`), rewired to `@acme/ui` and to the
dependencies this package declares.

```tsx
import { SplitView } from '@acme/ui/adaptive-panes';

<SplitView topColumnForCollapsing="primary" showInspector={selected != null} detail={<Detail />}>
  <SplitView.Column>{/* sidebar */}</SplitView.Column>
  <SplitView.Column>{/* list */}</SplitView.Column>
  <SplitView.Inspector>{/* inspector */}</SplitView.Inspector>
</SplitView>
```

## Platforms

| Platform | Renderer | Chosen in |
|---|---|---|
| iOS | expo-router's native `SplitView` (UISplitViewController) | `apps/mobile/src/navigation/split-view/index.ios.tsx` |
| Android | this package, bound to expo-router | `index.android.tsx` → `AdaptiveSplitView.tsx` |
| Web | this package | `index.web.tsx`, Storybook |

The call site is the same on all three. iOS re-exports expo-router's component
untouched because expo-router keeps a column only when
`child.type === SplitViewColumn`, and any wrapper would fail that check.

`@acme/ui` does not depend on expo-router, MMKV, Gesture Handler or Worklets.
The app supplies the router-bound pieces as props or configuration:

| Seam | Kit default | apps/mobile passes |
|---|---|---|
| `detail` | empty | `<Slot />` |
| `canGoBack` | `() => false` | `router.canGoBack` |
| pane override storage | in memory (native), `localStorage` (web) | MMKV `split-view` via `configurePaneOverrideStorage` |
| `paneControls` | `true` | `false`; the split layout mounts its own toggles |

## Breakpoints

Android's five window width classes, in dp. `useWindowDimensions()` already
reports dp on Android and points on iOS, so nothing here converts with
`PixelRatio`.

| Class | Min width |
|---|---|
| `compact` | 0 |
| `medium` | 600 |
| `expanded` | 840 |
| `large` | 1200 |
| `extraLarge` | 1600 |

The numbers live in `constants.ts` until `@acme/theme` carries them (see
Token debt). `../size-class.constants.ts` keeps a separate binary
`compact|regular` split at 768 dp for one-column vs two-column composition
inside a screen. The two answer different questions; do not merge them.

Before this port nyc-mon had four bands and called everything from 1200 up
`extraLarge`. The policy for that range is unchanged (`large` and `extraLarge`
share one row in each table below); only the name at 1200–1599 moved.

## Visibility policy

`columnCount` is the number of `SplitView.Column` children.

**Two-pane shape (1 column + detail)**

| Size class | primary | inspector | detail |
|---|---|---|---|
| extraLarge, large, expanded | full | yes | flex |
| medium | narrow rail | no | flex |
| compact | one pane at a time | no | one pane at a time |

**Three-pane shape (2 columns + detail)**

| Size class | primary | supplementary | inspector | detail |
|---|---|---|---|---|
| extraLarge, large | full | yes | yes | flex |
| expanded | narrow rail | yes | no | flex |
| medium | hidden | yes | no | flex |
| compact | one pane at a time | one pane at a time | no | one pane at a time |

Collapse follows the width class, never the device type: a folded foldable is a
phone, and a resized window is whatever width it is now.

The host keeps ONE tree at every width. Crossing a breakpoint only changes which
panes are open and how wide, so scroll position, drafts and selection survive a
fold, a rotation or a multi-window resize. A closed pane stays mounted and is
frozen (`pane-freeze.tsx`, inlined from react-freeze). Freezing stops renders,
not effects: content with its own render loop reads `usePaneOpen()` and stops
itself while its pane is shut.

Diagnostics: more than two `SplitView.Column` children throws, foreign children
warn, and zero children warn and render the detail alone.

`show(column)` on the host ref swaps the visible pane while collapsed. Expanded,
it changes nothing on screen but records the column, so the next collapse lands
there.

## Foldables

Width class decides WHICH panes may be visible. Fold geometry decides WHERE a
pane boundary lands.

### Where the geometry comes from

`useReservedRegions()` (`../reserved-regions.*`) returns window-relative regions
in dp:

- **Android**: the `ReservedRegions` Expo Modules 2 module in
  `apps/mobile/modules/reserved-regions`, which collects Jetpack WindowManager's
  `WindowInfoTracker.windowLayoutInfo(activity)` and reports every
  `FoldingFeature` as a `division` region with its `orientation`
  (`vertical`/`horizontal`), `state` (`flat`/`halfOpened`), `occlusionType`
  (`none`/`full`) and `isSeparating`.
- **iOS 27.1+**: UIKit `UIView.reservedRegions(kind:)` division and occlusion
  regions from the same module (iPhone Duo). UIKit has no change event, so the
  hook re-queries when the window size changes.
- **Web**: none, unless a `ReservedRegionsOverride` simulates some.

The hinge rectangle in window coordinates is the one input JS cannot derive
from width alone. WindowManager exposes no continuous hinge angle, so the type
has no angle field and nothing should synthesize one.

### What the panes do with it

`fold-layout.ts` is pure and `node --test`ed (`fold-layout.test.ts`).

1. **Snap to the hinge.** For a separating vertical fold, the pane boundary
   lands on the hinge. The planner first keeps primary + supplementary on the
   leading region with the detail on the trailing one; if both do not fit, it
   puts primary alone on the leading region. A fully occluding hinge (Surface
   Duo style) gets a spacer of its own width so no pane draws under it.
2. **Never straddle, never hide.** If no arrangement fits, the width-class
   layout stands. The fold layer never changes the visibility policy or picks
   which product pane to drop.
3. **Trifold.** With two or more separating vertical hinges and three panes,
   `resolveVerticalMultiFoldPanePlan` picks the hinge pair that puts primary,
   supplementary and detail one per physical panel. Every `FoldingFeature` is
   kept, never only the first.
4. **Postures.** `halfOpened` + horizontal is `tabletop`; `halfOpened` +
   vertical is `book`. The panes do not turn tabletop into a top/bottom split by
   themselves, because which content belongs above the crease is a decision
   for each screen. Tabletop does move Android navigation to the bottom bar
   (Navigation rail, below).
5. **Inspector.** It stays an overlay from the logical trailing edge (right in
   LTR, left in RTL), matching expo-router's `SplitView.Inspector`. On a
   separating vertical fold its width is capped to the trailing physical panel,
   so it cannot cover a hinge.

Coordinates: the native rectangles are window-relative, and a pane row can sit
beside a rail or inside an offset container. The host measures its row with
`measureInWindow` and converts every fold to row-local x. Until the origin is
known, no fold applies. Folds wholly outside the row are ignored
(`foldLayoutsIntersectingRow`).

### Native module lifecycle

The Flow is collected only while a JS listener exists (the Modules 2 event's
`onStartObserving` / `onStopObserving`), is cancelled on host pause and
destroy, and is re-bound to the new Activity when `query()` runs after a
configuration change. A missed cancel would leak the Activity, so this is the
part to check on a device.

## Navigation rail

`resolveAdaptiveNavigationPlacement` (`../adaptive-navigation.ts`, tested) and
the live hook `useAdaptiveNavigationPlacement()` decide where primary navigation
goes:

- **Android** (Material 3 Adaptive): compact → bottom bar; tabletop posture or a
  window under 480 dp tall → bottom bar; otherwise a rail on the logical
  leading edge; `extraLarge` → expanded rail (`placement.expanded`).
- **iOS**: a hardware edge column (inset of 64 dp or more, iPhone Duo) wins and
  stays on its PHYSICAL edge; compact → bottom; wider → leading sidebar.
- **Other**: compact → bottom, otherwise a collapsed rail.

`apps/mobile/app/(drawer)/(tabs)/_layout.tsx` uses it for `tabBarPosition`.
`AppTabBar` still draws its 80 dp rail at every width; the expanded rail needs
the `railExpanded` token first.

## Back behaviour (Android)

Order, highest first (`resolveSearchBack` in `pane-search.ts`):

1. Focused search with a query → clear the query.
2. Focused search, empty → blur.
3. Detail pane showing and `canGoBack()` true → defer to the navigator.
4. Collapsed and not on the leading column → step back one column.
5. Otherwise → fall through to the system.

`BackHandler` walks subscriptions last-registered-first. expo-router's
container mounts above the split view, subscribes earlier and so runs after this
handler; returning `false` hands the press to it. The hook never calls
`router.back()` itself, which would double-pop. It relies on the legacy
`hardwareBackPress` event; opting in to `enableOnBackInvokedCallback` would
require moving it to `onBackInvokedCallback`.

## Pane overrides

`resolvePaneVisibility` in `pane-overrides.ts`:

1. `paneVisibility(sizeClass, columnCount)` is the default.
2. An override for THIS size class replaces it; overrides for other classes are
   ignored, so hiding the list on a tablet does not hide it on a phone.
3. An override can always hide a pane but can only show one the class can fit.
   The detail pane can be hidden only while another pane is still on screen.
4. Storage is synchronous so the first frame is already right. A malformed blob
   is dropped.

## Platform forks

| File | native | web |
|---|---|---|
| `use-split-view-back` | Android `hardwareBackPress` | no-op |
| `pane-overrides.store` | in memory until configured | `localStorage` |
| `PaneDivider` | `PanResponder` drag + keyboard | keyboard / press only |
| `CollapsiblePane` | Reanimated width tween (UI thread) | Legend Motion width tween |
| `use-sticky-header` / `PaneListHeader` | Reanimated auto-hide | static header |
| `../reserved-regions` | native module | empty, or the override |

Each fork has a same-extension anchor (`.ts` beside `.ts` forks, `.tsx` beside
`.tsx`). Metro resolves `.ts` before `.native.tsx`, so a mismatched anchor would
win on native. Import the anchors extensionless (`./pane-overrides.store`, not
`./pane-overrides.store.ts`), or Metro loads the web fork on device.

`SwipeableRow` stays in `apps/mobile/src/navigation/split-view` because it
needs Gesture Handler and Worklets, which `@acme/ui` does not declare.

## Animation

`CollapsiblePane` animates width and nothing else on its node: neighbours have
to reflow, which a `translateX` slide would not do. The content holds its last
width on an inner view, so text does not re-wrap and a canvas is not resized
while the clip moves. Legend Motion runs on RN `Animated`, which cannot mix
native- and JS-driven properties on one component, which is why rotation and
width never share a node. Transition values live in `transitions.ts`.

## Storybook

`packages/ui/SplitView.stories.tsx` (`Layout/SplitView`) renders the real host:

- Width classes: `Compact` (412), `Medium` (700), `Expanded` (1000), `Large`
  (1366), `ExtraLarge` (1920), pinned through the viewport global.
- Fold postures: `BookPosture` (840, crease at 420), `DualScreenHinge` (1114,
  34 dp occluding hinge at 540), `Tabletop` (840, horizontal crease),
  `Trifold` and `TrifoldInspector` (1290, creases at 430 and 860).

Folds are simulated with `ReservedRegionsOverride`, which feeds regions to the
same `useReservedRegions` the native module feeds, so the shipped planner runs.
A stripe marks each simulated hinge.

## Tokens

Both former constants are theme tokens in `packages/theme/tokens.ts`:

- `widthClassMinDp` (`compact` 0, `medium` 600, `expanded` 840, `large` 1200,
  `extraLarge` 1600): `WINDOW_SIZE_CLASS_MIN_WIDTH_DP` reads it.
- `navChrome.railExpanded` (240px; Material allows 220–360 dp): the expanded
  rail width AppTabBar draws when `placement.expanded` is set.

## Testing

```
pnpm --filter @acme/ui test       # policy, folds, trifold, overrides, back, search, navigation placement
pnpm --filter storybook test      # story render tests (Vitest browser)
```

Device behaviour (hinge snapping on a real foldable, the Flow lifecycle, the
divider drag, iOS 27.1 reserved regions) is not covered by these. Use an Android
Studio foldable emulator with posture controls, or hardware.

## Prior art

- MoyoLearn `packages/ui/adaptive-panes`, `packages/ui/adaptive-navigation.ts`,
  `apps/mobile/modules/reserved-regions` (commits `fa3657cc`, `ab3307fc`, and the
  `feat/android-foldable-windowmanager-v2` series `121f9041`, `9a9dcea7`,
  `9e6b187a`).
- Jetpack WindowManager `FoldingFeature`:
  https://developer.android.com/reference/androidx/window/layout/FoldingFeature
- Material 3 window size classes:
  https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes
- react-freeze (MIT, inlined): https://github.com/software-mansion/react-freeze
- [`craftzdog/inkdrop-ui-mockup-react-native`](https://github.com/craftzdog/inkdrop-ui-mockup-react-native)
  (Apache-2.0): collapse choreography, auto-hiding header, search-focus
  gesture gating, swipe-to-reveal rows. Reimplemented, not copied.
