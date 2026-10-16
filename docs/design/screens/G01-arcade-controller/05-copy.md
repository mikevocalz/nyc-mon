# G01 Arcade controller overlay: copy

Owner: `ux-writer`. Inputs: `01-research.md`, `03-direction.md`, `04-components.md`; `docs/COPY_DECK.md` (voices, banned words, tone); CONTRIBUTING.md Law 9; `packages/ui/game-controls/contract.ts` (the state unions these strings name). Every string is `voice: "ui"`. No character speaks on the overlay.

## Rules this screen follows

- The pill's visible legend is a `type-tag` signage label in uppercase (`03-direction.md` Decision). Its accessible name is sentence case. Every other visible string is sentence case.
- Button labels come from `ControllerBindings`; the defaults below are the `CameraCommand` union in `packages/app/features/game/camera-input.ts`, with the spoken labels already used by `A11Y_ACTIONS` in `GameScreen.tsx`. No action name is invented here.
- "Stop" ends the session; it never says "quit", "exit" or "end game", and it never promises what happens to the save beyond what `WorldResumeService` guarantees (lane E): the last durable save is kept.
- No "device" (the H-Lynk is not on this screen and is never named as a controller). `Caller` if the player is named; the overlay never needs to.
- No pressure, no exclamation marks, no "oops" (COPY_DECK § Tone).

## Pill legend (visible, `type-tag`) and accessible names

| ID | Legend | Accessible name | Hint | Max | `pill/state` | Notes |
|---|---|---|---|---|---|---|
| `g01.pill.start` | START | Start | Starts the game | 6 | `start` | `cta` face; the one orange on the overlay |
| `g01.pill.pause` | PAUSE | Pause | Pauses the game | 6 | `playing` | graphite face |
| `g01.pill.resume` | RESUME | Resume | Resumes the game | 6 | `paused` | graphite face |
| `g01.pill.stop_confirm` | HOLD TO STOP | Stop | Hold for one second to stop. Your last save is kept | 12 | `stopConfirm` | shown while the hold ring fills |
| `g01.pill.hint` | Hold to stop | — | — | 14 | `playing`, `paused` | `type-caption` under the pill; the hint Xbox put in its empty centre |
| `g01.pill.stop_cancel` | Cancel | Cancel | Keeps playing | 6 | `stopConfirm` (screen-reader Stop confirm) | platform word in the confirm dialog the accessibility Stop action opens (added 2026-10-15, review finding H7) |
| `g01.touch.show` | Show touch controls | Show touch controls | Brings back the stick and buttons | 20 | any, while a gamepad or keyboard hid them | sits in the pill's rect; one tap restores the touch overlay (added 2026-10-15, review finding H8) |
| `g01.pill.disabled.hint` | — | — | Not available right now | 24 | disabled | read only if focused while the session is loading |

Spoken state changes (polite, `AccessibilityInfo.announceForAccessibility`): `g01.a11y.paused` "Paused", `g01.a11y.resumed` "Resumed", `g01.a11y.stopped` "Stopped. Your last save is kept", `g01.a11y.stop_released` "Stop cancelled". Max 32 each.

## Six buttons (defaults until a gameplay spec exists)

Visible cap labels are the one- or two-character `ActionBinding.label`; the accessible name is the spoken action; the hint is empty (the name says what happens). Letters X Y Z A B C are the printed defaults; a binding may replace them.

| ID | Button | Cap label | Accessible name (from `A11Y_ACTIONS`) | Max |
|---|---|---|---|---|
| `g01.btn.x.label` | X | X | Zoom in | 14 |
| `g01.btn.y.label` | Y | Y | Zoom out | 14 |
| `g01.btn.z.label` | Z | Z | Reset view | 14 |
| `g01.btn.a.label` | A | A | Turn view left | 14 |
| `g01.btn.b.label` | B | B | Turn view right | 14 |
| `g01.btn.c.label` | C | C | Move forward | 14 |

Decision: BUILD this default map. Zoom and reset on the top row, turn and forward on the bottom, so the thumb's nearest row (bottom) holds the three the camera uses most while moving. Move back, left and right stay on the stick. The map is data (`ControllerBindings`), replaced by the gameplay screen without touching this file. G03's read-only bindings list shows this same map.

State hints, spoken as `accessibilityState` or value, never visible:

| ID | String | Max | `ButtonVisualState` |
|---|---|---|---|
| `g01.btn.state.held` | Held | 8 | `held` |
| `g01.btn.state.disabled` | Not available | 14 | `disabled` |
| `g01.btn.state.cooldown` | Ready in {seconds} seconds | 24 | `cooldown` |

## Stick

| ID | String | Role | Max | Notes |
|---|---|---|---|---|
| `g01.stick.label` | Move | name | 8 | `accessibilityRole="adjustable"` |
| `g01.stick.hint` | Drag to move. Double tap for step controls | hint | 40 | the step controls are `GameScreen.tsx`'s existing accessibility actions |
| `g01.stick.value` | {direction} | value | 12 | one of: Centre, North, North-east, East, South-east, South, South-west, West, North-west (`Direction8`, the compass words `describeCamera` already speaks) |
| `g01.stick.mode.analog` | Analog stick | value prefix | 14 | spoken once when the mode is analog |
| `g01.stick.mode.dpad` | Direction pad | value prefix | 14 | spoken once when the mode is dpad |

## Cancelled input

When `cancelAll(reason)` fires every cap returns to idle and the pad springs home. One polite line, by reason, so a Caller who felt a press vanish knows why:

| ID | String | `CancelReason` | Max |
|---|---|---|---|
| `g01.cancel.background` | Paused while the app was in the background | `background` | 44 |
| `g01.cancel.fold` | Paused while the screen changed shape | `fold-change` | 44 |
| `g01.cancel.layout` | Controls moved to fit the screen | `layout-change` | 40 |
| `g01.cancel.source` | Controller disconnected. Touch controls are on | `source-disconnected` | 48 |
| `g01.cancel.generic` | Controls reset | `gesture-cancel`, `focus-loss`, `screen-transition` | 16 |

Whether `background` and `fold-change` also pause the session is lane E's call; the strings assume they do, because a cancelled input with a running simulation is the drift §2A forbids.

## Strings deliberately not written

- No onboarding or tooltip copy; the overlay has no first-run hint in Phase 1.
- No "quit", "exit", "end game", "game over" anywhere.
- No save copy beyond "Your last save is kept"; the resume and recovery copy lives in `G02-game-lobby/05-copy.md`.
- No settings labels; they are `G03-game-control-settings/05-copy.md`.

## Slopmonster gate

Every String cell above (legends, names, hints, spoken lines, one per line, `{placeholders}` filled with "north" and "3"; the list is `scratchpad/g01-strings.txt`) was run through `python3 ~/.claude/skills/slopmonster/tools/deslop.py --text "$(cat g01-strings.txt)"` on 2026-10-15. Printed tail:

```
110 words of visible copy

  score 5/5  CLEAN
exit=0
```

The rival-model cleanse (`tools/cleanse.sh`) was not run; the strings are labels of one to nine words.
