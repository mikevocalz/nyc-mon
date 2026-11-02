# 04 Accessibility report: companion UI, WCAG 2.1 AA

Source: `origin/feat/nvidia-05-submission-package` at `6f59ab27`. Skill loaded: `design:accessibility-review`. Date 2026-10-28.

**Method.** Source reading plus contrast ratios computed from the hex values in `packages/theme/tokens.ts` with the WCAG relative-luminance formula (script: `scratchpad/contrast.mjs`). No browser, screen reader or keyboard session was run. Anything that depends on runtime rendering is marked **not verified**.

**Scheme.** The page renders the light (daylit) column: `theme.css:341` sets `:root { color-scheme: light }`, so every `light-dark()` token resolves to light. Dark values are listed for completeness only.

## Summary

Fails against AA: **4.1.3 Status messages** (no progress, save, export, forget or sign-out announcements) and **1.3.1 Info and relationships** (two `h1`, no `main`). A third failure is usability rather than a single criterion: the chat live region reads up to 2,500 characters of raw JSON per tool call.

Contrast passes everywhere text sits on a token pair. All text pairs are 6.55:1 or higher. The only weak spot is the default text field's focus state.

## Contrast (1.4.3 text, 1.4.11 non-text)

| Element | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---|---|---|
| Body text (`Paragraph`, default black) | `#000000` | `#F3F4F4` bg | 19.06 | 4.5 | Pass |
| Solid button label (`ink-950` on `orange-500`) | `#00041C` | `#FC7C00` | 7.76 | 4.5 | Pass |
| Solid button edge (`orange-950` shadow border vs page) | `#3C1E00` | `#F3F4F4` | 13.83 | 3 | Pass |
| Outline button label (`orange-400` on night fill) | `#FD9D40` | `#00041C` | 9.74 | 4.5 | Pass |
| Outline button night fill vs page | `#00041C` | `#F3F4F4` | 18.43 | 3 | Pass |
| Disabled label (`ink-400` on night) | `#90929C` | `#00041C` | 6.55 | exempt | n/a (passes anyway) |
| TextField nameplate (`ink-950` on `orange-500`) | `#00041C` | `#FC7C00` | 7.76 | 4.5 | Pass |
| TextField input text (`ink-50` on `ink-950` well) | `#F8F8F8` | `#00041C` | 19.12 | 4.5 | Pass |
| TextField well vs page | `#00041C` | `#F3F4F4` | 18.43 | 3 | Pass |
| TextField focus: border `orange-500` → `orange-300` | `#FEBE80` | `#FC7C00` | 1.61 change | see 2.4.7 | At risk |
| Switch off: track fill `ink-900` vs page | `#14182E` | `#F3F4F4` | 15.88 | 3 | Pass |
| Switch off: thumb `silver-400` on `ink-900` | `#CED0D1` | `#14182E` | 11.31 | 3 | Pass |
| Switch off: border `silver-600` vs page | `#A3A6AB` | `#F3F4F4` | 2.22 | 3 | Pass for the control (the dark fill carries the edge), the border alone fails |
| Switch on: track `orange-500` vs page | `#FC7C00` | `#F3F4F4` | 2.38 | 3 | Pass via `orange-950` keyline (13.83); face alone fails |
| Switch on: thumb `ink-50` on `orange-500` | `#F8F8F8` | `#FC7C00` | 2.46 | 3 | Pass via `ink-950` thumb border (7.76); fill alone fails |
| Focus ring `royal-500` on page | `#0058F8` | `#F3F4F4` | 5.08 | 3 | Pass |
| Proposed: `danger` text on page | `#D50000` | `#F3F4F4` | 4.98 | 4.5 | Pass |
| Proposed: `text-muted` meta text on page | `#61656A` | `#F3F4F4` | 5.33 | 4.5 | Pass |
| Proposed: `text-secondary` on page | `#484C51` | `#F3F4F4` | 7.85 | 4.5 | Pass |
| Dark (not rendered): text / danger / focus on night | `#F8F8F8` / `#FA4040` / `#4BA8F0` | `#00041C` | 19.12 / 5.68 / 7.89 | 4.5 / 4.5 / 3 | Pass |

## Per screen

### Sign-in / OAuth (`nvidia.tsx:119`, callback `:49-56`)
| Criterion | Result | Evidence |
|---|---|---|
| 2.1.1 Keyboard | Pass | `Button` web press base is a real `<button>` (`Button.tsx:102` comment) |
| 2.4.7 Focus visible | Pass | `focus-visible:ring-2 ring-focus ring-offset-2` (`Button.styles.ts:25`) |
| 2.5.5 Target size (AAA in 2.1; repo floor 44) | Pass | `min-h-target` 48px |
| 3.3.1 Error identification | Pass | Callback errors (`auth.ts:198-205`) reach `role="alert"` (`nvidia.tsx:120`) |
| 4.1.3 Status messages | Partial | Nothing announces "Signed in" after the redirect |
| 2.4.3 Focus order after redirect | Not verified | Full page load; focus starts at document top |

### Companion chat (`:122-124`)
| Criterion | Result | Evidence |
|---|---|---|
| 1.3.1 Info and relationships | **Fail** | Two `<h1>` (`:117`, `:125`). Log entries are `<p>` with a text prefix (`Caller:` / `Mon:`), not a list; acceptable, but a `List` reads better |
| 3.3.2 Labels | Pass | `TextField` sets `aria-label={label}` and a visible `Label` (`TextField.tsx:102,130`) |
| 4.1.3 Status messages | **Fail** | Busy state is only the disabled button's label change (`:123`), which is not announced. Nothing in a `role="status"` region during the wait |
| Live region for replies | **Fail (usability)** | `aria-live="polite"` on the log (`:124`) is right in principle, but each tool line includes up to 2,500 characters of JSON (`:99`), which a screen reader reads in full. Replies are not streamed: Nebius is buffered (`nebius.ts:142`) and the page ignores `onText`, so each reply is announced once, whole |
| Live region keys | At risk | `key={index}` with `.slice(-40)` (`:90,99,103,124`): once the log passes 40 lines, every row's text shifts under the same key, and a polite region may re-announce changed rows. Not verified |
| 2.1.1 Keyboard | Partial | Field and Send are reachable. Enter in the field does not send (no `onSubmitEditing`); not a WCAG fail, but a keyboard user must Tab to Send each time |
| 2.4.3 Focus order | Pass by DOM order | Field → Send → log. After a reply, focus stays on the disabled-then-enabled Send button. Not verified that the browser keeps focus on a button that was disabled |

### Care-action confirmation (tool lines `:98-99`)
| Criterion | Result | Evidence |
|---|---|---|
| 1.3.1 / readability | **Fail (usability)** | Outcome word (`applied`, `declined`…) is mid-line between a tool id and JSON |
| 1.4.1 Use of colour | Pass | Outcome is text only |

### Memory controls (`:125-131`)
| Criterion | Result | Evidence |
|---|---|---|
| 3.3.2 Labels | Pass | Field and switch have labels; 500-char limit is in the label |
| 3.3.1 / 3.3.3 | Partial | Field is disabled until memory loads, with no text saying why |
| 4.1.2 Name, role, value | Pass | Switch is `role="switch"` with `aria-checked` and `aria-label` (`NeonSwitch.tsx:64-67`) |
| 2.5.5 Target size (AAA in 2.1) | Advisory | Switch track `h-8 w-14` = 32×56px (`NeonSwitch.tsx:18`); the label text is not part of the press target. Passes 2.2's AA 2.5.8 (24px); fails the repo floor `layout.minTargetIosPt` 44 |
| 2.4.7 Focus visible (text field) | At risk | Default `well` surface: `focus:outline-none` plus a border step `orange-500` → `orange-300` (1.61:1 change) and a soft orange glow. Visible, weak. `surface="daylit"` uses `border-focus` royal, 5.08 against page |
| 4.1.3 Status messages | **Fail** | No success message after Save (`:82`); only `Revision: N` changes in plain text |
| 2.1.1 Keyboard (switch) | Not verified | Rendered through RNW `Pressable` with `role="switch"`; Space/Enter activation relies on RNW's keyboard press handling |

### Export and forget (`:111-115`, `:132-133`)
| Criterion | Result | Evidence |
|---|---|---|
| 3.3.4 Error prevention (legal, financial, data) | Partial | Strictly AA 3.3.4 covers legal/financial/test data; deleting saved personal data with one click and no confirm or undo is the same risk. Add a `Dialog` confirm |
| 4.1.3 Status messages | **Fail** | No message after export or forget |
| 2.1.1 Keyboard | Pass | Both are `Button` |

### Error / timeout / provider-unavailable (`:120`, `:144`)
| Criterion | Result | Evidence |
|---|---|---|
| 3.3.1 Error identification | Partial | Errors are announced (`role="alert"`) but provider failures all read `The model call failed. Try again.` (`model.ts:310`), which does not identify the failing service |
| 1.4.1 / visual distinction | Partial | Error text is styled exactly like body text; only its position marks it |
| Silent sign-out | **Risk** | Refused refresh mid-turn aborts the turn and suppresses the message (`freshToken.ts:109-112` → `nvidia.tsx:39,104`). Not verified at runtime |

### Sign-out (`:107-110`, `:119`)
| Criterion | Result | Evidence |
|---|---|---|
| 2.4.3 Focus order | At risk | The Sign out button stays in place but the whole signed-in block unmounts; focus target after sign-out is not managed. Not verified |
| 4.1.3 | Partial | No "Signed out" announcement |

## Page-level

| Criterion | Result | Evidence |
|---|---|---|
| 3.1.1 Language | Pass | `<html lang="en">` (`nvidia.html:2`) |
| 2.4.2 Page titled | Pass | `<title>NYC-Mon Personal Companion</title>` |
| 1.3.1 Landmarks | Partial | Root is `Section`, no `Main` |
| 1.4.4 Resize text / 1.4.10 Reflow | Not verified | No max width; buttons wrap via `flex-wrap` (`:130`); labels are `whitespace-nowrap` unless `fullWidth` (`Button.styles.ts:27,52`) |
| 2.3.3 / reduced motion | Pass | Button `motion-reduce:transition-none`; switch honours `useReducedMotion`; no other motion on page |
| 1.4.12 Text spacing | Not verified | |

## Priority fixes

1. **Status messages** (4.1.3): one `role="status"` line for wait, save, export, forget, sign-in and sign-out. Affects screen-reader users on every action.
2. **Tool lines**: plain outcome sentence in the live region; JSON in a collapsed `Details` outside it.
3. **Headings and landmark**: `Main` root, one `h1`, `h2` for the memory section.
4. **Forget confirm**: `Dialog` with the danger action.
5. **Field focus**: `surface="daylit"` on both text inputs.
