# Game controls integration: router, camera, session, settings

Lane G of the arcade-control directive (v2 §2C pill contract, §9 input architecture, §13 settings). This is how `packages/app` wires the kit's `ArcadeController` and `GameInputRouter` (`packages/ui/game-controls`) into the Game screen, what the game-control settings screen persists, and what still needs a device.

Nothing in this lane ran on a device. "Verified" below means `tsc --noEmit`, `node --test` or `expo config` on this machine; §6 lists the device checks.

## 1. Pieces

| Path | Role |
| --- | --- |
| `packages/app/features/game/game-input-bindings.ts` | Pure: stick reading → camera pan, cap → `CameraCommand`, repeat timing, router request → `SessionEvent`, cancel copy. Tested in `use-game-input.test.ts`. |
| `packages/app/features/game/use-game-input.ts` | `gameInputRouter` (module scope, one per process) and `useGameInput`: the one subscriber, the stick frame loop, the held-cap repeat chain, the session dispatch, the cleanups, the hardware adapter mount, the stop-confirm ring timer. |
| `packages/app/features/game/GameScreen.tsx` | Mounts `ArcadeController` over the world in the HUD layer, `useWorldSaveLifecycle`, `useGameInput`; reads the Caller identity like `BootScreen` (`readSave()`). |
| `packages/app/features/game/hud-layout.ts` (+ test) | Status banner, attribution and blocking region only; the camera column and move pad are retired (G01 08-handoff.md § Route). |
| `packages/app/features/game/controls-settings/` | `ControlsSettingsScreen.tsx`, `controls-settings-copy.ts` (every `g03.*` string and the value formatters, tested). |
| `apps/mobile/app/(drawer)/game-controls.tsx` | Thin route, like `game.tsx`. Opened by the "Game controls" row in `packages/app/features/settings/settings-content.tsx` (native only; see §5). |
| `apps/mobile/app.config.ts` | `GCSupportedGameControllers`, `GCSupportsControllerUserInteraction` and the `withOptionalGamepad` manifest plugin, as `hardware-input.md` §5 specifies. |

## 2. Wiring

```
touch (ArcadeController)  keyboard / gamepad (useHardwareInput)  accessibility (caps, stick actions)
          │                            │                                   │
          └────────────── gameInputRouter (createGameInputRouter) ─────────┘
                                       │  validated, ordered InputEvents
                               useGameInput listener
                 ┌─────────────────────┼──────────────────────────┐
             move                button-down / up         pause / resume / stop-request
                 │                     │                          │
   rAF loop while engaged     commandToAction once,      sessionEventsFor(kind, session)
   stickToPanAction(dt)       repeat every 120 ms        → worldSessionStore.dispatch
                 │            after 300 ms while held     → runSessionEffects (save cadence)
                 └──────► gameCameraStore.move ◄──────┘             │
                                       │                      pill = pillStateOf(session)
                              ThreeCanvas.invalidate()        ArcadeController reflects it
```

Order of authority: the router validates (finite numbers, known ids, strict down/up pairing, one stick owner); `game-input-bindings.ts` maps; the camera store and the session store apply; the overlay and Rive reflect. No React render happens per frame or per event: the stick loop and the repeat chain write to `gameCameraStore`, whose one subscriber calls `invalidate()`.

### Stick

A `move` event replaces the current reading. While `reading.engaged`, a `requestAnimationFrame` loop runs; each frame `stickToPanAction(reading, camera, viewportHeightDp, dt)` turns the reading into a pan through `panToAction` (the same maths the drag uses), so speed scales with camera distance exactly as a drag does. Full deflection equals a steady 320 dp/s drag (`STICK_PAN_DP_PER_SECOND`); a frame longer than 100 ms is capped (`STICK_MAX_FRAME_SECONDS`), so a stall never teleports the camera. +x pans right, +y (up) pans forward; the sign flip against `panToAction`'s world-follows-finger convention is in one place. An `end`, `cancel` or `cancel-all` sets the reading neutral and stops the loop.

### Caps

`button-down` runs the bound `CameraCommand` once through `commandToAction`. Every command except `reset` repeats: first at 300 ms (`BUTTON_REPEAT_DELAY_MS`), then every 120 ms (`BUTTON_REPEAT_MS`), from a `setTimeout` chain that re-checks `router.heldButtons` before every repeat, so a `button-up` or `cancel-all` the timer did not see still ends the chain. Bindings are `DEFAULT_CAMERA_BINDINGS` (X zoom in, Y zoom out, Z reset, A turn left, B turn right, C forward); nothing else is allowed until a gameplay spec exists (§2B).

Stick and caps reach the camera only while the session is `playing` (`acceptsGameplayInput`). In any other state the caps render `disabled` through `buttonOverrides`, so there is no live cap that does nothing.

### Session requests

| Router event | Session state | `SessionEvent`s dispatched |
| --- | --- | --- |
| `pause-request` | `playing` | `pillPress` |
| `resume-request` | `paused` | `pillPress` |
| `stop-request` | `stop-confirm` (touch hold began) | `confirmStop` |
| `stop-request` | `playing`, `paused` (keyboard or gamepad hold, completed in the adapter) | `stopConfirm`, then `confirmStop` |
| any of the above | any other state | nothing |

Every dispatch runs its effects through `runSessionEffects` with `{ identity, dataset }`, so a pause writes a save and a stop writes the final one (`use-world-save-lifecycle.ts`).

### Cleanups

| Trigger | Call |
| --- | --- |
| `AppState` leaving `active` | `cancelAll('background')` |
| Route loses focus (`useFocusEffect` cleanup) | `cancelAll('screen-transition')` |
| A splitting fold appears, moves or disappears (`foldSignature`) | `cancelAll('fold-change')` |
| Container resize (`layoutSignature`) | `cancelAll('layout-change')` |
| `useGameInput` disabled or unmounted | `cancelAll('screen-transition')` |
| Gamepad disconnect, web blur (the hardware adapter) | `cancelAll('source-disconnected' \| 'focus-loss')` |

`cancel-all` clears the stick loop and every repeat timer and speaks the `g01.cancel.*` line for its reason, once, only when something was held.

## 3. The pill contract as implemented

| Pill state (`worldSessionStore.pill`) | Shown when | Tap | Hold |
| --- | --- | --- | --- |
| `start` | session `idle` (a stop ended it in place; the lobby normally covers this) | `onStart` → `startSession`: `dispatch({ type: 'start', sessionId: mintSessionId(identity, now) })`, the same start the lobby performs | — |
| `playing` | `playing` | `router.pauseRequest('touch')` → `pillPress` → `paused` + save | `onStopHoldStart` → `beginStopConfirm` → `stopConfirm` |
| `paused` | `paused` | `router.resumeRequest('touch')` → `pillPress` → `playing` | as above |
| `stopConfirm` | `stop-confirm` | — | completed: `router.stopRequest` → `confirmStop` → `idle` + final save; released early: `onStopReleased` → `cancelStopConfirm` → `cancelStop` |
| `disabled` | session `idle` and no Caller identity (`readSave()?.caller` missing) | nothing; the pill says "Not available right now" | — |

`stopProgress` is the session's confirm timer: while `stop-confirm`, `(now − pausedAt) / STOP_HOLD_MS`, quantized to 20 steps on a 30 ms interval in a per-instance store. `STOP_HOLD_MS` is 1000 ms and lives in `packages/ui/game-controls/contract.ts`: the touch pill, the gamepad Start hold, the keyboard Escape hold, this timer and the pill's spoken hint ("Hold for one second to stop") all read it (finding M9). A live touch hold overrides it inside the pill; a hardware hold hides the overlay anyway (`hideTouchControls`), so the ring is only ever seen under a finger.

The pill's screen-reader "Stop" action opens a confirm dialog (kit `ResponsiveDialog`, title "Stop", body "Your last save is kept", Cancel and Stop buttons) and stops only on its Stop button, then announces "Stopped. Your last save is kept" (finding H7).

Decision (BUILD): in-game START dispatches `start` rather than `resumeRequest`. The session machine ignores `pillPress` from `idle`, so a resume would be a tap that does nothing; the lobby's own start is the same `start` event with the same minted id.

The paused world sits under `bg-scrim-scene` (G01 08-handoff.md § States, `g01-scrim`), rendered between the status layer and the controller.

## 4. HUD changes

`CameraControls.tsx` is deleted and `hud-layout.ts` no longer resolves a camera column or move pad: the stick, caps and pill are placed by `AdaptiveControlLayout` (lane D), which reuses the same `usableRegions` rule. The attribution moved from the bottom-leading corner, where the stick now sits, to the controller region's leading edge under the pill's band (`PILL_GEOMETRY_DP.targetHeight` + margins). The status banner and the blocking region are unchanged. The accessibility actions on the world view stay; the stick lists the same nine `CameraCommand`s as its non-drag path (`stickA11yActions`, WCAG 2.5.7).

`game-session.ts` still carries `movePadOpen` and `toggleMovePad` (outside this lane); nothing reads them now. Report: remove them in a follow-up.

Gesture ownership: the world's pan/pinch/twist detector wraps only the canvas; the controller's RNGH detectors live in absolutely positioned slots in the sibling overlay, which is `box-none` at every level above a slot. No RNGH detector is nested in another's tree, and a touch outside a control reaches the world.

## 5. Settings screen

Route `/game-controls` (brief; the G03 handoff's `settings/controls` path was not used because the brief names this file). The screen holds no field state: every control reads `controllerProfileStore` and writes one patch through `controllerProfileActions.set`, which `patchControllerProfile` validates against the Zod schema (`controller-profile.schema.ts`); a patch out of range leaves the store unchanged. Slider values are snapped to their step before the write (`snapToStep`), so a float drag never persists `0.15000000000000002`.

| Control | Field | Persisted at |
| --- | --- | --- |
| Mode segment | `stickMode` | MMKV `game` / `controller-profile.v1` |
| Placement segment | `stickPlacement` | same |
| Dead zone slider (0…0.5, step 0.05) | `stick.deadZone` | same |
| Sensitivity slider (0.5…2, step 0.1) | `stick.sensitivity` | same |
| Hand segment | `handedness` | same |
| Size slider (0.8…1.4, step 0.1) | `scale` | same |
| Opacity slider (0.3…1, step 0.05) | `opacity` | same |
| Haptics 2×2 segment | `haptics` | same |
| Restore defaults (confirm dialog) | the whole profile → `DEFAULT_CONTROLLER_PROFILE` (key removed) and `controllerLayoutActions.reset()` (saved positions, key `controller-layout`) | both keys |

The preview is `ArcadeController mode="preview"` in a 200 pt well with a private router it never calls; its accessibility label is `g03.preview.a11y`, rebuilt from the profile. Reduced motion is a `StatusRow` that appears only when the OS reports it, with "Change" opening system settings; there is no in-app toggle. The bindings list is `DEFAULT_CAMERA_BINDINGS` with the spoken labels, read-only.

Decisions recorded in the file header: value labels are visible text beside each slider (the kit `Slider` has no `valueText`); the position editor is deferred (no kit component or `validate` contract exists); the haptics-unsupported caption is struck (no `haptics.supported` flag in the kit); the "Show icons" switch is struck while no default binding has an icon.

The Settings row ("Game controls", `Card` + outline `Button`) renders on native only: the Game tab never mounts on web, so a web row would open a route that does not exist there.

## 6. What remains for a device

- Stick feel: `STICK_PAN_DP_PER_SECOND` 320 and the 300/120 ms repeat are first values; tune on an iPhone and a Pixel against the drag.
- Two caps held while the stick moves; rapid tapping leaves `heldButtons` empty; fold while A is held ends with no stuck cap (G01 08-handoff.md § Tests, integration).
- The pill: tap pauses, tap resumes, a 1000 ms hold stops with the final save written, an early release cancels; the `pill/holdProgress` ring fills under the finger and reaches full on the same frame the stop lands (reduced motion: four steps). VoiceOver "Stop" opens the confirm and only its Stop button stops.
- Screen readers find six caps, one stick and one pill, not a second set from the Rive artboards (`Semantics.Off` on the arcade surfaces).
- A stray keystroke (Shift, Cmd) on a tablet keyboard case leaves the touch controls up; a mapped key hides them and "Show touch controls" brings them back.
- Hardware: Start short press and hold on a pad; Enter/Escape on a keyboard; the overlay hides while a pad drives and returns on disconnect with `g01.cancel.source` spoken.
- Backgrounding mid-hold: `cancel-all` spoken once, session paused by `useWorldSaveLifecycle`, save written.
- Fold postures: controller rects and the attribution never on the hinge; `fold-change` cancel spoken.
- Settings: VoiceOver and TalkBack read each slider (the fraction until `Slider.valueText` lands); Restore leaves the saved game untouched (resume fixture 2).
- `expo prebuild` and a native build with the gamepad plist keys and the `uses-feature` entry; `npx expo config --type public` already shows them.

## 7. Verification

| Check | Command | Result |
| --- | --- | --- |
| App typecheck | `pnpm --filter @acme/app typecheck` | exit 0 |
| App tests | `pnpm --filter @acme/app test` | see the lane report tail |
| Kit typecheck (consumed) | `pnpm --filter @acme/ui typecheck` | exit 0 |
| Lint | `eslint` on the lane's files | 0 problems |
| Config | `npx expo config --type public` in `apps/mobile` | prints `GCSupportedGameControllers`, `GCSupportsControllerUserInteraction: false`, `withOptionalGamepad` in `plugins` |

## 8. Open items for other owners

### View Model contract additions (directive §8 table)

| Path | Type | Range | Written by | Reduced motion |
| --- | --- | --- | --- | --- |
| `pill/holdProgress` | number | 0 to 1, clamped in the artboard; default 0 | `StartStopPill` through `ArcadeRiveBinding.setPillHoldProgress`, from the UI-thread hold timer (20 steps) or the session's `stopProgress`, during a hold of `STOP_HOLD_MS` = 1000 ms. The ring has no clock of its own and shows only while `pill/state` is `stopConfirm`. | An authored stepped ring (Motion layer keyed on `a11y/reducedMotion`) shows `floor(holdProgress * 4) / 4`, so it renders 0, .25, .5, .75 or 1 whatever the host writes; the host also sends four steps. |

Evidence: `docs/evidence/rive/start-stop/holdProgress-half.png` (`--data=pill/state=stopConfirm --data=pill/holdProgress=0.5`), `holdProgress-reduced-0.6.png` (renders the 0.5 step), `data-holdProgress.data.json` (`--data-dump`, `pill/holdProgress` value 0.5). `scripts/rive/check-contract.sh paths` fails the build when any `ARCADE_VM_PATHS` literal is missing from a built `.data.json`. Not verified on a device.

### Items

- `packages/ui/Slider.types.ts`: `valueText?: (value: number) => string` (G03 B2) so the sliders speak percents and "times".
- `game-session.ts`: drop `movePadOpen` / `toggleMovePad`.
- G03 05-copy.md: four strings run past their own "Max" column (`g03.hand.caption` 75/74, `g03.restore.body` 75/74, `g03.opacity.caption` 54/48, `g03.stick.placement.caption` 50/48). The strings are used verbatim; the deck should fix the column or the string.
- Lane L's `GameTab` should mount `GameScreen` only when `phase === 'game'`; `useGameInput` also gates on the world being ready and on `acceptsGameplayInput`, so nothing moves while the lobby is up either way.
