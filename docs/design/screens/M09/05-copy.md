# M09 Naming ceremony: copy

Owner: `ux-writer`. Inputs: `01-research.md`, `03-direction.md`, `04-components.md`, `screens/M07/05-copy.md` (name rules and error tone); canon #1, #5, #9, #11, #14; PS-005; Q14, Q17, Q32; `docs/COPY_DECK.md`.

All strings are `voice: "ui"`. The Baby says no words on M09: naming follows the hatch, and a Baby babbles for its first 24 hours (Decision 32). No pronoun for the Mon anywhere (PS-005, Q14): the copy uses the form name or "your Mon".

Tokens: `{formName}` and `{dexNumber}` from the active Mon's `speciesId` in `@acme/content` (`allSpecies`: `formName`, `dexId`); `{bloodline}` = `` `${bloodlineName} Bloodline` `` (Decision #11); `{name}` is the trimmed, NFC-normalised name.

## Name rules (proposed; platform confirms)

Same shape as the Caller name (M07) so one validator family serves both: 1–16 characters after trimming; letters in any script plus space, hyphen, apostrophe, period; no digits or emoji; the block list applies. Proposed core function `validateMonName` (`08-handoff.md` B4). "Ratti" is allowed unless Mike rules otherwise (open question 1); the `reserved` reason and its string are ready if he does.

## Strings

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m09.identity` | #{dexNumber} {formName}, {bloodline} | ui | 48 | Caption above the title. "#062 Yotito, Yote Bloodline" | Decisions #9, #11 |
| `m09.identity.a11y` | Number {dexId}, {formName}, {bloodline} | ui | — | | |
| `m09.title` | Give {formName} a nickname | ui | 26 | `Heading level={1}`. "Name this Kittee Cee" is 20 | Decision #1 ("names the individual") |
| `m09.field.label` | Nickname | ui | 20 | Visible label, never placeholder-only | |
| `m09.field.hint` | Nicknames can't change yet, so take your time. | ui | 48 | True for Phase 1: nothing edits `nickname` after this | §4.3/§4.4 (no rename screen) |
| `m09.field.clear.a11y.label` | Clear nickname | ui | — | | |
| `m09.plate.a11y.label` | Nickname preview: {name} | ui | — | Full name even when the plate steps down | D10 |
| `m09.baby.a11y.label` | `CREATURE_ART[].alt` for the Baby | ui | — | Already pronoun-free (PS-005) | `packages/assets/creatures` |
| `m09.cta` | Use this nickname | ui | 20 | Same verb as M07 | |
| `m09.cta.a11y.hint.disabled` | Type a nickname first | ui | — | | |
| `m09.trackpad.label` | Nickname for {formName} | ui | — | | |
| `m09.trackpad.hint` | Tap to type a nickname. Hold to use it. | ui | — | Only reachable with the keyboard down | DIRECTION.md "Controls" |
| `m09.trackpad.commit.label` | Use this nickname | ui | — | `commitLabel` | |
| `m09.confirmed.a11y.announce` | Nickname saved: {name}. | ui | — | Polite | |
| `m09.ask.title` | Give {formName} a nickname? | ui | 32 | The question, drawn on the glass over the 3D Baby. A nickname is optional; the Mon is always its species | Mike, 2026-10-27 |
| `m09.ask.body` | {formName} keeps its name either way. | ui | 48 | Under the Baby | Mike, 2026-10-27 |
| `m09.ask.yes` | Yes | ui | 12 | Glass button; opens the text field | |
| `m09.ask.no` | No | ui | 12 | Glass button and the trackpad's default. Goes to M13 with no nickname | |
| `m09.ask.no.a11y.hint` | Goes to {formName}. No nickname. | ui | — | | |
| `m09.ask.yes.a11y.hint` | Opens a text field for the nickname. | ui | — | | |
| `m09.skipped.a11y.announce` | No nickname. {formName} it is. | ui | — | Polite | |
| `m09.edit.cancel` | Cancel | ui | 12 | Back to the question from the text field | |
| `m09.error.blank` | Add at least one letter. | ui | 80 | Same wording as M07 | |
| `m09.error.too_long` | That's more than 16 characters. Try a shorter version. | ui | 80 | | |
| `m09.error.characters` | Names can use letters, spaces, hyphens, apostrophes and periods. | ui | 80 | | |
| `m09.error.blocked` | Our filter blocked that name. It gets things wrong sometimes, so try another for now. | ui | 100 | Never "offensive", "inappropriate", "not allowed" (M07) | |
| `m09.error.reserved` | Ratti is the name of Malik's partner. Try another name for your Mon. | ui | 80 | **Ships only if Mike rules the name reserved** (open question 1) | Decision #1; `V11 ¶44` |
| `m09.save_error.title` | The name didn't save. | ui | 40 | Save write threw | |
| `m09.save_error.body` | Your Mon is fine and the name is still in the field. Try again. | ui | 80 | Reassures first (Law 8 spirit: nothing happened to the Mon) | |
| `m09.save_error.retry` | Try again | ui | 20 | | |
| `m09.sound.attention` | (audio slot) | — | — | No string; babble, off until assets | Decision 32 |

Error order: blank → too long → characters → reserved (if enabled) → blocked. One at a time, after a ≥ 1 s typing pause or on submit (M07 timing).

## Struck

- Suggested names and a shuffle (Q17, Law 1).
- "You can change this later" (no rename exists).
- Any Mon reaction line ("Squeaklet likes it!"): it would invent a Baby's opinion, and a first-day Baby only babbles (#14, Decision 32).

## Reduced motion

No copy changes.

## Localisation notes

- `{formName}` and `{bloodline}` are proper nouns, never translated.
- "Name this {formName}" needs an article-aware template in gendered languages; the Mon's gender is unstated (Q14), so translators use a neutral construction ("Give a name to {formName}").

## Open questions

1. **"Ratti" (Decision #1).** Is the Caller barred from typing "Ratti", or only from having it as a default? Built either way: the reserved list ships empty until Mike rules.
2. **Q32.** Answered by Decision 32: a first-day Baby babbles. Slot ready, off until the sound assets exist.
3. **Rename.** If a rename ever ships (M17), `m09.field.hint` is rewritten in the same PR.
