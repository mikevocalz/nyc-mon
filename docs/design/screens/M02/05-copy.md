# M02 Welcome: copy

Owner: `ux-writer`. Inputs: `01-research.md`, `03-direction.md`, `04-components.md`, `06-critique.md`; `docs/design/DECISIONS.md` P1, P3, D7, D8; canon Decisions #5, #9, #11, #14. Voice and glossary: `docs/COPY_DECK.md`.

All strings are `voice: "ui"`. No character speaks on M02 and no Mon is shown (P3: eggs only).

## Length budget

Measured against iPhone SE (375 pt, 16 pt gutters, 343 pt text width) at default Dynamic Type, from the type scale in `docs/DESIGN_SYSTEM.md`: `type-title` (24 pt) holds about 26 characters a line, `type-body` (17 pt) about 37, `type-caption` (13 pt) about 48. "Max" below is the hard limit for the caption band: title two lines, body two lines. At XXL the band scrolls (`06-critique.md`).

## Chrome and navigation

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m02.carousel.label` | Welcome | ui | — | `CardSlider label`; spoken as the region name | — |
| `m02.skip` | Skip | ui | 6 | Top-right, every panel | — |
| `m02.skip.a11y.hint` | Goes to the last page | ui | — | Skip lands on panel 3, not past it (`03-direction.md` § Skip) | — |
| `m02.next` | Next | ui | 8 | Panels 1–2 | — |
| `m02.prev.a11y.label` | Previous | ui | — | Arrow button | — |
| `m02.next.a11y.label` | Next | ui | — | Arrow button | — |
| `m02.progress.a11y` | Page {n} of 3 | ui | — | Progress tiles; `{n}` is 1–3 | — |

## Panel 1, the city

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m02.p1.title` | Mons live in New York, on the same blocks as you. | ui | 52 | `Heading level={1}`, the page's only h1 | Hood Mons share the city: `V11 ¶21`, `¶40` |
| `m02.p1.body` | They showed up less than ten years ago. The city's still figuring them out. | ui | 74 | | "publicly known for less than a decade": `V11 ¶36`; "still adjusting": `V11 ¶33` |
| `m02.p1.image.alt` | A Harlem street of brownstones with stoops out front. | ui | — | For the proposed photo `harlem-brownstone-stoops.webp`. If Mike picks another block, rewrite to name the street type and borough, nothing about who lives there (§2.3) | Real places: `V11 ¶41` |

EngineX is not named. The origin is a season mystery (`V11 ¶33`, `¶90`) and has no place in a first-run caption.

## Panel 2, the eggs (P3)

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m02.p2.title` | Three eggs. One of them hatches for you. | ui | 52 | | Three eggs, one chosen: Decision #5 |
| `m02.p2.body` | Each comes from a Bloodline. Whoever's inside is their own person. | ui | 74 | | Bloodline: Decision #11. "Mons are people": `V11 ¶42`, `¶43`; species vs individual: `V11 ¶44` |
| `m02.p2.caption.f01` | Hood Ratti Bloodline | ui | 30 | Under #001, left | Decision #11, D7; `ROSTER L150` |
| `m02.p2.caption.f02` | Bodega Baddiee Cee Bloodline | ui | 30 | Under #008, centre. Longest caption; at XXL it wraps to two lines, never truncates | Decision #11, D7; `ROSTER L157` |
| `m02.p2.caption.f12` | Yote Bloodline | ui | 30 | Under #061, right | Decision #11, D7; `ROSTER L210` |
| `m02.p2.image.alt` | Three eggs side by side: Metro Egg, Hood Ratti Bloodline. Corner Egg, Bodega Baddiee Cee Bloodline. Prism Egg, Yote Bloodline. | ui | — | Names only. No colours or markings until Q11 (egg skins) is answered | Egg names: Decision #9, `ROSTER L150`, `L157`, `L210` |

The UI says "Bodega Baddiee Cee Bloodline", never the casual "Bodega Cee" (Decision #13 keeps that for story copy). Never "line" or "family" (Law 9, D7).

## Panel 3, the Caller

Two body variants. **A ships by default.** B carries the canon line "Scanning isn't recruiting" and goes to the hallway comprehension test (`docs/design/research/HALLWAY_TESTS.md`, milestone 1, task 2). Scanning does not exist in Phase 1, so B ships only if testers can say what it means without help.

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m02.p3.title` | You'd be their Caller. | ui | 52 | First time the player sees "Caller"; M07 depends on it | Caller: `V11 ¶19`, `¶109` |
| `m02.p3.body.a` | A Caller is a Mon's partner. Mons think for themselves, and they can say no. | ui | 74 | Variant A, default | Partnership is social, Mons can refuse: `V11 ¶43`, `¶109` |
| `m02.p3.body.b` | Scanning isn't recruiting. A Mon decides who it partners with. | ui | 74 | Variant B, test only | "Scanning is not recruitment": `V11 ¶43` |
| `m02.p3.image.alt` | The H-Lynk: a red handheld with a black scanner along the top. | ui | — | Never "device" (Law 9) | H-Lynk Core: Decision #16; `V11 ¶63` |
| `m02.p3.cta.primary` | Get started | ui | 20 | Orange CTA → M04 (P1) | — |
| `m02.p3.cta.primary.a11y.hint` | Sets up a new account | ui | — | Does not mention the birth-year question, so nothing primes an answer (FTC COPPA FAQ D.7) | — |
| `m02.p3.cta.secondary` | Already a Caller? Sign in | ui | 28 | Ghost link → M03 sign-in intent (P1). Mirrors `m03.switch.to_sign_in` | Caller: `V11 ¶109` |
| `m02.p3.cta.secondary.a11y.hint` | For players who already have an account | ui | — | | — |

"Owner", "trainer", "user" and "wild" never appear (Law 9, `V11 ¶21`). "Callah" never appears: it is character dialogue only (`V11 ¶19`, `¶58`).

## Status

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m02.status.offline` | You're offline. You won't need a connection until you sign in. | ui | 70 | `StatusRow`, first run with no network (M01 offline state). `type-caption`, `concrete-600` | — |

## Reduced motion

No copy changes. Panels cross-fade instead of sliding; every string and label above is identical.

## Slopmonster gate

`deslop.py` over every String cell (variants A and B included): **5/5 CLEAN**. Rival-model cleanse (`tools/cleanse.sh`) not run.
