---
name: mikevocalz-foldable-layouts
description: >-
  Build, debug, review and test Michael Allen's Expo/React Native foldable,
  dual-screen, multi-hinge, tablet and adaptive-window interfaces. Use for
  folded-cover navigation, physical-right rails, SplitView, AdaptivePanes,
  Master/Detail/Inspector, book/tabletop posture, hinge occlusion, resizing,
  RTL, web navigation parity, state loss during folding, and shared XR panels.
---

# Michael's foldable layouts

**Hardware family chooses the native navigation shell. Current usable space chooses the content layout.**

This is the project's cross-platform skill, not an instruction to convert the app to SwiftUI. Apply it before relevant design, implementation, debugging, review, tests or documentation. Improve existing shared components and adapters; do not create another router, device-specific app or UI library.

## 1. Establish the contract before editing

Read the root and nearest AGENTS.md, the package/lockfile versions, current navigation and UI exports, fold/posture bridge, layout store and relevant tests. Locate the actual implementations: names such as SplitView and AdaptivePanes describe existing abstractions to find, not imports to invent. Keep Expo Router as route/selection owner where used.

Preserve explicit screen-specific contracts. Flag conflicts instead of silently replacing them with generic platform defaults. Read relevant existing skills from expo/skills, mattpocock/skills, Argent/agent-device, coreyhaines31/marketingskills, pbakaus/impeccable and petergyang/no-ai-slop; load specialist native, accessibility and testing skills when relevant.

## 2. Navigation policy: do not derive this from width

| Runtime / hardware | Required shell |
| --- | --- |
| Native ordinary phone | Existing bottom tabs, including the app's authored center action. |
| Native foldable or dual-screen device, open OR folded cover | Physical RIGHT rail, also in RTL. |
| Native foldable in tabletop/book posture or a narrow app window | Physical RIGHT rail; content may become a single pane. |
| Native tablet or headset, including narrow windows | Physical RIGHT rail, also in RTL. |
| Web on any device, including a foldable browser | Persistent header; desktop destination links or small-screen menu. Phone-width web also has bottom tabs. NO side rail. |

Determine runtime before native hardware policy. A wide ordinary phone does not become a tablet; an absent hinge event does not turn a foldable cover into an ordinary phone. Keep stable device-family capability separate from transient posture and dimensions. Use the existing verified capability source; do not invent an OS API, guess from model names, or use viewport width alone. Retain known capability across fold/activity transitions. Unknown is not proof of non-foldable hardware: preserve the established bootstrap shell while resolving it, and report detection gaps rather than claiming complete support.

Treat physical RIGHT as an explicit physical edge, not logical `end` that flips under RTL. Verify the actual rendered edge under React Native RTL behavior; do not globally disable RTL to achieve this. Text, content order and semantic reading direction still follow the locale. The Inspector's configured trailing edge is a separate decision from the physical-right navigation rail.

Use the existing Moyo hardware-column measurement where applicable; no predicted Duo dimensions. Consume safe-area/column insets once, center the rail's usable action group vertically, and keep branding in the persistent app header. Rail items must avoid a horizontal hinge too; keep their hit targets within usable segments rather than centering a button on the fold. Never add bottom tabs to solve rail crowding on a native foldable.

## 3. Keep capability, window geometry and product state separate

Maintain three independent inputs in existing stores/adapters:

- Stable capability: runtime, verified device family and available platform features, with an explicit unknown state.
- Live geometry: container/window bounds, its coordinate origin, units/density, safe areas, keyboard, all relevant fold/occlusion features and posture.
- Product state: route, selection, pane intent, drafts, scroll anchors, media/call/camera session and game progress.

Subscribe to size changes; never store a launch-time Dimensions.get or UIScreen.main measurement as permanent layout truth. React Native useWindowDimensions is suitable for reactive window metrics; measure the actual pane host as well when it occupies only part of that window. Do not confuse physical pixels with layout units or apply density twice.

## 4. Hinge-safe geometry, including multiple folds

Normalize native feature coordinates into the measured content container's coordinate system. Account for root/header offsets and density exactly once. Reject invalid/stale measurements, clip relevant bounds, and ignore features outside the container or pane row. Recompute on resize, rotation, inset/keyboard changes, activity reattachment and fresh feature events.

Process the full reported feature collection, not only index zero. Preserve the distinction between an occluding rectangle and a separating fold line: a zero-width separating fold still creates a boundary. Conversely, a flat, non-separating, non-occluding crease must not automatically remove usable pixels. Never synthesize missing hardware geometry.

Produce non-overlapping usable regions; preserve stable pane assignments across equivalent updates. Keep text, primary actions, faces, scan targets, QR codes and media focal points clear of active interference. Never let a touch target straddle an occluding or separating region. Validate hit testing as well as visuals. Support reported multi-hinge arrangements without assuming all hardware reports them; simulation coverage is not proof of a specific trifold device.

## 5. Master, Detail and Inspector are different responsibilities

Master discovers/selects. Detail is the canonical selected item or active workspace. Inspector adds contextual actions/properties; it must not duplicate the detail screen. A map or scene is a supplementary workspace only when the product contract says so.

Use more space for meaningful companion panes, not stretched forms or excessive text line length. Derive fitting from minimum usable pane sizes, content and accessibility needs. Preserve existing documented breakpoints rather than introducing arbitrary thresholds. A foldable may legitimately show one content pane while retaining its right rail.

Book posture may place complementary content in separate usable regions. Tabletop may place preview/playback above and controls below when useful. Navigation policy does not change with either posture. Honor actual separation, not just a boolean folded flag.

Keep Inspector overlays inside their assigned usable/trailing region, away from hinges, keyboard, safe areas and rail targets. Opening an overlay must not resize, remove or remount underlying panes or change the authored stage aspect ratio. On a constrained segment, use the screen's approved contained overlay/sheet and preserve a reachable close action; do not invent a new navigation stack.

### Screen-specific presets: never make these universal

PaCasa's existing Workspace contract is 40/60 list/detail with a 30% Inspector overlay; compact flat windows use full-width detail. Its editorial cards use 60% media / 40% text and wide content uses a max-w-4xl cap. Keep these ONLY where that screen's contract applies. Preserve the existing percentage reference box; if undefined, establish and document it with tests rather than guessing.

Other products keep their own pane ratios, content roles, stage aspect ratios and Inspector edge. Do not spread a Workspace ratio into tutor rooms, maps, music players, forms or game scenes by copying a preset.

## 6. Preserve identity, state and session ownership

Use Zustand for new React application/component state under this project's policy; per-instance vanilla stores stay in refs with selector subscriptions. Keep imperative/native resource handles in refs. Do not introduce useState, duplicate state for compact/expanded views or recreate the store from geometry.

Change arrangements around stable content identities. No keys derived from width, posture or hinge angle. Selection, draft input, scroll anchor, focus intent and navigation history must survive fold/unfold and intermediate resizing. Own players, calls, camera/OCR workflows, game loops and XR sessions above replaceable presentation wrappers.

OS-driven recreation can require resource reconstruction: restore supported user/session state through existing lifecycle mechanisms and report unsupported continuity honestly. Rebind native listeners to the current activity, remove stale subscriptions and prevent duplicate sessions. Do not disable recreation, orientation or resizability as a substitute for fixing lifecycle handling.

## 7. Platform adapters, not a new application architecture

**Android:** preserve the existing Expo Modules 2 / Jetpack WindowManager bridge where present. Consume actual FoldingFeature bounds, orientation, state, isSeparating and occlusionType. FoldingFeature does not supply a precise hinge angle; do not fabricate one. Use verified sensors separately only for a justified physical interaction. Keep the existing Android adaptive renderer and SplitView/Inspector semantics; verify API support in installed versions before adding native UI wrappers. Merge manifest/plugin entries rather than replacing unrelated configuration.

**Apple:** reuse the supported Expo/native split-view path. SwiftUI adaptive containers and the FWC examples inform Apple-native adapters only. Verify APIs against official documentation, installed Xcode/SDK and deployment target; compile and availability-gate new APIs appropriately. Do not claim a SwiftUI API is already exposed by Expo/React Native. Do not raise deployment targets, replace the cross-platform router or impose Liquid Glass styling just to use this skill. Preserve the product's explicit navigation contract rather than adopting a generic leading-sidebar default.

**Web:** build through the project's semantic UI components, not raw HTML in feature screens. Use current container dimensions with SSR-safe initialization. Use reported viewport segments/posture only when supported and feature-detected; absent support means no asserted fold geometry, not guessed coordinates. Test a browser on a foldable separately from the native app. Header/menu/bottom-tab policy remains web-specific; close the menu on selection, Close, Escape and supported back actions.

**XR:** retain the existing Viro/Rive/shared spatial layouts and Meta/PICO/visionOS adapters. App-window dimensions are not scene coordinates or compositor-panel dimensions. Preserve an existing Quest 1280x800dp window contract where configured; do not apply it to every headset. Folding/window resize must not rebuild the renderer or register scene resources before the renderer/scene is available. No substitute camera or renderer path merely to make tests green. Report unsupported runtime capabilities honestly. Adaptive layout or a browser screenshot does not prove native system-window, compositor or device support.

## 8. Motion, performance and accessibility

Use Kinetrell and its established platform adapters for motion; keep Rive for authored animation where already used. Do not add Tamagui, Bento or another animation stack. Respect reduced motion. Avoid sending every raw sensor sample through full React renders; deduplicate equivalent geometry and profile actual layout work. Do not introduce GPU/Worklet machinery for a small layout calculation without evidence it helps. Preserve established WebGPU/TypeGPU/Eskiu ownership where present.

Test text scaling, focus order, screen readers, keyboard, touch/pointer and RTL. Keep close/primary actions visible and adequately sized. Preserve authored media framing and readable text widths. During animated transitions, hit targets must follow the actual layout and avoid hinge regions; decorative transitions cannot temporarily make essential controls unusable.

## 9. React Native Arrangement View: optional native enhancement

Reference documentation:
- https://thiagobrez.github.io/react-native-arrangement-view/index.html
- https://thiagobrez.github.io/react-native-arrangement-view/guide/installation
- https://github.com/FloWritesCode/fwc-swiftui-skills/tree/main/skills/swiftui-iphone-duo

**Extend, never replace, the existing AdaptivePanes / SplitView architecture.** Expo Router remains navigation owner; existing Master/Detail/Inspector components remain semantic pane owners; Zustand and refs retain selection and session state. Treat React Native Arrangement View as an optional, platform-gated *arrangement adapter* for related content (editor + inspector, player + playlist, preview + controls), not as a new navigator or a global layout provider.

Before installation, read the project's lockfile, the linked installation guide, native package peer dependencies and supported platforms. Resolve the current published package/version from the package registry; never assume a version from old examples. Confirm Expo SDK, React Native, React Native New Architecture, iOS/Android deployment targets, native module autolinking, config plugin/prebuild requirements and whether Expo Go is unsupported. Use `npx expo install` only after compatibility is established. Never claim an API exists without checking its installed types and docs; do not fabricate import names, props, events or hinge-angle support.

Implementation sequence:
1. Inventory existing adaptive containers, pane identity, measurements and device-family shell rules. Document baseline screenshots/tests.
2. Define a small typed arrangement boundary in the existing UI package that accepts stable pane children, desired split/overlay/stack semantics, usable regions and safe-area information; preserve existing API/visual defaults.
3. Add a native Arrangement View backend only where the installed library supports the platform and arrangement; feature-detect/availability-gate it. Avoid nested competing split engines and double-applied safe-area or hinge insets.
4. Use existing AdaptivePanes/SplitView fallback for unsupported Android/iOS versions, web, SSR and XR. The web fallback uses semantic UI components and responsive container sizing, not native-only imports during SSR. XR remains a separate Viro adapter, not a native Arrangement View inside the compositor.
5. Preserve physical-right native foldable/tablet rail and web header/menu/bottom tabs regardless of which arrangement backend renders the content.
6. Keep product state and native resources above backend switches. Avoid remounts when folding, rotating, resizing or opening Inspector; if a backend switch necessarily remounts a view, prove session restoration and focus/selection continuity.
7. Verify accessibility, RTL, keyboard, safe-area asymmetry, fold occlusion, multi-hinge geometry and nested overlays. Compare before/after screenshots; test both native development builds and browser separately.

On Apple, compare `@expo/ui/swift-ui` ArrangementView availability against this library only after verifying actual SDK and installed exports. Choose one backend per view and document why; never run two arrangement engines over the same pane pair. FWC SwiftUI iPhone Duo principles inform native adapters but do not justify SwiftUI-only code in shared React Native screens.

**Acceptance gates:** ordinary phone; native foldable closed/open/book/tabletop; right rail and RTL; native tablet narrow/wide; iOS supported/unsupported OS; Android with and without hinge features; web SSR and responsive browser; keyboard and Inspector overlays; media/call/camera continuity; XR fallback; unit, typecheck, lint and available native build tests. Report untested hardware explicitly. Roll out to the shared starter first, then update each consumer's pinned skill reference in PRs; no automatic dependency bump or mass migration without per-repo verification.

## 10. Acceptance scenarios

These are required test scenarios, NOT claims of completed tests. Add assertions to the repository's existing unit/component/end-to-end harness and record platform evidence.

| Scenario | Expected result |
| --- | --- |
| Native ordinary phone resized wide | Phone bottom tabs; content adapts independently. |
| Native foldable cover, narrow, no active fold feature | Physical-right rail; no phone-tab regression. |
| Same cover in RTL | Rail remains physically right; text/reading direction remains RTL. |
| Native tablet/headset window resized narrow | Right rail survives; content may collapse. |
| Unknown capability at startup then verified foldable | No permanent phone classification; stable resolved right-rail shell. |
| Web on the same foldable at phone width | Header plus bottom tabs; no side rail. |
| Wide web / intermediate width | Header links or menu; no side rail or duplicated navigation. |
| Vertical occluding hinge / flat dual-screen span | No content or touch target occupies hinge bounds. |
| Zero-width separating fold | Boundary respected despite zero occluding area. |
| Flat non-separating, non-occluding crease | No fabricated dead strip. |
| Horizontal tabletop hinge | Useful preview/control arrangement; rail actions clear the fold. |
| Multiple features, off-row feature, nonzero host origin | Every relevant feature handled; off-row feature ignored; coordinates correct. |
| Inspector opened/closed in book posture and RTL | Contained in assigned region; underlying frames, stage ratio and session identity unchanged. |
| Large text or keyboard inside a narrow segment | Primary/close actions reachable; no hinge or rail collision. |
| Fold mid-form, playback, call, camera/OCR or game | Supported state/session continuity; no duplicate work or posture-key remount. |
| Background/resume or activity replacement | Fresh bounds/listeners; no stale geometry or duplicate subscriptions. |
| Reduced motion / pointer / screen reader | Usable equivalent interaction and logical focus order. |
| Native platform configuration regenerated | Unrelated manifest entries and window contracts preserved. |

Test each existing layout boundary just below/at/above it and intermediate sizes, not only two endpoints. Include offset containers and multiple densities. Capture before/during/after transition evidence. Surface Duo hardware checks must cover hinge, span, posture, lifecycle, rotation, RTL, Inspector, keyboard and rail placement. Label unit fixtures, browser, emulator/simulator and physical-device results separately. Unavailable hardware is an explicit validation gap, never a pass.

## 10. Delivery and review gates

Make the smallest shared fix plus platform adapters and regression tests. For a skills-only task, change only instruction/skill files: no runtime refactor, dependency upgrade, merge or deployment. When applying the skill to an authorized feature task, include the required implementation rather than merely proposing it.

Each relevant PR must report: skills read; existing abstractions reused; navigation-policy and pane-policy decisions; affected files/platforms; checks actually executed and their results; unavailable SDK/hardware; screenshots/device evidence where relevant. Do not describe skill installation or documentation as implemented foldable support.

## Sources and scope

This original cross-platform adaptation draws on FWC's container adaptation, state continuity and fold-safety approach; it intentionally replaces its generic navigation assumptions with Michael's product policy.

- Upstream: https://github.com/FloWritesCode/fwc-swiftui-skills/tree/3a6c74be7bf9cbc6b19c2025922f6b364542c000/skills/swiftui-iphone-duo . Read SKILL.md and reference.md for Apple-native work; upstream revision is a reference pin, not a runtime dependency.
- Product contract: PaCasa AGENTS.md at commit 1c1d231b07c60b93c08496793d8eafd139bdd5e8, plus each consuming repository's own instructions. PaCasa-only numeric presets remain screen-scoped.
- Android API authority: https://developer.android.com/develop/ui/compose/layouts/adaptive/foldables/make-your-app-fold-aware
- React Native metrics: https://reactnative.dev/docs/usewindowdimensions
- Apple API authority: https://developer.apple.com/documentation/technologyoverviews/preparing-your-app-for-iphone-duo

Official SDK/API documentation determines platform capability; local product contracts determine intended behavior. Recheck version-specific APIs before implementing them. Do not treat source examples or simulated geometry as device validation.
