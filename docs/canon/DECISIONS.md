# NYC-MON canon decisions

This file records explicit creator decisions, one numbered entry each, with the date and who made it. Law 1 (`prompts/LAWS.md`) lets a name, species label, stage, meter, device or line of dialogue into the code only if it traces to the v11 Bible or to an entry here. Entries are never edited to change their meaning; a later decision supersedes an earlier one by number.

## Authority

The v11 Bible is law. Its authority order, from `docs/canon/source/NYC_MON_CURRENT_CANON_INDEX_v11.md`:

1. The creator's latest explicit instruction (recorded here).
2. `NYC_MON_Canon_and_Lore_Bible_v11.docx`.
3. `NYC_Mon_Master_Bible_v11.md` (the v8 109-record Dex, moves and care data, plus v11 overrides).
4. The specialised v11 bibles, each for its own domain.
5. Older v10/v8/v7 files, only where not contradicted.
6. Concept art lettering is never canon.

## What is on disk (2026-10-04)

In the repo, under `docs/canon/source/`:

- `NYC_MON_Canon_and_Lore_Bible_v11.docx` (title page: "VERSION 11 / 4 OCTOBER 2026")
- `NYC_MON_CURRENT_CANON_INDEX_v11.md`
- `nyc-mon-3d-character-architecture.md`
- `NYC_MON_Egg_Baby_All_Forms_Roster_v11_1.md` (added in 08d31f7; roster reconciliation v11.1, 115 records / 19 families; see Decision #9)

Not yet in the repo, though the index lists them:

- `NYC_Mon_Master_Bible_v11.md`, which holds the Dex records the starters must be transcribed from
- `NYC_Mon_Gameplay_Lifecycle_and_Care_Bible_v11.md`
- `NYC_Mon_Voice_Identity_and_Dialogue_Bible_v11.md`
- `NYC_MON_HLynk_Capture_and_Handoff_Bible_v11.md`
- `NYC_Mon_Animation_and_Performance_Bible_v9.md`
- `NYC_Mon_3D_Character_Architecture_v5.md`
- `NYC_Mon_Street_Circuit_Card_Game_Bible_v1.md`

Until those land, any field that would come from them stays `TODO(canon)`.

---

## Decision 1 — The three Phase 1 starters

- **Date:** 2026-10-04
- **Decided by:** Mike (creator)
- **Source:** `prompts/BUILD_PROMPT_v3.md` §2.2

The Phase 1 starters are three species lines:

| Slot | Line (species label) | Canon anchor | Content file |
|---|---|---|---|
| 1 | **Hood Ratti** | Malik's partner Ratti is one individual of this line. Ratti himself is NOT the starter; the player meets a different Hood Ratti. | `content/mons/hood-ratti.ts` |
| 2 | **Bodega Cee** | Mari's partner comes from this line. | `content/mons/bodega-cee.ts` |
| 3 | **Yotes** | Latino family identity, per Bible §Identity. | `content/mons/yotes.ts` |

Rules that come with the decision:

- The player's Hood Ratti is never named "Ratti" by default. That name belongs to Malik's individual. The Bible (§Mons are people in the story) states the distinction: "Hood Ratti is a form/species label; Ratti is Malik’s specific individual."
- Species and individual are separate types: `MonSpeciesDef` is the line (Hood Ratti); `MonInstance` is the player's partner, carrying the nickname, bond and a reserved `voiceLineageId`. The naming ceremony names the individual.
- Stable Dex IDs, body data, culture notes and food classes come from the v8 Dex inside `NYC_Mon_Master_Bible_v11.md` with the v11 override layer. Nobody renumbers or fills gaps. A field the Dex leaves open stays `TODO(canon)` and goes to Mike as a question.

Bible text these anchors rest on (`NYC_MON_Canon_and_Lore_Bible_v11.docx`):

- Principal cast, Ratti: "Malik’s particular Hood Ratti."
- Principal cast, Amara "Mari" Rosario: "Caller whose partner comes from the Bodega Cee line."
- Identity, culture, gender and voice: "Yotes carry a Latino family identity." and "Culture is biography and community, not elemental biology."

**Update 2026-10-04:** Decision #11 (superseding #10) sets the labels the UI and data use for these lines: "Hood Ratti Bloodline", "Bodega Baddiee Cee Bloodline", "Yote Bloodline". The slot order and the content file names above are unchanged; `packages/content` keeps `mons/hood-ratti.ts`, `mons/bodega-cee.ts` and `mons/yotes.ts`.

---

## Product decisions

These are product and engineering decisions, not canon. Law 1 does not apply to them, but they share this file's numbering so every decision has one number. They are recorded here so the ADRs and the build prompt can cite a dated creator ruling.

## Decision 2 — Auth: Better Auth on Payload via delmaredigital/payload-better-auth

- **Date:** 2026-10-04
- **Decided by:** Mike (creator)
- **Answers:** `docs/adr/0001-auth-and-identity.md`, open question 1

Accounts use Better Auth (https://www.better-auth.com/docs) with Payload as the database and admin, joined by the `@delmaredigital/payload-better-auth` plugin (https://github.com/delmaredigital/payload-better-auth, docs https://delmaredigital.github.io/payload-better-auth/). Sign-in providers: passkey, Sign in with Apple, Google, and email. ADR 0001 records the design and the compatibility findings against our Payload 4 canary.

## Decision 3 — Transactional email: Resend

- **Date:** 2026-10-04
- **Decided by:** Mike (creator)
- **Answers:** `docs/adr/0001-auth-and-identity.md`, open question 2

Resend (https://resend.com/docs) sends every auth email: verification, password reset, and guardian-consent mail for under-13 accounts.

## Decision 4 — Theme: daylit by default; dark for night and the hatch

- **Date:** 2026-10-04
- **Decided by:** Mike (creator)
- **Source:** `prompts/BUILD_PROMPT_v3.md` §1.3 ("Dark surfaces are for night and the hatch; the default companion view is daylit.")

The default theme is daylit. Dark surfaces appear at night and during the hatch. This overrides the repo's current dark-first theme in `packages/theme`.

---

## Canon decisions (continued)

## Decision 5 — The meeting: three eggs, presented by Santoro; naming after the hatch

- **Date:** 2026-10-04
- **Decided by:** Mike (creator)
- **Answers:** `docs/canon/OPEN_QUESTIONS.md` Q1
- **Overrides:** `prompts/BUILD_PROMPT_v3.md` M08 ("meet three living Mons")

The Caller is shown three eggs, one per starter line (Decision 1), and chooses one, in the Pokémon "Professor Oak" pattern. Dr. Alessandra Santoro presents the eggs; the v11 cast list makes her a chemistry teacher, former biochemist, and the H-Lynk's inventor and mentor. The chosen egg hatches into the individual. Naming happens after the hatch, so the naming ceremony names the hatched Baby, not the egg.

## Decision 6 — The starter card shows the Baby form name, labelled with its line

- **Date:** 2026-10-04
- **Decided by:** Mike (creator)
- **Answers:** `docs/canon/OPEN_QUESTIONS.md` Q8 (the label half; the Dex number half waits on Q9)

The card shows the Baby form name with the line as its label:

| Baby form name (v7) | Label |
|---|---|
| Squeaklet | Hood Ratti line |
| Kittee Cee | Bodega Cee line |
| Yotito | Yotes line |

The three Baby names come from v7 and stay provisional until the v8 Dex in `NYC_Mon_Master_Bible_v11.md` confirms them. Which Dex number the card shows is still open under Q9.

**Update 2026-10-04:** Decision #9 confirms the three Baby names and their Dex IDs (#002, #009, #062) from roster v11.1. Decision #11 (superseding #10) replaces the "<line> line" labels in the table above with "<roster family name> Bloodline".

## Decision 7 — The scanner LED is red

- **Date:** 2026-10-04
- **Decided by:** Mike (creator)
- **Answers:** `docs/canon/OPEN_QUESTIONS.md` Q2
- **Overrides:** every "orange scanner LED" mention in `prompts/BUILD_PROMPT_v3.md` (§1.1, §1.3, W01)

The H-Lynk scanner/emitter LED is red, per v11 (`V11 ¶63`). Orange stays the accent for the primary CTA and the hatch moment.

## Decision 8 — The app is framed as an H-Lynk Entry unit; the bond is never the device's

- **Date:** 2026-10-04
- **Decided by:** Mike (creator)
- **Answers:** `docs/canon/OPEN_QUESTIONS.md` Q3

Companion screens are framed as an H-Lynk Entry unit, which Santoro hands the Caller. The bond lives on the `MonInstance`, never on the device. No code path stores partnership or bond state on the H-Lynk, and no copy implies the device owns or controls the Mon (`V11 ¶23`, `V11 ¶43`).

## Decision 9 — Starter Dex IDs and form names follow roster v11.1

- **Date:** 2026-10-04
- **Decided by:** Mike (creator), who supplied the roster
- **Source:** `docs/canon/source/NYC_MON_Egg_Baby_All_Forms_Roster_v11_1.md` ("Roster reconciliation v11.1 — 4 October 2026", committed in 08d31f7)
- **Answers:** `docs/canon/OPEN_QUESTIONS.md` Q9, and the Dex-number and form-name parts of Q8

The roster keeps #001–#109 as the preserved baseline (roster L9) and states the lifecycle as "Egg → Baby → Small → Mid → Max" (L16). For the three starter families it registers (L150-L156, L157-L163, L210-L216):

| Family | Egg | Baby | Small | Mid | Max |
|---|---|---|---|---|---|
| F01 · Hood Ratti | #001 Metro Egg | #002 Squeaklet | #003 Lil’ Ratti | #004 Hood Ratti | #005 Ratti Royale, #006 Agua Ratti, #007 Phantom Ratti |
| F02 · Bodega Baddiee Cee | #008 Corner Egg | #009 Kittee Cee | #010 Lil’ Cee | #011 Bodega Cee | #012 Bodega Baddiee Cee, #013 Knocka Cee, #014 Midnight Cee |
| F12 · Yote | #061 Prism Egg | #062 Yotito | #063 Lil’ Yote | #064 Barrio-Yote | #065 Fuego-Yote, #066 Yote del Eléctrico, #067 Agua-Yote |

These match the v7 numbering in `STARTERS_EXTRACT.md` §1 record for record. `@acme/content` transcribes them; nobody renumbers them. The starter card's Dex number is the Baby form's: #002, #009, #062.

The roster settles IDs, names and stages only. Body data, scale, food, culture notes, clips, type/Affinity and the Mid-to-Max branch edges stay `TODO(canon)` until the v8 Dex in `NYC_Mon_Master_Bible_v11.md` or another creator ruling covers them.

## Decision 10 — The starter card labels each starter with its roster family name

- **Date:** 2026-10-04
- **Decided by:** Mike (creator), answering "family"
- **Answers:** `docs/canon/OPEN_QUESTIONS.md` Q34 (and Q10)
- **Amends:** Decision #6 (the label column) and Decision #1 (the line labels)
- **Superseded by:** Decision #11 (same day: the word "family" becomes "Bloodline")

The label uses the roster's family name exactly, with the word "family":

| Baby form | Label |
|---|---|
| #002 Squeaklet | Hood Ratti family |
| #009 Kittee Cee | Bodega Baddiee Cee family |
| #062 Yotito | Yote family |

"Bodega Cee" and "Yotes" no longer label the starters. In data, the grouping is a family: `familyId` (`F01`, `F02`, `F12`) plus `familyName` (`Hood Ratti`, `Bodega Baddiee Cee`, `Yote`). The §2.2 content file names stay as they are (`hood-ratti.ts`, `bodega-cee.ts`, `yotes.ts`); they are file paths, never shown to a player.

## Decision 11 — "Bloodline" is the term for a Dex family, in UI and data

- **Date:** 2026-10-04
- **Decided by:** Mike (creator): "it's more hood NYC"
- **Supersedes:** the word "family" in Decision #10. Everything else in #10 stands: the roster family name is used exactly, and the §2.2 file names stay.
- **Answers:** `docs/canon/OPEN_QUESTIONS.md` Q34 (and Q10)

The starter card reads:

| Baby form | Label |
|---|---|
| #002 Squeaklet | Hood Ratti Bloodline |
| #009 Kittee Cee | Bodega Baddiee Cee Bloodline |
| #062 Yotito | Yote Bloodline |

In data the grouping is a bloodline: `bloodlineId` (`F01`, `F02`, `F12`, the roster's family numbers) and `bloodlineName` (`Hood Ratti`, `Bodega Baddiee Cee`, `Yote`). UI copy builds the label as `${bloodlineName} Bloodline`. The roster and the other source files keep saying "family"; quotes from them stay verbatim.

**Note for `prompts/LAWS.md` Law 9 (language is canon):** add "`Bloodline` in UI and data for a Dex family" to its list. Recorded here; whoever owns `LAWS.md` makes the edit.

## Decision 12 — A Mid evolves into exactly one of its Max forms

- **Date:** 2026-10-04
- **Decided by:** Mike (creator)
- **Answers:** `docs/canon/OPEN_QUESTIONS.md` Q35

The Max forms branch. A Mid evolves into exactly one of its three Max forms: #004 Hood Ratti → #005 Ratti Royale OR #006 Agua Ratti OR #007 Phantom Ratti; #011 Bodega Cee → #012, #013 or #014; #064 Barrio-Yote → #065, #066 or #067. The serial arrows in the roster's chain lines (`ROSTER L72`, `L76`, `L116`) are listing order, not a sequence. This matches v7 ("exactly **005 OR 006 OR 007**", `[v7] M7 L38`).

Edges before Mid are linear: Egg → Baby → Small → Mid. `@acme/content` stores these edges as data. Data is not an evolution: nothing fires without an authored `EvolutionEvent` (Law 7), and Phase 1 ships none. What decides the branch (bond, personality; `V11 ¶68`) stays `TODO(canon)`.

**Data shape (Mike, same day: "we can have a bloodline (evolution list), just like the Pokémon API does and Digimon"):**

- Each Bloodline is an evolution-chain resource, after PokeAPI's evolution-chain (https://pokeapi.co/docs/v2#evolution-chains): `Bloodline = { bloodlineId, bloodlineName, chain }`, where `chain` is a tree rooted at the Egg and each node is `{ speciesId, dexId, formName, stage, evolutionDetails, evolvesTo: node[] }`. `evolutionDetails` lists the `eventId`s of authored `EvolutionEvent`s and is empty in Phase 1. Schemas: `BloodlineSchema` and `EvolutionNodeSchema` in `@acme/core`.
- Each form also has Digimon-API-style lists (https://digi-api.com/, `priorEvolutions` / `nextEvolutions`): `priorEvolutions(speciesId)` returns the form it evolves from, and `nextEvolutions(speciesId)` returns the forms it can become (three for a Mid). Both are derived from the chain in `@acme/content`, never stored separately.
- Digimon's level ladder plays the role our stages play. No Digimon level names are borrowed: `stage` is always one of the canon five, Egg, Baby, Small, Mid, Max (`V11 ¶25`, `ROSTER L16`).
- `@acme/content` exports `bloodlines`: the three starter chains in slot order, which the Dex screen (M17) and the web /mons pages (W02) render from.

## Decision 13 — "Bodega Cee" stays as the casual story name for the F02 bloodline

- **Date:** 2026-10-04
- **Decided by:** Mike (creator)
- **Answers:** `docs/canon/OPEN_QUESTIONS.md` Q38

Story copy may call the F02 bloodline "Bodega Cee", as v11 does: Mari's partner comes "from the Bodega Cee line" (`V11 ¶76`), and that line stays as written. UI labels still follow #11: "Bodega Baddiee Cee Bloodline". Data keeps `bloodlineName: "Bodega Baddiee Cee"`; the casual name is a copy-deck choice, not a second data field.

## Decision 14 — the Mon's choice happens at hatch

- **Date:** 2026-10-04
- **Decided by:** Mike (creator)
- **Answers:** research finding 3 (commit 87affb2, `docs/design/screens/M0*/01-research.md`)

"The Mon chooses too" (`V11 ¶47`) lands at the hatch. The Baby's first look at the Caller is its choice. It leans in, or it hesitates and needs a moment of care before the bond forms. It never rejects the Caller, and the egg is never sent back. M08 stays a meeting with three eggs (#5).

## Decision 15 — if a guardian denies consent, Dr. Santoro keeps the Mon safe

- **Date:** 2026-10-04
- **Decided by:** Mike (creator)
- **Answers:** research finding 4

An under-13 Caller can play locally while guardian consent is pending (ADR 0001). If the guardian says no, the hatched Mon stays with Dr. Alessandra Santoro in the story. It is never deleted on screen and never turned back into an egg (Law 8). The child's personal data is deleted as COPPA requires. If consent comes later, the Caller starts fresh. How Santoro looks after the Mon is TODO(canon).

## Decision 16 — the three H-Lynk tiers, from the creator's device sheet

- **Date:** 2026-10-04
- **Decided by:** Mike (creator), who supplied a three-tier H-Lynk concept sheet in session. The image file still needs to be added to `docs/canon/source/`.
- **Answers:** `docs/canon/OPEN_QUESTIONS.md` Q5 (Entry body), and part of the H-Lynk hardware gap

The sheet shows three tiers. The design follows it. Under the index rule (concept-art text is never database authority), the on-screen text does not count as canon.

| Tier | Name on the sheet | Body | Rear camera |
|---|---|---|---|
| Entry | **H-Lynk Core** | matte red plastic | 1 lens |
| Midrange | **H-Lynk** | matte charcoal/gunmetal | 2 lenses |
| Premium | **H-Lynk Pro** | white/silver, faceted armour panels with red edge lights | 3 lenses |

All three tiers share these parts:
- A black **scanner head** across the top edge, with red emitters, projecting a red fan of light upward. Mike: the top is a barcode scanner. This is v11's separate red scanner/emitter.
- A black stub **antenna** at the top left.
- A tall screen with a dark bezel.
- A bottom control row: home, menu, a large square **centre trackpad** ringed in red, back, and forward.
- Side keys: volume +/−, power, and a left action key, as v11 describes.
- A thin vertical red status light on the back.
- The tier name printed on the backplate.

The app's companion chrome is the **H-Lynk Core** (Entry), so its body is red. This replaces the open choice between concrete and Knicks blue in Q5. The red LED and scanner always sit in the black scanner head, never on bare red plastic.

The sheet also shows on-screen UI: the Mon name, "Lv. 12", a gender mark, a "SCAN READY" chip, HP/Energy/Fullness/Social meters, a "CALL MON" button, and DEX/CREW/CARE/BAG/CITY tabs. That UI is concept text, not canon. It is reference for the companion screen layout only, and every label still has to clear Law 1 and Law 9.

**Open:** the sheet prints the **EngineX** logo on the front of every tier. v11 calls Dr. Santoro the H-Lynk's inventor and makes EngineX the concealed eradication program. See Q40.

## Decision 17 — under-13 sign-in after consent: username and passkey, guardian email for recovery

- **Date:** 2026-10-04
- **Decided by:** Mike (creator)
- **Answers:** `docs/adr/0004-auth-methods-and-device-handoff.md`, open question 1
- **Kind:** product

After a guardian approves consent, the child signs in with a username and a passkey on the family device. The account's email is the guardian's verified address, used only for recovery. No account ever carries a placeholder email.

## Decision 18 — a merged account keeps both starters; Home asks which one is active

- **Date:** 2026-10-04
- **Decided by:** Mike (creator)
- **Answers:** `docs/adr/0004-auth-methods-and-device-handoff.md`, open question 2; closes the `TODO(canon)` on merging two accounts that each hatched a starter
- **Kind:** canon

When two accounts merge and each has hatched a starter, the Caller keeps both Mons. Home asks the Caller which one is active. Nothing is lost: no Mon is deleted, released or sent back (Laws 6 and 8).

## Decision 19 — SMS goes to US and Canadian numbers

- **Date:** 2026-10-04
- **Decided by:** Mike (creator)
- **Answers:** `docs/adr/0004-auth-methods-and-device-handoff.md`, open question 3
- **Kind:** product

Phone verification and SMS sign-in codes accept US and Canadian numbers only.

## Decision 20 — tablet handoff: QR first, code approval as the fallback

- **Date:** 2026-10-04
- **Decided by:** Mike (creator)
- **Answers:** `docs/adr/0004-auth-methods-and-device-handoff.md`, open question 5
- **Kind:** product

A tablet signs in by scanning a QR shown on the Caller's phone. When it can't scan, it shows a code and the Caller approves it on the phone, the same flow a headset uses.

## Decision 21 — a guardian-consented account unlocks phone features at 13 with a second guardian approval

- **Date:** 2026-10-04
- **Decided by:** the lead agent, delegated by Mike on 2026-10-04
- **Answers:** `docs/adr/0004-auth-methods-and-device-handoff.md`, open question 6
- **Kind:** product

An account created through guardian consent can add a phone number and receive SMS codes only after the Caller turns 13 and the guardian approves again. Until both are true, the account uses TOTP, passkeys and email codes sent to the guardian.

## Decision 22 — staff hold one role each if multi-value roles don't persist

- **Date:** 2026-10-04
- **Decided by:** the lead agent, delegated by Mike on 2026-10-04
- **Answers:** `docs/adr/0004-auth-methods-and-device-handoff.md`, open question 7
- **Kind:** product

Staff roles are `ops`, `support`, `consent` and `content`. If the auth adapter cannot store more than one role on a user, each staff member holds exactly one, and ADR 0004 records the limit until the plugin's configurable role field reaches the pinned fork.
