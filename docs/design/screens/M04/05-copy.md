# M04 Birth year gate: copy

Owner: `ux-writer`. Inputs: `01-research.md`, `03-direction.md`, `04-components.md`, `06-critique.md`; `docs/design/DECISIONS.md` P1, D9; ADR 0001 § Age and consent; FTC COPPA FAQ D.7 and H.3 (https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions); UK ICO Children's Code standard 13 (https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/). Voice and glossary: `docs/COPY_DECK.md`.

All strings are `voice: "ui"`. No character, no Mon, nothing reacts to the answer.

## Neutrality rules (FAQ D.7, H.3)

The adult, 13–17 and under-13 states share **every string on this screen**. Nothing here changes with the year picked. The branch happens after Continue, on the next screen.

- No example year anywhere, including the typed field's hint. An example is a default by another name.
- No word that hints at a threshold: no "13", "old enough", "must", "allowed", "unlock", "verify".
- No reason that implies a payoff for a particular answer. The why line says everyone gets asked, which is true and neutral.
- No "Are you sure?" after a young year. Confirming only some answers would teach the right one.
- Back from M03 or M05 does not reopen the question, so there is no "Change your answer" copy.

## Length budget

iPhone SE, 343 pt. `type-title` about 26 characters a line; `type-body` 37; tiles in `type-label`, three columns, about 9 characters a tile.

## Strings

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m04.title` | What year were you born? | ui | 26 | `Heading level={1}`. One line on SE | — |
| `m04.why` | We ask everyone this once. | ui | 37 | `type-body`, muted. True: the answer is stored and not asked again | — |
| `m04.back.a11y.label` | Back | ui | — | Returns to M02 only before a year is confirmed | — |

### Step 1, decades

| ID | String | Voice | Max | Notes |
|---|---|---|---|---|
| `m04.grid.decades.a11y.label` | Decades | ui | — | Group label |
| `m04.decade.label` | {decade}s | ui | 6 | "1950s" … "2020s". Tabular figures. Spoken as written ("nineteen-fifties") |
| `m04.decade.a11y.hint` | Shows the years in that decade | ui | — | |

### Step 2, years

| ID | String | Voice | Max | Notes |
|---|---|---|---|---|
| `m04.grid.years.a11y.label` | Years in the {decade}s | ui | — | `radiogroup` label |
| `m04.year.label` | {year} | ui | 4 | Future years are not drawn |
| `m04.year.a11y.selected` | {year}, selected | ui | — | Selection is a check glyph plus edge, never colour alone |
| `m04.change_decade` | Change decade | ui | 20 | Ghost link, returns to step 1 with nothing selected |

### Typed alternative

| ID | String | Voice | Max | Notes |
|---|---|---|---|---|
| `m04.type_instead` | Type it instead | ui | 20 | Ghost link under the grid |
| `m04.field.label` | Birth year | ui | 20 | `keyboardType="number-pad"`, `maxLength={4}` |
| `m04.field.hint` | Four digits | ui | 30 | No example year (see rules) |
| `m04.pick_instead` | Pick from a list instead | ui | 28 | Returns to the grid |

### Validation (typed entry only)

Shape: what's wrong, what to do. Nothing hints at an acceptable age.

| ID | String | Voice | Max | Trigger |
|---|---|---|---|---|
| `m04.error.incomplete` | Enter all four digits of the year. | ui | 70 | Fewer than 4 digits on Continue |
| `m04.error.future` | That year hasn't happened yet. Check the number. | ui | 70 | Year after the current year |
| `m04.error.too_early` | Check that year. It needs to be 1900 or later. | ui | 70 | Before 1900 (`04-components.md`); server `INVALID_BIRTH_YEAR` |

### Continue

| ID | String | Voice | Max | Notes |
|---|---|---|---|---|
| `m04.continue` | Continue | ui | 20 | Orange CTA, appears only once a year exists. Same label for every year |
| `m04.continue.a11y.hint` | Saves {year} as your birth year | ui | — | Names the year back, so a VoiceOver user hears what they picked before committing. Mentions no destination |

## States

| State | Copy on M04 | Next screen |
|---|---|---|
| adult (18+) | identical | M03 create |
| 13–17 | identical | M03 create |
| under-13 (`currentYear − birthYear ≤ 13`) | identical | M05; its first line says the player can keep playing |

## Reduced motion

No copy changes. Step 1 to step 2 cross-fades; focus moves to `m04.grid.years.a11y.label`.

## Slopmonster gate

`deslop.py` over every String cell: **5/5 CLEAN**. Rival-model cleanse (`tools/cleanse.sh`) not run.
