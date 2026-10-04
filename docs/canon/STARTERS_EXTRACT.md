# Starters canon extract: Hood Ratti, Bodega Cee, Yotes

Verbatim quotes only. This file transcribes what the sources on disk say about the three Phase 1 starters and the systems around them. It does not settle anything, and nothing here is Mon data for `content/`. Gaps and conflicts go to `docs/canon/OPEN_QUESTIONS.md`.

Compiled 2026-10-04 by `canon-keeper`.

## Sources and how to read the citations

Authority order, quoted from the index (`IDX L6-L12`):

> 1. Creator’s latest explicit instruction.
> 2. `NYC_MON_Canon_and_Lore_Bible_v11.docx`.
> 3. `NYC_Mon_Master_Bible_v11.md` for detailed inherited v8 Dex/moves/care data plus v11 overrides.
> 4. Specialized v11 bibles below for their domain.
> 5. Older v10/v8/v7 files only where not contradicted.
> 6. Concept art text is never database/canon authority.

| Tag | File | Status |
|---|---|---|
| `V11 ¶n` | `docs/canon/source/NYC_MON_Canon_and_Lore_Bible_v11.docx` | Authority 2. On disk. `¶n` is the n-th non-empty paragraph (table cells count as paragraphs) of `word/document.xml`, extracted with `unzip -p … word/document.xml`. |
| `IDX Ln` | `docs/canon/source/NYC_MON_CURRENT_CANON_INDEX_v11.md` | Defines the authority order. On disk. |
| `ARCH Ln` | `docs/canon/source/nyc-mon-3d-character-architecture.md` | Unversioned. The index names `NYC_Mon_3D_Character_Architecture_v5.md`, which is not on disk; this file's relation to v5 is unknown. |
| `[v7] M7 Ln` | `~/Downloads/NYC_Mon_Master_Bible_v7.md` (sha256 `3cd22f75b4bb7a9b…`, dated "28 September 2026") | Authority 5: usable only where v11 does not contradict it. Not in the repo. |
| `[v7] Atlas` | `~/Downloads/NYC_Mon_Character_Atlas_v7.md` (sha256 `44c67e0a5f807d12…`) | The dossiers are byte-identical to `M7` apart from heading depth. Atlas line = M7 line − 324 for every dossier quoted here (checked for #001, #004, #011, #062, #064). |
| `[v7] Dex7` | `~/Downloads/NYC_Mon_Dex_and_Evolution_Reference_v7.html` | Same numbering and edges as `M7` §2. |

Not on disk, all named by the index (`IDX L15-L22`): `NYC_Mon_Master_Bible_v11.md` (the v8 109-record Dex), `NYC_Mon_Gameplay_Lifecycle_and_Care_Bible_v11.md`, `NYC_Mon_Voice_Identity_and_Dialogue_Bible_v11.md`, `NYC_MON_HLynk_Capture_and_Handoff_Bible_v11.md`, `NYC_Mon_Animation_and_Performance_Bible_v9.md`, `NYC_Mon_3D_Character_Architecture_v5.md`, `NYC_Mon_Street_Circuit_Card_Game_Bible_v1.md`. The v8 Dex is the source BUILD_PROMPT_v3 §2.2 names for Dex IDs, body data, culture notes and food classes, so every v7 number below is provisional until it is checked against v8.

The index says stable data carries over (`IDX L31-L36`):

> Unless a v11 file explicitly says otherwise:
> - 109 numbered records
> - 18 evolutionary families
> - 37 Max endpoints
> - stable Dex/form IDs

`[v7] M7 L4` reports the same totals: "**109 numbered entries · 18 families · 37 Max forms · 10 types · 216 moves**". Matching totals do not prove matching numbers per record.

Coverage legend: **found** (the source states it), **partial** (some of it, or only by implication), **absent**.

---

## 1. The three lines: Dex numbers and evolution

Coverage: v11 **partial** (names the lines, no numbers). v7 **found**.

v11 names the lines but gives no Dex numbers:

> Hood Ratti is a form/species label; Ratti is Malik’s specific individual. The same distinction applies throughout the Dex. Nicknames, culture, Caller relationship and voice identity belong to the individual. (`V11 ¶44`)

> Caller whose partner comes from the Bodega Cee line. (`V11 ¶76`)

> Yotes carry a Latino family identity. (`V11 ¶53`)

[v7] Family table (`M7 L53`, `L54`, `L64`; same rows in Atlas L8, L9, L19):

> | F01 Hood Ratti | #001–#007 | Hood Ratti | #005 Ratti Royale (Neutral); #006 Agua Ratti (Water); #007 Phantom Ratti (Ghost) |
> | F02 Bodega Baddiee Cee | #008–#014 | Bodega Cee | #012 Bodega Baddiee Cee (Neutral); #013 Knocka Cee (Neutral); #014 Midnight Cee (Ghost) |
> | F12 Yote family | #061–#067 | Barrio-Yote | #065 Fuego-Yote (Fire); #066 Yote del Eléctrico (Electric); #067 Agua-Yote (Water) |

The third column is headed "Shared Mid" (`M7 L51`). In v7 the family is named after its Max form for F02 ("Bodega Baddiee Cee") and the starter label "Bodega Cee" is the Mid form #011. "Hood Ratti" is both the family name and the Mid form #004. "Yotes" is not a form name; v7 says "Yote family".

[v7] Entry index (`M7 L77-L83`, `L84-L90`, `L139-L143`, plus `L137-L138`):

> | #001 | Metro Egg | Egg | Noncombat egg | — | #002 |
> | #002 | Squeaklet | Baby | Neutral | #001 | #003 |
> | #003 | Lil’ Ratti | Small | Neutral | #002 | #004 |
> | #004 | Hood Ratti | Mid | Neutral | #003 | #005, #006, #007 |
> | #005 | Ratti Royale | Max | Neutral | #004 | Final |
> | #006 | Agua Ratti | Max | Water | #004 | Final |
> | #007 | Phantom Ratti | Max | Ghost | #004 | Final |
> | #008 | Corner Egg | Egg | Noncombat egg | — | #009 |
> | #009 | Kittee Cee | Baby | Neutral | #008 | #010 |
> | #010 | Lil’ Cee | Small | Neutral | #009 | #011 |
> | #011 | Bodega Cee | Mid | Neutral | #010 | #012, #013, #014 |
> | #012 | Bodega Baddiee Cee | Max | Neutral | #011 | Final |
> | #013 | Knocka Cee | Max | Neutral | #011 | Final |
> | #014 | Midnight Cee | Max | Ghost | #011 | Final |
> | #061 | Prism Egg | Egg | Noncombat egg | — | #062 |
> | #062 | Yotito | Baby | Neutral | #061 | #063 |
> | #063 | Lil’ Yote | Small | Neutral | #062 | #064 |
> | #064 | Barrio-Yote | Mid | Neutral | #063 | #065, #066, #067 |
> | #065 | Fuego-Yote | Max | Fire | #064 | Final |
> | #066 | Yote del Eléctrico | Max | Electric | #064 | Final |
> | #067 | Agua-Yote | Max | Water | #064 | Final |

(Markdown link syntax around the names is stripped; the names are unchanged.)

[v7] Stable form IDs, one per dossier: `form_metro_egg` (`M7 L358`), `form_squeaklet` (`L444`), `form_lil_ratti` (`L532`), `form_hood_ratti` (`L664`), `form_corner_egg` (`L1297`), `form_kittee_cee` (`L1381`), `form_bodega_cee` (`L1597`), `form_prism_egg` (`L7844`), `form_yotito` (`L7928`), `form_lil_yote` (`L8014`), `form_barrio_yote` (`L8144`). Each line continues: "**Status:** exact creator constraints are fixed; newly authored measurements, acting detail and tuning are design proposals."

[v7] Branching rule:

> The rat and coyote families never share evolution edges. The canonical rat sequence is **001→002→003→004**, then exactly **005 OR 006 OR 007**. (`M7 L38`)

> Preview each eligible endpoint independently and confirm ONE selection before light/pose changes. Preserve original identity, HP fraction and saved progress; no serial Max arrows. (`M7 L717`; identical at `L1650`, `L8197`)

[v7] Type fields. v11 treats these as legacy:

> The active gameplay direction now uses eight Affinities while the v8 registry still carries a ten-type field set. Treat the old type fields as legacy data until the explicit migration map is authored; do not silently rewrite Dex records. (`IDX L41`)

---

## 2. Hood Ratti (F01) and Malik's Ratti

### 2.1 Malik's Ratti, the individual

Coverage: v11 **found**. v7 **absent** (v7 never mentions Malik, Ratti as an individual, or any human cast).

> Ratti — Malik’s particular Hood Ratti. Clever, funny, stubborn, Black American/NYC Black cultural identity. Lives at the neighborhood bodega by choice and can refuse Malik or anyone else. (`V11 ¶73-¶74`, name cell and description cell)

> Malik’s Ratti is Black American / NYC Black. The Ratti species is not ethnically locked; other Rattis can belong to other NYC communities. (`V11 ¶53`)

> Ratti: “You ain’t my Callah. I’m not listening to you.” (`V11 ¶59`)

> Malik and Ratti ultimately save Theo from a mad scientist’s humanoid robot; Ratti’s evolution is necessary to that rescue. (`V11 ¶91`)

> In a futuristic New York still adjusting to intelligent life forms created by a concealed EngineX eradication program, Malik Carter and his outspoken Hood Ratti enter the city’s emerging Caller culture … (`V11 ¶33`, truncated)

> EngineX originally intended a lethal serum-and-gas eradication program aimed at rodents and designated pest/invasive populations. (`V11 ¶36`, one sentence)

v11 does not say which Dex form Malik's Ratti is at the story's start.

### 2.2 Egg: #001 Metro Egg [v7]

Coverage: v11 **absent** for this form. v7 **found**.

> **Defining silhouette.** Rounded triangular egg with uninterrupted stripe bands and a small plain circular inset. (`M7 L364`)

> **Anatomy and rig.** Magical one-core Block Egg. It is not biological evidence that the corresponding real mammal hatches from eggs. (`M7 L368`)

> **Surfaces and costume.** Glossy vivid red egg with three bold white diagonal wraparound stripes. Small gold medallion inset optional; never a predominantly gray shell. (`M7 L372`)

> **Scale target.** Hand-held collectible scale; absolute dimensions are a design target to set at art lock, not a measured biological egg. (`M7 L378`)

> **Movement and idle.** Stripes pulse in sequence; a pink tail-shaped light circles the shell before a friendly squeak. (`M7 L384`)

> **Expression range.** Three quiet states: rested, responding to attention, and ready-to-hatch. No distress animation implies harm when the owner is away. (`M7 L388`)

> **Relationship and team identity.** One dormant individual belonging to the rat family. Later branches share this same egg skin; it does not determine its future type. (`M7 L390`)

> Family seam opens softly; reveal #002 Squeaklet, one individual. (`M7 L411`)

> No eating at Egg. (`M7 L419`)

> **Social reaction:** Respond to gentle attention with a small safe wobble and family light cue. No food, battle attacks, hunger punishment or splitting into two companions. (`M7 L421`)

### 2.3 Baby: #002 Squeaklet [v7]

Coverage: v11 **absent** for this form. v7 **found**. This is the stage Phase 1 ships, if the v8 Dex keeps v7's numbering.

> Squeaklet — first trust. A quick-witted street survivor becomes the friend who never leaves anyone behind. (`M7 L442`)

> **Defining silhouette.** Seated pear-shaped body, oversized ears and eyes, bare paws, tiny soft red nape marking; no full outfit. (`M7 L450`)

> **What changes from the prior stage.** Head and eyes dominate; appendages are soft and simple. The visual jump from Egg is a living baby, not a shrunken final outfit. (`M7 L452`)

> **Anatomy and rig.** Rat-specific round ears, incisors, narrow whiskered muzzle, grasping forepaws, broad hind feet and a long exposed pink segmented tail. Never use coyote ears, a bushy canine tail or a dog muzzle. (`M7 L454`)

> **Face, eyes and mouth.** Large warm anime eyes with visible pupils and highlights; soft infant mouth … (`M7 L456`, truncated)

> **Surfaces and costume.** Short soft charcoal fur and cream muzzle; no shoes, chain, adult hoodie or headpiece. Pink ear and tail texture stays soft. (`M7 L458`)

> **Color and material reference.** Charcoal fur #403D43; warm cream #EEE0CC; ear/tail pink #D99597; hoodie red #C92838; brass #C49B48. Water and Ghost branches override garment/VFX colors, not the recognisable rat face. (`M7 L460`)

> **Back construction.** Plain fur across shoulders and rump. Tail begins low at the pelvis; do not add the adult hood seam. (`M7 L462`)

> **Scale target.** Small cuddle-scale character; exaggerate head/body ratio without shrinking the finished adult costume. (`M7 L464`)

> **Motivation and temperament.** Cheerfully improvises, boasts before admitting uncertainty, and notices when a companion falls behind. Wants to be dependable, not feared. Fidgets with a plain token while thinking. (`M7 L468`; the same sentence appears for every F01 form)

> **Movement and idle.** Small curiosity and safe exploration. … Use soft, short steps or tiny wing/fin adjustments appropriate to this anatomy; no adult finisher pose. (`M7 L470`, truncated)

> **Voice and sound.** Soft young expression of the family sound: Bright scritchy chirps and confident little chuckles; breath is audible after a committed dash, never a borrowed human celebrity voice. Keep volume and effort gentle; no adult line delivery or battle scream. (`M7 L472`)

> **Expression range.** Curiosity, delight, sleepy contentment and mild uncertainty have distinct eye/ear/body cues. No aggressive battle roar or adult posing. (`M7 L474`)

> **Relationship and team identity.** Regularly works with LanternFye: her visible relay lanes create options for his shove. His Water branch and Agua-Yote are different species, rigs and IDs. (`M7 L476`)

> No battle stats, damaging attacks, finisher or combat weakness are assigned. Use the stated hatch or baby expression. Care never requires harm, fright, starvation or a real-night check-in. (`M7 L501`)

> Use caretaker-prepared fictional starter portions; no adult takeout mouth animation. (`M7 L505`)

> **Favorite:** Chopped cheese + fries. **Prop:** Chopped beef-and-cheese sandwich cut across the center, lettuce and tomato, crinkled deli paper and golden fries. **Container:** Rectangular foil tray. Meals are fictional nourishment; no real-animal feeding recommendation is implied. (`M7 L507`)

> **Social reaction:** Simple attention or a gentle offered interaction suited to the baby body. Observe its approach/step-back cue; use a small toy rather than adult equipment. One Social HP meter only. (`M7 L509`)

> No canine muzzle, fire-rat branch, electric-rat branch, extra water egg, early split, extra tail, headpiece or M-shaped emblem. (`M7 L517`)

### 2.4 Small #003 Lil' Ratti and Mid #004 Hood Ratti [v7], abridged

Phase 1 stops at Baby. These lines are here because the starter is labelled with the Mid name.

> **Defining silhouette.** Slim quick adolescent, longer tail and oversized hood; a plain token instead of the finished heavy medallion. (`M7 L538`, #003)

> **Scale target.** Intermediate adventure scale; establish a measured concept-sheet height before final rigging. (`M7 L552`, #003)

> **Movement and idle.** Sniff → glance → weight shift → short burst. Tail counterbalances turns. Keep two grounded beats before a major impact; no always-on hovering. (`M7 L558`, #003; same at `L690`, #004)

> **Social reaction:** Offers a bottle cap to shuffle, leans in for a brief ear acknowledgement, then checks the group. Affection ends when he steps back. (`M7 L641`, #003; same at `L791`, #004)

> Hood Ratti — capable companion. A quick-witted street survivor becomes the friend who never leaves anyone behind. (`M7 L662`)

> **Defining silhouette.** Confident compact biped with wider shoulders and functional red streetwear; still far below the giant final. (`M7 L670`, #004)

> **Surfaces and costume.** The Small hood is oversized and unprinted, with one plain token rather than a heavy chain; Mid receives the mature red hoodie and plain medallion. … (`M7 L678`, #004, truncated)

> **Scale target.** Companion scale; use a shared ground line against Baby, Small and Max. Exact dimensions remain design targets. (`M7 L684`, #004)

> **Role:** Mascot kinetic skirmisher. (`M7 L721`, #004, first sentence)

> **Passive — Hood Heart.** Successful Guard gives 1 Heart, max 2; Rat-a-Tat Rush can spend one for +10 Power. (`M7 L729`)

> **Favorite:** Chopped cheese + fries. (`M7 L789`, #004, first sentence)

> | #005 | Ratti Royale | Chopped cheese + fries | Rectangular foil tray |
> | #006 | Agua Ratti | Shrimp fried rice | Folded Chinese takeout box |
> | #007 | Phantom Ratti | Black-garlic ramen | Sealed rectangular broth tub | (`M7 L14763-L14765`)

### 2.5 Culture, gender, identity for the line

Coverage: v11 **found** for Malik's individual and the species-not-locked rule (§2.1). v7 **absent**: no F01 culture note anywhere in v7. v7 refers to the rat with "he"/"his" (`M7 L476`, `L641`). v11 says "Mons have genders" (`V11 ¶54`) and gives no rule for the player's individual.

---

## 3. Bodega Cee (F02) and Mari's partner

### 3.1 Mari's partner

Coverage: v11 **partial** (line only, no individual name, form or personality). v7 **absent**.

> Amara “Mari” Rosario — Afro-Latina teen girl, 14–15, Brooklyn Tech. Caller whose partner comes from the Bodega Cee line. Her age-appropriate relationship with Malik grows from friendship, conflict, attraction and trust. (`V11 ¶75-¶76`)

v11 gives no culture note for the Bodega Cee line or for Mari's partner. `V11 ¶53` lists communities without assigning one to this line.

### 3.2 Egg: #008 Corner Egg [v7]

> Corner Egg — dormant potential. Three expressions of city confidence: counter timing, sonic style and supernatural night work. (`M7 L1295`)

> **Defining silhouette.** Pink oval with one white-fur wrap, not a living kitten inside a handbag. (`M7 L1303`)

> **Surfaces and costume.** Glossy pink egg wrapped around its middle and lower rim with soft white fur. Keep enough pink shell visible; a small heart charm is optional. The shared egg does not force the pink final branch. (`M7 L1311`)

> **Movement and idle.** White fur fluffs, a small purr resonates, and the shell separates under a soft pink gleam. (`M7 L1323`)

> **Relationship and team identity.** One dormant individual belonging to the cat family. Later branches share this same egg skin; it does not determine its future type. (`M7 L1329`)

> Family seam opens softly; reveal #009 Kittee Cee, one individual. (`M7 L1350`)

Scale, egg expression states, "No eating at Egg" and the Egg social reaction repeat the #001 wording (`M7 L1317`, `L1327`, `L1358`, `L1360`).

### 3.3 Baby: #009 Kittee Cee [v7]

> Kittee Cee — first trust. Three expressions of city confidence: counter timing, sonic style and supernatural night work. (`M7 L1379`)

> **Defining silhouette.** Round calico kitten, large paws and short upright tail; no adult earrings. (`M7 L1387`)

> **Anatomy and rig.** One feline head, two ears, four feline limbs and one continuous raised tail. The current calico, pink sonic and black spectral branches must retain the same recognisable eye spacing and muzzle proportions. (`M7 L1391`)

> **Surfaces and costume.** Soft calico fur and bare little ears. No adult puffer, door-knocker jewelry or human-like bodice. (`M7 L1395`)

> **Color and material reference.** Current: ivory #F5E7D4, orange #C98340, charcoal #302E34, puffer pink #E35797. Pink branch: rose #EC81AE and old-gold #CAA154. Black branch: ink #171822 and emerald #66AD8B. (`M7 L1397`)

> **Back construction.** Calico patches continue around the spine and tail root. One continuous feline tail, not a cloth accessory. (`M7 L1399`)

> **Scale target.** Small cuddle-scale character; exaggerate head/body ratio without shrinking the finished adult costume. (`M7 L1401`)

> **Motivation and temperament.** Observant, exacting and generous on her own terms. She dislikes interruptions while concentrating but chooses to share the warmest perch. Confidence is not cruelty. (`M7 L1405`; same for every F02 form)

> **Voice and sound.** Soft young expression of the family sound: Chirrup, purr and clipped meow motifs; sonic attacks are a deliberate magical amplification, not constant screaming. Keep volume and effort gentle; no adult line delivery or battle scream. (`M7 L1409`)

> **Expression range.** Curiosity, delight, sleepy contentment and mild uncertainty have distinct eye/ear/body cues. No aggressive battle roar or adult posing. (`M7 L1411`)

> **Relationship and team identity.** Regular Cee opens a narrow angle while the squirrel blocks a retreat route. The pink branch cooperates with the bat DJ through sound-tagged moves without copying Electric powers. (`M7 L1413`)

> **Favorite:** Chicken wings + fries. **Prop:** Crisp golden wings in one section; fries in the other; a separate sauce cup. **Container:** Rectangular divided tray. Meals are fictional nourishment; no real-animal feeding recommendation is implied. (`M7 L1444`)

> **Social reaction:** Simple attention or a gentle offered interaction suited to the baby body. Observe its approach/step-back cue; use a small toy rather than adult equipment. One Social HP meter only. (`M7 L1446`)

> No humanoid cleavage, identical three-color recolors, round hoops replacing door knockers, mysterious typing inferred only from black fur, or head ornaments. (`M7 L1454`)

### 3.4 Small #010 Lil' Cee and Mid #011 Bodega Cee [v7], abridged

> **Defining silhouette.** Longer feline body, playful extended tail and tiny collar charm; no puffer bulk. (`M7 L1473`, #010)

> Bodega Cee — capable companion. Three expressions of city confidence: counter timing, sonic style and supernatural night work. (`M7 L1595`)

> **Defining silhouette.** Lean adolescent with a short light jacket, small jewelry and developing poised stance. (`M7 L1603`, #011)

> **Surfaces and costume.** Small uses only a little collar charm. Mid develops a slim cropped puffer; full earrings and branch-specific fashion arrive at Max. … (`M7 L1611`, #011, truncated)

> **Scale target.** Companion scale; use a shared ground line against Baby, Small and Max. Exact dimensions remain design targets. (`M7 L1617`)

> **Movement and idle.** Tail punctuation precedes a decision; ears lead a turn before the shoulders. Land softly on forepaws, then settle the hind paws. Each branch has a different combat rhythm. (`M7 L1623`)

> **Role:** Developing counter-duelist. (`M7 L1654`, first sentence)

> **Passive — Counter Service.** Counter Purr successfully intercepting a direct hit stores +10 Power for the next Aisle Cut, max one token; expires after 2 rounds. (`M7 L1662`)

> **Social reaction:** Perch puzzle, ribbon tracing and quiet storefront watching are alternatives that feed one Social HP meter. Adult-like confidence never requires forced touch. (`M7 L1724`, #011; same at `L1576`, #010)

> | #012 | Bodega Baddiee Cee | Chicken wings + fries | Rectangular divided tray |
> | #013 | Knocka Cee | Steak and cheese | Rectangular foil tray |
> | #014 | Midnight Cee | Lamb over rice | Rectangular foil tray | (`M7 L14766-L14768`)

> | Bodega Baddiee Cee | P | P | P | P | P | community_hub, courtyard, street | Partner/community-story encounters, not wild predation or real pet capture. Rare cat finals require evolution, not coat-color neighborhoods. | (`M7 L14813`)

### 3.5 Culture, gender, identity for the line

Coverage: v11 **absent**. v7 **absent** for culture; v7 uses "she"/"her" for the family (`M7 L1405`).

---

## 4. Yotes (F12)

### 4.1 Identity

Coverage: v11 **partial** (one sentence). v7 **absent**: v7 contains no Latino, Latin or family-identity note for F12.

> Culture is biography and community, not elemental biology. … Yotes carry a Latino family identity. (`V11 ¶53`, two sentences)

v11 does not say whether "Latino family identity" binds every Yote or one family of Yotes. The same paragraph says the Ratti species "is not ethnically locked", and `V11 ¶44` puts culture on the individual.

[v7] Names with Spanish words: "Yotito" (`M7 L138`), "Barrio-Yote" (`L140`), "Fuego-Yote" (`L141`), "Yote del Eléctrico" (`L142`), "Agua-Yote" (`L143`). v7 adds no culture note to them. Voice rule:

> Never frame a language or accent as an animal joke. (`M7 L8042`, last sentence of the Yote voice line)

### 4.2 Egg: #061 Prism Egg [v7]

> Prism Egg — dormant potential. An adaptable long-legged coyote chooses an elemental route while keeping one unmistakable family body. (`M7 L7842`)

> **Defining silhouette.** Black oval with decorative flames at the bottom and clear uncolored crystal inset. (`M7 L7850`)

> **Surfaces and costume.** Glossy black egg with red-orange-yellow flame motifs rising from the bottom. A clear, uncolored crystal inset may sit above the flames. This is the shared Yote egg skin; its flame motif does not preselect the Fire branch. (`M7 L7858`)

> **Movement and idle.** The painted or emissive flames ripple; the clear inset brightens without elemental color, and the shell opens. (`M7 L7870`)

> **Relationship and team identity.** One dormant individual belonging to the yote family. Later branches share this same egg skin; it does not determine its future type. (`M7 L7876`)

> Family seam opens softly; reveal #062 Yotito, one individual. (`M7 L7897`)

> No fire form as shared ancestor, no rat branch, no forced sequence Fire→Electric→Water, no instant heal by reattunement. (`M7 L7915`)

### 4.3 Baby: #062 Yotito [v7]

> Yotito — first trust. An adaptable long-legged coyote chooses an elemental route while keeping one unmistakable family body. (`M7 L7926`)

> **Defining silhouette.** Sandy-gray pup with long ears and large paws; NO elemental mane. (`M7 L7934`)

> **Anatomy and rig.** Pointed coyote ears, long canine muzzle, lean chest, long lower legs, four paws and a bushy tail. NEVER rat incisors, round rat ears or a bare pink tail. (`M7 L7938`)

> **Surfaces and costume.** Sandy-gray pup fur with a dark saddle hint and a clear chest fleck; no flames, electrical mane or water fins. (`M7 L7942`)

> **Color and material reference.** Sandy gray #A1917E and charcoal saddle #3A383A. Fire: ember #E96532. Electric: cyan-white #79D5F0. Water: deep teal #236D82 and foam #CEE9E7. (`M7 L7944`)

> **Back construction.** A small FURRY canine tail, never the rat’s bare segmented pink tail. No jacket or crystal rig yet. (`M7 L7946`)

> **Scale target.** Small cuddle-scale character; exaggerate head/body ratio without shrinking the finished adult costume. (`M7 L7948`)

> **Motivation and temperament.** Independent until trust is earned, then remarkably reliable. Reads a route before moving and returns to guide slower companions. (`M7 L7952`; same for every F12 form)

> **Voice and sound.** Soft young expression of the family sound: Yips and a short rally howl; Fire is rougher, Electric clipped, Water low and flowing. Never frame a language or accent as an animal joke. Keep volume and effort gentle; no adult line delivery or battle scream. (`M7 L7956`)

> **Expression range.** Curiosity, delight, sleepy contentment and mild uncertainty have distinct eye/ear/body cues. No aggressive battle roar or adult posing. (`M7 L7958`)

> **Relationship and team identity.** Agua-Yote is a broad directional guardian; Agua Ratti is a smaller tight-lane rat disruptor. They are separate families and never evolve into one another. (`M7 L7960`)

> **Favorite:** Spicy chicken over rice. **Prop:** Chicken and rice with visible red sauce; same portion/effect as ordinary chicken plate. **Container:** Rectangular foil tray. Meals are fictional nourishment; no real-animal feeding recommendation is implied. (`M7 L7991`)

> **Social reaction:** Simple attention or a gentle offered interaction suited to the baby body. Observe its approach/step-back cue; use a small toy rather than adult equipment. One Social HP meter only. (`M7 L7993`)

### 4.4 Small #063 Lil' Yote and Mid #064 Barrio-Yote [v7], abridged

> **Defining silhouette.** Long-legged young coyote with developing dark saddle and a clouded crystal charm. (`M7 L8020`, #063)

> **Surfaces and costume.** Small scarf/harness precedes the Mid street jacket and neutral crystal socket. Element appears only at the chosen Max. … (`M7 L8028`, #063; same at `L8158`, #064, truncated)

> **Movement and idle.** Long springing stride → precise paw placement → head turn to check the route. Different elements change the movement cadence, not the species. (`M7 L8040`; same at `L8170`)

> **Social reaction:** Route-token tracking, quiet side-by-side sitting or an offered head acknowledgement. (`M7 L8123`, #063; same at `L8271`, #064)

> **Defining silhouette.** Lean adult-proportioned shared coyote with neutral chest setting and restrained jacket straps. (`M7 L8150`, #064)

> **Role:** Neutral route-reading companion. (`M7 L8201`, first sentence)

> **Passive — Pack Route.** Streetline Sprint grants one route token, max 1. Corner Pounce may consume it for +10 Power. (`M7 L8209`)

> | #065 | Fuego-Yote | Spicy chicken over rice | Rectangular foil tray |
> | #066 | Yote del Eléctrico | Shrimp lo mein | Folded Chinese takeout box |
> | #067 | Agua-Yote | Seafood ramen | Sealed rectangular broth tub | (`M7 L14779-L14781`)

### 4.5 Gender

Coverage: v11 **absent** for Yotes. v7 **absent** (no pronoun used for F12 in the lines read).

---

## 5. Lifecycle stages

Coverage: v11 **found**. v7 **found** (stage column of the index). They agree on the five names.

> Egg → Baby → Small → Mid → Max. A newly hatched Mon stays Baby until an authored evolution event. (`V11 ¶25`)

> A Mon stays Baby after hatching until an authored evolution occurs. Evolution preserves the same monInstanceId, memories, personality, Caller bond, voice lineage, learned history and continuity of experience while changing body/form data, movement, materials and abilities. (`V11 ¶47`)

> Personality/Bond can influence branching evolution. (`V11 ¶68`, one sentence)

> Hatchlings may use baby-talk/gibberish, then limited speech, then full speech. One voiceLineageId persists so the voice matures like the same person growing up rather than switching to a different actor identity at each evolution. (`V11 ¶56`, last two sentences)

[v7] "**Stage function.**" per stage: "Dormant potential" (Egg, `M7 L362`), "First trust" (Baby, `L448`), "Learning independence" (Small, `L536`), "Capable companion" (Mid, `L668`), and for Max "mastered identity" (`L812`).

Conflict inside the on-disk sources: `ARCH L320-L328` lists `Species: Ratti` with forms "Egg / Baby / Form I / Form II / Form III / Apex". That is six stages with different names. v11 `¶25` and v7 both give five.

---

## 6. Care meters

Coverage: v11 **found** (names only). v7 **found** (names, numbers, rules), all labelled by v7 itself as proposals.

> Energy, Fullness and one Social HP/social-need meter remain the core care model. Mons can request food. Every food-capable Mon needs anatomy-appropriate eating animation and reactions. Standard battle fainting is recoverable and is never an automatic egg reset. (`V11 ¶51`)

> Every food-capable Mon needs species-appropriate eating. Conversation needs listening/talking/refusal performance. Lifecycle needs hatch/evolution. (`V11 ¶97`, three sentences)

> In XR the Mon can hold full conversations, remember what happened on mobile, ask for food, react to damage/fatigue and continue the same relationship. (`V11 ¶94`, first sentence)

[v7] The model and its own disclaimer:

> The aim is a creature that feels present in daily life, not a checklist that punishes the owner. … NYC-Mon’s exact three-meter model, scoring and absence rules below are original proposals. (`M7 L14623`, abridged)

> | Energy | Rested readiness for outings/training. | Sleep, rest and a small meal contribution. | Battle HP or BP. |
> | Fullness | 100 = satisfied; 0 = needs food. Label “Hungry” when low rather than reversing bar direction. | Meals and snacks. | A healing potion. |
> | Social HP | Comfort and connection; petting, play and attention all fill this ONE bar. | Pet OR play OR spend attentive time. | Three separate meters, battle durability or owner morality. | (`M7 L14629-L14631`)

> At adoption start all at 80. While awake: Energy −1/hour, Fullness −2/hour, Social HP −1/hour. Default sleep window is 8 hours chosen by the owner; while asleep Energy +10/hour, Fullness −0.5/hour, Social HP unchanged. Clamp every meter to 0–100. A low bar never causes permanent death, loss of a paid item or creature deletion. (`M7 L14633`)

> Low Fullness/Social HP give gentle prompts but do not secretly multiply battle damage or make the companion disobey. (`M7 L14635`, one sentence)

> | Pet | +12 Social HP over a short ~20 s interaction. | … |
> | Play | +20 Social HP; −4 Energy for a ~60 s activity. | … |
> | Attention | +15 Social HP for ~45 s together. | … | (`M7 L14641-L14643`, first two cells of each row)

> Cap gains at +25 Social HP per 10-minute interaction session so frantic tapping does not farm the score. (`M7 L14645`, first sentence)

> Food by itself restores Fullness, not Social HP. (`M7 L14647`, first sentence)

Starter social reactions:

> | Hood Ratti | Leans the hood back for an ear scratch; tail taps twice. | Short bottle-cap shuffle or safe tail-balance game. | Sits on a stoop and shows the medallion. |
> | Bodega Cee | Cheek lean, purr and tail curl; respect the step-back animation. | Chase a ribbon or solve a little perch puzzle. | Watch the storefront together; she shows an accessory. |
> | Yote family | Lowers the head for affection and curls the tail. | Track a magical route token or catch a soft light. | Sits beside the owner and gives a quiet friendly yip. | (`M7 L14653`, `L14654`, `L14664`)

Indicators:

> 60–100 = comfortable. 40–59 = mild need in the home UI. Crossing below 40 triggers the appropriate bowl, crescent or hand/heart icon. Below 20 intensifies the **in-app** prompt, not a guilt alarm. Clear the alert only after the meter rises to at least 50 (hysteresis), so the icon does not flap around a threshold. (`M7 L14668`)

> Use understandable text: “Hood Ratti could use a meal,” … Group multiple needs into one optional notification; maximum two per 24 hours, with owner-controlled quiet hours, snooze and notification opt-out. (`M7 L14670`, abridged)

Absence:

> Manual vacation mode freezes decay and excludes those hours from scoring. After 24 hours without engagement, a free automatic sitter pauses further decay. On return, any meter below 35 is raised to 35 with a friendly “your companion was looked after” message; the owner can restore the rest for free. No irreversible neglect state, missed-evolution punishment or paid rescue. (`M7 L14676`, first four sentences)

> Use elapsed UTC time for meter integration and a selected local timezone for the weekly display so daylight-saving changes do not create a double decay or a missing day. (`M7 L14678`, last sentence)

Weekly score (`M7 L14684-L14688`):

> ```text
> E = mean tracked Energy; F = mean tracked Fullness; S = mean tracked Social HP
> adequate(x) = min(1, x / 60)
> Weekly Care Score = round(100 * [0.30*adequate(E) + 0.35*adequate(F) + 0.35*adequate(S)])
> ```

Food values:

> Eggs do not eat; Babies use tiny caretaker-prepared starter portions. Favorites are preferences, not restrictions. All living families can use the fantasy menu. Full meals restore 40 Fullness/5 Energy; snacks 15/2. Food gives no battle HP/BP or automatic Social HP. (`M7 L14726`, sentences 2-6)

> | chopped | Chopped cheese + fries | … | Rectangular foil tray | 40 | 5 |
> | wings | Chicken wings + fries | … | Rectangular divided tray | 40 | 5 |
> | hot_chicken | Spicy chicken over rice | … | Rectangular foil tray | 40 | 5 | (`M7 L14732`, `L14733`, `L14748`, appearance cells elided)

v7 has food IDs and favorites. Neither source has a "food class" field. v7 says favorites "are preferences, not restrictions" and every living family can eat the whole menu (`M7 L14726`).

---

## 7. Incubation and hatching

Coverage: v11 **found** for timing, notification and atomicity. v7 **partial** (per-egg hatch performance only; no timer, no notification).

> The companion loop uses 15-minute, 30-minute or 1-hour incubation choices. When ready, the player receives a notification; tapping it opens the hatch screen. Hatch is atomic and cannot duplicate on reconnect, skip-animation or device handoff. (`V11 ¶49`)

[v7] Per-egg hatch performance: Metro Egg `M7 L384` and `L411`, Corner Egg `L1323` and `L1350`, Prism Egg `L7870` and `L7897` (quoted in §2-§4). Egg expression states, identical for all three:

> **Expression range.** Three quiet states: rested, responding to attention, and ready-to-hatch. No distress animation implies harm when the owner is away. (`M7 L388`)

Unversioned architecture doc, which describes a messier hatch than v7's "Family seam opens softly":

> This allows the incubation timer to control a real creature state. (`ARCH L418`)

`ARCH L422-L441` then lists: "incubating → movement inside shell → shell pulse → first crack → multiple cracks → goo leak → shell separates → Mon struggles out → first breath → looks for Caller", and `ARCH L445-L448` says to avoid "egg disappears → baby model appears".

---

## 8. Caller and Callah

Coverage: v11 **found**. v7 **absent**: v7 never uses "Caller"; it says "owner" throughout (46 lines in `M7`, e.g. `L388`, `L14633`, `L14664`).

> Caller is the canonical spelling. “Callah” is an in-character NYC pronunciation some Mons/people may use; it does not rename the role. (`V11 ¶19`)

> Caller is the canonical spelling. “Callah” is an approved character pronunciation/surface spelling for NYC dialogue. A bonded Mon stores one primary Caller voice identity. Familiar Voices can be separately enrolled and can have their own relationship/memory context, but recognition does not grant primary-Caller status or obedience. (`V11 ¶58`)

> Dialogue should preserve character-specific NYC cadence, stress, slang and code-switching when appropriate without making every Black, Latino or New Yorker sound the same. (`V11 ¶60`)

> Caller: Human in a genuine Mon partnership; canonical spelling. (`V11 ¶109`)

> Callah: In-character pronunciation/surface spelling of Caller. (`V11 ¶110`)

---

## 9. Hood Mon

Coverage: v11 **found**. v7 **absent** as a term; v7 uses "wild" (e.g. `M7 L14815` "wild-stage mix", `L14847` "Partner/community route, not wild pool").

> Independent/free-living Mons are Hood Mons (“Hood” in dialogue), not “wild.” Hood does not mean hostile, unregistered, poor or lesser. (`V11 ¶21`)

> Hood Mon: Independent/free-living Mon without a current Caller partnership. (`V11 ¶111`)

Naming collision to note: "Hood" is the status word for any free-living Mon, and "Hood Ratti" is a species label (`V11 ¶44`). v7's encounter row for the line:

> | Hood Ratti | C | C | C | C | C | street, transit_set, courtyard | Common citywide mascot encounters; no mapping of poverty or ethnicity to pest rarity. | (`M7 L14812`)

---

## 10. "Mons are people" and consent

Coverage: v11 **found**. v7 **partial** (care-level consent cues, no personhood statement).

> Mons can think, communicate, disagree, refuse, choose relationships and build histories. Intelligence and speech vary by individual and developmental stage. “Hood” means independent/free-living, not hostile or lesser. Scanning is not recruitment. H-Lynk containment is not consent. A partnership is social and relational, not a device flag. (`V11 ¶43`; heading `¶42` reads "Mons are people in the story")

> The question under the spectacle is whether partnership can mean something different from possession. (`V11 ¶34`, last sentence)

> A Mon is never reduced to inventory simply because the game needs a state machine. (`V11 ¶123`, last sentence)

[v7] Care-level cues: "Observe its approach/step-back cue" (`M7 L509`), "Affection ends when he steps back." (`L641`), "Adult-like confidence never requires forced touch." (`L1724`), "Creature leans into a touch at an appropriate spot; stop if it steps back." (`L14641`).

---

## 11. H-Lynk

Coverage: v11 **found**. v7 **absent** (no H-Lynk, Hood Link or BlockLink anywhere in `M7`, Atlas, Dex7 or Type Guide v7). The index archives BlockLink:

> BlockLink concept: archived; H-Lynk is current hardware name/design. (`IDX L28`)

> H-Lynk (“Hood Link”) is an optional communication/care/recovery device. It is not proof of ownership, personhood or partnership. (`V11 ¶23`)

> The H-Lynk is a slim 3:4-screen handheld with a central tactile trackpad/control, two buttons on each side, rear L/R controls, right-side volume/power, left-side action control, a top antenna and a separate red scanner/emitter. The backplate reads H-Lynk. Entry, Mid and Pro tiers differ in materials and sensor/camera sophistication; Entry is plastic and Pro is the most premium. (`V11 ¶63`)

> H-Lynk: Hood Link; optional communication/care/recovery hardware. (`V11 ¶112`)

> Current digital combat uses one active Mon plus three reserves while the Caller remains physically active in real time. H-Lynk supports commands/reads/coordination. (`V11 ¶67`, first two sentences)

> The season mystery connects missing Mons, redevelopment zones, H-Lynk telemetry, manipulated/fabricated media, captive research and controlled evolution. (`V11 ¶90`, first sentence)

Listed as still open:

> Exact mass/volume/energy fiction and emergency-release protocol for H-Lynk/capture containment. (`V11 ¶102`)

v11 does not name an Entry-tier color. BUILD_PROMPT_v3 §1.1 specifies "Knicks blue body, orange scanner LED"; that is a prompt decision, not v11 text.

---

## 12. The single-egg capture case

Coverage: v11 **found**. v7 **absent** (nearest is the egg itself: "Magical one-core Block Egg", `M7 L368`).

> This is a separate one-egg device/prop: compact square metal case, equal top/bottom halves, internal hinge, folding top handle only, no side latches and a rounded-square central biometric/trackpad control that can glow red. It must visually make sense as a one-egg cradle/case and must not read as a Poké Ball or a dozen-egg carton. (`V11 ¶65`)

v11 calls it a "capture/containment case" (`V11 ¶64` heading) and does not say the egg incubates inside it.

---

## 13. Cross-device continuity

Coverage: v11 **found**. v7 **absent** (nearest is the single active-companion rule, `M7 L14672`).

> Three.js remains the game direction; no Unity substitution. Cross-device state is authoritative server-side and must not create duplicate individuals. (`V11 ¶31`)

> The same Mon continues across mobile/tablet, web/spatial, Meta/Quest, Pico, Vision Pro and Alexa+. HP, status, hunger/fullness, energy, bond, learned moves, evolution, conversation memory and relationship state remain authoritative server-side. A device session is a surface, not a new creature. (`V11 ¶93`)

[v7]:

> For a large collection, only one explicitly selected **active companion** is tracked in the owner score. Inactive companions get a free unlimited sitter and no decline. (`M7 L14672`, first two sentences)

---

## 14. Faint and 0 HP (for the `CareState` copy deck)

Coverage: v11 **found**. v7 **found**. They agree.

> 0 HP means FAINTED/KO and recovery is required. Standard gameplay does not treat fainting as literal death or convert a defeated Mon back into an egg. (`V11 ¶27`)

> Faint: Standard recoverable 0-HP battle state; not literal death. (`V11 ¶115`)

> | HP | Battle health; 0 = knocked out for this encounter, never deleted or permanently dead. | (`M7 L14442`)

---

## 15. Coverage summary

| Topic | v11 docx | v7 |
|---|---|---|
| Hood Ratti: Dex numbers, forms, edges | absent (v8 Dex not on disk) | found |
| Hood Ratti: Baby body, scale, palette | absent | found (scale is a "design target") |
| Hood Ratti: food | absent | found (favorite chopped cheese + fries; no food class) |
| Hood Ratti: personality | found for Malik's Ratti only | found (family-wide line) |
| Hood Ratti: culture | found (Malik's Ratti; species not locked) | absent |
| Bodega Cee: Dex numbers, forms, edges | absent | found |
| Bodega Cee: Baby body, scale, palette | absent | found |
| Bodega Cee: food | absent | found (wings + fries) |
| Bodega Cee: personality | absent | found |
| Bodega Cee: culture; Mari's partner identity | partial (line only) | absent |
| Yotes: Dex numbers, forms, edges | absent | found |
| Yotes: Baby body, scale, palette | absent | found |
| Yotes: food | absent | found (spicy chicken over rice) |
| Yotes: personality | absent | found |
| Yotes: culture | partial (one sentence) | absent |
| Lifecycle stages | found | found |
| Care meters | found (names) | found (numbers, all "proposals") |
| Incubation timing, notification, atomic hatch | found | absent |
| Hatch performance per egg | absent | found |
| Caller / Callah | found | absent ("owner") |
| Hood Mon | found | absent ("wild") |
| Mons are people / consent | found | partial |
| H-Lynk | found | absent |
| Capture case | found | absent |
| Cross-device | found | absent |
| Faint | found | found |
