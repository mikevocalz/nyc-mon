# react-native-arrangement-view: verdict

Lane D (adaptive layout), 2026-10-15. Evaluated against the AdaptivePanes and
reserved-regions infrastructure already in `packages/ui`, for the arcade
controller's foldable, tablet and tabletop layouts (Master Directive v2 §10).

**Verdict: REJECT for the controller; DEFER as a future AdaptivePanes host
option.** Not added as a dependency.

## What was read

- npm metadata: `npm view react-native-arrangement-view@0.4.0` (version
  `0.4.0`, modified 2026-10-14, MIT, 147,667 bytes unpacked, 90 files).
- The published tarball, unpacked into the session scratchpad only:
  `package.json`, `README.md`, `src/types.ts`, `src/hinge.ts`, `src/arrange.ts`,
  `src/layout.ts`, `src/index.tsx`, `src/ArrangementView.tsx`,
  `src/ArrangementView.ios.tsx`, `src/HingeObserver.tsx`,
  `ios/ArrangementHost.swift`, `ios/RNHingeObserver.mm`,
  `android/build.gradle`, `android/src/main/java/com/arrangementview/HingeTracker.kt`,
  `ArrangementView.podspec`.
- Docs site: https://thiagobrez.github.io/react-native-arrangement-view/ and
  source https://github.com/thiagobrez/react-native-arrangement-view.
- Ours: `packages/ui/adaptive-panes/fold-layout.ts`,
  `packages/ui/reserved-regions.types.ts`,
  `apps/mobile/modules/reserved-regions/**` (iOS and Android bridges),
  `packages/app/features/game/hud-layout.ts`.

## Facts from the package

| Item | Value | Source |
| --- | --- | --- |
| Peers | `react >= 19.0.0`, `react-native >= 0.83.0` | `package.json` `peerDependencies` |
| Architecture | Fabric components only (`codegenConfig.type: "components"`, three native components: `RNArrangementView`, `RNArrangementPane`, `RNHingeObserver`) | `package.json` `codegenConfig` |
| iOS | SwiftUI `ArrangementView` with `.arrangementViewStyle(.split/.overlay)` and `.onHingeChange`, gated `#available(iOS 27.1, *)` behind `RAV_HAS_ARRANGEMENT`; `UIHingeInteraction` gated `__IPHONE_27_1`; podspec `:ios => "16.4"`; older OS/SDK falls back to a compact primary-only layout | `ios/ArrangementHost.swift` lines 129–170, `ios/RNHingeObserver.mm` lines 8–25, podspec line 13 |
| Android | Jetpack WindowManager `androidx.window:window:1.5.1` + `window-java`, `FoldingFeature` state/orientation/separating; `minSdk 24`, `compileSdk 36` | `android/build.gradle` lines 4–5, 61–63; `HingeTracker.kt` |
| Web / other | `ArrangementView` throws `"react-native-arrangement-view supports iOS and Android only."`; `HingeObserver` renders children with hinge `unavailable` | `src/ArrangementView.tsx`, `src/HingeObserver.tsx` |
| Public surface | `ArrangementView` (+ `.Primary`/`.Secondary` slots), `HingeObserver`, `useHingeChange`, `useHingeSelector`, `useArrangementLayout`; `arrangement: 'split' \| 'overlay'`, `axes`, `primaryEdge`, Android-only `hingePolicy` / `hingeGap` | `src/index.tsx`, `src/types.ts` |
| Hinge data exposed to JS | `{ available, angle (radians) \| null, status: closed \| partiallyOpen \| fullyOpen \| unknown }` | `src/types.ts` `HingeState` |
| Layout data exposed to JS | `{ secondaryVisible, axis: 'horizontal' \| 'vertical' \| null, isOverlapping }`; pane frames stay native | `src/types.ts` `ArrangementLayout`, `src/layout.ts` |
| Internal state | `useState` for the store refs, `useSyncExternalStore` for reads | `src/hinge.ts`, `src/layout.ts` |
| Expo Go | Not supported; dev build required | `README.md` |
| Tests | `node --test tests/*.test.ts` (unit); no device evidence shipped | `package.json` `scripts.test` |

Our installed stack for comparison: `react-native 0.88.0-rc.3`, `expo 58.0.3`,
`react 19.3.0`, New Architecture always on (`apps/mobile/app.config.ts` line
10). The peer range is satisfied.

## Why it does not fit the controller

1. **It is a two-pane container, and the controller is not two panes.** The
   API arranges exactly one `Primary` and one `Secondary` (`src/types.ts`:
   "Exactly one `ArrangementView.Primary` and one `ArrangementView.Secondary`.
   Any other child is ignored"). The §10 rows need three independently placed
   groups (stick, six-button cluster, START/STOP pill) plus a clear stage,
   each confined to a usable region and each adjustable by the player. A
   split/overlay of two panes cannot express that, and nesting it would put
   layout authority in native code we cannot read rects out of.

2. **Pane frames never reach JS.** `onArrangementLayoutChange` reports
   `secondaryVisible`, `axis` and `isOverlapping` only (`src/layout.ts`
   `describeLayout`). The directive's "nothing crossing the hinge" and
   "revalidate saved positions against hinge boundaries" need the hinge
   rectangle and the usable regions in container coordinates. Our
   `useReservedRegions` already delivers `x/y/width/height/orientation/state/
   occlusionType/separating` for every feature, and `foldLayoutsFromRegions`
   plus `usableRegions` turn that into regions. The library's hinge payload is
   `angle` and a three-value `status`; it has no bounds at all.

3. **Single-fold model.** `arrange.ts` takes one optional `fold`. Our
   reserved-regions path processes the full collection and the trifold story
   (`SplitView.stories.tsx` `TRIFOLD`) exercises two creases. The foldable
   skill §4 requires every reported feature to be handled.

4. **It exposes a hinge angle.** `HingeState.angle` is in radians (iOS via
   `UIHinge.angle`; Android maps `FoldingFeature.State` to a status and reports
   no angle). The skill §7 and `reserved-regions.types.ts` both forbid
   inferring an angle on Android and keep posture to the supported signals.
   Adopting an API whose headline value is an angle invites exactly the
   fabricated-angle code the repo bans.

5. **A second native hinge bridge.** We already ship
   `apps/mobile/modules/reserved-regions` (Expo Modules, iOS 27.1
   `UIView.reservedRegions(kind:)`, Android WindowManager 1.5.1). The library
   would add three Fabric components and its own WindowManager subscription
   per mounted view, two sources of truth for the same hinge, and a second
   `@available(iOS 27.1)` gate to keep in step with ours. Repo laws (one hinge
   infrastructure, no duplicated state) weigh against that.

6. **Web is a throw.** The web game surface and Storybook both render the
   layout; `ArrangementView` on web throws at render. Our resolver and
   component run everywhere the kit runs, and the stories simulate folds
   through `ReservedRegionsOverride`.

7. **`useState` inside the library.** `src/hinge.ts` and `src/layout.ts` hold
   their stores in `useState`. That is the library's own business, but it
   means the hinge store is not a Zustand store we can subscribe to from
   worklets or module scope, which the controller's input and layout code
   does.

## What it does well, and when to revisit

The iOS half is a thin, honest binding to SwiftUI's `ArrangementView` and
`.onHingeChange` with a deterministic compact fallback, and the Android half
follows Material's pane-scaffold directive (`arrange.ts` comment cites
`calculatePaneScaffoldDirective`). If a future screen is a plain
primary/secondary split that should adopt the platform's own arrangement
behaviour (overlay on fold, system animation), it is a reasonable
**AdaptivePanes host** candidate behind the existing `SplitView` API, not a
replacement for the pane planner. Revisit when:

- the library reports pane frames (or hinge bounds) to JS, so the hinge-safe
  checks can be asserted rather than trusted;
- it handles more than one fold;
- our own `reserved-regions` module can either feed it or be retired in its
  favour, so there is one hinge bridge.

## Decision record

- REJECT for `AdaptiveControlLayout` / `ControllerLayoutResolver`: the
  controller is a region-constrained three-group overlay, implemented purely in
  `packages/ui/game-controls/layout/` on top of `useReservedRegions`,
  `foldLayoutsFromRegions` and the width-class tokens, tested under `node
  --test`.
- DEFER as a possible `SplitView` host for two-pane screens, pending the three
  conditions above. Owner: the adaptive-panes maintainer; no issue opened by
  this lane.
- No dependency added; the tarball was inspected in the session scratchpad
  and nothing from it was copied into the repo.
