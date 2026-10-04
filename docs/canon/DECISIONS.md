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
