# G03 Game-control settings: copy

Owner: `ux-writer`. Inputs: `01-research.md`, `03-direction.md`, `04-components.md`, `06-critique.md`; `docs/COPY_DECK.md` (voice, banned words, limits); `packages/ui/game-controls/contract.ts` (field names and ranges); `packages/app/features/game/camera-input.ts` (`CameraCommand`). Canon: Law 9 (Caller, H-Lynk, Hood Mon, Bloodline).

Every string is `voice: "ui"`. Sentence case everywhere, buttons included. No exclamation marks. Limits are the COPY_DECK estimates for iPhone SE at default Dynamic Type.

## Rules this screen follows

- Button labels start with a verb and say what happens: "Restore defaults", "Reset position", "Keep my settings".
- Captions say what a setting does to the game, never how the maths works.
- No game action is named beyond the `CameraCommand` union. No move, ability or combat verb appears anywhere on this screen.
- Errors: what happened, then what to do. No blame, no "oops", no "invalid".
- Values are spoken in units a person uses: percent, "times", "left" and "right".

## Screen and sections

| ID | String | Voice | Max | Where | Notes |
|---|---|---|---|---|---|
| `g03.title` | Game controls | ui | 26 | `Heading level={1}` | Also the row label in `SettingsContent` that opens this screen |
| `g03.intro` | Changes apply as you make them. | ui | 37 | `Text tone="muted"` under the title | Says there is no Save |
| `g03.section.stick` | Stick | ui | 26 | `FieldGroup.Section` | |
| `g03.section.layout` | Layout | ui | 26 | | |
| `g03.section.feel` | Feel | ui | 26 | | |
| `g03.section.buttons` | Buttons | ui | 26 | | |

## Preview

| ID | String | Voice | Max | Where | Notes |
|---|---|---|---|---|---|
| `g03.preview.a11y` | Controller preview. {hand}, size {size} percent, opacity {opacity} percent, {mode} stick. | ui | — | `ControllerPreview` accessibility label | `{hand}` is `g03.hand.left` or `g03.hand.right`; `{mode}` is "analog" or "D-pad"; rebuilt on every change |
| `g03.preview.hint` | Tap a button to feel the haptic strength. | ui | 48 | caption under the well; hidden when haptics is Off | |

## Stick

| ID | String | Voice | Max | Where | Notes |
|---|---|---|---|---|---|
| `g03.stick.mode.label` | Mode | ui | 15 | segment group name | `aria-label` reads `g03.stick.mode.a11y` |
| `g03.stick.mode.a11y` | Stick mode | ui | — | `aria-label` | |
| `g03.stick.mode.analog` | Analog | ui | 10 | segment | `stickMode: 'analog'` |
| `g03.stick.mode.dpad` | D-pad | ui | 10 | segment | `stickMode: 'dpad'` |
| `g03.stick.mode.caption` | Analog moves at any angle and speed. D-pad snaps to eight directions. | ui | 74 | caption | Two short sentences; wraps to two lines on SE |
| `g03.stick.placement.label` | Placement | ui | 15 | | |
| `g03.stick.placement.a11y` | Stick placement | ui | — | | |
| `g03.stick.placement.fixed` | Fixed | ui | 10 | segment | `stickPlacement: 'fixed'` |
| `g03.stick.placement.floating` | Floating | ui | 10 | segment | `stickPlacement: 'floating'` |
| `g03.stick.placement.caption` | Floating puts the stick wherever your thumb lands. | ui | 48 | caption | |
| `g03.stick.deadzone.label` | Dead zone | ui | 15 | `Slider label` | `stick.deadZone` 0 to 0.5 |
| `g03.stick.deadzone.value` | {percent} percent | ui | — | spoken value; visible as "{percent}%" | 0.15 reads "15 percent" |
| `g03.stick.deadzone.caption` | How far the stick moves before the game notices. | ui | 48 | caption | |
| `g03.stick.sensitivity.label` | Sensitivity | ui | 15 | `Slider label` | `stick.sensitivity` 0.5 to 2 |
| `g03.stick.sensitivity.value` | {factor} times | ui | — | spoken; visible as "{factor}×" | 1 reads "1 times"; 1.5 reads "1.5 times" |
| `g03.stick.sensitivity.caption` | How fast a small push turns into a big move. | ui | 48 | caption | |

## Layout

| ID | String | Voice | Max | Where | Notes |
|---|---|---|---|---|---|
| `g03.hand.label` | Hand | ui | 15 | segment group | |
| `g03.hand.a11y` | Hand | ui | — | `aria-label` | |
| `g03.hand.left` | Left | ui | 10 | segment | `handedness: 'left'`: stick right, buttons left |
| `g03.hand.right` | Right | ui | 10 | segment | `handedness: 'right'` |
| `g03.hand.caption` | Left puts the buttons under your left thumb and the stick under your right. | ui | 74 | caption | |
| `g03.size.label` | Size | ui | 15 | `Slider label` | `scale` 0.8 to 1.4 |
| `g03.size.value` | {percent} percent | ui | — | spoken; visible "{percent}%" | 1 reads "100 percent" |
| `g03.opacity.label` | Opacity | ui | 15 | `Slider label` | `opacity` 0.3 to 1 |
| `g03.opacity.value` | {percent} percent | ui | — | spoken; visible "{percent}%" | |
| `g03.opacity.caption` | Lower lets more of the city show through the controls. | ui | 48 | caption | |
| `g03.placement.title` | Position | ui | 15 | editor label (tablet, book, web) | |
| `g03.placement.caption` | Drag a handle, or use the arrows to move it 8 points at a time. | ui | 74 | caption | Names the non-drag path (SC 2.5.7) |
| `g03.placement.stick.handle` | Stick position | ui | — | handle accessibility label | |
| `g03.placement.cluster.handle` | Button cluster position | ui | — | handle accessibility label | |
| `g03.placement.nudge.up` | Move up | ui | — | nudge button label | likewise `.down`, `.left`, `.right` |
| `g03.placement.reset` | Reset position | ui | 34 | `Button variant="ghost"` | one per handle |
| `g03.placement.invalid` | That spot is off the screen or on the fold. It went back to where it was. | ui | 74 | `StatusRow` tone `request`, polite announcement | |

## Feel

| ID | String | Voice | Max | Where | Notes |
|---|---|---|---|---|---|
| `g03.haptics.label` | Haptics | ui | 15 | segment group | |
| `g03.haptics.a11y` | Haptic strength | ui | — | `aria-label` | |
| `g03.haptics.off` | Off | ui | 10 | segment | `haptics: 'off'` |
| `g03.haptics.light` | Light | ui | 10 | | |
| `g03.haptics.medium` | Medium | ui | 10 | | |
| `g03.haptics.strong` | Strong | ui | 10 | | |
| `g03.haptics.unsupported` | This H-Lynk has no haptics. | ui | 37 | caption, replaces the group when the platform reports none | "H-Lynk", never "device" (Law 9). The app is framed as an H-Lynk Entry unit (Decision #8) |
| `g03.icons.label` | Show icons on buttons | ui | 34 | `Switch label` | `showIcons` |
| `g03.icons.caption` | Buttons show a picture of what they do instead of a letter, when one exists. | ui | 74 | caption | |

## Buttons (read-out)

| ID | String | Voice | Max | Where | Notes |
|---|---|---|---|---|---|
| `g03.bindings.caption` | What each button does on this screen. Remapping comes with the game rules. | ui | 74 | caption under the section title | Promises only what ships |
| `g03.bindings.key.x` … `.c` | X, Y, Z, A, B, C | ui | 2 | `KeyValueList` label | the six `ButtonId`s, upper case because they are the printed legends |
| `g03.bindings.unbound` | TODO(canon) | ui | — | drawn by `KeyValueList` when `value` is `null` | never shown in a release build; a release build with an unbound button is a defect |

Binding labels for the current `CameraCommand` union (the only actions in the repo today): Zoom in, Zoom out, Turn view left, Turn view right, Move forward, Move back, Move left, Move right, Reset view. These are the existing `A11Y_ACTIONS` labels in `packages/app/features/game/GameScreen.tsx`, reused so the spoken action and the printed binding never drift. Which six of the nine are bound, and to which button, is lane C's call in `ControllerBindings`; this screen prints whatever it is given.

## Reduced motion and clamping

| ID | String | Voice | Max | Where | Notes |
|---|---|---|---|---|---|
| `g03.reduced.on` | Reduced motion is on in your system settings. The controls use their steady versions. | ui | — | `StatusRow` tone `neutral`, only when the OS reports it | |
| `g03.reduced.action` | Change | ui | 8 | `StatusRow` action, opens system settings | hint `g03.reduced.hint` |
| `g03.reduced.hint` | Opens system settings | ui | 28 | `accessibilityHint` | |
| `g03.clamped` | One setting was outside its range and was reset. | ui | 48 | `StatusRow` tone `pending` | Clears on the next edit |

## Restore defaults

| ID | String | Voice | Max | Where | Notes |
|---|---|---|---|---|---|
| `g03.restore` | Restore defaults | ui | 34 | `Button variant="outline"` | |
| `g03.restore.title` | Restore default controls? | ui | 26 | `ResponsiveDialog title` | |
| `g03.restore.body` | Every control goes back to how it started. Your saved game is not affected. | ui | 74 | `description` | Says what is and is not touched |
| `g03.restore.confirm` | Restore | ui | 34 | danger `Button` | |
| `g03.restore.cancel` | Keep my settings | ui | 34 | outline `Button` | Labels name the outcome, never "OK" / "Cancel" |
| `g03.restore.done` | Controls restored to defaults. | ui | 37 | polite announcement | |

## Strings deliberately not written

- No "Save" or "Apply". Changes commit as they are made (`03-direction.md`).
- No in-app "Reduce motion" toggle label.
- No action names beyond `CameraCommand`. A gameplay spec adds its own strings under its own screen.
- No "Advanced" or "Expert" section headings.

## Slopmonster gate

Command run 2026-10-15 from `packages/ui`'s parent, on every String cell above joined by newlines (placeholders like `{percent}` left in):

```
python3 ~/.claude/skills/slopmonster/tools/deslop.py --text "$(cat /private/tmp/claude-501/-Users-mikevocalz/aca33531-b1f0-4bc8-836b-1b82ce1d4ed9/scratchpad/g03-strings.txt)"
```

Printed tail:

```
257 words of visible copy


  score 5/5  CLEAN
exit=0
```

The rival-model cleanse step (`tools/cleanse.sh`) has not been run; the strings are labels, captions and one dialog.
