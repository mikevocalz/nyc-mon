# M08 Meeting: research

Route `/(onboarding)/meet` · Shell: H-Lynk Core · Brief states: browsing / approaching / refused / bonded · Spec: `docs/phase-1-brief.md` §4.2 M08, §2.2; canon Decisions #1, #5, #9, #11, #13, #14; `docs/design/research/JOURNEY.md` risk 5.

**Canon overrides the brief here.** The brief's M08 shows "three live Mons" that lean in or refuse. Decision #5 replaces that: Dr. Alessandra Santoro presents **three eggs**, the Caller chooses one, and no Baby is seen before the hatch. Decision #14 moves "the Mon chooses too" to the hatch and says the Mon never rejects the Caller and the egg is never sent back. So M08 is an egg choice, and the brief's `refused` and `bonded` states are remapped (`06-critique.md` C1, C2).

## Jobs to be done

- **Dani (teen Caller):** When Santoro shows me three eggs, I want to tell them apart at a glance and feel that my pick is mine, so the Mon that hatches feels like it was always going to be my partner.
- **Jayden (under-13, consent pending):** When I choose, I want to do it without reading much, so I get to the egg before I lose interest.
- **Marcus (returning lapsed player):** When I come back after closing the app mid-choice, I want to land on the same three eggs with nothing already decided for me.
- **Renée (parent):** When my child picks an egg, I want no purchase, timer or pressure attached to the choice.

## Risks

- **The choice feels arbitrary.** The Caller can't see who is inside (P3, glossary: Babies are never shown before the hatch). Each egg's own surface, its block, its name and its Bloodline are the whole basis for choosing. If those three things don't differ enough at thumbnail size, people pick at random and feel nothing. The three concept-art stills differ strongly in colour (red striped, pink fur-wrapped, black with flames), which helps.
- **The Bloodline label spoils the animal.** "Hood Ratti Bloodline" says rat; "Yote Bloodline" says coyote; "Bodega Baddiee Cee Bloodline" implies cat. Decision #11 makes the label mandatory on any surface that names a family. Accepted: the Bloodline is the Caller's only canon-backed clue, and the Baby's form name and look stay hidden.
- **Canon gaps on the card.** The brief's card wants a culture note and a liked food. `@acme/content` has `cultureNote: null` (Q12, Q13) and `foodClassIds: null` (Q22, Q24) for every form, and v7 says "No eating at Egg" (`M7 L419`). Rendering "Unknown" rows would be a fake form. The card omits both rows until canon fills them.
- **Santoro has no art and no lines.** Decision #5 puts her on stage. `docs/COPY_DECK.md` lists no canon dialogue for her (`V11 ¶83`, `¶84` describe, don't quote). The screen can name her in the UI voice; her `character` line ships empty (`TODO(canon)`).
- **Permanence.** One egg per Caller in Phase 1; the egg is never sent back (#14). A mis-tap must never commit. The hold-to-commit trackpad and a confirm step carry that weight.
- **Cultural reading of the stills.** The art places the Metro Egg on a Harlem stoop, the Corner Egg on a bodega step and the Prism Egg in Times Square. These are art-direction choices (`packages/assets/creatures/index.ts`), not canon. A Yote egg in Times Square must not be read as a culture claim, and copy never ties a block to a community (`COPY_DECK.md` "No Bloodline speaks for a community").
- **Choice pressure.** No countdown, no "limited", no "most popular" badge, no default selection. A preselected egg steers the pick the way a preset year steers M04 (D9, L1).
- **Consent pending (under-13).** The `StatusRow` pending item (M05) must fit inside the H-Lynk screen's status row without crowding the triptych (M05 critique gap).

## Usability questions

1. Without help, can players say what they are choosing (an egg, with one Mon inside) and that it can't be swapped later?
2. Do players open more than one egg's close look before choosing, and can they get back to all three without hunting for a control?
3. Do players discover hold-to-choose on the trackpad, or do they rely on the on-screen button, and does either path ever commit a choice they didn't mean?
