# Open canon questions: Phase 1 starters

Questions for Mike. Each one blocks a field that BUILD_PROMPT_v3 §2.2 (starters) or §3.2 (creature runtime) needs, or flags a place where the build prompt and the v11 Bible disagree. Evidence for every claim below is quoted in `docs/canon/STARTERS_EXTRACT.md`, using the same citation tags (`V11 ¶n`, `IDX Ln`, `[v7] M7 Ln`, `ARCH Ln`).

Until a question is answered, its field stays `TODO(canon)`. An answer goes into `docs/canon/DECISIONS.md` with a date; this file then marks the question closed and links the decision.

Compiled 2026-10-04 by `canon-keeper`. Sources on disk: the v11 Canon & Lore Bible docx, the v11 canon index, an unversioned 3D architecture note, and the v7 bibles in `~/Downloads`. The v8 109-record Dex inside `NYC_Mon_Master_Bible_v11.md` is not on disk, so every Dex number below comes from v7 and is provisional.

## Top 10

These block the most downstream work (Dex cards, `content/mons/*.ts` schemas, clip lists, the meeting and hatch screens).

1. **Q1** (answered → Decision #5) Meeting order: what does the Caller meet before the egg exists?
2. **Q8** (label answered → Decision #6; Dex number waits on Q9) Which form is "the starter": the Baby form or the Mid form whose name labels the line?
3. **Q9** Dex numbers: are v7's #001-#007, #008-#014 and #061-#067 the v8 numbers? Send `NYC_Mon_Master_Bible_v11.md`.
4. **Q2** (answered → Decision #7) Scanner LED: red (v11) or orange (build prompt)?
5. **Q3** (answered → Decision #8) Is the app itself an H-Lynk, given v11 says the H-Lynk is optional?
6. **Q12** Culture notes for the player's three starters.
7. **Q18** Meter name: "Social" or "Social HP"?
8. **Q19** Are v7's care numbers canon?
9. **Q22** Food classes: does any species-level food restriction exist?
10. **Q29** Relative scale numbers against the 1 m ground disc.

---

## A. Conflicts between BUILD_PROMPT_v3 and v11

The Bible outranks the build prompt (`IDX L7-L8`; BUILD_PROMPT_v3 §0B Law 1). Each item is an issue against the prompt until Mike rules.

**Q1. Meeting before incubation.** **Answered → Decision #5** (`docs/canon/DECISIONS.md`): three eggs presented by Santoro; the Caller chooses one; naming happens after the hatch. The prompt runs M08 Meeting ("Three live Mons … Confirmation is mutual") → M09 Naming → M10 Incubation ("Case closes with the egg") → M12 Hatch. v11 says the individual starts as an egg and stays the same individual from Egg onward: "Egg → Baby → Small → Mid → Max. A newly hatched Mon stays Baby until an authored evolution event." (`V11 ¶25`) and "Evolution preserves the same monInstanceId …" (`V11 ¶47`). A living Mon you meet and name cannot then be the egg that hatches. Fill in: in M08, the Caller meets ______ (a: three eggs, each with a reaction; b: three adult/Mid Mons who entrust an egg of their line; c: three Babies, and the incubation step is cut; d: other). And who does the naming ceremony name: the egg or the hatched Baby?

**Q2. Scanner LED color.** **Answered → Decision #7**: red; orange stays the CTA and hatch accent. v11: "a top antenna and a separate red scanner/emitter" (`V11 ¶63`). The prompt says "orange scanner LED" (§1.1, line 146), "the orange reserved for the scanner LED" (§1.3, line 169) and "orange emissive LED" on the web hero (W01, line 319), but "the red scanner LED is a status light" (§2.4, line 221) and "scanner LED red" (§3.5, line 254). Yes/no: the scanner LED is red, and orange is limited to the hatch moment and primary CTA?

**Q3. App as H-Lynk.** **Answered → Decision #8**: yes, framed as an Entry unit Santoro hands the Caller; bond lives on `MonInstance`. v11: "H-Lynk (“Hood Link”) is an optional communication/care/recovery device. It is not proof of ownership, personhood or partnership." (`V11 ¶23`); "A partnership is social and relational, not a device flag." (`V11 ¶43`). The prompt makes the app chrome an H-Lynk Entry unit on every companion screen (§1.1, §2.4) and Law 9 says "`H-Lynk`, never 'device' in UI copy". Yes/no: framing the app as the Caller's H-Lynk is fine, as long as no code or copy treats having an H-Lynk as the partnership itself (bond lives on `MonInstance`, never on the device)?

**Q4. Capture case as incubator.** v11 names the prop "Single-egg capture/containment case" (`V11 ¶64`) and lists its "emergency-release protocol" as open (`V11 ¶102`). v11 also says "H-Lynk containment is not consent." (`V11 ¶43`). The prompt has the egg incubate inside the case (§2.4, M10, M11, §3.5). Yes/no: the case is the incubation cradle in Phase 1? If yes, should UI copy call it a "case" rather than anything with "capture" in it?

**Q5. Body color of the Entry H-Lynk.** v11 says only "Entry is plastic and Pro is the most premium" (`V11 ¶63`). The prompt sets "plastic, matte, Knicks blue body" (§1.1). Yes/no: Knicks blue for the Entry tier is a creator decision to record in `DECISIONS.md`?

**Q6. "Per canon spirit" in M20.** The prompt's account deletion has a "7-day grace per canon spirit". Neither v11 nor v7 mentions a grace period. Yes/no: record the 7-day grace as a product decision, not canon?

**Q7. Overfeeding.** M14 requires "Overfeeding has a canon-safe consequence (sluggish, not sick-to-death)". No source defines overfeeding; v7 only clamps meters to 0-100 (`[v7] M7 L14633`). Fill in: overfeeding at Fullness 100 does ______ (nothing / Mon declines food / a short sluggish idle / other).

## B. Starter identity and Dex fields (§2.2)

**Q8. Starter form.** **Label answered → Decision #6**: Baby form name, with "<line> line" as the label. The Dex number shown stays open until Q9 is settled. v11: "Hood Ratti is a form/species label" (`V11 ¶44`). In v7, "Hood Ratti" is the Mid form #004 and the Baby is #002 Squeaklet; "Bodega Cee" is the Mid form #011 and the Baby is #009 Kittee Cee; the Yote Baby is #062 Yotito and there is no form named "Yotes". Fill in for the Dex card on M08/M17: species label shown = ______ (line name, or current form name); Dex number shown = ______ (Baby form number, or Mid).

**Q9. Dex numbers.** v7 numbering: F01 #001-#007, F02 #008-#014, F12 #061-#067. The index promises "stable Dex/form IDs" carried from v8 (`IDX L35`). Yes/no: v8 uses the same numbers and form IDs (`form_squeaklet`, `form_kittee_cee`, `form_yotito`, etc.) as v7? Fastest answer: put `NYC_Mon_Master_Bible_v11.md` in `docs/canon/source/`.

**Q10. Line names.** v7 calls F02 "Bodega Baddiee Cee" (after its Max) and F12 "Yote family". v11 says "the Bodega Cee line" (`V11 ¶76`) and "Yotes" (`V11 ¶53`). Yes/no: the line labels in data and UI are exactly "Hood Ratti", "Bodega Cee", "Yotes"?

**Q11. Egg forms.** v7 gives each line its own egg: #001 Metro Egg (red, white stripes), #008 Corner Egg (pink, white fur wrap), #061 Prism Egg (black, flames, clear crystal). Yes/no: the player's egg uses its line's egg skin inside the case?

**Q12. Culture notes.** The M08 and M17 Dex cards show a "culture note (from canon)". v11 has: Malik's Ratti is Black American / NYC Black, and "The Ratti species is not ethnically locked" (`V11 ¶53`); "Yotes carry a Latino family identity" (`V11 ¶53`); nothing for Bodega Cee. v11 also says culture "belong[s] to the individual" (`V11 ¶44`). Fill in, per starter: species card culture note = ______; the player's individual's culture = ______ (fixed by canon / chosen by the player / left blank in Phase 1).

**Q13. Yotes scope.** Yes/no: "Yotes carry a Latino family identity" applies to every Yote, including the player's? (Contrast the explicit "not ethnically locked" rule for Ratti.)

**Q14. Gender and pronouns.** v11: "Mons have genders." (`V11 ¶54`). v7 writes the rat line as "he" (`[v7] M7 L641`) and the cat line as "she" (`[v7] M7 L1405`); no pronoun for Yotes. Fill in: the player's starter's gender is ______ (fixed per line / chosen at naming / unstated in Phase 1).

**Q15. Personality per individual.** v7 gives one temperament line per family, repeated on every form (e.g. "Cheerfully improvises, boasts before admitting uncertainty …" for F01). v11 puts personality on the individual (`V11 ¶29`, `¶47`). Yes/no: v7's family temperament lines are the species default, and the player's individual can differ from them?

**Q16. Mari's partner.** v11 says only "partner comes from the Bodega Cee line" (`V11 ¶76`). Fill in: the partner's name and current form, so the player's Bodega Cee can be kept distinct the way "Ratti" is reserved for Malik's.

**Q17. Suggested names.** M09 offers "Suggested names from canon only when canon provides them". No source lists names for the player's starters, and "Ratti" is reserved. Yes/no: no suggested names in Phase 1?

## C. Care, food and lifecycle (§2.1, feeding the sim core)

**Q18. Meter name.** v11: "Energy, Fullness and one Social HP/social-need meter" (`V11 ¶51`). v7: "Social HP" throughout. The prompt: "Social". Fill in: UI label = ______; code identifier = ______.

**Q19. Care numbers.** v7 proposes: all meters start at 80; awake decay Energy −1/h, Fullness −2/h, Social HP −1/h; asleep Energy +10/h, Fullness −0.5/h; pet +12, play +20 (−4 Energy), attention +15; cap +25 per 10 min; full meal 40 Fullness/5 Energy, snack 15/2 (`[v7] M7 L14633`, `L14641-L14645`, `L14726`). v7 itself calls these "original proposals" (`[v7] M7 L14623`). Yes/no: adopt v7's numbers as Phase 1 values?

**Q20. Needs threshold.** The prompt's M13 "needs-you" state fires at "any meter < 25%". v7 proposes icons below 40, a stronger prompt below 20, and clearing at 50 (`[v7] M7 L14668`). Fill in: needs-you threshold = ______; clear threshold = ______.

**Q21. Absence rules.** v7 proposes vacation mode, a free sitter after 24 h, and a floor of 35 on return (`[v7] M7 L14676`). The prompt has no absence rules. Yes/no: Phase 1 ships the sitter and the floor?

**Q22. Food classes.** The prompt needs `eat_{food_class}` clips (§3.2), a tray "filtered by what this species can eat" (M14), and `foodClass` references that resolve (§8). Neither source has a food class. v7 says "Favorites are preferences, not restrictions. All living families can use the fantasy menu." (`[v7] M7 L14726`). Fill in: food classes are ______ (none: one eat clip per species, tray unfiltered / container-based: tray, takeout box, broth tub / other).

**Q23. Baby portions.** v7: "Use caretaker-prepared fictional starter portions; no adult takeout mouth animation." (`[v7] M7 L505`). Fill in: Baby meal Fullness/Energy = ______ (same 40/5 as adult meals, or smaller).

**Q24. Favorites.** v7 favorites: Hood Ratti line chopped cheese + fries; Bodega Cee line chicken wings + fries; Yotes spicy chicken over rice (`[v7] M7 L507`, `L1444`, `L7991`). Yes/no: these are the Phase 1 favorites, and only the three starter favorites plus ______ ship in `content/food`?

**Q25. Sleep.** v7: an 8-hour sleep window "chosen by the owner" (`[v7] M7 L14633`). The prompt's M15 is a manual Rest with "Waking early has a cost". Fill in: sleep is ______ (scheduled window / manual / both); waking early costs ______.

**Q26. Bond.** M16 raises "the Social meter and bond". v11 names bond as server state (`V11 ¶93`) and says Bond can influence branching evolution (`V11 ¶68`). No source defines how bond grows. Fill in: bond is ______ (hidden counter / visible / out of scope for Phase 1 beyond storage).

**Q27. Incubation length.** v11 gives 15/30/60 min (`V11 ¶49`) and says nothing about whether length changes anything. Yes/no: length has no effect on the Mon in Phase 1?

**Q28. Stage names.** `ARCH L320-L328` lists Ratti forms as "Egg / Baby / Form I / Form II / Form III / Apex". v11 has five stages, Egg → Max (`V11 ¶25`). Yes/no: the architecture note's names are obsolete and `LifecycleStage` uses Egg, Baby, Small, Mid, Max only?

## D. Body, scale and animation (§3.2)

**Q29. Scale.** §3.2 needs each species' `scale` against a 1 m ground disc. v7 gives only "Small cuddle-scale character" for all three Babies and calls every dimension "a design target to set at art lock" (`[v7] M7 L464`, `L1401`, `L7948`). Fill in: Baby height in metres for Squeaklet ______, Kittee Cee ______, Yotito ______.

**Q30. Hatch performance.** v7: "Family seam opens softly; reveal #002 Squeaklet, one individual." (`[v7] M7 L411`), with per-line light cues. `ARCH L422-L441`: "first crack → multiple cracks → goo leak → shell separates → Mon struggles out → first breath → looks for Caller". The prompt: "egg crack driven by `hatchProgress`" (§3.5). Fill in: the hatch is ______ (soft seam opening / crack-and-struggle / other).

**Q31. Refusal at Baby stage.** v11 requires "listening/talking/refusal performance" for conversation (`V11 ¶97`) and says Mons "refuse" (`V11 ¶43`). The prompt's `refuse` clip plays in M08 and M14. v7's Baby notes give only an "approach/step-back cue" (`[v7] M7 L509`). Yes/no: a Baby's refusal is a step-back/turn-away body cue with no speech?

**Q32. Baby voice.** v11: "Hatchlings may use baby-talk/gibberish, then limited speech, then full speech." (`V11 ¶56`). v7 gives species sounds (scritchy chirps; chirrup and purr; yips and a short rally howl). Yes/no: Phase 1 Babies use only species sounds, no baby-talk words?

**Q33. Type field.** v7 types all three Babies "Neutral". The index calls type fields "legacy data until the explicit migration map is authored" (`IDX L41`); v11 lists that map as open (`V11 ¶101`). Yes/no: Phase 1 content omits type/Affinity entirely?

---

## E. Which missing file would answer what

| Missing file (named in `IDX L15-L22`) | Questions it should settle |
|---|---|
| `NYC_Mon_Master_Bible_v11.md` (v8 109-record Dex + v11 overrides) | Q8, Q9, Q10, Q11, Q12, Q14, Q15, Q16, Q23, Q24, Q29, Q33 |
| `NYC_Mon_Gameplay_Lifecycle_and_Care_Bible_v11.md` | Q1, Q4, Q7, Q18, Q19, Q20, Q21, Q22, Q23, Q25, Q26, Q27, Q30 |
| `NYC_Mon_Voice_Identity_and_Dialogue_Bible_v11.md` | Q12, Q13, Q14, Q15, Q16, Q17, Q31, Q32 |
| `NYC_MON_HLynk_Capture_and_Handoff_Bible_v11.md` | Q1, Q2, Q3, Q4, Q5 |
| `NYC_Mon_Animation_and_Performance_Bible_v9.md` | Q22 (eat clips), Q30, Q31 |
| `NYC_Mon_3D_Character_Architecture_v5.md` | Q28, Q29 |
| `NYC_Mon_Street_Circuit_Card_Game_Bible_v1.md` | none for Phase 1 |

Q6 has no canon source; it needs a product decision.
