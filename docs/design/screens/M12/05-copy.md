# M12 Hatch: copy

Owner: `ux-writer`. Inputs: `01-research.md`, `03-direction.md`; Law 9; Decisions #5, #6, #8, #14; PS-005; Q32. Glossary: `docs/COPY_DECK.md`.

All strings are `voice: "ui"`. The Baby does not speak (Q32 open). No pronoun for the Mon (PS-005): restructure or repeat the name. `{babyName}` is the Baby form name from content (`Squeaklet`, `Kittee Cee`, `Yotito`; Decision #9) until M09 sets a nickname; `{monName}` is the nickname when set, else `{babyName}`.

Fewer words than any other screen. The show carries the moment; text exists for the screen reader and for the two choices.

## Strings

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m12.trackpad.open` | Open the case | ui | 20 | pre; same as `m11.trackpad.open` | `V11 ¶49` |
| `m12.skip` | Skip | ui | 12 | visible from 2000 ms | brief §3.5 |
| `m12.skip.a11y.hint` | Goes to the end. Nothing about your Mon changes. | ui | — | the honest promise | Law 6 |
| `m12.first_look.hesitate.trackpad` | Stay close | ui | 16 | trackpad label and labelled button on the hesitate path | Decision #14 |
| `m12.first_look.hesitate.hint` | Hold the trackpad to stay close. | ui | 40 | caption after 8 s without input; never earlier | — |
| `m12.plate.a11y.label` | {babyName}, {bloodlineLabel} | ui | — | `SignagePlate`; `{bloodlineLabel}` e.g. "Hood Ratti Bloodline" (Decision #11) | #6, #11 |
| `m12.cta.name` | Name {babyName} | ui | 24 | complete, `nickname === null` → M09 | Decision #5 |
| `m12.cta.home` | Go to {monName} | ui | 24 | complete, nickname set → M13 | — |

## Announcements (polite, VoiceOver / TalkBack)

The show is visual; these make it followable without sight. One line per phase, never more.

| ID | String | When |
|---|---|---|
| `m12.a11y.case_open` | The case opens. | `case-open` |
| `m12.a11y.crack` | Your egg is cracking. | first crack only |
| `m12.a11y.emerge` | {babyName} hatched. | `emerge` |
| `m12.a11y.first_look.lean_in` | {babyName} looks at you and leans in. | lean-in |
| `m12.a11y.first_look.hesitate` | {babyName} looks at you, then peeks out from the shell. | hesitate starts |
| `m12.a11y.first_look.resolved` | {babyName} comes closer and leans in. | hesitate resolved by the Caller |
| `m12.a11y.skipped` | {babyName} hatched. | after skip |
| `m12.a11y.already` | {monName} already hatched. | already-hatched re-entry, then continuity |

## Rejected lines

| Line | Why not |
|---|---|
| "{babyName} chose you!" | States the meaning instead of showing it, and the exclamation is the celebratory register the brief rules out. The lean-in shows the choice |
| "{babyName} isn't sure about you" | Reads as rejection (#14: never rejects) |
| "Meet {babyName}!" (Finch's pattern) | Names before naming; and "meet" is M08's word |
| "Hatching…" | Loader voice |
| "It's a Squeaklet!" | "It" for the Mon (PS-005) |

## Localization notes

The announcements are short on purpose: screen readers interrupt the next phase's line if a translation runs long. Keep each under about 50 characters in translation. `{bloodlineLabel}` comes from content, never translated by string concatenation.
