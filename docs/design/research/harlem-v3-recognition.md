# Harlem v3 recognition study: does the Valdrada-backed tile read as 125th Street?

Owner: Lane A1 (research and design), `docs/plans/harlem-v3-valdrada-prompt.md` §6.1 #1. Written 2026-10-17. Skill run: `design:user-research` is a plugin bundle that is not installed here (`ecc:*` absent); its method — research question, participant definition, fixed stimuli, scored answers, pass criteria — is applied by hand.

**Question.** Can people who know 125th Street pick out the Apollo Theater, the Hotel Theresa, the A.C. Powell Jr. State Office Building and two corners, from fixed camera bookmarks rendered on the v3 tile — and does v3 beat v2, which fills those facades from hash rules and OSM tags?

**Claim under test.** v3 replaces estimated heights, floors, facade typology, lanes and furniture with city records (PLUTO, Building Footprints, CSCL, FISP via Valdrada 0.4.0). The hypothesis is that the record-backed tile is *more recognisable* than v2, not merely "prettier". A fail means the import did not move recognition, or broke it.

## What is fixed, what varies

Fixed across both versions:

- Camera bookmarks below — same `CityCamera` values on both renders.
- Time of day (dusk, the default L1 sky), weather, and the camera pose math (`cameraPose`, `city-scene.ts` L51–69).
- Tile extent and origin: `harlem-apollo`, origin `[-73.94975, 40.81005]`, local metres (x east, z south).

Varies:

- The dataset version rendered (v2 `harlem-apollo-20261014` vs the v3 build).
- Order of versions per participant (counterbalanced).
- Whether street-name blade lettering is visible or masked (secondary condition, see Signage control).

Not in this study: free navigation, motion, audio, HUD copy. Frames only — the unit under test is the city's look, not the game's flow.

## Camera bookmarks

`CityCamera` is `{x, z, yaw, distance}`; the camera sits `distance` behind the look-at point along `(sin yaw, cos yaw)`, at height `distance · tan(pitch)`, pitch easing 0.35 rad at 8 m to atan(0.8) at 220 m (`city-scene.ts` L33–34, L57–69). All coordinates are scene metres about the dataset origin.

Scene coordinates used below were computed from the bundled tile and Valdrada's canonical registry:

- Landmarks (v2 `harlem-apollo.json`): Apollo (−9.7, −11.3); Hotel Theresa (69.2, 144.2); State Office Building (196.2, 92.8). Theresa and the State Office match Valdrada's corrected footprint centroids (`landmarkSpec.js` AR32C overrides L221–224) to under a metre in nyc-mon's projection (`projectCityPoint`, `city-dataset.ts` L346): Theresa override (40.808761, −73.948930) → (69.0, 143.3); State Office (40.809219, −73.947423) → (195.7, 92.4). The Apollo's AR32C point is its lobby door (40.809923, −73.950126) → (−31.6, 14.1), ~25 m west-south of the v2 landmark point — the lobby sits mid-frontage while v2's point marks the theatre's east end; the study targets the footprint, so either serves B1.
- Valdrada canonical landmark points (`landmarkSpec.js` L17–19, ids 8/9/10): Apollo (40.81007, −73.95003) → (−23.5, −2.2); Theresa (40.80920, −73.94910) → (54.7, 94.5); State Office (40.80950, −73.94830) → (122.0, 61.2). These are the registry points, not footprint centroids; the study targets the footprints.
- Corners: real signed junctions from the v2 tile (`signage.ts` `findIntersections`, 218 in tile): **W 125 St × Frederick Douglass Blvd** at (−120.2, −14.0); **W 125 St × Malcolm X Blvd** (Lenox Ave) at (351.7, 249.0). Both sit on 125th, bracketing the three landmarks.

| Bookmark | Target | `x` | `z` | `yaw` | `distance` | Eye height | What it frames |
|---|---|---:|---:|---:|---:|---:|---|
| B1 | Apollo front | −10 | −11 | 0 | 30 | ~12 m | North across 125th at the marquee and blade sign, from the south sidewalk line |
| B2 | Apollo corridor | −28 | 22 | π/2 | 220 | ~176 m | The shipped start view: west along 125th from above the sidewalk east of the theatre |
| B3 | Hotel Theresa | 69 | 144 | −0.785 | 60 | ~26 m | Northeast at the Theresa blockfront and its corner against the 125 × ACP junction |
| B4 | State Office Bldg | 196 | 93 | −0.785 | 70 | ~28 m | Northeast at the slab from across the 125 × ACP junction |
| B5 | Corner: 125 × FDB | −120 | −14 | π/2 | 45 | ~18 m | West through the Frederick Douglass junction, viaduct side |
| B6 | Corner: 125 × Lenox | 352 | 249 | π/2 | 45 | ~18 m | West through the Malcolm X Blvd junction, State Office slab behind |
| B7 | District read | 60 | 60 | −π/2 | 400 | ~400 m | East along the whole corridor: Theresa and the State Office slab against the skyline |

B1–B6 are ground-corridor frames (the chase camera's reach, 8–70 m). B7 is the overview where Lynch's "district" read is tested. The exact JSON for scripted capture (`skills/agent-device` per spec §6.5):

```json
[
  { "id": "B1", "x": -10, "z": -11, "yaw": 0.0, "distance": 30 },
  { "id": "B2", "x": -28, "z": 22, "yaw": 1.5708, "distance": 220 },
  { "id": "B3", "x": 69, "z": 144, "yaw": -0.7854, "distance": 60 },
  { "id": "B4", "x": 196, "z": 93, "yaw": -0.7854, "distance": 70 },
  { "id": "B5", "x": -120, "z": -14, "yaw": 1.5708, "distance": 45 },
  { "id": "B6", "x": 352, "z": 249, "yaw": 1.5708, "distance": 45 },
  { "id": "B7", "x": 60, "z": 60, "yaw": -1.5708, "distance": 400 }
]
```

## Participants

People who know 125th Street. Screening, both required:

1. Self-report: lived, worked, or regularly visited the corridor between Morningside Ave and Park Ave in the last five years (at least monthly).
2. An unaided pre-screen: name the Apollo's block or either of its cross avenues. Anyone who cannot is thanked and out — the study measures recognition among people with the real memory, not the general public.

Target n = 24, minimum viable n = 12, counterbalanced so half see v2 first at every bookmark. Recruitment noted in the session log (who, how screened, when). No demographic quotas; report the mix.

## Procedure and scoring

Per bookmark, shown for up to 15 s (participant may answer sooner):

1. **Free name**: "What is this?" — recorded verbatim.
2. **Pick**: a fixed list (the three landmarks, the two corners as "125th & ___", "not sure"). Free-name beats the pick list for scoring when both were given.
3. **Confidence** 1–5.
4. Corners score when both streets are named. "Lenox", "Malcolm X" and "6 Ave" all count for Malcolm X Blvd; "8 Ave" and "Frederick Douglass" both count for FDB.
5. B1–B4, B7 score landmark identification. B5–B6 score corner identification. B2 and B7 additionally score **orientation**: can they say which way is east/west or where on 125th they are.

Randomisation: bookmark order is shuffled once per session (same order for both versions within a participant). Version order is the counterbalance. Identical resolution, exposure and dusk sky on both renders.

**Signage control.** v2 and v3 both place street-name blades at these junctions; v3's names come from CSCL where v2's come from OSM. To separate "read the sign" from "recognise the corner", a masked-lettering render of B5 and B6 runs as a third condition on a random half of participants. Blades-on is the primary, shipped, condition.

## Pass criteria

The study passes for v3 when all hold on the blades-on primary condition:

- **No regression**: v3 identification rate ≥ v2 − 10 percentage points on every target.
- **Floors at v3**: Apollo ≥ 80 %, Theresa ≥ 70 %, State Office ≥ 60 %, each corner ≥ 50 %, orientation ≥ 60 % on B2+B7 combined.
- **Confidence**: median ≥ 3 on correct v3 answers.
- **Substitution check**: wrong answers on the Theresa/State Office frames name a different *place*, not "an office building" — generic misses count against the floor.

Numbers land in the study log; per-bookmark tables, not a single rollup.

## What this study cannot show

- It is frames, not play. A walkthrough that feels like 125th is a different claim; the critique pass (§6.1 #7) and device frames (D4) cover it.
- Street-name blades leak the corner answers in the unmasked condition — that is why the masked variant exists. If masked-corner scores collapse, "recognition" was reading, and that finding goes to the report rather than being hidden.
- n = 24 self-selected locals measures this corridor only. Nothing here generalises to other tiles or to people who have never been to Harlem.
- A v3 pass does not certify the import: wrong-record bugs can still pass recognition. Provenance is N7's job, not this study's.
