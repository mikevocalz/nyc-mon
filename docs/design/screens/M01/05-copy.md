# M01 Boot / power-on: copy

Owner: `ux-writer`. Inputs: `01-research.md`, `03-direction.md`, `04-components.md`, `06-critique.md`; `docs/design/DECISIONS.md` D1, D11; canon Decisions #7, #8, #16. Voice and glossary: `docs/COPY_DECK.md`.

The boot frame carries no visible text (`03-direction.md` § Type). Everything below is either spoken by VoiceOver/TalkBack, or is the shared H-Lynk status chip the LED settles into on the destination screen.

Every string here is `voice: "ui"`. No character speaks on M01, and no Mon exists on first run.

## Rules this screen follows

- The object is the H-Lynk. "Device" never appears, spoken or visible (Law 9).
- Nothing implies the H-Lynk holds, connects to or controls the Mon (Decision #8, `V11 ¶23`). "Connecting to your Mon" and "Loading your Mon" are banned.
- No "loading", no "please wait": the LED is a status light, not a spinner (§2.4).

## Spoken (VoiceOver / TalkBack)

| ID | String | Voice | Max | When | Canon |
|---|---|---|---|---|---|
| `m01.a11y.power_on` | H-Lynk on | ui | 12 | Once, polite announcement, when `power` reaches `on` (all states). Then the destination announces its own title | H-Lynk: `V11 ¶22`, `¶112` |

The reduced-motion variant speaks the same line at the same moment (240 ms). Nothing else changes in copy.

## Shell controls (accessibility labels)

Disabled during boot. Labels are set now so they are present the moment the controls enable on M08–M16.

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `hlynk.key.home.label` | Home | ui | 8 | `HLynkKey role="home"` | Control row: Decision #16 |
| `hlynk.key.menu.label` | Menu | ui | 8 | `role="menu"` | #16 |
| `hlynk.key.back.label` | Back | ui | 8 | `role="back"` | #16 |
| `hlynk.key.forward.label` | Forward | ui | 8 | `role="forward"` | #16 |
| `hlynk.trackpad.label` | Trackpad | ui | 10 | Hint is set per screen (M08 onward); none on M01 | #16, `V11 ¶63` |
| `hlynk.state.disabled.hint` | Available after start-up | ui | 28 | Read only if a user focuses a control during the 600 ms boot | — |

## Status light chip (shared with M11, M13)

The chip appears only after the LED settles on the destination. The LED never carries meaning by colour or rhythm alone (D3); this text is the meaning. M11 and M13 copy may refine these; until then they are the source of truth.

| ID | String | Voice | Max | LED state | Canon |
|---|---|---|---|---|---|
| `hlynk.led.incubating` | Incubating | ui | 14 | `incubating` | `V11 ¶49` |
| `hlynk.led.ready` | Ready to hatch | ui | 14 | `ready` | `V11 ¶49` |
| `hlynk.led.needs_you` | Needs you | ui | 14 | `needsYou` (any meter under 25%, §4.3 M13) | — |
| `hlynk.led.a11y` | Status light: {chip} | ui | — | Accessibility label on the LED; `{chip}` is one of the three above | — |

"Needs you" is the LED's own wording and stays neutral. It never becomes "hungry", "sad" or "dying": a Baby's request is a look or a reach, not a speech bubble (§2.1), and faint is never death (Law 8).

## Offline, first run

Shown on M02, not on M01 (`04-components.md`). Defined in `docs/design/screens/M02/05-copy.md` as `m02.status.offline`.

## Strings deliberately not written

- No splash title, tagline or wordmark text (§4.1, `03-direction.md` no-list).
- No error copy for a failed route read. If the MMKV snapshot cannot be read, M22 "save-recovered" owns that copy.

## Slopmonster gate

`python3 ~/.claude/skills/slopmonster/tools/deslop.py --text "<all String cells above>"`: **5/5 CLEAN**. Rival-model cleanse (`tools/cleanse.sh`) not run; the strings are labels of one to four words.
