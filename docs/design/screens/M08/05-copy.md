# M08 Meeting: copy

Owner: `ux-writer`. Inputs: `01-research.md`, `03-direction.md`, `04-components.md`; canon Decisions #5, #9, #11, #13, #14; P3; Law 9; PS-005 (no pronoun for an individual Mon); `docs/COPY_DECK.md`.

All visible strings are `voice: "ui"`. One `character` slot exists (Santoro) and ships empty: v11 describes her (`V11 ¶83`, `¶84`) but quotes no line.

Tokens: `{eggName}` and `{dexNumber}` come from `eggs` in `@acme/content` (`eggName`, `dexId` zero-padded to three digits). `{bloodline}` is `` `${bloodlineName} Bloodline` `` from `bloodlines` (Decision #11). Never typed by hand.

## Length budget

Inside the SE H-Lynk screen (351 pt wide, 16 pt inner gutters, 319 pt text width): `type-title` about 24 characters a line, `type-body` about 34, `type-label` about 30 on a full-width button, about 11 under a 103 pt tile. "Corner Egg" (10) is the longest tile label.

## Strings

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m08.title` | Choose an egg | ui | 24 | `Heading level={1}` | Decision #5 |
| `m08.santoro.caption` | Dr. Alessandra Santoro brought three eggs. | ui | 70 | Two lines on SE. Narration in the UI voice, not her speech | Decision #5; name per `V11 ¶83` |
| `m08.santoro.line` | `TODO(canon)` | character | — | Ships empty and renders nothing until the Voice Bible gives Santoro a line | `V11 ¶83`, `¶84`; COPY_DECK open question 8 |
| `m08.tile.label` | {eggName} | ui | 11 | Under each tile | Decision #9 |
| `m08.tile.a11y.label` | {eggName}, {bloodline}, {index} of 3 | ui | — | Tile as a radio | Decisions #9, #11 |
| `m08.tile.a11y.hint` | Opens a closer look | ui | — | | — |
| `m08.trackpad.label.browsing` | Eggs, 3 | ui | — | Trackpad name before any focus | DIRECTION.md "Controls" |
| `m08.trackpad.label.focused` | {eggName}, {index} of 3 | ui | — | The DIRECTION.md example | — |
| `m08.trackpad.hint` | Flick to move between eggs. Hold to choose. | ui | — | Spoken after the name | — |
| `m08.trackpad.commit.label` | Choose the {eggName} | ui | — | `commitLabel` | — |
| `m08.action.look` | Look closer | ui | 30 | `TrackpadActions` `activateLabel` in browsing | — |
| `m08.action.prev` | Previous egg | ui | 14 | `stepBackLabel` | — |
| `m08.action.next` | Next egg | ui | 14 | `stepForwardLabel` | — |
| `m08.action.all` | All three | ui | 14 | `activateLabel` while focused: back to browsing | — |
| `m08.card.number` | #{dexNumber} | ui | 4 | `#001`, `#008`, `#061`: the egg's own record (`06-critique.md` C4) | Decision #9 |
| `m08.card.number.a11y` | Number {dexId} | ui | — | Read as a number, not "hash zero zero one" | — |
| `m08.card.bloodline` | {bloodline} | ui | 34 | "Bodega Baddiee Cee Bloodline" is 28 | Decision #11 (UI label; never "Bodega Cee" here, #13) |
| `m08.card.body` | Each egg holds one Mon. You meet your Mon when the egg hatches. | ui | 80 | No pronoun for the Mon (PS-005) | `V11 ¶25`; v7 "One dormant individual" (`M7 L390`) |
| `m08.cta.choose` | Choose the {eggName} | ui | 30 | "Choose the Corner Egg" is 21 | — |
| `m08.confirm.title` | Choose the {eggName}? | ui | 30 | Replaces the card body in place | — |
| `m08.confirm.body` | You can't swap eggs later. | ui | 60 | Only consequence that matters; no fear words | Decision #14 ("the egg is never sent back") |
| `m08.confirm.yes` | Choose this egg | ui | 20 | `cta` | — |
| `m08.confirm.no` | Keep looking | ui | 20 | outline; Back key and Escape do the same | — |
| `m08.chosen.a11y.announce` | {eggName} chosen. | ui | — | Polite, before M10 takes focus | — |
| `m08.error.title` | The eggs didn't load. | ui | 40 | Content failed its schema | — |
| `m08.error.body` | Nothing was chosen. Try again, and if it keeps happening, restart NYC-MON. | ui | 90 | | — |
| `m08.error.retry` | Try again | ui | 20 | | — |
| `m08.back.a11y.label` | Back | ui | — | H-Lynk Back key in browsing goes to M07 | — |

Shared strings used as written: `hlynk.key.*.label`, `m05.badge.pending`, `m05.badge.pending.a11y`. The LED is `off` on M08, so no `hlynk.led.*` chip shows.

## Struck strings

The brief's `refused` state had copy implications ("it refuses"). Struck under Decision #14; no string exists for an egg or a Mon declining the Caller. Culture-note and liked-food rows have no strings until Q12, Q13, Q22 and Q24 close; when they do, the card adds `m08.card.culture` and `m08.card.food` with canon citations.

## Reduced motion

No copy changes.

## Localisation notes

- `{eggName}` is a proper noun; never translate "Metro Egg", "Corner Egg", "Prism Egg" or the Bloodline names.
- "Choose the {eggName}" needs a gender/article-aware template in languages with grammatical gender; keep the article inside the template, not in the token.

## Open questions

1. **Santoro's line (`m08.santoro.line`).** Empty until canon. If Mike supplies one, it renders as a quoted line under the caption with `voice: "character"`.
2. **Egg number vs Baby number on the card (C4).** Decision #9 says the starter card shows the Baby's number. Before the hatch the card depicts the egg, so it shows #001/#008/#061. Mike confirms or rules the Baby number shows here too (which would hint at the hidden Baby).

## Slopmonster gate

See `06-critique.md` § Copy lint for the run over every String cell.
