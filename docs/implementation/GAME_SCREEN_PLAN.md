# Game screen and touch controls: design plan

Builds on PR #30 (`origin/feat/city-dataset-contract-20261014`, head `2e84ff1`) and follows PR #29 (`origin/plan/mobile-world-screen-pr-stack`, PR 3 "Game world vertical slice" under the 2026-10-13 city-renderer scope lock). Nothing here touches the repo checkout. Draft sources are in `src/`, mirroring repo paths.

## 1. Facts verified before designing

Read with `git show origin/<branch>:<path>` and from the installed `node_modules`.

| Question | Finding | Evidence |
| --- | --- | --- |
| Router | `apps/mobile/app` is Expo Router. Feature code under `packages/app/features` imports `expo-router` in 23 places and `solito/navigation` in 4 (error screen, profile, web sign-in). | `git grep` on PR #30 head |
| Game needs navigation? | No. PR 3 has no outbound link, so the screen imports neither router. If one is added later, follow the feature's neighbours (native-only features use `expo-router`; shared web+native ones use `solito/navigation`). | design |
| Tab shell | Current tabs: `apps/mobile/app/(drawer)/(tabs)/_layout.tsx`, JS `Tabs` with `tabBarPosition` from `useAdaptiveNavigationPlacement()`, only `notifications` and `profile`. No Game route exists on any remote branch. PR 1 (native shell) has not landed. | route files |
| ThreeCanvas usage | Exported from `@acme/ui/three` (and `@acme/ui`). Only mounted by `apps/web/components/DeviceStage.tsx` and kit backgrounds (`CityHeightfield`, `HolographicTerrain`, `NeonTide`). All use a module-level `load` with a dynamic import. No native feature mounts it yet. | `packages/ui/three/*` |
| ThreeCanvas traps | (a) `fallback` renders inside a `pointer-events-none` layer, so a fallback with buttons cannot be pressed. (b) With `tracksPointer` (default true) it attaches RN pointer handlers to its outer view, which would sit inside an RNGH detector. (c) `paused` stops the loop but `invalidate()` still draws one frame. (d) `onBackendChange(null)` fires both for "no WebGPU" and "backend failed". | `ThreeCanvas.tsx` |
| Gesture library | `react-native-gesture-handler` `~3.2.1` (catalog), installed 3.2.1. v3 hook API: `usePanGesture`, `usePinchGesture`, `useRotationGesture`, `useTapGesture`, `useSimultaneousGestures`, `useExclusiveGestures`. `runOnJS` is in `CommonGestureConfig`. Pinch `scaleChange = current.scale / previous.scale`; rotation `rotationChange` is the per-event delta; pan has `changeX/Y`, `velocityX/Y`; end callbacks get `{ canceled }`. `GestureHandlerRootView` already wraps the root layout. | `node_modules/.pnpm/react-native-gesture-handler@3.2.1_*/src/v3` |
| Other versions | reanimated 4.7.0, worklets 0.13.0, react-native-webgpu 0.10.4, three 0.186.1, typegpu 0.12.6, zustand 5.0.15, RN 0.88.0-rc.3. | `pnpm-workspace.yaml`, `.pnpm` |
| State rules | CONTRIBUTING rule 4: no `useState` for business state. Kit pattern: module `createStore` from `zustand/vanilla` or `useInstanceStore` (store in a ref) plus `useStore` selectors. PR #30's `createCityCameraStore()` is a vanilla store. | `use-instance-store.ts`, `gpu-store.ts` |
| Lists / motion / HTML | The screen has no list (LegendList rule is moot). No moti. No raw HTML: kit `View`/`Text`/`Pressable` from `@acme/ui/tw` and kit components from `@acme/ui`. | design |
| Fold geometry | `useReservedRegions()` + `foldLayoutsFromRegions(regions, originX)` in `@acme/ui/adaptive-panes/parts`. **`useFoldLayouts(rowWindowX)` converts x only; `y` stays in window space**, so a tabletop fold would be mis-placed in any container not at window y=0. The screen subtracts its own measured window y. | `fold-layout.ts`, `use-fold-layout.ts` |
| Test runner | `node --test '**/*.test.ts'` in `packages/app` (Node type stripping). No component test harness in `packages/app`. | `packages/app/package.json` |
| Mobbin | Pokémon GO, Monster Hunter Now, Pikmin Bloom and Apple Maps are not in Mobbin's results for these queries. Used five structural references that are (section 9). | two `search_screens` calls |

## 2. Files

### Add, `packages/app/features/game/`

| File | Role | Draft |
| --- | --- | --- |
| `GameScreen.tsx` | Screen. Measures container, resolves state and HUD layout, mounts `GestureDetector` + `ThreeCanvas`, HUD overlay. | yes |
| `game-session.ts` | Module-scope `gameCameraStore = createCityCameraStore()` and `gameScreenStore` (canvasFailed, firstFrame, attempt, movePadOpen, announcedReady) with actions. Module scope so tab switches, rotation and fold never reset the camera. | yes |
| `game-status.ts` | Pure `resolveGameViewState()` and `shouldMountCanvas()`. | yes |
| `camera-input.ts` | Pure mappers: pan/pinch/twist to `CityCameraAction`, button `CameraCommand` steps, `headingDegrees`, `describeCamera`, fling inertia. | yes |
| `hud-layout.ts` | Pure hinge-safe HUD placement: `usableRegions()`, `resolveGameHudLayout()`, `insideOneRegion()`. | yes |
| `city-bounds.ts` | `cityDatasetBounds()`, `isOverMappedArea()` for the empty state. | yes |
| `city-data.ts` | Parses the bundled `harlem-apollo.json` once; `{ ok, dataset, bounds } | { ok: false, error }`. | yes |
| `load-game-scene.ts` | Stable ThreeCanvas `load`: dynamic import of PR #30's `createCityScene`, wrapped with a first-frame signal. | yes |
| `use-city-camera-gestures.ts` | RNGH v3 hooks composed into one gesture. | yes |
| `CameraControls.tsx` | Zoom, turn, compass/reset, move-pad toggle, 3x3 move pad. Kit `IconButton`. | yes |
| `MapAttribution.tsx` | ODbL credit and link, text from `dataset.source`. | yes |
| `GameStatusLayer.tsx` | Loading, empty, data-error, render-error, unsupported. Kit `ArrowLoader`, `Banner`, `EmptyState`, `Button`. | yes |
| `camera-input.test.ts`, `hud-layout.test.ts`, `game-status.test.ts` | Node tests. | yes, 22 passing (section 8) |

### Add, `apps/mobile/app/`

- `<tabs group from PR 1>/game.tsx`: one-line re-export of `GameScreen`. Draft at `src/apps/mobile/app/(tabs)/game.tsx`; the real group name comes from PR 1. Lands in the same change as its tab trigger.

### Change

- PR 1's tab layout: add the Game trigger. Not drafted here, because the shell and the adaptive-navigation change are owned elsewhere.
- No kit edits. No new dependencies. PR #30 files are used unchanged.

### Recommended follow-up in the kit (not in this PR)

- `useFoldLayouts` should convert `y` as well as `x`, or document that it is row-only. The Game screen works around it locally.

## 3. Component tree

```
GameScreen                      View flex-1, onLayout -> measureInWindow -> geometry store
├─ GestureDetector(exclusive(doubleTap, simultaneous(pan, pinch, rotate)))
│  └─ View  accessible, aria-label "3D map of Harlem, around the Apollo Theater",
│           accessibilityActions (9), onAccessibilityAction, onMagicTap=reset
│     └─ ThreeCanvas<GameSceneParams>
│          key="attempt-N"  (Retry only; never size/posture/fold)
│          load=loadGameScene  params={dataset, get camera(), onFirstFrame}
│          paused  tracksPointer={false}  fallback={null}  background=brand.night
│          onBackendChange=gameScreenActions.backendChanged
└─ View absolute inset-0 pointerEvents=box-none            (HUD, outside the detector)
   ├─ GameStatusLayer state rect=hud.status
   ├─ CameraControls layout=hud        (ready | empty)
   │  ├─ toolbar "Camera": Zoom in, Zoom out, Turn view left, Turn view right, Compass(reset), Move toggle
   │  └─ toolbar "Move" (when open): forward, left, right, back
   └─ MapAttribution source rect=hud.attribution   (whenever the canvas is mounted)
```

Rendering is on demand. The city is static, so the canvas is always `paused`, and a `gameCameraStore.subscribe` calls `canvas.invalidate()` once per camera change. A drag does not re-render React: the params object is stable and its `camera` getter reads the store at draw time. `createCityScene` throws if `dataset` identity changes; the screen never changes it.

## 4. States

| State | Condition (`resolveGameViewState`) | What shows | Canvas |
| --- | --- | --- | --- |
| loading | dataset ok, GPU `pending` or no frame submitted | `ArrowLoader` "Loading Harlem, around the Apollo Theater" in the status rect; attribution visible | mounted |
| default (ready) | frame submitted, look-at point over mapped geometry | world, controls, attribution | mounted |
| success | the loading to ready transition | one polite `announceForAccessibility`: "Harlem, around the Apollo Theater map ready. Facing north, 220 metres away". Once per session. | mounted |
| empty | frame up, camera off the tile (`isOverMappedArea` false; margin max(120 m, 0.75 × distance)) | non-blocking `Banner` "Nothing mapped here yet" + "Back to the Apollo" (reset). World stays touchable. | mounted |
| error (data) | `parseCityDataset` threw on the bundled JSON | blocking `EmptyState` "The Harlem map didn't load", tells the user to update the app. No retry: the file ships in the binary. | not mounted |
| error (render) | GPU supported but `onBackendChange(null)` | blocking `EmptyState` "The 3D view stopped drawing" + "Try again" (bumps `attempt`, new ThreeCanvas instance) | not mounted |
| unsupported GPU | `useGpuSupport() === 'unsupported'` | blocking `EmptyState` "This device can't show the 3D city", notes Mon and H-Lynk care still work | not mounted |
| offline | n/a | identical to default. The tile is bundled and nothing on this screen uses the network. | mounted |

"First frame" means the frame after the scene's first `update()` was submitted without the canvas failing. It does not prove nonblack pixels; PR #29's physical-device capture gate still applies. GPU device loss puts `gpu` back to `pending`; once `firstFrame` is true the screen does not fall back to the loader, and ThreeCanvas rebuilds on the new device.

## 5. Gesture mapping to `moveCityCamera`

All input goes through PR #30's `moveCityCamera`, which clamps pan to ±500 m per action and ±2000 m overall, zoom to 30–3000 m, wraps yaw, and drops non-finite input.

| Input | Action | Mapping |
| --- | --- | --- |
| One- or two-finger drag | `pan` | `right = -changeX × m/dp`, `forward = changeY × m/dp`. m/dp = 2 × 1.28 × distance × tan(25°) / canvas height, from the scene's fov 50 and camera height 0.8 × distance. The world follows the finger. Physical axes: RTL does not mirror the map. `averageTouches: true` for iOS/Android parity. |
| Release with ≥ 200 dp/s | `pan` per frame | Exponential decay at 5/s, stop under 20 dp/s, frame-rate independent (tested at 30 vs 120 fps). Any new touch stops it. |
| Pinch | `zoom` | `factor = 1 / scaleChange`; spread zooms in. |
| Two-finger twist | `orbit` | `radians = rotationChange`. Sign must be confirmed on hardware. |
| Double tap | `zoom` | one button step (factor 0.8). Exclusive over the continuous group. |
| Buttons and a11y actions | per `commandToAction` | zoom ×1.25 / ÷1.25; turn ±π/8; move 0.25 × distance; reset → `{ type: 'reset' }` |

Heading: `createCityScene` places the camera at target + (sin yaw, cos yaw) × distance with north = −z, so it faces bearing = −yaw. "Turn view left" is `orbit +π/8` (heading 0 → 337.5). The compass needle counter-rotates by the heading and its label reads "Reset view. Facing N degrees from north".

All callbacks use `runOnJS: true`. The camera store and the renderer both run on the JS thread, so UI-thread worklets would only hop back through `scheduleOnRN` on every event.

### Reduced motion

- Fling glide is disabled (`startPanInertia` returns null); turning the setting on mid-glide cancels it.
- Buttons, double tap and reset are instant in both modes, so they have no animated variant to author.
- The canvas is paused regardless, so ThreeCanvas's own reduced-motion freeze changes nothing.
- `ArrowLoader` already stops its animation under reduced motion. `EmptyState` uses the kit's `FadeIn`/`ScaleIn`, which follow the kit's motion presets.

## 6. Accessible alternatives

- Every gesture has a labelled single-tap button (WCAG 2.5.1). Drag maps to the move pad, pinch to Zoom in/out, twist to Turn left/right. Move pad directions are map directions and are not mirrored in RTL.
- The world view is one accessible element with nine `accessibilityActions` (zoom in/out, turn left/right, move forward/back/left/right, reset) and a hint. After each action it announces the new view ("Facing north-east, 220 metres away"). iOS magic tap resets the view.
- Targets: `IconButton` md is 44 pt; the layout reserves 48 dp per control so Android's 48 dp floor fits. The attribution link has a `min-h-11` (44) hit area.
- Toolbars carry `role="toolbar"` and names ("Camera", "Move"). Focus order follows render order: status, camera controls, move pad, attribution.
- Status uses `Banner`'s `role="status"` region. Blocking errors are full-screen `EmptyState`s with a text title and description, not colour alone.
- HUD buttons live outside the `GestureDetector`, so the kit's RN `PressScale` and RNGH never share a tree.

## 7. Hinge- and rail-safe placement

Per the `mikevocalz-foldable-layouts` skill (read in full at `256a97b`):

- **The world is one uninterrupted canvas.** It spans the hinge; PR #29 PR 7 asks for exactly this. Only HUD clusters are fold-aware.
- **Every HUD rect sits wholly inside one usable region.** `usableRegions()` cuts the safe area by each separating fold or full-occlusion feature: vertical folds into columns, horizontal into rows. A zero-width separating fold still cuts. A flat, non-separating, non-occluding crease does not. Off-container folds are ignored, and all folds are processed (trifold).
- **Controls** go on the logical trailing edge (thumb side for the reading direction). If the navigation rail is on that physical edge, they move to the opposite edge, in the lowest region. A column when it fits above the attribution row, otherwise a row.
- **Attribution** sits at the bottom of the region on the edge away from the controls.
- **Status banners** carry actions, so they share the controls' region. On a tabletop fold everything lands in the lower half, where the hands are.
- **Rail coordination with the other agent's adaptive-navigation change.** The HUD reads only `useAdaptiveNavigationPlacement().position` (`'left' | 'right' | 'bottom'`, already physical). If hardware family moves the rail to physical right on foldables and tablets, controls move to the left with no code change. The rail is drawn by the tab layout outside this container, so the HUD never overlaps it.
- **No remounts from geometry.** The ThreeCanvas key changes only on Retry. Container geometry lives in a per-instance store; folds are recomputed from live `useReservedRegions()` and the measured window origin on both axes (see the `useFoldLayouts` y finding in section 1).
- **Inspector:** none in PR 3. When PR 7 adds a hinge-safe Inspector, it should reserve its rect through the same `usableRegions()` output and pass it into `resolveGameHudLayout`.

## 8. ODbL attribution

`MapAttribution` renders `${source.attribution}, ${licenseLabel(source.license)}` ("© OpenStreetMap contributors, ODbL 1.0") from the parsed dataset, so a future tile with different terms cannot ship stale credit. It is a `role="link"` pressable that opens `https://www.openstreetmap.org/copyright` via `Linking.openURL` (the pattern in `features/onboarding/sign-in-nav.ts`). It shows whenever the canvas is mounted (loading, ready, empty), satisfying `data/README.md`: "Any map surface must visibly display the attribution and license link." Estimated heights and widths from `dimensionEstimates` are never shown as measurements.

## 9. Mobbin references (structure only)

- [Tripadvisor, 3D map](https://mobbin.com/screens/19f3c852-67e1-4d0c-8161-312ad653c3b8): recenter and 2D/3D toggle stacked on the trailing edge; actions above the bottom chrome.
- [Mindtrip, map + settings sheet](https://mobbin.com/screens/0fde4920-4094-4ee6-81f9-48bf5826a617): round actions stacked on one edge; settings in a bottom sheet rather than on the canvas.
- [Tolan, 3D world](https://mobbin.com/screens/9074f01e-a68c-481c-8307-20db0f86afd4): full-bleed 3D scene, a single recenter control low on the trailing side, primary actions in a bottom row.
- [Fresha, Apple Maps embed](https://mobbin.com/screens/7fd4b74d-ab0a-45c3-b90c-438b0778940f): map credit and "Legal" link in the bottom-leading corner.
- [Waymo, route map](https://mobbin.com/screens/ba739e29-bfd7-40b5-b497-d3734a8baa3c): back top-leading, layers top-trailing, detail in a sheet below the map.

## 10. Decisions

| Item | Disposition | Reason |
| --- | --- | --- |
| Game screen, controls, six states, attribution | BUILD | Real data end to end: bundled OSM tile, scene, camera store all on PR #30. |
| Offline banner | STRIKE for PR 3 | Nothing on the screen touches the network; an offline banner would describe nothing. Returns with tile streaming (PR #29 stage 3), which owns the network check. |
| Camera persistence to MMKV | DEFER | Blocked on a decision: what position is worth restoring once the Caller proxy exists (PR #29 stage 2). Session-only module store until then. |
| Tilt (pitch) control | DEFER | PR #30's `CityCamera` has no pitch; adding it is a contract change to `city-camera.ts`, not a screen change. |
| Tap-to-select buildings (raycast) | STRIKE for PR 3 | Out of the scope lock (no interactive storefronts or POIs). |
| Keep Game mounted when switching tabs | BUILD, measure | Fast return, no renderer rebuild; the paused canvas costs no frames. Record GPU memory with the tab backgrounded in the device pass. |
| Web | STRIKE | PR #29: web never gets the full Game screen. Dev-only `console.error` if it is ever mounted on web. |

## 11. Tests

### Unit (node, drafted, run against PR #30's real sources in a scratch copy: 22 pass, 0 fail, Node 26.8.2)

`camera-input.test.ts`
- drag direction follows the finger; m/dp scales with distance; zero/NaN viewport is a no-op
- pinch spread zooms in, close zooms out, zero rejected by the store
- heading = −yaw; turn left → 337.5°, right → 22.5°; move forward follows heading after a turn
- every command maps to a valid action; zoom in/out round-trips; reset restores `INITIAL_CITY_CAMERA`
- spoken summary text
- fling: off under reduced motion, below threshold and for NaN; decays to stop; same travel at 30 and 120 fps within 15%

`hud-layout.test.ts` (each case asserts every HUD rect is inside one region)
- phone portrait; RTL; rail right in LTR; physical-left rail in RTL
- vertical occluding hinge; zero-width separating fold; flat non-separating crease leaves one region
- tabletop puts controls, status and attribution in the lower half
- trifold with an off-container fold; short landscape → row axis; move pad beside or above the column; safe-area insets

`game-status.test.ts`
- precedence of all states; canvas stays mounted through empty
- real Apollo tile: the start view is mapped, the clamp corner (2000, 2000) is not, NaN is not
- first-frame signal fires once, after update, via macrotask

### Still to add in the implementation PR

- Component tests: none possible in `packages/app` today (no RN test harness). Add Storybook stories for each state in PR 8 with screenshot baselines and accessibility assertions, per PR #29.
- Argent device pass on iOS (iPhone Duo simulator per the user's simulator rule) and an Android device, labelled separately: nonblack first frame capture, drag/pinch/twist on hardware including the twist sign, double tap, each button, VoiceOver/TalkBack actions and announcements, reduced motion (no glide), RTL, font scale 200%, fold/unfold and tabletop with the camera position unchanged and no canvas remount, background/resume, leave and return to the tab 10×, unsupported-GPU path (force via a dev flag), render-error Retry.
- Performance baseline: first-frame time, frame time during a drag, JS and GPU memory with the tab active and backgrounded. No FPS claims without these numbers.

## 12. Open risks

- **Route path** depends on PR 1's tab group; the draft path is a placeholder.
- **Twist direction** is reasoned from UIKit's convention, not observed on device.
- **Pan accuracy** uses one m/dp at screen centre; rows near the horizon move faster than the finger. Acceptable for PR 3; a ground-plane raycast pan can replace it if it feels wrong on device.
- **Draft type check not run.** The `.tsx` drafts were written against the verified exports but not compiled; `pnpm --filter @acme/app typecheck` runs in the implementation PR. Unverified prop shapes: `View` accepting `accessibilityActions`/`onMagicTap` through the `@acme/ui/tw` css wrapper, and `ThreeCanvas`'s generic JSX form `<ThreeCanvas<GameSceneParams>>`.

## Skills read

foldable (`mikevocalz-foldable-layouts` @ 256a97b, full), react-native-best-practices (gestures, continuous gestures), expo-app-design, building-native-ui, threejs-fundamentals, threejs-interaction, mapbox-cartography, reanimated-skia-performance, ux-heuristics-review, accessibility, product-decisions, frontend-design, no-ai-slop. PR #29 adds two docs (`MOBILE_WORLD_PR_PACK.md`, `THREENATIVE_COMPATIBILITY_SPIKE.md`), both read. Its roster names external skills (expo/skills, mattpocock/skills, pbakaus/impeccable, Argent/agent-device, react-native-arrangement-view docs) that are not files in either PR, so they were not fetched.
