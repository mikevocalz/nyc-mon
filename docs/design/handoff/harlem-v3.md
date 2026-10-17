# Harlem v3 design handoff: Valdrada fields → dataset v3

Owner: Lane A1 (research and design), `docs/plans/harlem-v3-valdrada-prompt.md` §6.1 #5. Written 2026-10-17 against Valdrada `v0.4.0` (`2724c79`, checked out at `~/src/valdrada`) and nyc-mon `lane-v3a1`. Feeds E2 (schema and bake) and E3 (renderer consumption).

**Provenance rule.** A field counts as a *record* only where `compile.mjs` copies it from a named public record; everything else is a *rule* the compiler derived and carries an estimate bit in v3's `e`. Line numbers below were verified against the pinned checkout — `compile.mjs` at `client/tools/pipeline/compile.mjs`, `classify.mjs` beside it, record readers in `client/src/world/tiledata.js`. Where a fact lives in the shipped tile bytes rather than the compiler source, it is marked **PENDING E1** and stays unverified until the decoder runs.

**The `e` bit order** (spec §5.2): height, class, floors, style, detail. A set bit means "a named record supplied this"; cleared means rule or hash.

## Building records (44 bytes each; `tiledata.js` `buildingsOf` L66–83)

| Valdrada field (offset) | v3 field | Record or rule (evidence) | Renderer use | Fallback (v2/unmatched) |
|---|---|---|---|---|
| `start`/`len` → `bldgXZ` ring (u32/u16, 0/4) | `p` (ring, existing) | **Record**: Building Footprints geometry, `compile.mjs` L369–430 (`ring` from the footprint, `bin`/`bbl` join keys; light-court holes CY12). Tile bytes: PENDING E1 | Extrusion footprint; `streetFace` candidates; contact shadows | v2 OSM `way` ring |
| `landmarkId` (i16, 6) | `landmarks[]` entry (key) | **Record + rule**: canonical points `landmarkSpec.js` L17–19 (Apollo 8, Theresa 9, State Office 10, all `decorate`); containment match `compile.mjs` L1546–1558, nearest-footprint fallback L1560–1573; **AR32C read-time overrides fix the compiled placements of 9 and 10** (`landmarkSpec.js` L210–230). Canonical, not invented | `landmarkAccents` per key (`city-mesh.ts` L185–223) | No landmark, as v2 |
| `baseY` (f32, 8) | `y` (G4 only; default: not imported) | **Record**: `ground_elevation` ft→m, L401; datum adjusted L2067 | Ground datum if G4 imports terrain | Flat ground (`cityGroundHeight`) |
| `height` (f32, 12) | `h` (existing) | **Record**: `height_roof` ft→m, L388; outlier guard L400; OSM-tagged taller massing supersedes for named towers L521–543 | Wall extrusion `emitWalls(target, ring, 0, h, …)` at `city-mesh.ts` L323, roof plane, shadow reach | v2 `h` + `heightEstimated` |
| `floors` (u8, 16) | `f` | **Record when PLUTO has it**: `numfloors`, L215 → L1530; **rule** otherwise: `h/3.2` with sanity clamps, `classify.mjs` L86–89 | Window/fire-escape row pitch | `FLOOR_HEIGHT` 3.2 estimate (`facade-detail.ts` L14) |
| `style` (u8, 17) | `vs` verbatim; `class` via §City mapping | **Rule over records**: `classify()` (L78–422; style branches ~L146–310) on PLUTO `bldgclass`/year/`landuse`/`histdist`/district (loaded L206–224, applied L1529–1533); FISP material can restyle L314–354; per-building overrides `landmarkSpec.js` L148–209 | `class` → `WALL_TONES` family → `wallTone` (`city-mesh.ts` L236) | Hash class pick (`classEstimated`) |
| `r`/`g`/`b` (u8, 18–20) | not imported (G3) | **Rule**: `PAL` pick per style `classify.mjs` L10–65, jitter L1540; FISP/OSM colour overrides L320–354 | — | Palette family by class |
| `roofKind` (u8, 21) | not imported | **Mixed**: shape/membrane rule L2073–2080; bit 5 = DOB water-tank BIN record L2081; solar/green bits from records L2082–2085 | — (today: tar roof + tower hash) | `hasWaterTower` hash (`facade-detail.ts` L37) |
| `flags` (u8, 22) | `d` bitset, remapped | **Rule**: `classify()` sets CORNICE/FIRE_ESCAPE/STOREFRONT/GABLE/SETBACKS by class and year (the style branches ~L160–310, setbacks L375–377); WATERTOWER mixes rule probability L381–384 with the tank record L2081; STOOP is a placement rule `compile.mjs` L2142–2168; LANDMARK is the record match | `d` drives stoop/escape/cornice/tower emission | `hasStoop`/`hasFireEscape`/`hasWaterTower` hashes |
| `lit` (u8, 23) | not in v3 schema | **Rule**: 0.55 glass / 0.32 else, `classify.mjs` L387 | (Window-lit density if E3 wants it) | Existing window-light hash |
| `floorH` (f32, 24) | `fh` | **Rule**: `h/floors` clamped, snapped to 0.3 m brick course, `classify.mjs` L395, L421 | Fire-escape/storefront row pitch | `FLOOR_HEIGHT` |
| `winW` (f32, 28) | `ww` | **Rule**: per-style bay module, `classify.mjs` L396–417, snapped 0.6 m L422; runtime `rw13WinW` bridge `tiledata.js` L76 | Bay spacing on storefront fronts | `bays(length, 4.5)` |
| `storeH` (f32, 32) | `sh` | **Rule**: per class 3.9–6.0 m, `classify.mjs` L178–299 | Storefront band height | Fixed band y 3.15–3.45 (`city-mesh.ts` L386–401) |
| `blind` (u32, 36) | not in v3 schema | **Rule**: party-wall detection between adjoining footprints L1588–1618 | Could suppress front detail on blind walls; E3's call | None today |
| `area` (u16, 40) | not in v3 schema | **Record**: footprint area L405 | — | — |
| `colorVar` (u8, 42) | not in v3 schema | **Rule**: per-building random seed L1541 | — | `hashUnit(id)` |
| `frontIdx` (u8, 43, minus 1) | `fi` | **Rule**: best street-facing edge score, L2049–2061 | Replaces `streetFace()`'s runtime guess for marquee/stoop orientation | `streetFace()` (`city-mesh.ts` L151–176) |
| — | `e` bit 1 (height) | Set when `height_roof` carried the value (L388); cleared for OSM-gap-fills and guarded outliers | — | Always set-sourced or cleared per field |
| — | `e` bits 2–5 (class, floors, style, detail) | `floors` set only where PLUTO `numfloors` exists; `style`/`detail` are rule-derived → always carry the estimate side of the bit semantics | — | — |
| — | `id` | **PENDING E1 + G1**: no BIN/BBL/source id is serialized in the 44-byte record (`bin`/`bbl` are compile-time join keys only, L369–406). G1 default: match to v2 OSM ways by footprint overlap, `osm:way:N` on match else `vd:<tag>:<tile>:<index>` | Hash seeds, `landmarks.buildingId`, saves | v2 ids unchanged where matched |

## Road records (24 bytes; `roadsOf` L108–125)

| Valdrada field (offset) | v3 field | Record or rule (evidence) | Renderer use | Fallback |
|---|---|---|---|---|
| `start`/`len` → `roadVerts` (0/4) | `p` (points) | **Record**: CSCL centreline geometry, loaded L613–680 | Carriageway/sidewalk ribbons | v2 OSM way points |
| `rclass` 7 bits + `noTraffic` bit 7 (u8, 6) | `c` (class, mapped) | **Rule** over CSCL `rw_type`+width L685; pedestrianised flag L650–653 | Road class → ribbon width, sign eligibility | v2 class |
| `oneway` (i8, 7) | `ow` | **Record**: `trafdir` FT→1 / TF→−1 / else 0, L623 | Direction cues if renderer adds them | None today |
| `width` (f32, 8) | `w` (widthMeters) | **Record**: `streetwidth` ft→m L619; **rule** default 60/10/30 by `rw_type` when blank | Carriageway width | v2 `w`/`widthEstimated` |
| `lanes` (u8, 12) | `l` | **Record**: `number_travel_lanes` L621; **rule** fallback `max(1, round(width/3.6)−1)` | Lane markings, if shipped | None today |
| `park` (u8, 13) | not in v3 schema | **Record**: `number_park_lanes` L622 | — | — |
| `level` (u8, 14) | not in v3 schema | **Record**: CSCL level (grade) | Grade separation if ever | Flat |
| `speed` (u8, 15) | `sp` | **Record**: `posted_speed` L630; **rule** default 25, 50 on `rw_type` 2 | — (available for traffic cues) | — |
| `nameIdx` (u16, 16) → name table | `n` (name) | **Record**: `stname_label`/`full_street_name` L617 | Street-name blades (`signage.ts`, `signText`) | OSM `name` |
| `mouthA`/`mouthB` (u8, 18/19) | not in v3 schema | **Rule**: junction mouth geometry | — | `segmentHit` slack |
| `segId` (u32, 20) | `sid` | **Record**: CSCL segment id L680 | Stable road id (replaces `osm:way:N`) | v2 road ids |
| `bike` (in-memory, L684) | not in v3 schema | **Record**: `bike_lane` | (Bike-lane paint if ever) | — |

## Landmarks

| Valdrada | v3 | Evidence | Renderer use | Fallback |
|---|---|---|---|---|
| `LANDMARKS` ids 8/9/10 + AR32C overrides | `landmarks[]` (`apollo-theater`, `hotel-theresa`, `acp-state-office`) | **Record**: `landmarkSpec.js` L17–19 canonical lat/lon; overrides L219–228 put 9/10 on the correct footprints (Theresa 51.5 m/12-storey footprint; State Office 88.9 m/19-storey). Verified: the override centroids project onto v2's landmark x/z to <1 m (Theresa (69.2,143.3) vs (69.2,144.2); SOB (196.2,92.4) vs (196.2,92.8)). Tile presence: PENDING E1 | `landmarkAccents` + building lookup by `buildingId` | v2 landmarks |
| `mode: 'decorate'` → negative `landmarkId` | keep v2 decorate behaviour | `compile.mjs` L1551 (`replace` vs `decorate` sign convention) | v2 never replaces massing; accent only | — |

## Furniture records (20 bytes; `furnitureOf` L126–139: `k`, `p0–p2`, `x`,`y`,`z`,`rot`)

v3 import rule (spec §5.2, G2 default "record-backed only"): `transit.subway` ← SUBWAY_ENTRANCE, `transit.shelters` ← BUS_SHELTER, new `furniture{hydrant,linknyc,bikeRack}` flat `[x,z,rot]`, `trees.census` ← record trees, `decor` only under a G2 opt-in.

| FURN `k` | Name | v3 disposition | Evidence (`compile.mjs`) |
|---:|---|---|---|
| 1 | TREE | `trees.census` — census rows are the record; TI14 avenue infill (L4603) clones a census neighbour's species and shares `p2: 1` (street tree / pit fence), so census vs infill is **not distinguishable in the byte** → carry the estimate bit | census `trees_*.csv` L4534–4535; species map L4515–4526, dbh L4527, `p2` L4528 |
| 2–3 | LAMP_COBRA / LAMP_CROOK | `decor` (G2) or drop | rule: spacing along carriageways, crook on historic L4466–4467 |
| 4 | HYDRANT | `furniture.hydrant` (record) | `hydrants.geojson` L4611 |
| 5–6 | SIGNAL_MAST / SIGNAL_PED | `decor` (G2) or drop | rule: `n.signal` junction test L1786, placed L3517–3519, L3590 |
| 7 | STREET_SIGN | `decor` (G2) or drop — v2 already builds blades | rule: corner bisector + name idx L3515 |
| 8–9 | LITTER / MAILBOX | `decor` (G2) or drop | rule: corner chance L3520–3521 |
| 10 | BUS_SHELTER | `transit.shelters` (record) | `shelters.geojson` L4612 |
| 11 | SUBWAY_ENTRANCE | `transit.subway` (record) | `subway.csv` L4614 |
| 12 | LINKNYC | `furniture.linknyc` (record) | `linknyc.geojson` L4613 |
| 13 | NEWSSTAND | not imported | no emission found |
| 14 | SCAFFOLD | `decor` (G2) or drop | rule: frontage L2208 |
| 15 | BENCH | `decor` (G2) or drop | campus benches L5241 (OSM-mapped on campus) |
| 16–19 | AWNING / BIKE_RACK / PHONE / PLANTER | 16–18 `decor` or drop; **17 BIKE_RACK → `furniture.bikeRack` (record)** `bikeracks.geojson` L4615 | awning L2198; phone/planter no emission found |
| 20–21 | STOOP / FIRE_ESCAPE | `decor` (G2) or drop — v2 builds both from `d` | rule L2162–2167, L2186, L2247 |
| 22 | WATER_TOWER | `decor` (G2) or drop — bit already in `d`/roofKind | DOB tank record L2081 + rule L2110 |
| 23–26 | ROOF_AC / ROOF_BULKHEAD / CHIMNEY_POT / STANDPIPE | `decor` or drop | roofscape runtime (roofEngine); standpipe L2216 |
| 27–32 | CONE / FLAG / MARQUEE / CHURCH_TOWER / CROSSING_BEACON / PARKING_METER | not imported | marquee is the Apollo's authored accent; no street-level emissions for these in Harlem |
| 33–39 | (raw ids past `FURN`: lane glyphs, junction paint, bollards) | not imported | pushes at L3012, L3524–3528, L4477–4482 |

`p0`–`p2` semantics per kind are partially verified in compiler pushes (tree `p0` species / `p1` dbh cm L4519–4527; sign `p0`/`p1` name indices L3515; fire escape `p0` floors / `p1` floorH×20 L2186). **PENDING E1** for the remaining kinds — E1's decoder tests should pin the ones v3 actually imports (tree, hydrant, shelter, entrance, linknyc, bike rack).

## STYLE → class mapping

The G3 artifact lives in `docs/DESIGN_SYSTEM.md` §City. Summary: all sixteen Valdrada styles land on the seven existing classes — `brick` (0,1,2,7,10), `glass` (3,11), `civic` (4,8), `brownstone` (5), `plain` (6,13,14,15), `church` (9), `nycha` (12) — so no palette tokens are added and no `rgb` is imported. `vs` stays verbatim on the building record for provenance; `class` is the derived render look.

## `flags` → `d` bit order

Spec §5.2 fixes `d`'s order as nyc-mon's own: cornice, fire escape, stoop, water tower, storefront, setbacks, gable. Remap on import — do **not** copy BF's bit order:

| `d` bit | Meaning | From BF | From |
|---:|---|---|---|
| 0 | cornice | `BF.CORNICE` (2) | rule (classify) |
| 1 | fire escape | `BF.FIRE_ESCAPE` (4) | rule |
| 2 | stoop | `BF.STOOP` (64) | rule (placement) |
| 3 | water tower | `BF.WATERTOWER` (1) | rule + DOB tank record |
| 4 | storefront | `BF.STOREFRONT` (8) | rule |
| 5 | setbacks | `BF.SETBACKS` (16) | rule |
| 6 | gable | `BF.GABLE` (128) | rule |
| — | landmark | `BF.LANDMARK` (32) | record — carried by `landmarks[]`, never by `d` |

## Renderer consumption contract (for E3)

- Where a v3 fact exists it replaces the hash: `f`/`fh` set row pitch, `d` drives stoop/escape/cornice/tower, `sh` sets the storefront band, `fi` replaces `streetFace()`. Where it does not — v2 tiles, unmatched buildings — today's hash rules run unchanged (`facade-detail.ts` L25–44, `city-mesh.ts` L311–418).
- Geometry stays merged per material; `drawCalls` must not grow (N9 asserts it).
- `class` keeps meaning "material family": the glass-vs-masonry wall split at `city-mesh.ts` L314, cornice emission at L353–355.
- Landmark `terracotta` accent (`city-mesh.ts` L312) is keyed on the landmark, not the class — untouched.
- `e` bits are data, not renderer input: nothing visual keys on them.

## Open items for E1

1. Tile-level facts the compiler source cannot give: per-record field presence on the pinned tiles, record counts vs header lengths (N1), actual `p0`–`p2` meaning for the six imported kinds.
2. Building-id strategy per G1: footprint-overlap match rate to v2 `osm:way:N` ids; report before E2 bakes.
3. The `RW13` winW bridge (`tiledata.js` L76) and `BUILDING_OVERRIDES` application order in the ported decoder (N2 pins the landmark id/footprint asserts).
4. HF tag coverage of the origin square (spec §2 lists ~20 tiles, `t_1..5_-8..-5`; re-measure at the pinned tag).
