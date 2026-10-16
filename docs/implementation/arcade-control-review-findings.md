# Arcade control + game lobby: review findings (Lane F)

Independent verification of the complete working tree on `main` at `311ab58`, 2026-10-15. Lane F verifies work it did not write and fixes nothing; every defect below names the file and line, a severity, the input that fails, and the fix the owning lane should make. The orchestrator routes each one.

Scope: `packages/ui/game-controls/**`, `packages/ui/modules/nyc-gamepad-input/**`, `packages/ui/lobby/**`, `packages/ui/rive/**`, `scripts/rive/**`, `packages/core/{schemas/world-save.ts,schemas/leaderboard.ts,world/**,leaderboard/**,test/*}`, `packages/app/features/game/**`, `apps/mobile/app/(drawer)/**`, `apps/mobile/app.config.ts`, `apps/mobile/plugins/with-optional-gamepad.js`, `packages/theme/contrast.ts`, `docs/design/**`, `docs/implementation/**`, `docs/adr/0020-world-save-and-resume.md`, `docs/evidence/rive/**`.

Method: the gate run in `docs/evidence/verification/gates.md` (all pass except the pre-existing `phase1-loop` nickname test); six read-only review passes (input pipeline and native gamepad module, app and lobby features, save and resume path, directive §14 coverage mapping, Rive sources and evidence, prose and attribution), each cross-checked against the source before a finding was kept; the lane's own contrast, touch-target, accessibility-prop and copy-deck greps. Two reviewer claims were dropped after checking: that nothing in the touch path wires `cancelAll` (the app hook `use-game-input.ts:235-268` does), and that `headingRadiansFromYaw` can return exactly 2π (a JS `%` result is always smaller than its divisor). One claim was downgraded (M1, the cross-Caller overwrite) because the lobby rejects a `not-owner` save before START.

Nothing here was verified on a device. Component behaviour under real touches, VoiceOver, TalkBack, folds and gamepads is inferred from source and installed type definitions; `docs/evidence/verification/device-plan.md` is the script that turns those inferences into evidence.

## Counts

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 9 |
| Medium | 23 |
| Low | 16 |

The known gaps the lanes recorded are listed at the end, verified as documented, and are not counted above.

## Critical

### C1. START hangs forever when the world never reports a first frame

- `packages/app/features/game/lobby/GameLobbyScreen.tsx:45-54` (`awaitFirstFrame`), `:62-83` (`startLobbySession`), `packages/app/features/game/GameTab.tsx:17-26`.
- Failing input: any device or build where `GameScreen` ends in `data-error`, `render-error` or `unsupported` (no WebGPU, damaged bundled city, canvas backend null). `gameScreenStore.firstFrame` never flips, the promise never settles, no `catch` runs, `lobbyStore.phase` stays `transition` with the opaque cover up, START is inert, and the `GameStatusLayer` error state that would explain it renders under the cover where nothing can reach it. There is no timeout and no path back: `returnToLobby` has no caller (H6).
- Fix: race `awaitFirstFrame` against `gameScreenStore` entering a failure state and a bounded timeout; reject so `failStart` runs with the deck's failure line; unsubscribe on every path (today the subscription leaks unless `firstFrame` arrives).

Resolution 2026-10-15: START's wait is now bounded and fails fast. `awaitWorldReady` rejects when GameScreen publishes `data-error`, `render-error` or `unsupported` (new `gameScreenStore.viewState`) or after `FIRST_FRAME_TIMEOUT_MS` (20 s), and removes its subscription and timer on every path; the session starts only after the first frame, `resetForMount` stops an earlier mount's frame from counting, and `failStart` shows `g02.resume.fail.generic` through the new `GameLobby.startFailed` strip (`packages/app/features/game/lobby/await-world-ready.ts:46`, `lobby/GameLobbyScreen.tsx`, `lobby/resume-sequence.ts:60`, `GameScreen.tsx:136`, `packages/ui/lobby/GameLobby.tsx`; tests `awaitWorldReady *` in `lobby/await-world-ready.test.ts`, `a failed wait stops the run before the session starts` in `lobby/resume-sequence.test.ts`).

### C2. The pill writes `pill/holdProgress`, a path the start-stop artboard does not have

- `packages/ui/game-controls/rive-binding.ts:43` declares `pillHoldProgress: 'pill/holdProgress'`; `:128-131` writes it; `packages/ui/game-controls/StartStopPill.tsx:169-172` and `:279-286` feed it (20 steps per hold, 4 under reduced motion, each a `runOnJS` hop).
- `packages/ui/rive/arcade-controls/start-stop/scene.rml` and `build/start-stop.data.json` declare `pill/state`, `pressed`, `focused`, `activate` only; `grep holdProgress` over both returns nothing (verified by this lane).
- Failing input: any hold. Every step lands in `missingPaths` (a silent no-op nobody reads, M16). The ring the player sees is the artboard's own 72-frame `StopConfirm` animation on its own clock (about 1.2 s at 60 fps) while the session stops at 600 ms (`STOP_HOLD_MS`, `StartStopPill.tsx:110`). Under reduced motion `StopConfirmReduced` is a one-frame pose, so the authored four-step fill never appears.
- Fix (lane B and lane C together): author `ViewModelPropertyNumber holdProgress` on `Pill` and key the ring's trim from it, or delete the setter and the `useAnimatedReaction` and document the ring as artboard-timed with `holdMs` matched to the animation. Either way the directive §8 contract table must change, and a device run must show the ring and the stop coinciding.

Resolution 2026-10-15: the start-stop artboard authors `holdProgress` (number 0..1) on the Pill view model and binds the HoldRing trim `end` to it; a Motion layer keyed on `a11y/reducedMotion` swaps in an authored ring that reads `floor(x*4)/4`; StopConfirm no longer keys the trim and is one frame (`packages/ui/rive/arcade-controls/start-stop/scene.rml`, rebuilt `build/start-stop.riv`). The pill quantizes through `quantizeHoldProgress` (`packages/ui/game-controls/start-stop-pill-copy.ts`) and the hold is `STOP_HOLD_MS` 1000 ms. Proof: `docs/evidence/rive/start-stop/holdProgress-half.png` (`--data=pill/holdProgress=0.5 --screenshot`), `holdProgress-reduced-0.6.png` (renders the 0.5 step), `data-holdProgress.data.json` (`--data-dump`, value 0.5); §8 table row added to `game-controls-integration.md`. Tests: `rive-binding.test.ts` "C2: the built start-stop artboard defines every pill path", `start-stop-pill-copy.test.ts` "C2: hold-ring quantization", `check-contract.sh paths` fails against the pre-fix dump. A device run must still show the ring full on the frame the stop lands.

## High

### H1. Hardware input and screen readers reach gameplay while the lobby cover is up

- `GameLobbyScreen.tsx:72` dispatches `start` as the first resume step, so the session is `playing` before the reveal. `GameTab.tsx:19-26` mounts `GameScreen` under the lobby during `transition`. `packages/app/features/game/use-game-input.ts` enables the router and `useHardwareInput` on `worldReady` alone; nothing reads `lobbyStore.phase`.
- Failing input: a Caller with a pad or keyboard attached holds the stick or a cap during the `enter`/`hold` phases. `acceptsGameplayInput` is true, the camera moves, and the frame revealed is no longer the saved camera (directive §3 "no visible teleport"). The touch overlay is covered by the absolute lobby view, hardware is not. A VoiceOver user can also focus and activate the lobby START (`docs/evidence/rive/game-lobby/semantics.semantics.json` lists it under the cover) and the controller caps under the lobby, because only `GameTransition` is `aria-hidden` (`packages/ui/lobby/GameTransition.tsx:52-54`), not the lobby content or the controller.
- `docs/implementation/game-controls-integration.md:148` claims "nothing moves while the lobby is up either way"; that holds only until step 1 of the resume sequence.
- Fix: gate `useGameInput` and the hardware adapter on `lobbyPhase === 'game'`, and set `accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"` on the lobby content while `transitionPhase !== 'done'` and on the controller until `phase === 'game'`.

Resolution 2026-10-15: the router and the hardware adapter are enabled only when `gameplayInputEnabled(worldReady, lobbyPhase)` is true, i.e. once the phase is `game`; the controller mounts only then and the GameScreen tree is hidden from assistive tech until handover; the lobby content is hidden while the cover is up; and the session itself now starts after the first frame, so nothing under the cover is `playing` (`packages/app/features/game/game-input-bindings.ts`, `GameScreen.tsx:141,188,212`, `packages/ui/lobby/GameLobby.tsx` `covered`; tests `gameplay input waits for the lobby to hand over` in `game-lane-guards.test.ts`, `sets the camera before the wait, starts the session only after the first frame` in `lobby/resume-sequence.test.ts`). `game-controls-integration.md:148` is lane X2's doc; its claim is now true.

### H2. The leaderboard panel is one accessibility element; rows and "Try again" are unreachable

- `packages/ui/lobby/LeaderboardPanel.tsx:164-172`: the root `View` carries `accessible`, `accessibilityLabel={rankRegionLabel(spoken)}` and `accessibilityLiveRegion`. On iOS and Android an `accessible` container folds its descendants into itself. `Row` (`:204-207`) sets `accessibilityLabel` without `accessible`, so rows would not be elements even if the parent let them through, and the `StatusRow` "Try again" action (`:135-146`) is swallowed with them.
- Failing input: VoiceOver or TalkBack on the lobby. The reader says "NYC Rank, 4 rows" and nothing else; no rank, no name, no retry. `docs/design/screens/G02-game-lobby/07-a11y.md` Focus order requires region, status, rows, own row, "Try again".
- Fix: drop `accessible` from the root (keep the label through `accessibilityRole="summary"` or a heading), make each `Row` `accessible` with its label, and keep `StatusRow` reachable; or build the region label from the row labels and leave the retry action as its own element.

Resolution 2026-10-15: the panel root is a plain container; the header band is the `header` element carrying `g02.rank.a11y.region` and the polite live region; every kit row is `accessible` with `g02.rank.row.a11y`; when the artboard draws the rows its semantics are switched off (they spoke the score) and transparent 56 pt frames carry the row labels; `StatusRow` "Try again" is no longer folded (`packages/ui/lobby/LeaderboardPanel.tsx`, `leaderboard-style.ts` `leaderboardAccessibility`, `LobbyRiveSurface` `exposeSemantics`; tests `rank panel accessibility *` in `packages/ui/lobby/leaderboard-style.test.ts`). VoiceOver/TalkBack order still needs the device run.

### H3. Leaderboard keylines fail 3:1 on the panel's real face

- The panel sits on `SolidPanel tone="ink"`, whose face is `bg-ink-800` (`packages/ui/neon/SolidPanel.tsx:49`), not `ink-950`. `LeaderboardPanel.tsx:59` (`border-royal-500`, the default keyline), `:62` (`border-orange-700`, Harlem), `:107`, `:173-176`.
- Measured by this lane with the registry's formula: `royal-500` #0058F8 on `ink-800` #25293D = 2.56:1; `orange-700` #A35100 on `ink-800` = 2.55:1; both under the 3:1 UI floor. `orange-500` (5.48) and `carolina-500` (5.58) pass. `docs/design/screens/G02-game-lobby/07-a11y.md` measured these pairs on `ink-950` (3.63 / 3.61) and said "this screen adds no new pair"; `packages/theme/contrast.ts` has no row for either pair on `ink-800`, so `contrast.test.ts` could not catch it (Law 10).
- Fix (theme owner + lane for the lobby): add the `ink-800` rows; use `royal-400` and `orange-500` (or the brick family's lighter step) for keylines on the ink face, or register the keyline as decorative with a reason if the heading text is the boundary.

Resolution 2026-10-15: keylines moved to the lightest passing step on the real `ink-800` face: downtown/default `royal-400` 3.96, midtown `orange-500` 5.48, Harlem `orange-600` 4.14, megacity `carolina-500` 5.58, own-row marker `carolina-500`; the row divider is registered decorative with a reason; `royal-500` and `orange-700` on `ink-800` are FORBIDDEN rows; CONTRAST.md regenerated (`packages/ui/lobby/leaderboard-style.ts:17-33`, `packages/theme/contrast.ts` "rank panel:" rows; tests `rank panel keylines on the ink face *` in `leaderboard-style.test.ts`, theme suite 415/415).

### H4. A cap released while the controller is not `live` stays held in the router

- `packages/ui/game-controls/ArcadeController.tsx:213-216`: `onUp` returns early when `!live`, so `router.buttonUp` never runs; `onDown` is gated the same way, which is correct, and `onAccessibilityActivate` (`:217-221`) already sends its up unconditionally.
- Failing input: hold a cap, then `disabled` or `mode` flips (settings preview, a blocking state, a binding turning `enabled: false`). RNGH fires `onFinalize`/`onTouchesCancel` and the component's `up()` runs, but the router drops it; `heldButtons` keeps the cap and `holders` keeps `touch` until some `cancelAll`, which the kit itself never calls.
- Fix: never gate `onUp` on `live`; call `router.cancelAll('gesture-cancel')` when `live` goes true→false.

Resolution 2026-10-15: touch and accessibility presses go through `createTouchInputGate` (`packages/ui/game-controls/touch-input-gate.ts`): downs only while live, ups always, and live true→false calls `cancelAll('gesture-cancel')`; `ArcadeController.tsx` wires it (test `touch-input-gate.test.ts` "H4: a cap released after the controller stopped being live").

### H5. The Android gamepad HybridObject never unregisters

- `packages/ui/modules/nyc-gamepad-input/android/src/main/java/com/margelo/nitro/gamepadinput/HybridGamepadInput.kt:59-61`, `:135-139`: `GamepadEventHub.sink = this` is set in `init` and never cleared; `registerInputDeviceListener` has no `unregisterInputDeviceListener`; there is no dispose override. Swift is fine (`GameControllerObserver.swift:36-40` removes its observers in `deinit`).
- Failing input: a JS reload in development or a second `createHybridObject`. The old instance stays registered with `InputManager` and keeps calling JS callbacks from a dead runtime (leak at best, crash at worst).
- Fix: override Nitro's dispose hook (check the name in `react-native-nitro-modules` 0.37.1), clear the sink if it is `this`, unregister the device listener, clear the registries.

Resolution 2026-10-15: `HybridGamepadInput.dispose()` overrides Nitro 0.37.1's `HybridObject.dispose()` (`@CallSuper`): clears `GamepadEventHub.sink` only if it is still this instance (`GamepadEventHub.clearIfCurrent`, synchronized `install`), unregisters the `InputDeviceListener`, clears the four listener registries (`ListenerRegistry.clear`) and the main-thread maps, then calls `super.dispose()` (`packages/ui/modules/nyc-gamepad-input/android/src/main/java/com/margelo/nitro/gamepadinput/HybridGamepadInput.kt`). Not compiled: no Kotlin toolchain or Android build runs in this lane; a Gradle build and a JS reload on a device with a pad attached must prove it.

### H6. Nothing returns the player to the lobby after a STOP

- `packages/app/features/game/lobby/lobby.store.ts:39,67` defines `returnToLobby` ("pill stop or leaving the tab"); the only caller is `lobby.store.test.ts:41`. Repo-wide grep by this lane: no product code calls it.
- Failing input: hold-to-stop in the game. The session goes `idle`, the pill reads "Start", and `lobbyStore.phase` stays `game` for the life of the JS runtime; the leaderboard, resume status and lobby START are unreachable until the app restarts. The directive's flow (lobby → game, STOP ends the session) has no way back.
- Fix: subscribe `returnToLobby` to the session reaching `idle` after `confirmStop` (and to the tab blurring if that is the intent), or delete the claim from the store comment and the directive mapping.

Resolution 2026-10-15: `bindReturnToLobby` subscribes the lobby to the session; a session that ends (`→ idle`) while the phase is `game` calls `returnToLobby`; GameTab holds the binding (`packages/app/features/game/lobby/return-to-lobby.ts`, `GameTab.tsx`; tests `return to lobby *` in `lobby/return-to-lobby.test.ts`). Tab blur does not return to the lobby (the session survives a tab change by design).

### H7. The pill's "Stop" accessibility action stops the session with no confirmation

- `packages/ui/game-controls/StartStopPill.tsx:305-311`: the custom action `stop` calls `holdComplete()` directly.
- Failing input: a VoiceOver or TalkBack user picks "Stop" from the actions rotor; the session ends and the final save is written in one gesture. `docs/design/screens/G01-arcade-controller/07-a11y.md` Focus order item 1 requires the action to perform the hold "after a confirm alert"; directive §2C says STOP is "a deliberate hold-and-confirm, never a single tap".
- Fix: route the action through a confirm (`ResponsiveDialog` or `AccessibilityInfo` alert) before `holdComplete`, and announce the result.

Resolution 2026-10-15: the pill's accessibility "Stop" action opens a kit `ResponsiveDialog` confirm; only its Stop button calls `onStopHoldComplete`, which then announces "Stopped. Your last save is kept"; Cancel announces "Stop cancelled" (`packages/ui/game-controls/StartStopPill.tsx`, copy in `start-stop-pill-copy.ts` `PILL_STOP_CONFIRM`). Component code: verified by typecheck only; VoiceOver and TalkBack must be checked on a device.

### H8. One hardware event hides the touch controls, and nothing brings them back

- `packages/ui/game-controls/layout/AdaptiveControlLayout.tsx:209` unmounts the touch slots when the hardware source is active; `packages/ui/game-controls/hardware/use-hardware-input.ts:86-89` marks the source active on every key and axis event, modifiers and noise included; `hardware-input.store.ts:17-20` says the touch lane may set `touch` back, but the slots that would do so are unmounted.
- Failing input: a tablet with a keyboard case, or web. One stray keystroke removes the on-screen controller until blur or disconnect. If a cap was held at that moment it stays held (H4).
- Fix: `cancelAll('layout-change')` before hiding; mark active only for mapped keys and non-zero axes; add a way back (a stage touch or a "Show touch controls" affordance that sets `touch`).

Resolution 2026-10-15: only meaningful hardware input marks a source active (bound button, Start, mapped key, an axis event that produced a move) in `packages/ui/game-controls/hardware/hardware-input-adapter.ts`; when the overlay hides, `TouchInputGate.releaseTouch()` ends only touch's caps and stick; `AdaptiveControlLayout` renders a `restoreTouch` slot at the pill rect and `ArcadeController` puts a "Show touch controls" button there that sets `activeSource` to `touch` (tests `hardware-input-adapter.test.ts` "H8: only meaningful hardware input", `touch-input-gate.test.ts` "H8: hiding the touch slots releases only touch").

### H9. Leaderboard rows are written through `rows[n]/…` paths the runtime does not document

- `packages/ui/lobby/lobby-rive-binding.ts:38-41` builds `leaderboard/rows[${i}]/rank|name|score|isSelf` and `:126-135` writes them with `numberProperty`/`stringProperty`/`booleanProperty`. `@rive-app/react-native` 0.5.2 `lib/typescript/src/specs/ViewModel.nitro.d.ts:94-100,188-196` exposes lists through `listProperty(path)` then `getInstanceAtAsync(index)`; nothing documents bracket indexing in a scalar path. The lane's own doc records the CLI rejecting the same syntax: `docs/implementation/rive-round-trip.md:148-150`.
- Failing input: any real ranking on device. The four rows keep their authored fixtures (Vesper, Nimbus, Kestrel, Sable, `leaderboard/scene.rml:478-501`), sixteen entries land in `missingPaths`, and nobody reads them (M16). The native `Row` fallback renders only when `rive?.file` is absent (`LeaderboardPanel.tsx:158`), so on device the Rive fixtures would show over real data.
- Fix: resolve `listProperty('leaderboard/rows')`, `getInstanceAtAsync(i)`, then the relative `rank`/`name`/`score`/`isSelf` on the item (`build/leaderboard.data.json:432-453` shows relative paths on list items). Capture a device run before the composition is called done.

Resolution 2026-10-15: rows go through the runtime's list API: `listProperty('leaderboard/rows')` → `getInstanceAtAsync(i)` → the item's relative `rank`/`name`/`score`/`isSelf` (ViewModel.nitro.d.ts:94-100,188-196; `build/leaderboard.data.json` shows `leaderboard/rows` as `type: list, size: 4`). Items resolve once; rows set earlier are flushed; a missing list or item lands in `missingPaths`; late resolves after dispose write nothing (`packages/ui/lobby/lobby-rive-binding.ts`; tests `writes rows through leaderboard/rows list items, never a bracketed scalar path` and three siblings in `lobby-rive-binding.test.ts`). Device capture of real rows over the fixtures is still owed.

## Medium

### M1. The save path trusts whatever save is on disk as "previous", whoever owns it

- `packages/app/features/game/world-resume/use-world-save-lifecycle.ts:49` takes `previous` from the snapshot with no `playerId` check; `world-snapshot.ts:68-90` copies `worldInstanceId`, `districtId` and `sync` forward from it. `resolveResume` (`packages/core/world/resume.ts:151`) rejects a `not-owner` save, and the lobby gates START on that error, so the normal path is safe.
- Failing input: Caller A stops in-game (session idle, pill "Start", lobby never returns, H6); the Mon save switches to Caller B; the in-game pill START (`game-controls-integration.md` §3) dispatches `start` with B's identity read at mount (`GameScreen.tsx` reads it once). The next save carries `playerId: B`, A's `worldInstanceId`, A's revision + 1, and overwrites A's world.
- Fix: in `saveWorldNow`, treat `previous.playerId !== identity.playerId` as `previous = null` and refuse the write until the Caller chooses start-new; or key the storage per `playerId`.

Resolution 2026-10-15: `saveWorldNow` refuses to write when the stored save belongs to another Caller (`ownedPrevious` → `'foreign'`); recorded in ADR 0020 (`packages/app/features/game/world-resume/use-world-save-lifecycle.ts`, `world-snapshot.ts` `ownedPrevious`; test `another Caller's save is never the previous one` in `world-resume/world-ownership.test.ts`).

### M2. `deviceId()` is not persisted before the first save exists

- `packages/app/features/onboarding/save-store.ts:26-31` (pre-existing, unchanged): with no save, each call returns a fresh `device-<timestamp>` and stores nothing. `world-snapshot.ts:52-58` hashes it into session and world ids; `WorldSaveV1Schema.deviceId` records it.
- Failing input: a world saved before the Mon save holds a `queue.deviceId`. Each save can claim a different device, which defeats the device-level conflict story in ADR 0020.
- Fix (onboarding owner): persist the minted id on first read; use a crypto UUID.

Resolution 2026-10-15: the world identity takes the Mon save's queue id when present, else a world-store id minted once (UUID when the runtime has one) and persisted under `world-device-id`; GameScreen and the lobby now share one identity reader (`world-resume/world-save.store.shared.ts` `readOrMintDeviceId`, `world-snapshot.ts` `pickDeviceId`, `lobby/lobby-identity.ts`; tests `device id *` in `world-ownership.test.ts`). The onboarding `deviceId()` still returns an unpersisted id with no Mon save; that file is outside lane X1 and is reported to its owner.

### M3. A cramped layout shrinks the cluster slot below the arch's own clamp

- `packages/ui/game-controls/layout/controller-layout-resolver.ts:162-181,232-253` lets `fitScale` fall toward 0 (`cramped` below 0.6); `six-button-arch.ts:80` clamps to 0.8…1.4, so the arch box is at least 153.6 × 102.4 dp while the slot is `208 × scale` by `136 × scale`. `ArcadeController` ignores `layout.cramped`; `AnalogStick.tsx:89-91` uses the unclamped scale and drops under 44 pt around 0.34.
- Failing input: a narrow fold segment. Caps overflow the slot and can sit on the hinge; the 44 pt floor is kept at the cost of the hinge-safe guarantee the resolver tests promise.
- Fix: when `cramped`, hide the touch controls or surface the state; or floor the resolver scale at 0.8 and report failure.

Resolution 2026-10-15: `USABLE_SCALE_MIN` is 0.8, the arch's own clamp and the profile floor; a cramped layout drops the stick and cluster and keeps the pill (which never scales) in `AdaptiveControlLayout.tsx`, and `ArcadeController` releases touch holds when a layout resolves cramped (`layout/controller-layout-resolver.ts`, test "an uncramped layout always fits the arch and the stick it renders (M3)", red at 0.6).

### M4. A stick that began inside the dead zone is not neutralised when disabled

- `packages/ui/game-controls/AnalogStick.tsx:230-241`: the disable effect runs only if `voice.direction !== 'none' || lastEngaged`. A touch that started and stayed in the dead zone owns the router stick with a neutral reading, so no `cancel` is published and `stickOwner` stays `touch`; later keyboard or gamepad `begin`s are rejected as "owned by touch".
- Fix: test `owner.get() !== -1` instead. Add the same effect to `ArcadeActionButton` (it has none; whether RNGH 3 fires `onFinalize` when `enabled` flips mid-gesture is unverified).

Resolution 2026-10-15: both touch controls release on disable by pointer ownership (`mustReleaseOnDisable`, `packages/ui/game-controls/touch-ownership.ts`); `AnalogStick.tsx` uses it in place of the direction/engaged test and `ArcadeActionButton.tsx` gains the same effect, sending its `up` (test `touch-ownership.test.ts`). Whether RNGH 3.2.1 also fires `onFinalize` is still a device check.

### M5. The web gamepad poll loop and window listeners are never torn down

- `packages/ui/game-controls/hardware/gamepad.web.ts:148-157,185-191`: the rAF loop runs while any pad is attached regardless of listeners and is not stopped when the last hook unsubscribes; `gamepadconnected`/`gamepaddisconnected` are added and never removed.
- Fix: start the loop only while a listener set is non-empty (the `Listeners.add` `onFirst`/`onLast` hooks exist) and remove the window listeners symmetrically.

Resolution 2026-10-15: the web source attaches `gamepadconnected`/`gamepaddisconnected` and runs the frame loop only while a connection, button or axis listener exists, and removes both with the last one (`packages/ui/game-controls/hardware/gamepad.web.ts`, test `gamepad.web.test.ts` "M5: web gamepad teardown").

### M6. The web keyboard adapter captures editable targets and modifier chords

- `gamepad.web.ts:167-171,203-209`: key events on `window` with no editable-target filter and no `preventDefault`. Arrows and Space scroll the page; WASD/JKL typed into an `<input>` drive the game; Cmd/Ctrl+K fires button b.
- Fix: ignore `input`, `textarea` and `contenteditable` targets and any event with ctrl/meta/alt; `preventDefault` for mapped codes.

Resolution 2026-10-15: keyboard events pass `createKeyEventFilter` (`packages/ui/game-controls/hardware/web-key-filter.ts`): no editable targets, no Ctrl/Meta/Alt chords, mapped codes only with `preventDefault`, and an up always follows a forwarded down (test `web-key-filter.test.ts`).

### M7. A hardware stick `begin` rejected by the router leaves the adapter engaged

- `use-hardware-input.ts:91-93,189-193` assumes `begin` was accepted. While touch owns the stick the router rejects it; the adapter's local state stays engaged, later updates are rejected, and after the touch ends they are rejected as "update without begin". Keys stay held with no movement until released and pressed again.
- Fix: re-issue `begin` when `router.stick.engaged` is false and the adapter believes it is engaged, or send `update` as `begin` when the owner is null.

Resolution 2026-10-15: the adapter sends an `update` as a `begin` when the router's stick is not engaged, so a begin rejected while touch owned the stick is retried once touch lets go (`hardware-input-adapter.ts` `publishMove`, test "M7: a stick begin the router rejected is retried").

### M8. Any device disconnect releases every source's held buttons

- `use-hardware-input.ts:152-154`: a single disconnect calls `forgetAll()` and `router.cancelAll('source-disconnected')`.
- Failing input: unplug pad B while pad A or a thumb holds a cap; everything drops.
- Fix: per-device held sets; release only that device's buttons and cancel the stick only if that device owned it.

Resolution 2026-10-15: held buttons are tracked per device; a disconnect releases only that device's buttons, ends the gamepad stick only if that pad drove it, and the last device leaving while hardware drove sends one `cancelAll('source-disconnected')` (`hardware-input-adapter.ts`, tests "M8: a disconnect releases only that device").

### M9. Three different numbers for the stop hold

- Touch: `StartStopPill.tsx:110` `STOP_HOLD_MS = 600`. Hardware: `hardware/hold-to-stop.ts:6` `STOP_HOLD_MS = 1000`, re-exported by `hardware/index.ts:11`, consumed by `use-game-input.ts:27,280,285` for the ring timer. Spoken hint `StartStopPill.tsx:132` "Hold for one second to stop". `docs/design/screens/G01-arcade-controller/07-a11y.md` says 600 ms.
- Failing input: a pad user holds Start for 700 ms (nothing), a thumb holds for 700 ms (stop); the ring timer in `use-game-input.ts` fills over 1000 ms while the touch hold completes at 600 ms.
- Fix: one constant in `contract.ts` or `touch-geometry.ts`; hint and deck follow it.

Resolution 2026-10-15 (app half): `use-game-input.ts` reads `STOP_HOLD_MS` from `@acme/ui/game-controls/parts`, which lane X2 now sources from `contract.ts:47` (1000 ms), so the ring timer and both hold paths share one number (test `the in-game stop ring times itself from the contract hold` in `game-lane-guards.test.ts`).

Resolution 2026-10-15: `STOP_HOLD_MS = 1000` lives in `packages/ui/game-controls/contract.ts`, exported through `parts.ts`; `hardware/hold-to-stop.ts` re-exports it, the pill's local 600 is gone, and the spoken hint is derived from it (`stopHoldHint`), so the touch hold, hardware hold, the app's ring timer and the hint agree. The ring has no clock of its own (C2). Test `start-stop-pill-copy.test.ts` "M9: one stop-hold number". `docs/design/screens/G01-arcade-controller/07-a11y.md` ("held 600 ms") and `04-components.md` (`holdMs=600`) are outside this lane and still say 600.

### M10. The six new arcade contrast rows cite no usage, and the disabled-glyph row is missing

- `packages/theme/contrast.ts:431-436`: `usedAt: []` on all six, printed as "token contract" in `docs/design/CONTRAST.md:335-340`; the comment at `:437` admits the disabled cap glyph row "joins once ArcadeActionButton cites its line". The kit does draw these pairs: `StartStopPill.tsx:293` (`text-silver-300` on the concrete-800 pill face), `ArcadeActionButton.tsx:190` (`border-carolina-500` held ring). `contrast.test.ts:52` enforces `usedAt` only for decorative and disabled rows, so the gap is invisible to the test.
- Fix (theme owner): cite the two lines, add the exempt disabled-glyph row with its reason, and consider extending the test to require `usedAt` on every row that is not a token-contract row by name.

Resolution 2026-10-15: DEFER to the theme owner (lane X1 owns `packages/theme/contrast.ts`); the exact row edits are in lane X2's report: cite `packages/ui/game-controls/StartStopPill.tsx:299` and `rive/arcade-controls/right-six/scene.rml:250` for the idle glyph, `right-six/scene.rml:339` for pressed, `right-six/scene.rml:284,290` for the keylines, `ArcadeActionButton.tsx:200` and `start-stop/scene.rml:40` for the held/focus ring, `start-stop/scene.rml:81,98` for the hold ring, and add the exempt disabled-glyph row citing `right-six/scene.rml:380`.

### M11. Sliders speak raw fractions and labels are announced twice

- `packages/app/features/game/controls-settings/ControlsSettingsScreen.tsx:205-222,243-259`: the kit `Slider` has no `valueText` (file header `:13-17` records the DEFER), so VoiceOver reads "0.15" where the deck requires "15 percent"; `percentSpoken`/`timesSpoken` exist in `controls-settings-copy.ts:104-117` and are unused. `LabelRow` (`:81-88,204-207`) renders the label as visible text and passes the same string as the Slider `label`, so readers hear it twice.
- Fix: `Slider.valueText` in the kit (`game-controls-integration.md` §8 already asks for it); hide the visible `LabelRow` label from assistive tech until then.

Resolution 2026-10-15: each slider sits in one `adjustable` element labelled once, with `accessibilityValue.text` from the deck (`percentSpoken`/`timesSpoken`) and increment/decrement stepping through `stepSlider`; the visible label row is inside that element, so it is not read twice (`packages/app/features/game/controls-settings/ControlsSettingsScreen.tsx` `SliderField`; test `an accessibility increment or decrement moves one snapped step` in `controls-settings-copy.test.ts`). Kit `Slider.valueText` remains the cleaner fix for the kit owner; device check owed.

### M12. The recovery dialog offers buttons that do nothing

- `GameLobbyScreen.tsx:97-105`: `from-district`, `restore-server`, `use-newer`, `keep-local`, `not-now` close the dialog and change nothing (Decision: DEFER recorded). The dialog still shows "Restore from the server" and "Start from your last district" as primary actions.
- Failing input: a Caller with a corrupt save taps "Restore from the server"; the dialog closes, the strip stays, no feedback. The repo rule the Game screen applies to caps ("no live cap that does nothing") is broken here.
- Fix: hide the actions whose choice is a no-op, or show the deck's generic failure line on tap.

Resolution 2026-10-15: `recoveryActions` takes the set of choices the host can perform; the lobby passes `new-game`, `retry`, `not-now`, so no dead button is offered (an unreadable save now offers "Start a new game" plus "Not now"; a changed map offers "Start a new game"); unoffered choices log if ever reached (`packages/ui/lobby/lobby-copy.ts` `recoveryActions`, `GameLobby.recoveryChoices`, `GameLobbyScreen.tsx` `LOBBY_RECOVERY_CHOICES`; test `never offers a recovery the host cannot perform` in `lobby-copy.test.ts`).

### M13. Two accessibility trees for every control: the Rive semantics and the RN wrapper

- `ArcadeRiveSurface.native.tsx:44` and `LobbyRiveSurface.native.tsx:44` mount `RiveView` with `semantics={Semantics.Automatic}`, so the artboard exposes its own six buttons, slider and pill (`docs/evidence/rive/right-six/semantics.semantics.json`). The RN wrappers also own a full tree (`ArcadeActionButton.tsx:179-189`, `AnalogStick.tsx:282-295`, `StartStopPill.tsx:299-311`, `AngledStartButton.tsx:107-110`). `AnalogStick` hides its housing (`:303 aria-hidden`); `ArcadeSixButtons.tsx:101-107` and the pill's `Sink` do not hide the surface from the tree in the same way. `G01 07-a11y.md` Screen reader table: "the React Native wrapper owns the tree and the Rive view is `accessible={false}`".
- Failing input: VoiceOver on the cluster. Expected: six caps. Risk: twelve, half of them Rive buttons whose "tap" fires the artboard's A11y Tap listener, not the router.
- Fix: pick one owner per control. If the RN wrapper owns it, pass `semantics={Semantics.None}` (or the runtime's equivalent) and `accessible={false}` on the surface; if Rive owns it, wire the semantic actions to the router. Needs a device run either way.

Resolution 2026-10-15: the React Native wrapper owns the tree: `ArcadeRiveSurface.native.tsx` mounts `RiveView` with `semantics={Semantics.Off}` (core/Semantics.d.ts: no accessibility elements are created), `accessible={false}`, `accessibilityElementsHidden` and `importantForAccessibility="no-hide-descendants"`. Typecheck only; a VoiceOver/TalkBack pass must count six caps. The lobby surface (`LobbyRiveSurface.native.tsx`) is lane X1's.

### M14. The right-six release spring has no reduced-motion sibling

- `packages/ui/rive/arcade-controls/right-six/scene.rml:345` `Released` (10 frames); the Pose layer's transitions around `:551-567` key on `stateIndex` only. Compression is gated (`:688-700`, `CapCompressedReduced :393`); release is not. The left stick does it right (`left-stick/scene.rml:435-463`).
- Fix: a one-frame `ReleasedReduced` and split transitions on `reducedMotion`.

Resolution 2026-10-15: right-six gains a one-frame `ReleasedReduced` (id 0:406) and every transition into Released splits on `reducedMotion` (`packages/ui/rive/arcade-controls/right-six/scene.rml`, rebuilt); evidence `docs/evidence/rive/right-six/released-reduced.png`, whose hash equals `idle.png`.

### M15. No Rive view is ever paused; the lobby loops run until unmount

- `ArcadeRiveSurface.native.tsx:42`, `LobbyRiveSurface.native.tsx:42`: `autoPlay`, no `RiveViewRef`, no `pause()` anywhere in `packages/ui` (grep). `RiveView.nitro.d.ts:94` has `pause()`. Looping content: `leaderboard/scene.rml:135` `Loading`, `start-angled/scene.rml:229` `TraceLoop`, `game-transition/scene.rml:406` `Hold`. `GameTransition` unmounts at `done`; the leaderboard and START only stop when `GameTab` unmounts the lobby after `finishStart`, so during the whole `hold` (and forever in C1) they run at full rate. Nothing pauses on `AppState` background.
- Fix: forward a ref or a `paused` prop and call `pause()` when the transition leaves `done` and on background.

Resolution 2026-10-15 (lobby half): `LobbyRiveSurface` takes `paused`, holds the view through `useRive()`'s `hybridRef`, and calls `pause()`/`play()` on prop changes and AppState; the rank panel and START pause whenever the cover is up (`packages/ui/lobby/LobbyRiveSurface.native.tsx`, `lobby-playback.ts`, `GameLobby.tsx`; tests in `lobby-playback.test.ts`). `ArcadeRiveSurface.native.tsx` belongs to lane X2. Render-loop stop still needs a device trace.

### M16. Rive errors are swallowed and `missingPaths` is read by nobody

- `ArcadeRiveSurface.native.tsx:46`, `LobbyRiveSurface.native.tsx:46`: `onError={() => undefined}`. `missingPaths` is referenced only in the two bindings and their tests (grep by this lane: zero host readers). C2 and H9 both hide behind this.
- Fix: `__DEV__` warn at minimum; route both to the kit diagnostics (`InputDiagnostics` has the shape).

Resolution 2026-10-15: `riveDiagnosticsStore` (`packages/ui/game-controls/rive-diagnostics.ts`, exported from `parts.ts`) records every missing View Model path (via the new `createArcadeRiveBinding(instance, { onMissingPath })`) and every `RiveView` error, with a development warning per new entry; `ArcadeRiveSurface.native.tsx` routes both there (test `rive-binding.test.ts` "M16: missing paths are reported, not swallowed"). `LobbyRiveSurface.native.tsx` (lane X1) can call the same store.

### M17. `verify.sh` gates exit codes, not content

- `scripts/rive/verify.sh:36-43,195-197,208-214` fails on a non-zero `rive` exit, the string "no property", `inspect` problems, and `check-colors`. It writes semantics JSON, data dumps and screenshots but never asserts a node per interactive element, a touch-target size, a bound path name against the TS constants, a reduced-motion sibling, or a non-blank screenshot. The header comment claims only what it does, so there is no over-claim, but §14 "semantics tree presence, touch-target dimensions" has no automated gate.
- Fix: add `jq` assertions over the semantics dumps (one `button` per cap, `slider` for the stick, bounds ≥ 44) and a path-name diff between `*.data.json` and `rive-binding.ts` / `lobby-rive-binding.ts` (that diff would have caught C2 and H9).

Resolution 2026-10-15: `scripts/rive/check-contract.sh` (called by full `verify.sh` runs) asserts six right-six buttons, a stick slider, 44 x 44 interactive bounds and no empty text labels over the semantics dumps, and fails when any `ARCADE_VM_PATHS` literal is missing from its built `.data.json`; the lobby leg reports only while lane X1 moves rows to a list property. Red run against the pre-C2 dump: `FAIL: arcade path pill/holdProgress missing`.

### M18. §14 coverage gaps (no component tests exist)

- No `*.test.tsx` in scope. Missing: two or three distinct pointers on stick plus caps (router tests tag everything `touch`); fold or layout change while a control is held (nothing sends `cancelAll('fold-change')` mid-hold; `world-resume.test.ts:188` only checks a stray `cancelStop` is ignored); rebinding a cap to a different action; touches outside the stick, cluster and pill rects not intercepted; lobby input never reaching the game router. Full table in the coverage section below.
- Fix: `@testing-library/react-native` or RNGH's `fireGestureHandler` for the multi-pointer and cancel cases; a resolver-level test that re-resolves with a fold while `router.heldButtons` is non-empty.

### M19. New `expo-router` imports in `packages/app`

- `packages/app/features/game/use-game-input.ts:23` (`useFocusEffect`) and the modified `packages/app/features/settings/settings-content.tsx:4,16,29` (`useRouter`, `router.push('/game-controls')`). The standing rule for this repo family is solito only in product code (`docs/REPO_MAP.md:108` names `solito/link` for in-app links); 25 tracked files under `packages/app` already import `expo-router`, so this is an existing debt, not a new class.
- Fix: `solito/navigation` `useRouter` for the push; a navigation-agnostic focus signal (AppState plus the tab's own focus prop) for the cancel, or a dated exception recorded in docs.

Resolution 2026-10-15: `use-game-input.ts` no longer imports `expo-router`; focus arrives as a `focused` prop (GameTab → GameScreen → `useGameInput`) and losing it cancels with `screen-transition` (test `no Game feature file imports expo-router` in `game-lane-guards.test.ts`). Outside lane X1, reported: `apps/mobile/app/(drawer)/(tabs)/game.tsx` must pass `focused={useIsFocused()}` to `GameTab` (until then the default `true` means a tab change drops input only through unmount/AppState); `packages/app/features/settings/settings-content.tsx` still uses `useRouter` from expo-router.

### M20. "Start new" destroys an unreadable save with no quarantine

- `GameLobbyScreen.tsx:88-90` calls `worldSaveStore.clear()`; `world-save.store.shared.ts:68-71` removes the key. The `unreadable` snapshot keeps `raw` precisely so it can be uploaded for diagnosis (`:28`), and `clear` throws it away.
- Fix: copy `raw` to a quarantine key before removing.

Resolution 2026-10-15: `clear()` copies an unreadable snapshot's `raw` to `world-save-quarantine` before removing the save (`world-resume/world-save.store.shared.ts` `clear`; tests `start new keeps an unreadable save for diagnosis *` in `world-ownership.test.ts`).

### M21. The gamepad manifest plugin appends without dedupe and nothing checks the result

- `apps/mobile/plugins/with-optional-gamepad.js:10-17` pushes `android.hardware.gamepad required=false` onto whatever `uses-feature` already holds. If another plugin (expo-horizon-core rebuilds `uses-feature`, per the `app.config.ts` comment) adds the same feature or replaces the array after this mod runs, the result is a duplicate or a silent loss; no prebuild assertion reads the generated manifest.
- Fix: dedupe by `android:name`; add a check that greps the prebuilt `AndroidManifest.xml` for `required="false"`.

Resolution 2026-10-15: `apps/mobile/plugins/with-optional-gamepad.js` merges by `android:name` (`applyOptionalGamepad`): an existing gamepad entry is rewritten to `required="false"`, duplicates collapse, other entries are kept, and it is idempotent (test `packages/ui/modules/nyc-gamepad-input/test/with-optional-gamepad.test.ts`). The prebuilt-manifest grep is DEFER: it needs `expo prebuild`, which this lane does not run; a plugin that later replaces `uses-feature` wholesale would still drop the entry, and only that check would show it.

### M22. Copy outside the decks

- `ArcadeActionButton.tsx:174` hint `'Not ready'` for cooldown; the deck has `g01.btn.state.cooldown` "Ready in {seconds} seconds" (`G01/05-copy.md:47`).
- `packages/app/features/settings/settings-content.tsx` (new row): "Game" and "Stick, buttons, hand, haptics." are in no deck.
- `packages/ui/lobby/lobby-copy.ts` `rankStatusSpoken`: "{n} rows", "1 row", "{n} rows, may be out of date" are not in `G02/05-copy.md`.
- Pre-existing, in scope: `packages/app/features/game/GameStatusLayer.tsx` says "This device can't show the 3D city" and "which this device doesn't offer" (Law 9: never "device" in UI copy). Unchanged by this work; its owner should fix it.
- No invented canon was found anywhere: no ability, score rule, tournament or mechanic is named; "NYC Rank" is deck copy.
- Fix: add the strings to the decks or replace them with deck strings.

Resolution 2026-10-15 (lane X1 strings): `rankStatusSpoken` now returns only deck lines; ready and stale announce the region as "NYC Rank" and the rows and stale strip speak for themselves; GameStatusLayer says "H-Lynk" instead of "device" (`packages/ui/lobby/lobby-copy.ts`, `packages/app/features/game/GameStatusLayer.tsx:55-56`; tests `speaks only deck lines` in `lobby-copy.test.ts`, `Game screen copy says H-Lynk, never "device"` in `game-lane-guards.test.ts`, red-checked). `ArcadeActionButton.tsx` (lane X2) and `settings-content.tsx` (settings owner) are outside lane X1.

### M23. Fixture 4's chunk check masks the edge it tests, and the rebased path is untested

- `packages/core/test/world-resume.test.ts:162-175`: same-origin only; the chunk assertion adds `1e-9` before `Math.floor`, which hides a position landing one ulp below the edge; chunk size 250 is hardcoded in the test. After an origin move `rebaseCamera` re-projects (`resume.ts:184`), and a saved edge position can land at `edge ± 1e-12` and resolve to the neighbouring tile; no test covers that path.
- Fix: a tolerance policy in the chunk lookup, tested; an edge case through a changed `originRef`.

Resolution 2026-10-15: DEFER because the test and the chunk lookup are `packages/core/test/world-resume.test.ts` and `packages/core/world/resume.ts`, outside lane X1's paths; routed back to the core owner with the fix as written above.

## Low

### L1. Two FORBIDDEN rows on one line in `contrast.ts`

`packages/theme/contrast.ts:475`: `royal on housing plate` was appended after `brick face on night` on the same line. Theme lint was not in this lane's gate list; worth running before the pathspec commit.

Resolution 2026-10-15: already fixed in the tree: `brick face on night` and `royal on housing plate` sit on separate lines (`packages/theme/contrast.ts:485,488`); no X2 edit (the file is lane X1's).

### L2. Stale statements in the lane docs

`docs/implementation/game-controls-integration.md` §8 asks for a `./game-controls/hardware` export that `packages/ui/package.json` already has; `:148` claims nothing moves while the lobby is up (H1). `docs/adr/0020-world-save-and-resume.md:41` says `@acme/ui` has no `./game-controls` export (it does; `save-cadence.ts` still uses the literal mirror). ADR 0020 is silent on M1 and L5.

### L3. The lobby's `start` dispatch discards its effects

`GameLobbyScreen.tsx:72` drops the returned `SessionEffect[]`; every other dispatch goes through `runSessionEffects`. `start` emits nothing today (`session.ts:106`), so this is latent.

Resolution 2026-10-15: the lobby's `start` dispatch now runs its effects through `runSessionEffects` with the real identity and dataset (`packages/app/features/game/lobby/GameLobbyScreen.tsx` `startSession`; covered by typecheck, `start` emits no effect today so no behavioural test can fail).

### L4. A `commit` throw inside the ticker or AppState handler is uncaught

`use-world-save-lifecycle.ts:43-65,85-95`: `worldSaveStore.commit` uses `.parse` (`world-save.store.shared.ts:60`); a thrown error inside `setInterval` or the AppState listener stops saving with no trace. Catch, report, continue.

Resolution 2026-10-15: the ticker, AppState and exit writes run through `guardedSave`, which reports a throw with where it happened and lets the cadence continue (`world-resume/save-cadence.ts` `guardedSave`, `use-world-save-lifecycle.ts`; test `a throwing write is reported with where it happened` in `world-ownership.test.ts`).

### L5. Every lobby START mints a new session id

`GameLobbyScreen.tsx:72`, `use-game-input.ts:293`: `mintSessionId(identity, now)` on resume as well as new game. Pause and resume keep the id (fixture 5 passes); exit-and-reopen does not. Directive §3 lists player, Mon, world instance and save, not session, so this is a decision to record in ADR 0020, not a defect.

Resolution 2026-10-15: a resume reuses the eligible save's session id (carried on the plan's `start-session` step); the in-game START reuses a same-Caller save's id through `sessionIdForStart`; only a new game mints; recorded in ADR 0020 Consequences (`lobby/resume-sequence.ts:60`, `world-resume/world-snapshot.ts`; tests `a resume reuses the saved session id` in `resume-sequence.test.ts`, `continues the Caller's saved session` in `world-ownership.test.ts`).

### L6. The lobby root label is never announced

`packages/ui/lobby/GameLobby.tsx:184-187`: `accessibilityLabel={LOBBY_COPY.screenA11y}` on a `View` without `accessible`; iOS ignores it. `G02 07-a11y.md` expects the screen title announced on open. Announce it once on mount.

Resolution 2026-10-15: `GameLobby` announces `g02.screen.a11y` once on mount, and stays quiet when it mounts already covered (re-hosted over the world mid-START); the unread label on the plain View is gone (`packages/ui/lobby/GameLobby.tsx`; typecheck only, announcement needs the device run).

### L7. The accessibility press timer outlives the controller

`ArcadeController.tsx:217-221`: the 80 ms `setTimeout` that sends the up is never cleared on unmount. Also unverified: iOS may synthesise a touch at the element centre on VoiceOver double-tap, giving two presses. Device check.

Resolution 2026-10-15: the accessibility press timer belongs to the `TouchInputGate`; `dispose()` on unmount clears it and sends the up at once (`touch-input-gate.ts`, test "L7: accessibility press timers"). The double-press question on VoiceOver double-tap is still a device check.

### L8. Hardware stop requests are accepted with no session

`hold-to-stop.ts` and the keyboard/gamepad mappings send `stop-request` while the pill is `start`; `use-game-input.ts` ignores it through `sessionEventsFor`, so no harm, but the adapter should gate on pill state.

Resolution 2026-10-15 (app half): the app already drops a stop request with no session (`sessionEventsFor('stop-request', idle)` → none; pinned in `game-lane-guards.test.ts`). The adapter gate is lane X2's: in `packages/ui/game-controls/hardware/hold-to-stop.ts` and both mappings, skip emitting `stop-request` when `pill === 'start'`.

### L9. A throwing router listener aborts later listeners

`create-game-input-router.ts:119-123`: no try/catch around listener calls; the adapter's "never throws" promise leaks. Wrap and count in diagnostics.

Resolution 2026-10-15: the router calls listeners from a snapshot inside try/catch, counts throws in `CreatedGameInputRouter.listenerErrors` and hands them to `onListenerError` (dev `console.error` by default) (`create-game-input-router.ts`, test "L9: a throwing listener does not starve the others").

### L10. `verify.sh` prints "exit 0" on every failure

`scripts/rive/verify.sh:36-37`: `$?` after `if ! cmd` is the negated status. The failure is still counted; the message is wrong. Capture `rc` first.

Resolution 2026-10-15: `verify.sh` `run()` captures `rc` with `"$@" || rc=$?` and prints the real code (proved on `sh -c "exit 3"`: `FAIL: exit 3`).

### L11. Small Rive authoring gaps

`start-angled/scene.rml:48` exposes an empty `role="text"` node (`label=""`, 0×0 bounds in the semantics dumps). `game-lobby/scene.rml:129,134` has a 200 ms theme cross-fade not gated on reduced motion. `right-six` button semantics carry no state flags for held, cooldown or disabled (`semantics-held.semantics.json` equals the idle tree), while `start-angled` and the pill do. Directive §3 lists "rank-change indicators" and "refined rank transitions" for the leaderboard; no such animation exists (rows are static instances).

Resolution 2026-10-15: start-angled's empty text node is gone (the district is the button's semantic value); game-lobby's 200 ms theme fade has an instant reduced-motion branch; right-six caps carry `isDisabled` in Disabled and Cooldown. DEFER held state: SemanticData in Rive CLI 1.5.0 has no pressed, held or busy flag. DEFER rank-change indicators: no rank-delta field exists in the contract or the leaderboard schema, and inventing one is new canon.

### L12. `runOnJS` is deprecated in the installed Reanimated

`AnalogStick.tsx`, `ArcadeActionButton.tsx`, `StartStopPill.tsx` use `runOnJS`; `react-native-reanimated` 4.7.0 marks it deprecated for `scheduleOnRN` from `react-native-worklets` (`src/workletFunctions.ts:48-56`). The router comment already names `scheduleOnRN`.

Resolution 2026-10-15: DEFER because `react-native-worklets` does not resolve from `packages/ui` (`packages/ui/node_modules/react-native-worklets` is absent); `runOnJS` stays. Dependency request: declare `react-native-worklets` in `packages/ui/package.json` (catalog version matching Reanimated 4.7.0), then switch the three components to `scheduleOnRN`.

### L13. iOS gamepad timestamps and listener order

`ios/GCExtendedGamepad+bindHandlers.swift:38`: `timestampMs` is handler time, not the event time `GamepadInput.nitro.ts:44-48` promises (Android uses `event.eventTime`). `ios/ListenerRegistry.swift:30` iterates a `Dictionary`, so delivery order is nondeterministic. Low because the hook uses deltas only.

Resolution 2026-10-15: iOS button, axis and key timestamps use the profile's `lastEventTimestamp` (`MonotonicClock.eventMs`, falls back to now when 0), and `ListenerRegistry.swift` keeps an ordered array so delivery follows insertion order (`ios/GCExtendedGamepad+bindHandlers.swift`, `GCKeyboard+bindHandlers.swift`, `MonotonicClock.swift`, `ListenerRegistry.swift`). Verified by `swiftc -typecheck` against the iOS 27.1 simulator SDK with stubbed Nitro types (exit 0); not run on a device.

### L14. Casts without a reason

`as object` on `testIdProps(...)` in five kit files and the settings screen; `host as never` at `AdaptiveControlLayout.tsx:205` and `GameScreen.tsx`; `A11Y_ACTIONS as never` at `GameScreen.tsx:207`. None is `any` or `as unknown as`, so the hard rule holds; each should say why.

Resolution 2026-10-15: the five `testIdProps(...) as object` casts in the kit are removed (the function already returns `object`); `host as never` in `AdaptiveControlLayout.tsx` carries a comment naming the Div ref versus HostInstance mismatch. The `GameScreen.tsx` casts are lane X1's.

### L15. Em-dash density in the design docs

No banned word, empty phrase, binary contrast or puffery pattern from the `no-ai-slop` list was found in any new doc, story description or copy file (grep over 33 files). That is a pattern grep, not a full detect-mode read: the agent pass over the multi-line code comments (239 blocks) was interrupted three times by server errors and did not report, so comment prose is checked for banned words only. Ten design docs carry 8 to 18 em dashes each (`G02-game-lobby/07-a11y.md` 18, `G03/07-a11y.md` 15, `G03/05-copy.md` 14), most inside tables as separators; the prose ones read as a rhythm crutch. Attribution grep (`Co-Authored|Generated with|Anthropic|Claude|ChatGPT|Copilot|OpenAI`) over 469 new and modified files: zero hits. The seven `packages/ui/rive/*/CLAUDE.md` files contain only `@AGENTS.md`, and the seven `AGENTS.md` are byte-identical `rive init` boilerplate. 51 `Decision:` lines carry BUILD/STRIKE/DEFER; none without a reason was found.

### L16. `aria-label` on role-less slot views

`AdaptiveControlLayout.tsx:118-128`: each slot `View` carries `aria-label` with no role; on web that is a lint warning and reads oddly. Use `accessibilityRole="none"` with `importantForAccessibility="no"` on the slot and let the control inside own the name.

Resolution 2026-10-15: `AdaptiveControlLayout`'s `Slot` no longer carries `aria-label`; it is a `pointerEvents="box-none"` positioning box and the control inside owns its name and role.

## Directive §14 coverage

"Automated tests" bullets, requirement by requirement. Test names were checked against the run logs in `gates.md`; every file listed ran and passed. `covered` means the assertions exercise the requirement; `partial` means they touch it from one side; `missing` means no test.

| Requirement | Test file : test | Status |
|---|---|---|
| Radial dead-zone math | `packages/ui/game-controls/stick-math.test.ts` : "reads neutral inside the radial dead zone", "is radial, not square…", "ramps from 0 at the dead-zone edge…"; `hardware/gamepad-mapping.test.ts` : "stays silent inside the dead zone", "applies the profile dead zone and sensitivity through readStick" | covered |
| Diagonal normalization | `stick-math.test.ts` : "never reads a (1, 1) corner…", "gives every direction a unit vector"; `keyboard-mapping.test.ts` : "normalises diagonals to unit length in every quadrant"; `gamepad-mapping.test.ts` : "snaps to eight directions in dpad stick mode, diagonals at unit length" | covered |
| Button-to-action mappings | `packages/app/features/game/use-game-input.test.ts` : "the default bindings map every cap to a camera command…"; `gamepad-mapping.test.ts` : "maps the six positional buttons…"; `keyboard-mapping.test.ts` : "J K L are the bottom row…", "covers every cluster button exactly once…" | covered |
| Rebinding | `create-game-input-router.test.ts` : "drops presses of a disabled binding but still accepts a release of a held one"; `use-game-input.test.ts` : "a disabled or unknown binding maps to no command" | partial: `setBindings` is exercised only to disable; no test rebinds a cap to another action and asserts it fires; bindings are not persisted (by design, no gameplay spec) |
| Persisted settings | `controller-profile.store.test.ts` (7), `controller-layout.store.test.ts` (6), `controller-profile.schema.test.ts` (6) | covered |
| Two-finger simultaneous controls | `create-game-input-router.test.ts` : "holds two buttons while the stick moves, then releases them independently", "keeps a button held until every source…" | partial: router level, one `touch` source; no two-pointer component test |
| Three-finger simultaneous controls | same test (two caps plus the stick) | partial: same caveat |
| Gesture cancellation | `create-game-input-router.test.ts` : "cancelAll clears everything and emits exactly one event", "reads neutral on end and cancel whatever values arrive" | covered at the router (`background` reason); `gesture-cancel`, `fold-change`, `layout-change` only appear in the copy-length test |
| Fold/unfold while holding controls | `packages/core/test/world-resume.test.ts` : "fixture 6…" (a stray `cancelStop` is ignored); `layout/controller-layout-resolver.test.ts` fold geometry (32 tests) | partial: nothing holds a control, changes the fold, and asserts release plus an intact session (M18) |
| Start/pause/resume/stop lifecycle | `packages/core/test/game-session.test.ts` (7); `use-game-input.test.ts` : "pause and resume requests are one pillPress…", "a stop request confirms a hold…" | covered |
| No new session from pause/resume | `game-session.test.ts` : "pause and resume never change the session id, however many times", "start is ignored while a session exists…"; `world-resume.test.ts` : "fixture 5…" | covered (in-session); exit-and-reopen mints a new id (L5) |
| Rive data-binding synchronization | `rive-binding.test.ts` (8), `lobby-rive-binding.test.ts` (5) against a fake instance; `verify.sh` fails on "no property" for `--data` paths | partial: the TS layer is tested; the artboard side has no path-name diff, which is how C2 and H9 slipped through |
| Rendering and teardown | `verify.sh` `--verify`/`--once`/`--test`/`inspect`; binding `dispose` tests | partial: exit codes only; no surface unmount test |
| Semantics tree presence | `verify.sh` writes `--semantics` dumps | partial: never inspected (M17) |
| Touch-target dimensions | `six-button-arch.test.ts` : "keeps every cap at or over the 44 pt floor…", "never overlaps two caps…"; `controller-layout-resolver.test.ts` `assertSafe` pill height ≥ 44 | partial: TS geometry only; stick target and RML hit areas unchecked; cramped slots (M3) untested |
| No input interception outside control bounds | none | missing |
| No lobby input leak | `use-game-input.test.ts` : "only a playing session accepts stick and cap input"; `lobby.store.test.ts` : "beginStart… only once" | partial: session gating only; H1 shows the real leak |

Resume fixtures 1 to 12 (`packages/core/test/world-resume.test.ts:134-286` plus app tests):

| # | Test | Status |
|---|---|---|
| 1 | "fixture 1: new user, no save → new-game"; `resume-sequence.test.ts` : "new game sets the initial view and mints nothing (fixture 1)" | covered |
| 2 | "fixture 2…"; `resume-sequence.test.ts` : "restores the saved camera bit for bit…" | covered |
| 3 | "fixture 3… (bit-identical doubles through storage)" | covered (JSON round trip; MMKV itself not exercised) |
| 4 | "fixture 4…" | partial (M23) |
| 5 | "fixture 5…"; `game-session.test.ts` | covered |
| 6 | "fixture 6…" | partial: session ignores a stray event; no fold event, no lobby store |
| 7 | "fixture 7…" | partial: asserts no viewport key; no outer-screen layout test |
| 8 | "fixture 8…", "fixture 8b…" | partial: read-side ordering only; no upload path exists to reject a stale write against |
| 9 | "fixture 9…" | covered (offline detection itself deferred: `toResumeSummary` offline stays false) |
| 10 | "fixture 10…", "fixture 10b…", "every failure maps to a reason and a recovery…"; `resume-sequence.test.ts` : "an error has no steps…" | covered |
| 11 | "fixture 11…"; `lobby.store.test.ts` : "a leaderboard answer never touches the resume decision (fixture 11)"; `leaderboard.test.ts` | covered |
| 12 | "fixture 12…"; `leaderboard-model.test.ts`; `leaderboard.test.ts` | partial: validation covered; "stay accessible" fails in the kit (H2) |

Inventory: 273 tests across 29 files in scope, no `.skip`/`.todo`/`.only`, no assertion-less body (mapper's awk scan).

## Accessibility review against `docs/design/screens/G0*/07-a11y.md`

Contrast. Every palette class the new components draw was listed by grep and matched to the registry:

| Drawn at | Pair | Registry | Result |
|---|---|---|---|
| `StartStopPill.tsx:293` | `silver-300` on `concrete-800` (pill legend) | `arcade: cap glyph idle on graphite cap`, 9.60, no usage cited | pass, M10 |
| `StartStopPill.tsx:293` | `on-cta` on `cta` (START legend) | `cta button label` family | pass |
| `ArcadeActionButton.tsx:190` | `carolina-500` on `signage-black` (held ring) | `arcade: held and focus ring in a well`, 8.16, no usage cited | pass, M10 |
| `ArcadeActionButton.tsx:197` | `signage-white/15` press disc | none | decorative; needs an exempt row with a reason |
| `AngledStartButton.tsx:100` | `carolina-500` / `royal-500` rim on `bg` | `focus ring on offset band` family | pass per G02 (7.89 night, 5.08 day) |
| `AngledStartButton.tsx:143` | `on-cta` on `cta`; `silver-300` on `concrete-700` (inert face) | registry / computed 6.54 | pass |
| `LeaderboardPanel.tsx:59,107` | `royal-500` on `ink-800` | none | **fail 2.56**, H3 |
| `LeaderboardPanel.tsx:62` | `orange-700` on `ink-800` | none | **fail 2.55**, H3 |
| `LeaderboardPanel.tsx:60,211` | `orange-500` on `ink-800` | `scene plate selected tab face` (ui, ink-800) | pass 5.48 |
| `LeaderboardPanel.tsx:63,207,216` | `carolina-500` on `ink-800` (own-row edge, "You") | none for ink-800 | pass 5.58, row missing |
| `LeaderboardPanel.tsx:115,201` | `silver-500` on `ink-800` | none for ink-800 | pass 7.87, row missing |
| `LeaderboardPanel.tsx:124,131,201` | `silver-300` on `ink-800` | `scene plate line` | pass 10.86 |
| `LeaderboardPanel.tsx:123,130,179,202` | `ink-50` on `ink-800` | none for ink-800 | pass 13.51, row missing |
| `GameTransition.tsx:55` | `bg-concrete-50` / `bg-ink-950` cover | surface | n/a |
| `ControlsSettingsScreen.tsx` | semantic tokens only (`surface`, `surface-sunken`, `border`) | existing rows | pass |

No hex literal exists in any new component (`city-scene.ts` keeps its pre-existing three.js material colours, outside this work). `check-colors.mjs` reports 281 RML colour attributes, 0 off-token.

Touch targets (44 pt iOS / 48 dp Android):

| Control | Source | At scale 0.8 | Result |
|---|---|---|---|
| Caps ×6 | `six-button-arch.ts:17-19,80-83` Ø56 × scale | 44.8 | pass iOS; Android 48 dp needs scale ≥ 0.857. `G01 07-a11y.md` finding 4 says the resolver clamps Android to 0.86; no such clamp exists (`grep 0.86\|minScale` in `layout/` returns nothing). Record as a doc-vs-code gap: medium, folded into M3's fix. |
| Cap spacing | nearest-centre distances 62.5 to 64.8 at scale 1 | > Ø56 | no overlap (verified numerically) |
| Stick | `touch-geometry.ts:17-25` housing Ø128 × scale | 102 | pass |
| Pill | `touch-geometry.ts:28-35` 144 × 48 target around 120 × 44, never scaled | 144 × 48 | pass both floors |
| Lobby START | `AngledStartButton.tsx:51` 64 pt tall, full width | 64 | pass |
| "Try again" | `StatusRow` action | kit | 44 on iOS; `G02 07-a11y.md` finding 3 (48 dp Android) unaddressed |
| Settings segments, sliders, switches | kit components | kit | per kit rows; not re-measured |

Roles, labels, actions (from grep of every accessibility prop in scope): caps `button` + label + hint + state + `activate`; stick `adjustable` + "Move" + value + hint + the nine camera actions; pill `button` + state-dependent label + hint + `activate`/`stop`; lobby START `button` + sentence-case name + hint + disabled/busy; leaderboard region labelled but collapsing (H2); settings segments carry deck `aria-label`s, preview is an `image` with a rebuilt label; rows (`Row`) and the lobby root lack `accessible` (H2, L6). Focus alone never triggers gameplay: activation only runs from `onAccessibilityAction` (`ArcadeActionButton.tsx:187-189`, `StartStopPill.tsx:305-311`, `AnalogStick.tsx:290-295`); the lobby START's focus handler only writes `lobby/start/focused` to Rive (`AngledStartButton.tsx:97-98`).

Reduced motion: an authored sibling exists in six of seven Rive projects with a `reducedMotion` input and a screenshot (`docs/evidence/rive/*/reduced*.png`, `press-reduced.png`, `stopConfirm-reduced.png`); the host lobby's theme cross-fade (L11) and the right-six release spring (M14) are the two unauthored motions. The RN side gates every `withTiming`/`withSpring` on the `reducedMotion` prop (`AnalogStick.tsx:214-216`, `StartStopPill.tsx:232,251-253,290`, `AngledStartButton.tsx:99`). The pill's four-step reduced hold fill cannot show (C2).

Focus order: pill, stick, X Y Z A B C (left-handed keeps the tree order; only screen positions mirror, `six-button-arch.ts:92`), world: matches `G01 07-a11y.md`. Lobby: wordmark header, panel, resume heading, strip, START: matches `G02 07-a11y.md` in structure, broken inside the panel (H2).

Announcements: pill transitions (`StartStopPill.tsx:135-137,177-183`), "Stop cancelled" (`:215`), lobby START loading (`AngledStartButton.tsx:88-93`), cancel reasons once per `cancelAll` (`use-game-input.ts`, deck lines verified by `use-game-input.test.ts:130`), settings intro and restore done (`ControlsSettingsScreen.tsx:146,153`). The leaderboard status line and the stale strip are live regions.

## Security and correctness

Verified OK, with file and line:

- Identity: `readLobbyIdentity` (`lobby-identity.ts:12-16`) reads the Caller from the local Mon save and never creates one; `resolveResume` rejects `playerId !== ownerId` (`resume.ts:151-153`). No network path exists yet; when a remote candidate source lands, the server must derive `playerId` from its own session and never from the blob (recorded for the backend owner).
- Zod at every boundary: `loadWorldSave` (`migrate.ts:81-96`) is `JSON.parse` in try/catch → envelope → migration walk → `WorldSaveCurrentSchema.safeParse`; `commit` parses before `storage.set` (`world-save.store.shared.ts:60-63`); `validateLeaderboardRows` safe-parses row by row and drops duplicates (`leaderboard/source.ts:66-81`); profile hydration goes through `parseControllerProfile` (`controller-profile.store.shared.ts:50-64`); layout hydration through `parseSavedControlLayouts` (hand-rolled, not Zod: `revalidate-positions.ts:137`, low). No `any`, `as unknown as`, `@ts-ignore`, `@ts-expect-error` in scope (grep; the only `as never` outside tests are L14).
- No silent spawn: `new-game` only with zero candidates (`resume.ts:109`); every failing candidate yields `error { reason, recovery }` (`:119-122,221-269`); `migrateToDataset` returns `undefined` for a missing chain, a different dataset id, or a rebased camera outside the extent (`:168-191`), and the lobby gates START on error (`GameLobbyScreen.tsx:66`).
- Conflict rule: (revision desc, savedAt desc, local on tie) at `resume.ts:197-209`; `commit` refuses `revision <= stored` (`world-save.store.shared.ts:62`). The write side has no remote compare-and-swap because no upload exists; `savedAt` tie-breaks rely on client clocks (record for the backend owner).
- Cadence: `save-cadence.ts:55-63` bounded (15 s), dirty-only, never subscribed to the camera store; a thousand gesture-rate decisions produce one write (`save-cadence.test.ts:61`). Saves on pause, background, stop, exit (`use-world-save-lifecycle.ts:85-95`); iOS `inactive`-to-kill is not a save point (worst case 15 s lost).
- Session: `world/session.ts` is pure and exhaustive; `start` is ignored while a session exists; pause, background and cancel keep the id; only `confirmStop` returns to idle.
- Coordinates: WGS84 canonical position plus `originRef`, re-derived by the same arithmetic as `projectCityPoint` (`transform.ts:36-50`), doubles never rounded; no geolocation import anywhere in scope; device GPS never reaches the position.
- Leaderboard: read-only interface, no `submitScore`, `no-ranking-authority` is the only source today (`source.ts:50-52,90-94`); a load never touches `resume` (`lobby.store.test.ts:63`).
- Storage: MMKV instances `world`, `game`, `controller-layout` beside the existing `nyc-mon-save`; web is in-memory by design (`world-save.store.ts:1-5`).
- No GSAP, Lenis, Tamagui, Unity or second three.js renderer in scope (grep). RNGH is the installed 3.2.1 hook API (`useManualGesture`, `GestureStateManager`), checked against `lib/typescript/v3/hooks/gestures/manual/useManualGesture.d.ts`; no RNGH 2 `Gesture.Pan()` builder anywhere.

Defects: M1, M2, M20, M23, L3, L4, L5 above.

## Storybook

Built and indexed 106 stories under `Game controls/*` and `Lobby/*` (list in `gates.md` §14); every state the directive names has a story (idle, pressed, held, released, disabled, cooldown; start, playing, paused, stop-confirm 0/50/100; reduced motion for each component; seven layout profiles; leaderboard loading/ready/empty/stale/error/unavailable). Indexing proves the modules compile and export, not that they render; no story was opened in a browser in this lane.

## Known gaps the lanes recorded (verified as documented, not re-counted)

| Gap | Where it is recorded |
|---|---|
| `PillState` has no `disabled`; the pill carries it locally | `packages/ui/game-controls/contract.ts:32-36` Decision DEFER with reason; `StartStopPill.tsx:59-62` |
| Web START permanently `disabled`, no web copy | `GameLobbyScreen.tsx:16-18` Decision DEFER (08-handoff B4); `:143` |
| No device runs | `docs/implementation/game-controls-integration.md:5`; `hardware-input.md`; `docs/adr/0020…` ; `G01/08-handoff.md`, `G03/08-handoff.md`; `docs/evidence/rive/environment.md`; `docs/DEVICE_CHECKS.md` conventions |
| No Storybook browser pass | Not stated in any lane doc; recorded in `gates.md` §14 by this lane (low doc gap) |
| Rive push revision labels / Editor round-trip not performed (`auth: Not logged in`) | STRIKE 2026-10-15: the project uses the Rive CLI only (RML source, `build.sh`, `scripts/rive/verify.sh`); `rive-round-trip.md` no longer has a push, pull, Editor or login step, and `rive.yaml` carries no `push.*` keys by design |
| Cluster placement editor, "Show icons", remapping absent from settings | `ControlsSettingsScreen.tsx:13-29` header decisions; `game-controls-integration.md` §5 |
| `rn-game-engine-next` struck without a device benchmark | ADR 0020; `docs/performance/rn-game-engine-next-spike.md` |

## Proposed contract changes (not made; `contract.ts` is read-only for every lane)

1. A single `STOP_HOLD_MS` next to `PillState` so touch, hardware and the spoken hint agree (M9).
2. A `holdProgress` entry in the §8 View Model table, or its removal, once C2 is decided.
3. `InputDiagnostics` to carry `missingRivePaths` and `riveErrors` so M16 has a home.

## Roster standards

Measured against: Google Testing and Netflix chaos-engineering (adversarial, fixture-driven: every finding names the failing input); WCAG 2.2 authors and the Xbox Accessibility Guidelines (contrast measured on the real face, targets in dp, no timed-only destructive input, operable without focus side effects); Callstack performance discipline (claims versus measurements: no frame-rate or latency number appears here because none was measured); the CodeRabbit review → fix → retest loop (each finding is routed to its owning lane with a fix; the retest is the gate run in `gates.md` plus the device plan). These are standards, not contributors.
