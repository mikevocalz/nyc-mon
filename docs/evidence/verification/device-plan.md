# Arcade control + game lobby: device plan (Lane F)

Status: **not yet run**, every row. This lane may not boot a simulator, emulator or device, so this file is the script a device session runs, not evidence. Each row carries the directive §14 environment it proves, the `argent` calls in order, and the pass condition. Record real output under `docs/evidence/verification/device-runs/<date>-<device>.md` and flip the row's status there, never here.

Rules for the device session (from `~/.claude/rules/argent.md` and the lane preamble): `list-devices` first; prefer a running device; take tap coordinates from the element tree a tool returns, never from screenshot pixels; `run-sequence` for steps that need no observation between them; `await-ui-element` instead of polling; `stop-all-simulator-servers` with the devices used at the end. The only simulator this user allows unprompted is the iPhone Duo; everything else in the matrix needs a physical device or an explicit go-ahead.

App id: `com.nycmon.app` (both platforms, `apps/mobile/app.config.ts`). The Game tab route is `(drawer)/(tabs)/game` and mounts `GameTab` (lobby first). The settings route is `(drawer)/game-controls`.

Element names below are the accessibility labels the code sets today: pill "Start" / "Pause" / "Resume" / "Stop" (`StartStopPill.tsx:121-127`), stick "Move" (`AnalogStick.tsx:285`), caps by their spoken binding label (`default-bindings.ts`), lobby START "Start a new game" / "Continue your game" (`lobby-copy.ts`), leaderboard region "NYC Rank, …" (`LeaderboardPanel.tsx:169`). testIDs: `g02-lobby`, `g02-lobby-rank`, `g02-lobby-transition`, caps `…-btn-x` … `…-btn-c`, pill `…-pill`.

Multitouch is `gesture-custom` with `x2`/`y2` on the same event list (two fingers) or two interleaved event lists; `gesture-tap` and `gesture-swipe` are one finger. Three fingers need two `gesture-custom` calls inside one `run-sequence` with `delayMs: 0`, which is the closest the tool gets; note in the run log that the third contact is sequenced, not simultaneous.

## Matrix

| # | §14 environment | Device | Status |
|---|---|---|---|
| 1 | iPhone portrait | iPhone 16 Pro Max (physical) or iPhone Duo simulator | not yet run |
| 2 | iPhone landscape | same | not yet run |
| 3 | Android compact | Pixel 8 | not yet run |
| 4 | Foldable outer | Pixel Fold / Galaxy Z Fold, folded | not yet run |
| 5 | Foldable inner | same, open flat | not yet run |
| 6 | Book posture | same, half-open vertical hinge | not yet run |
| 7 | Tabletop posture | same, half-open horizontal hinge | not yet run |
| 8 | Large Android tablet | Galaxy Tab or Pixel Tablet | not yet run |
| 9 | iPad portrait / landscape / split | iPad (physical only; the team must be `436WA3W63V`) | not yet run |
| 10 | Web touchscreen | Chrome with `--remote-debugging-port=9222` on a touch laptop, or Storybook on a phone browser | not yet run |
| 11 | Keyboard / gamepad | any of the above plus a Bluetooth pad and keyboard | not yet run |
| 12 | Reduced motion | any of the above with the OS switch on | not yet run |

## Common preamble (every row)

```
list-devices
boot-device { udid | avdName }            # only if nothing is booted and the device is allowed
launch-app  { bundleId: "com.nycmon.app" }
await-ui-element { condition: "visible", selector: { text: "Game lobby" }, timeoutMs: 20000 }
describe                                  # record the lobby tree: wordmark header, "NYC Rank" region, resume heading, START
screenshot { scale: 0.5 }                 # baseline: lobby
```

Pass for the preamble: the lobby shows wordmark, NYC Rank panel in the `unavailable` state ("Rankings are not available yet" copy), a resume heading, and START; nothing else (directive §3 "no unrelated cards").

## Row 1: iPhone portrait

```
gesture-tap on START (centre of its frame from the tree)
await-ui-element { condition: "hidden", selector: { identifier: "g02-lobby-transition" }, timeoutMs: 30000 }
describe                                  # controller tree: "Start"/"Pause" pill, "Move" stick, six caps
screenshot                                # first visible gameplay frame
```

Pass: the first screenshot after the cover drops already shows the world at the saved camera (compare the camera numbers from `gameCameraStore` via `debugger-evaluate` to the save's `camera` in MMKV `world` / key `world-save`; they must be identical doubles, fixture 3). Every cap and the stick are inside the safe area, nothing under the home indicator, pill in the upper band (`describe` frames: pill `y + height` below the status bar inset, stick and cluster `y` in the lower half).

Then, two thumbs:

```
run-sequence [
  gesture-custom { events: [ Down(stick centre), Move(stick centre + (0, -0.08)) ], interpolate: 8 }   # hold the stick up
  gesture-custom { events: [ Down(cap A), Up(cap A) ] }                                                # tap A while the stick is held
  gesture-custom { events: [ Down(cap B) ] }                                                           # hold B
  gesture-custom { events: [ Down(cap C), Up(cap C) ] }                                                # tap C while B and the stick are held
  gesture-custom { events: [ Up(cap B) ] }
  gesture-custom { events: [ Up(stick) ] }
]
describe
```

Pass: `describe` shows no cap with state "Held" after the sequence and the stick value "Centre"; `debugger-evaluate` of `gameInputRouter.heldButtons.size` is 0 and `gameInputRouter.stick.engaged` is false. The camera moved forward during the hold (compare `gameCameraStore` before/after).

Rapid tapping:

```
run-sequence [ 20 × gesture-tap on cap A with delayMs: 40 ]
```

Pass: `heldButtons.size` 0 afterwards; no cap reads "Held".

Pill:

```
gesture-tap on "Pause"            -> pill reads "Resume", "Paused" announced (VoiceOver on)
gesture-tap on "Resume"           -> pill reads "Pause"
gesture-custom { events: [ Down(pill), Up(pill) ], with a 700 ms gap }   # hold past 600 ms
```

Pass: the hold shows the ring filling under the finger, the session ends, a final save is written (MMKV `world-save` revision +1, `gameplay.pill` = `start`). A 300 ms hold does not stop. Open finding: after the stop the lobby does not return (findings file, H5); record what the screen shows.

Background mid-hold:

```
gesture-custom { events: [ Down(cap A) ] }
button { home }  (or `shake` on iOS to trigger the control centre)   # app goes inactive/background
launch-app { bundleId: "com.nycmon.app" }
describe
```

Pass: "Paused while the app was in the background" announced once; cap A not held; session paused; a `background` save written.

## Row 2: iPhone landscape

```
rotate { orientation: "LandscapeLeft" }
await-screen-idle
describe ; screenshot
```

Pass: stick and cluster in the lower grip zones, the pill top-centre, no control within 16 dp of the edge-swipe zones, centre third clear (`describe` frames). START is visible in the lobby without scrolling (go back to the lobby by restarting the app; the stop path does not return there yet). Repeat the two-thumb sequence from Row 1.

## Row 3: Android compact (Pixel 8)

Same as Row 1 with `gesture-custom`. Add TalkBack: enable it through `settings-permissions`-adjacent `adb shell settings put secure enabled_accessibility_services com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService` (argent has no TalkBack toggle), then `describe` and swipe-navigate. Pass: order is pill, stick, X, Y, Z, A, B, C, world; the caps read their spoken binding names, not letters; double-tap on a cap sends one press (camera moves once) and leaves nothing held. Record the Android 48 dp floor: at profile scale 0.8 the caps are 44.8 dp; the G01 a11y doc expects the resolver to clamp Android to 0.86, and the code has no such clamp (findings file), so record what the caps measure.

## Row 4 to 7: foldable

```
fold { state: "folded" }  / { state: "unfolded" } / { posture: "book" | "tabletop" }   # per the fold tool's schema for the device
await-screen-idle ; describe ; screenshot
```

Row 4 (outer): compact layout; every control inside the outer panel's safe area.
Row 5 (inner, flat): tablet-like layout, groups raised from the corners.
Row 6 (book): `describe` frames: stick wholly left of the hinge x-range, cluster wholly right, pill not spanning the hinge. Lobby: panel left pane, resume + START right pane.
Row 7 (tabletop): every controller frame below the hinge y, pill centred on the lower region's top edge; the world above. Lobby: panel upper, START lower.

Fold while holding (§14 bullet 2):

```
gesture-custom { events: [ Down(cap A) ] }
fold { ...toggle }
await-screen-idle
describe
```

Pass: "Paused while the screen changed shape" announced once; cap A not held; `worldSessionStore` still `playing` or `paused` with the same `sessionId` (fixture 6, 7); no controller frame on the hinge after the change. Then from the lobby: fold/unfold with the lobby open and confirm `lobbyStore.phase` unchanged and START still enabled.

Exit unfolded, resume outer (fixture 7): with the session playing and unfolded, `button { home }`, `fold { folded }`, `launch-app`, START; pass: the camera doubles match the save exactly.

## Row 8: Android tablet

Scale 1.2 default; clusters near the grip corners. Open Settings → Game controls, change Size to 1.4 and Hand to Left; back to Game: the layout mirrors and the caps grow without overlapping the stick. Record that the position editor is absent (documented DEFER). Leaderboard: the panel reserves four 56 pt rows and does not stretch.

## Row 9: iPad

Portrait, landscape and Split View (drag another app in from the Dock through `describe` + `gesture-swipe` on the Dock). Pass: on every resize the controller re-resolves inside the new bounds (`layout-change` cancel announced if something was held), nothing under the split divider, the pill keeps 120 × 44.

## Row 10: web touchscreen

Boot Chrome with CDP (`list-devices` shows `platform: "chromium"`), `open-url` to the Storybook `Game controls/ArcadeController/Phone Portrait` story and the `Lobby/GameLobby/Web` story. On web the pill tap and stick drag go through pointer events; use `gesture-tap`, `gesture-drag` (Chromium has no `gesture-swipe`) and `gesture-scroll`. Pass: pointer drag on the stick moves the reading; two-pointer is not available through CDP, record "multitouch-equivalent not testable through CDP, needs a touch laptop with Chrome's touch emulation". Open finding: web START is permanently disabled (documented DEFER); record that it reads disabled with no reason text.

## Row 11: keyboard / gamepad

Pair a Bluetooth pad and keyboard with the device. On the Game tab: press and release pad buttons A/B/X/Y and bumpers (mapping in `gamepad-mapping.ts`), move the left stick, tap Start, hold Start 1 s. Keyboard: U/I/O, J/K/L, WASD and arrows, Enter, Escape held 1 s.

Pass: each hardware press produces the same camera command as the matching touch cap; the touch overlay hides while a pad drives and returns on disconnect with "Controller disconnected. Touch controls are on" announced; Start short press pauses/resumes; Start held 1 s stops with the final save. Record the known mismatch: touch stop hold is 600 ms, hardware 1000 ms (findings file). On the lobby: a pad `select` on the focused START enters the game; keyboard Enter does the same; neither focus alone starts anything.

Hybrid-device check (findings file, H8): with a keyboard attached, press one unmapped key; the touch controls must not disappear. Today the code hides them on any key event; record the behaviour.

## Row 12: reduced motion

iOS: Settings → Accessibility → Motion → Reduce Motion on (via `describe` + taps in `com.apple.Preferences`). Android: `adb shell settings put global animator_duration_scale 0` plus the "Remove animations" switch.

Pass: the caps press as a colour change with no sink; the stick returns in one frame; the pill legend cuts instead of fading; the hold ring fills in four steps; the lobby START shows the steady rim (`carolina-500` at night, `royal-500` by day) with no trace; the transition cross-fades. Nothing on either screen blinks. `screenshot` each state next to the full-motion state from the same device.

## Accessibility pass (all phone rows)

VoiceOver / TalkBack walk of the lobby: wordmark (header), NYC Rank region, resume heading, strip, START. Open finding (findings file, H2): the NYC Rank region is one `accessible` element, so rows and "Try again" are not reachable; record what the reader announces. In the game: pill, stick (adjustable; swipe up/down steps the camera; double-tap opens the action list), caps. The pill's "Stop" custom action: record whether it stops without any confirmation (findings file, H6).

Dynamic Type XXL on iPhone SE 3: cap letters do not grow (they are in Rive), "Hold to stop" wraps to two lines under the pill without overlapping the cluster; lobby START legend does not clip.

## Performance (directive §14 "Performance")

`react-profiler-start` before the two-thumb sequence, `react-profiler-stop` after; pass when no component re-renders per stick frame (the stick loop writes to `gameCameraStore`, not React). `native-profiler-start` / `-stop` around the same sequence on iOS; record the main-thread time per frame. Report distributions, never a single number.

## Close

```
stop-all-simulator-servers { devices: [ <the ids this session used> ] }
```
