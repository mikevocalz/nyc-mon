# M07 Caller name: copy

Owner: `ux-writer`. Inputs: `01-research.md`, `03-direction.md`, `04-components.md`, `06-critique.md`; `docs/design/DECISIONS.md` P4, D10; Law 9; `V11 ¶19`, `¶58`, `¶109`. Voice and glossary: `docs/COPY_DECK.md`.

All strings are `voice: "ui"` (P4). The preview is the H-Lynk showing the name on a signage plate. No Mon, no Santoro, no "Callah": no Mon exists before the hatch (Decision #5), and Phase 1 Baby speech is open (Q32).

## Name rules (proposed; platform confirms)

These drive the error strings. The numbers are a copy proposal sized to the plate, not a platform decision yet.

- Length 1 to 16 characters after trimming. 16 is about what `SignagePlate` holds at `type-title` size on SE before it truncates (`type-station` holds about 13).
- Allowed: letters in any script, including accented letters (é, ñ, ç), plus spaces, hyphens, apostrophes and periods. Names from the communities `V11 ¶53` lists must pass: test the filter on them before launch (`06-critique.md` blocker 2).
- Digits and emoji are not allowed. Open: a teen handle like "Dani2" may be common; see open question 2.
- The filter never calls a name offensive. It says the name is blocked and that the filter makes mistakes.
- "Ratti" is allowed. The reserved-name rule is for the Mon's name at M09, not the Caller's (`01-research.md`).

## Length budget

iPhone SE, 343 pt. `type-title` about 26 characters a line; `type-caption` 48; the plate at `type-station` about 13.

## Strings

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m07.title` | What should your Mon call you? | ui | 52 | `Heading level={1}`, two lines on SE | Caller relationship belongs to the individual Mon: `V11 ¶44` |
| `m07.field.label` | Caller name | ui | 20 | Visible label, never placeholder-only | Caller: `V11 ¶19`, `¶109` |
| `m07.field.hint` | A nickname works. | ui | 48 | 13+ | — |
| `m07.field.hint.under13` | Use a nickname, not your real name. | ui | 48 | Under-13, any consent state | COPPA: a real first name is personal information (`01-research.md`) |
| `m07.field.hint.pending` | Use a nickname, not your real name. It stays on this phone until your parent or guardian says yes. | ui | 110 | Under-13, consent pending. Replaces `.under13` | ADR 0001 (queued writes) |
| `m07.field.clear.a11y.label` | Clear name | ui | — | `TextField clearable` | — |
| `m07.plate.a11y.label` | Caller name preview: {name} | ui | — | `SignagePlate`; full name even when the plate truncates. Not rendered when empty | — |
| `m07.continue` | Use this name | ui | 20 | Orange CTA, disabled while empty or invalid | — |
| `m07.continue.a11y.hint.disabled` | Type a name first | ui | — | Read when focused while disabled | — |
| `m07.back.a11y.label` | Back | ui | — | | — |

The plate shows exactly what was typed. It has no placeholder text in the empty state (§0A.2 bans "Name Here").

## Invalid

Shown in `ErrorMessage` under the field after a short pause in typing (not per keystroke) and on Continue. The plate keeps the text. One message at a time, in this order.

| ID | String | Voice | Max | Trigger |
|---|---|---|---|---|
| `m07.error.blank` | Add at least one letter. | ui | 80 | Only spaces or punctuation |
| `m07.error.too_long` | That's more than 16 characters. Try a shorter version. | ui | 80 | Over the limit. `maxLength` stops most of these; paste can still trigger it |
| `m07.error.characters` | Names can use letters, spaces, hyphens, apostrophes and periods. | ui | 80 | Digits, emoji or other symbols |
| `m07.error.blocked` | Our filter blocked that name. It gets things wrong sometimes, so try a nickname for now. | ui | 100 | Filter hit. Never "offensive", "inappropriate" or "not allowed" |

## Confirmed

No visual copy; Continue goes to M08. One polite announcement:

| ID | String | Voice | Max | Notes |
|---|---|---|---|---|
| `m07.confirmed.a11y.announce` | Caller name saved. | ui | — | |

## Reduced motion

No copy changes. The plate appears instantly instead of with `motion-enter`.

## Open questions

1. **Can the Caller change this name later?** `01-research.md` (Sol's job) wants it, but M19/M20 in §4.4 list no name edit. The hint does not promise it until settings has it.
2. **Digits in names.** Teens often use handles ("Dani2"). Allowing digits widens what the filter must catch. Platform and lead decide; the `m07.error.characters` string changes if digits are allowed.
3. **"Report a wrong block."** A 13+ player whose real name is blocked has no way to say so. A link that sends the blocked name for review would help, but it collects a name. Out of scope until the lead rules; never for under-13s.

## Slopmonster gate

`deslop.py` over every String cell: **5/5 CLEAN**. Rival-model cleanse (`tools/cleanse.sh`) not run.
