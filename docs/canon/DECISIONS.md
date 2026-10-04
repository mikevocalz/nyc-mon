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
