# Foldable arrangements

Written 2026-10-16 after Mike's report from the Surface Duo, spanned in landscape: "why isnt the h-link in the center of the right div? why i gave you the skills are you not using the arrangement views? arrangement views would work great to make a lot of these screens make sense; the ui need to adapt for foldables".

Status: the H-Lynk steps are built and covered by node tests (unit fixtures). Nothing in this document has been checked on a Surface Duo, iPhone Duo, Pixel Fold or tablet yet. The Duo run is the orchestrator's, and the native view only exists after an Android rebuild.

## Sources

- `skills/mikevocalz-foldable-layouts/SKILL.md` (Michael's 2026-10-15 revision, blob `d60f539`). §9 is followed step by step below; §2, §3, §4, §5, §6, §7 and §10 are cited where they decide something.
- Apple, Designing for iPhone Duo (<https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo>), sections "Device poses", "Best practices", "Reserved regions", "Split views", "Arrangement views", "Vertical controls".
- react-native-arrangement-view docs: <https://thiagobrez.github.io/react-native-arrangement-view/index.html>, `/guide/installation`, and `/guide/platform-comparison.html`.
- The installed package source, `react-native-arrangement-view@0.4.0`: `src/types.ts`, `src/arrange.ts`, `src/ArrangementView.android.tsx`, `src/ArrangementView.ios.tsx`, `src/ArrangementView.tsx`, `src/slots.ts`, `src/layout.ts`, `android/src/main/java/com/arrangementview/{ArrangementView,ArrangementViewManager,HingeTracker,ReactEvents}.kt`, `android/build.gradle`, `ios/ArrangementHost.swift`, `ios/RNArrangementView.mm`, `ios/RNArrangementPaneShadowNode.h`, `ArrangementView.podspec`.
- The previous verdict, `docs/design/research/arrangement-view-verdict.md` (REJECT for the controller, DEFER for SplitView).

## Compatibility (skill §9, "Before installation")

| Question | Answer | Evidence |
| --- | --- | --- |
| Current version | `0.4.0`, `latest`, published 2026-10-14 | `npm view react-native-arrangement-view versions dist-tags time` |
| Peers | `react >= 19.0.0`, `react-native >= 0.83.0`. We run React 19.3.0, RN 0.88.0-rc.3. | `package.json` `peerDependencies` |
| New Architecture | Fabric components only (`codegenConfig.type: "components"`). SDK 58 always runs the New Architecture. | `package.json`; `apps/mobile/app.config.ts` |
| RN 0.88 Android APIs | `BaseReactPackage`, `ReactViewManager.createViewInstance`, `ViewManager.setPadding(T, Int, Int, Int, Int)`, `UIManagerHelper.getEventDispatcherForReactTag`, `UIManagerHelper.getSurfaceId(View)` and `PixelUtil.toDIPFromPixel` all exist in the installed RN source. | `react-native/ReactAndroid/src/main/java/com/facebook/react/...` |
| Android | Jetpack WindowManager 1.5.1, `minSdk 24` (ours is 29), `compileSdk 36`. Autolinks under Expo SDK 58: `expo-modules-autolinking react-native-config` lists `com.arrangementview.ArrangementViewPackage` with codegen library `RNArrangementViewSpec`. | `android/build.gradle`; autolinking output |
| iOS | Pod `ArrangementView`, iOS 16.4 floor. SwiftUI `ArrangementView` only on iOS 27.1 with the 27.1 SDK (`RAV_HAS_ARRANGEMENT`); older systems get a primary-only fallback. | `ArrangementView.podspec`, `ios/ArrangementHost.swift` |
| Config plugin | None needed. Prebuild picks it up through autolinking. | `npx expo prebuild --platform android --no-install` exits 0 |
| Expo Go | Not supported; dev build required. | installation guide, `README.md` |
| Web | `ArrangementView` throws "supports iOS and Android only." | `src/ArrangementView.tsx` |
| `@expo/ui/swift-ui` alternative | `@expo/ui` 58.0.12 exports no ArrangementView, so this library is the only Apple binding (skill §9, "On Apple, compare..."). | `node_modules/@expo/ui/src/swift-ui/` |

How it reads the hinge. On Android the native `ArrangementView` registers its own `WindowInfoTrackerCallbackAdapter` listener, takes the first `FoldingFeature`, converts its bounds into the view's own content box in dp, and sends `{ width, height, window, fold }` to JS, where `arrange()` computes both pane frames and the React side positions them absolutely. On iOS 27.1 SwiftUI arranges the panes and reports their frames. The hinge angle comes from the Android hinge-angle sensor or `UIHinge.angle`; we pass `observeHinge={false}`, which leaves that sensor unregistered and keeps the repo's "no inferred angle" rule (skill §7).

What the platform-comparison page says. It compares an iPhone Duo with a Pixel 10 Pro Fold for `split` and `overlay`, each closed, half-open and flat, in four orientations. It warns that pane sizes are not comparable between the two devices, only placement, and that the same pose can stack panes on one device and place them side by side on the other (an unfolded iPhone Duo turned sideways is taller than wide, so its panes stack). The comparison is screenshots; the page does not cover the Surface Duo, more than one fold, or web. We take from it that placement follows the window's shape and the hinge on both platforms, which is why the H-Lynk centres itself inside whatever pane it gets instead of assuming a pane size.

## Re-evaluating the earlier verdict

The 2026-10-15 verdict listed seven objections. For the controller they still hold, and nothing here touches `packages/ui/game-controls`. For a plain two-pane screen they mostly fall away:

1. Two panes only: the H-Lynk companion is exactly two panes (brand, device).
2. "Pane frames never reach JS": true on iOS. On Android `arrange()` computes the frames in JS, and the node tests in `packages/ui/hlynk/duo-centring.test.ts` run that exact function from the installed `lib/module/arrange.js`. On both platforms the H-Lynk measures the pane it was given and centres itself arithmetically, so centring does not depend on knowing the frame in advance.
3. Single fold: the library reads `firstOrNull()` FoldingFeature. Every shipping foldable we target reports one. Trifold geometry stays on the fallback planner and the reserved-regions bridge; this is a recorded gap, not a claim of support.
4. Hinge angle: switched off (`observeHinge={false}`).
5. A second hinge bridge: yes, the library's view listens to WindowManager itself. We accept it for the pane pair because it measures the fold against its own view's position, which removes a whole class of origin bugs (below). `useReservedRegions` stays the source of truth for everything else, and the two never run over the same pane pair.
6. Web throws: the web fork of `ArrangementPanes` never imports the library.
7. `useState` inside the library: its own business; our state stays in Zustand instance stores.

Decision: BUILD the native backend for two-pane screens, behind a boundary, on Android and on iOS 27.1+. The controller REJECT stands.

## Why the H-Lynk was off-centre on the Duo

Read from code; the device has to confirm it.

- The planner itself is right when it has the hinge. Fed a 1080 x 696 host with a vertical hinge at 540, `planHLynkPlacement` returns the right region and the body centres in it (`duo-centring.test.ts`, fallback cases).
- The symptom matches the planner running without a usable hinge rect. With no fold, any window at least 600 wide takes the `wide` branch: the device pane is the body plus 24 dp each side, pinned to the window's right edge, and the brand pane takes the rest, straight across the hinge. On a spanned Duo that puts the body 20 to 40 dp right of the right panel's centre (depending on the hinge width), 24 dp from the window's right edge. That happens whenever `useReservedRegions` hands the host no division (the Modules 2 module unresolved, no event before the first measure, or the host measured before the fold arrived), and the hinge then gets no special treatment at all.
- The shell's `SafeArea` only consumed top and bottom insets, so a landscape navigation bar or cutout on the left or right covered the body's rail.
- The device region centred the body with flex alignment, so any mismatch between the region and the body size showed up as cropping instead of failing a test.

Fixes: the pane pair now goes through the native Arrangement View on Android, which measures the fold against its own view; the body is placed by `placeBodyInFrame`, which sizes it from the pane's measured box and centres it with explicit offsets on both axes; and the shell consumes all four safe-area edges once.

## The boundary (skill §9 steps 2 to 6)

`packages/ui/arrangement/`:

- `ArrangementPanes` takes `arrangement` (`split` | `overlay`), `primarySide` (physical `left` | `right`), a stable `primary` element, `secondary(shown)` and a `fallback()` render. `insetRightPt` keeps the panes clear of a rail drawn inside the view on its physical right.
- `chooseArrangementBackend` (pure, tested) picks `native` on Android and on iOS 27.1+, and `fallback` on web, SSR, Quest and PICO 2D windows (skill §7 XR, §9 step 4), iOS before 27.1, and any binary where `UIManager.hasViewManagerConfig('RNArrangementView')` is false. The last rule lets the JS reach a device before its native rebuild without rendering an unknown component.
- The backend is resolved once per process. Folding, rotating and resizing never swap engines, and the pane slots keep their identity, so the H-Lynk and the step inside its screen are never remounted (skill §6). The fallback is rendered instead of the native view, never beside it (skill §9, "never run two arrangement engines over the same pane pair").
- `primaryEdgeFor` maps a physical side to the library's logical `primaryEdge` (trailing in LTR, leading in RTL), so the H-Lynk stays physically right in RTL like the rail (skill §2). Each pane keeps the locale's direction inside.
- Navigation stays outside: Expo Router owns routes, and no rail or tab bar lives inside an arrangement (HIG: "Keep navigation outside of arrangement views"; skill §9 step 5).

## H-Lynk companion steps (built)

`HLynkShell` (`packages/ui/hlynk/HLynkShell.tsx`) is used by M01 boot, M08 egg choice, M10 incubate and the `(home)` layout (M11, M12, M09, M13–M16), so every one of them gets this.

Arrangement: `overlay`, H-Lynk primary on the physical right, brand pane secondary. Overlay is the arrangement whose placement matches the brief: across a separating or half-open vertical fold the panes sit either side; across a horizontal one the primary goes after the fold (below); with no fold the primary covers the secondary, and `ArrangementPanes` reports the brand as not shown, so it neither draws nor reaches the screen reader.

| Posture | Native backend (Android, iOS 27.1+) | Fallback (web, XR, older iOS) |
| --- | --- | --- |
| Phone, Duo cover, one Duo panel | H-Lynk alone, centred in the full box | same (`single`) |
| Duo spanned flat, book | brand left, H-Lynk centred in the right pane, clear of the hinge | same (`book`) |
| Tabletop | brand above, H-Lynk below the fold, compact when the half is short | same (`tabletop`) |
| Tablet or wide window, no fold | H-Lynk alone, centred | brand left, H-Lynk right (`wide`) |

The tablet row differs by backend. With overlay and no fold, SwiftUI and the library both stack the primary over the secondary. Decision: DEFER the brand pane on unfolded wide windows under the native backend; the HIG's "Don't reinvent your app when it resizes" and skill §5 ("A foldable may legitimately show one content pane") cover the H-Lynk alone, and the brand stays where it was on web.

The body is sized by `measureShell` for its pane and centred by `placeBodyInFrame` on both axes: the device centre is the pane centre, both rails, the scanner head and the control row sit inside the pane, and keys stay 48 dp with the trackpad at 112 dp (HIG: "keep text and control sizes as consistent as possible"). Content inside the 3:4 screen still fits without scrolling (Decision H-3, `HLynkFit`).

## Other screens (follow-ups, one PR each)

Shell per skill §2 does not change with any of these: native foldables, tablets and headsets keep a physical-right rail, web keeps its header. Only content panes move.

| Screen | Cover / phone | Spanned or book | Tabletop | Tablet | Backend |
| --- | --- | --- | --- | --- | --- |
| Home (`features/companion/HomeLayout.tsx`, M11/M12) | H-Lynk alone | brand left, H-Lynk right | brand above, H-Lynk below | H-Lynk alone (native), brand + H-Lynk (web) | Done here: it renders `HLynkShell`. |
| Mon detail, M17 (`features/companion/DexProfileScreen.tsx`) | one scroll column | primary: stage still and life-stage slots; secondary: the entry text | stage above, text below | split, primary left | `ArrangementPanes` `split`, `primarySide: 'left'`. Master/Detail does not apply (one item, skill §5). |
| Journal, M18 (`features/companion/JournalScreen.tsx`) | calendar on top of the timeline list | primary: calendar and days-together count; secondary: the timeline for the selected day | calendar above, timeline below | split | `split`, `primarySide: 'left'`. The selected day stays in the screen's store, so folding keeps it (skill §6). Both panes are already rendered by `VirtualList`. |
| Profile (`features/profile/profile-content.tsx`) | identity, details stacked | primary: `ProfileIdentity`; secondary: `ProfileDetails` | identity above, details below | split | `split`. `ProfileOverview` was struck 2026-10-17 (demo tags and stats with no backing source). |
| Settings (`features/settings/settings-content.tsx`, `(drawer)/settings`) | one list | Master: setting groups; Detail: the chosen group | list above, detail below | Master/Detail | Existing `SplitView`/AdaptivePanes (skill §5 Master/Detail). Not an Arrangement View: Settings has selection and navigation inside it, and the HIG keeps navigation outside arrangement views. |
| Game lobby, G02 (`features/game/lobby/GameLobbyScreen.tsx`, `ui/lobby/GameLobby.tsx`) | one column | `ArrangementPanes`: wordmark + NYC Rank in the left pane, resume + START docked at the foot of the right pane (level with the board's foot), split at the hinge | stage above, START below | one column | Done 2026-10-16. The screen measures its host with `measureInWindow` (the GameScreen pattern) and converts folds on both axes, so a non-zero host origin no longer shifts the split (skill §4, §10). No folds until the first layout pass. 2026-10-28: the fallback (iPadOS before 27.1, web) follows the onboarding pattern by class (`ui/lobby/lobby-layout.ts`): md portrait a 640 pt top-aligned column, md landscape the same two panes as the native split; phones unchanged. Unit-tested only, not seen on a device. |
| Starter home (`features/home/screen.native.tsx`) | scroll column | no change | no change | no change | Out of scope: a single feed with no companion pane (HIG: "Consider an arrangement view when your layout already resembles one"). |

## Skill §9 steps

1. Inventory: done above, plus the existing `adaptive-panes/`, `reserved-regions*`, `use-host-placement.ts` and `HLynkShell` abstractions. No baseline device screenshots exist in the repo for these screens; the Duo run is the baseline.
2. Typed boundary: `packages/ui/arrangement/`.
3. Native backend, feature-detected and version-gated: `ArrangementPanes.native.tsx`, `chooseArrangementBackend`.
4. Fallback for web, SSR, XR, older iOS and an unlinked binary: the Decision H-2 planner through `HLynkFallbackPanes`.
5. Navigation untouched: no rail or tab bar inside any pane; the rail inset is consumed by the arrangement view's padding.
6. State above the backend: the backend is fixed per process, pane slots are stable, screen stores live above the shell.
7. Verification: unit tests, typecheck and lint only. Not done: accessibility, RTL, keyboard and Inspector checks on a device, before/after screenshots, the iOS build, and any foldable other than the Surface Duo the orchestrator holds.

## Tests

- `packages/ui/arrangement/backend.test.ts`: backend matrix (Android, iOS 27.0/27.1/28, web, headset, unlinked binary), physical-edge mapping in LTR and RTL, overlay visibility.
- `packages/ui/hlynk/duo-centring.test.ts`: a 1080 x 720 Duo (696 dp host) with a 0 dp and a 34 dp hinge at x = 540, on both backends: device centre equals the right region's centre within 1 dp on both axes, both edges inside the region, nothing under the hinge, and the device stays physically right in RTL. Also tabletop (brand above, device below), the single-panel and phone cases, and a width-by-height sweep of `placeBodyInFrame`.

## Gaps

- Not run on hardware. Android needs a native rebuild before the native backend exists; until then `ArrangementPanes` falls back automatically.
- One fold only on the native backend.
- No iOS build was run; the iOS path is availability-gated and untested.


## Duo hinge policy (2026-10-16)

The Surface Duo reports its hinge through WindowManager as a flat fold: `separating: false`, width 0, x 540 in a 1080 dp window. The library's default `hingePolicy="avoidSeparating"` ignores a flat fold, so the lobby split at the middle of its 1000 dp view, 40 dp left of the hinge, and START sat across it. `ArrangementPanes.native.tsx` now passes `hingePolicy="alwaysAvoid"`: the panes split around the hinge with the library's 24 dp gap (528 and 552 dp). A flat fold still splits only where two panes fit (`arrange.ts`), so phones keep one pane. Measured on the Duo: NYC Rank ends at 509 dp and START starts at 566 dp.

## Companion pane on the persistent stage (2026-10-28)

Mike's report from the iPad: in landscape the companion loop showed a small portrait device in an empty window. Each glass screen draws on a fixed 768 x 1024 canvas and the device was centred in whatever box it got, so no screen had a tablet layout.

Status: built and covered by node tests (unit fixtures), typecheck and lint. Not run on an iPad, a foldable or a simulator.

### Who gets the pane

`useTabletClass` (`packages/app/features/companion/CompanionStageHost.tsx`): native rail hardware (tablet, foldable, headset; `useAdaptiveNavigationPlacement().rail`) at 672 pt or wider, which is Tailwind's `md` on native (rem 14). Web: 672 pt or wider. A phone never gets it, so a landscape phone wider than 672 pt keeps the device alone (phone unchanged). A foldable cover or one Duo panel is narrower than 672 and keeps the device alone too.

### Where it goes

`planCompanion` (`companion-layout.ts`, pure, `companion-layout.test.ts`) works from the stage host's measured size, which is the space left of the rail and under the header, not the window:

| Host | Plan |
| --- | --- |
| Phone, or any host too small for both | `single`: the device alone |
| Wider than tall (iPad landscape, Duo spanned) | `row`: pane on the physical left (40%, at most 480 pt), device on the physical right, the H-Lynk's documented side (skill §2: physical, also in RTL) |
| Taller than wide (iPad portrait) | `column`: device in a top band (60% of the height), pane under it |
| A vertical fold through a row | the split lands on the fold, gap = hinge width; a zero-width fold still splits (skill §4) |
| A horizontal fold (tabletop) | device above the fold, pane below |

Minimums: device 320 pt wide or 380 pt tall, pane 280 pt wide or 220 pt tall; below them the plan is `single` instead of squeezing either. The pane, gap and device slots keep their places in the tree in every plan and only their sizes and the flex direction change, so rotating, folding or resizing never remounts the DeviceStage (skill §6). Overlays that belong to the device (M09's and Settings' name field) read `stageFrame` from the stage store and stay inside the device box.

One side for every screen: the device stays physically right on Home, Feed, Rest, Social, Dex, Journal, Settings and M09, because they share one persistent stage and moving it between routes would make it jump. This replaces the earlier per-screen rows above for Dex (`primarySide: 'left'`) and Journal on the 3D path; the 2D fallbacks keep their own layouts.

### What each pane shows

| Screen | Pane | Role (skill §5) |
| --- | --- | --- |
| M13 Home | care summary (the three meters, Low marked) and the last five journal moments, with Open Journal | supplementary |
| M14 Feed, M15 Rest, M16 Social | that route's past meals, naps or games from the journal, and plain tips that follow the Mon's state | supplementary |
| M17 Dex | the full facts (number, form, Bloodline, life stages, name, hatched, Caller) | supplementary |
| M18 Journal | the calendar; picking a day narrows the glass timeline to it, Show every day clears it | Master (calendar) / Detail (glass timeline) |
| Settings | the highlighted row's detail: Theme and Time of day change in place, the rename field, every credit line, the sign-out question with Cancel first | Master (glass list) / Detail (pane) |
| M09 Name | the Mon's identity, then the ask or the name field | detail |
| M08 egg choice | the focused egg's name, number and Bloodline, the only canon facts before the hatch (M08 handoff P3); nothing focused: how to pick | Inspector |
| M10 incubate, M11 incubating | the incubation steps (chosen, incubating, ready, hatch) on the kit Timeline | supplementary |
| M12 hatch | none: full-window cinematic, unchanged | n/a |

Every pane has a loading state (kit LoadingSkeleton, also shown between routes) and an empty state (kit EmptyState) where a list can be empty. Panes are real, focusable UI; the glass keeps its hidden mirror for what it draws.

### Camera and glass resolution

- `stageCameraZ` (`packages/ui/three/hlynk/device-geometry.ts`, `stage-camera.test.ts`): the camera distance follows the pane's aspect. Wide panes are height-bound at the authored distance, narrow ones back off. Every aspect a phone stage reaches keeps the old value. The old floor at aspect 0.45 is gone, so a narrow split-screen pane no longer crops the device's sides. The earlier formula already followed the aspect; the empty window came from the device having the whole window, which the pane now fills.
- On tablet-class hardware the glass canvas renders at 2x (`DeviceStage glassScale`, `createCanvasSurface(..., scale)` on web and Skia). Screens still draw in their 768 x 1024 logical px. Read once when the scene builds.

### Gaps

- Not run on any device or simulator. Placement on iPad, Duo and Pixel Fold is from unit fixtures only.
- The trifold case uses the first matching fold only.
- M08 has no lore text: culture notes are `null` in content.
