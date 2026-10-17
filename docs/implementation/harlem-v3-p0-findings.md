# Harlem v3 — P0 findings (E1 Decoder lane)

Written 2026-10-17. Sources read in full before any edit, per `docs/plans/harlem-v3-valdrada-prompt.md` §0.2:

- nyc-mon `main` @ `73733e4` (worktree `lane-v3e1` @ `24ab0fc`): `AGENTS.md`, `skills/README.md`, `docs/design/reference-roster.md`, `docs/implementation/city-world.md`, `packages/app/features/game/city-dataset.ts`, `city-data.ts`, `packages/core/world/transform.ts`, `world/city-mesh.ts`, `map-data-credit.ts`, `settings/settings-content.tsx`, `lobby/use-lobby-resume.ts`, `world/walkability.ts`, `world/bundled-queries.ts`, `world/facade-detail.ts`, `world/surfaces.ts`, `world/geometry.ts`, `world/windows.ts`, `world/street-props-layout.ts`, `world/synthetic-tile.ts`.
- Valdrada `v0.4.0` = `2724c79` (read-only clone at `~/src/valdrada`): `README.md`, `LICENSING.md`, `ACKNOWLEDGEMENTS.md`, `CITATION.cff`, `LICENSE`, `client/DATA_SOURCES.md`, `client/src/world/tiledata.js` (139 lines), `client/src/shared/geo.js` (85), `client/src/shared/landmarkSpec.js` (330), `client/src/city/tk/tkOverrides.js` (38), and `client/tools/pipeline/compile.mjs` (6,125 lines) — the record writers at L5806–5907, followed back to the loaders at L206–701, the classifier input at L1510–1586, party walls L1588–1618, the building record assembly L2031–2093, road record assembly L3016–3039, furniture passes L2100–2250, L3510–3590, L4430–4615, L4634+, `buildTerrain`/`sampleGrid` L1017–1103, plus `binio.mjs` (the byte layout) and `client/src/world/streamer.js` (how the client fetches).

The `ecc:*` plugin is not installed in this checkout; this subagent ran the E1 lane directly.

## 1. Tile coverage — verified

Valdrada near tiles are 512 m squares indexed `t_<tx>_<tz>` over its own plane
(`geo.js` L2–18: `LAT0` 40.7831, `LON0` −73.9712, `M_PER_DEG_LON` = 111,320·cos(`LAT0`) = 84,290.1 m/deg,
`M_PER_DEG_LAT` = 111,132). The nyc-mon origin (−73.94975, 40.81005) projects to Valdrada (1808.0, −2995.0).

| Region | Tiles |
|---|---|
| The baked square, `extentMeters` 850 (`data/harlem-apollo.json` L1) | x 1..5 × z −8..−5 = **20 tiles** |
| +40 m road-clip margin (`build.mjs` clips roads to extent+40) | same 20 tiles |
| The 2,000 m schema limit (`city-dataset.ts` L127 `MAX_TILE_RADIUS_METERS`) | x −1..7 × z −10..−2 = 81 tiles |

The spec's "20 near tiles (`t_1..5_-8..-5`)" is correct **for the actual tile** — the wording "plus the 2000 m
radius limit" in §5.1 reads as the schema cap, not the fetch set; the square itself is 850 m. `fetch.mjs` computes
the tile set from `extentMeters` (with the 40 m margin), so it stays right if the bake grows. All three Harlem
landmarks, including the corrected AR32C points, sit on tile `t_3_-6`.

Hugging Face path verified: `Content/tiles/t_X_Y.bin` and `Content/tiles/manifest.json` under
`datasets/mehmetkeremturkcan/valdrada` at tag `v0.4.0`; resolve URLs return 302 → CDN, no auth.

## 2. Record vs rule — the fields this lane decodes

Format (`binio.mjs` L4–22, `tiledata.js` L44–57): `u32` magic `0x43544C31`, `u32` header length, JSON header
(`v`, `tx`, `tz`, `origin` = `[tx·512, tz·512]`, `names`, `nodes`, `res`, optional `railCuts`), then typed-array
sections, each 4-byte aligned. `header.sections` entries carry `name`, `type` (typed-array constructor name),
`offset` in the section blob (padding included), `bytes`, `length`.

### Buildings — `bldg` section, 44 bytes/record (writer `compile.mjs` L5806–5825; reader `tiledata.js` L59–84)

| Field | Written from | Record or rule |
|---|---|---|
| `start`, `len` | `bldgXZ` pair index + vertex count, ring vertices tile-local (L2031–2032) | **Record** — DOITT Building Footprints polygon (L363–384, `5zhs-2jue`); OSM `out geom` gap-fill (L472–493) |
| `landmarkId` | containment then nearest-fallback (L1547–1573); `+id` = replace, `−id` = decorate | Rule over `landmarkSpec.js` `LANDMARKS` points (L6–111); read-time overrides may rewrite it (`tiledata.js` L40) |
| `baseY` | `ground_elevation`×0.3048 (L401), then FLAT rules (L1509, L2012–2028, write L2067) | Record-seeded (DOITT), rule-adjusted. Shipped tiles are FLAT: `TERRAIN !== 'real'` default (L36), so `baseY` ≈ `BASE_Y`+0.28 = 3.52 m, not real elevation |
| `height` | `height_roof`×0.3048 (L388); OSM `height`/`building:levels`×3.4+1 in gap-fill (L535–539); sanity caps (L392–400); low fallback `4+hash·4` (L406) | Record (DOITT `height_roof`) with rule fallbacks |
| `floors` | `min(255, c.floors)` (L2068); `classify` seeds PLUTO `numfloors` then sanity-adjusts (`classify.mjs` L84–89) | Record-seeded (PLUTO `64uk-42ks`), rule-adjusted |
| `style` | `c.style` (L2068) from `classify()` over cls/year/floors/height/area/onAvenue/histDist/district/boro + FISP + OSM colour (`classify.mjs`) | **Rule** (facade typology; `STYLE` 0–15, `geo.js` L32–79) |
| `r`,`g`,`b` | `colorJitter(c.color, rnd, 9)` (L1540); `c.color` from classify/FISP material (L1526)/OSM `building:colour` (L1527)/overrides (L285) | Rule over records + hash jitter. G3 default: do not import |
| `roofKind` | classify + overrides (bits 0–2 shape; 3–4 membrane, L286 + `tiledata.js` L39) | Rule |
| `flags` (`BF`) | classify bits + `LANDMARK` on containment (L1552) + overrides (L287–288; `geo.js` L82–85) | Rule |
| `lit` | `c.lit` (L2088), a classify constant | Rule |
| `floorH` | `c.floorH` (L2089) | Rule |
| `winW` | `c.winW` (L2089); read-time RW13 bridge rewrites ROWHOUSE ≥2.3 → 1.75 (`tiledata.js` L7–8, L76) | Rule (+ read-time bridge, kept in the port) |
| `storeH` | `c.storeH` (L2089) | Rule |
| `blind` | party-wall adjacency bitmap (L1588–1618) | Rule |
| `area` | footprint m² of the kept ring (L405 `bestA`, clamped 65,000 at write L5823) | Record-derived (geometry measure) |
| `colorVar` | `(rnd()·255)|0` seeded on centroid (L1541, L1515) | Rule (seed) |
| `frontIdx` | best street-facing edge score (L2049–2060); written `+1`, 0 = none (L5824); read back `−1` (`tiledata.js` L79) | Rule over CSCL geometry |

### Courtyards — `bholes` section, 12 bytes/record (writer L5830–5840; reader `tiledata.js` L85–107)

`b` = parent building index; `start`,`len` = `bldgXZ` pair index/count (vertices sit right after the parent's
outer ring, L2038–2039); `flags` bit 0 = enclosed light court; `area` = m² in 4 m² units.
**Record geometry** (DOITT inner rings L387; OSM multipolygon `inner` L493) filtered by CY12 rules
(L296–320: ≥9 m², mean width ≥1.8 m, ≤6 courts, ≤40 vertices).

### Roads — `roads` section, 24 bytes/record; `roadVerts` f32 triplets, tile-local (writer L5841–5857, L3023–3024; reader `tiledata.js` L108–125)

All from **CSCL** (`streets_<boro>.geojson`, `inkn-q76z`, loaded L603–690). `start` = vertex index into
`roadVerts` (n/3, L3023), `len` = vertex count; the polyline is cut per tile (L3016–3039).

| Field | Written from | Record or rule |
|---|---|---|
| `pts` (`roadVerts`) | CSCL centreline projected, simplified 0.4 m (L667–668) | **Record** |
| `rclass` | pedPath 5, pedStreet 1–2, rw 2→3, rw 9→4, rw 10→6, width ≥13.5→2 else 1 (L685) | Rule over `rw_type` + `streetwidth` |
| `noTraffic` (bit 7) | `pedStreet` (L650–652, L681) | Rule over `trafdir`/`rw_type` |
| `oneway` | `trafdir` FT→1, TF→−1 (L623) | **Record** |
| `width` | `streetwidth` ft→m, clamped 7–45 (L619–620); pedStreet ≥15 or 18.3 (L653); pedPath ≤3.5 (L680) | Record-seeded, rule-adjusted |
| `lanes` | `number_travel_lanes`, fallback `width/3.6−1` (L621) | Record with rule fallback |
| `park` | `number_park_lanes`; 0 for pedStreet (L622, L680) | Record |
| `level` | `from/to_level_code` → ramp units; 255 = in a cut (L624–629, writer L5851) | Rule over record |
| `speed` | `posted_speed`, fallback 50/25 (L630) | Record with rule fallback |
| `nameIdx` | `stname_label`/`full_street_name`/`street_name` → per-tile `names` table (L617, L1932–1935) | **Record** |
| `segId` | `physicalid` ‖ `objectid` (L610, L680) | **Record — a stable source id** |
| `mouthA`, `mouthB` | junction mouth per end, 0.25 m units (writer L5853–5855) | Rule |

### Furniture — `furn` section, 20 bytes/record (writer L5858–5868; reader `tiledata.js` L126–138)

`k`, `p0`–`p2`, `x`,`z` tile-local, `y` absolute world height, `rot` radians.
Record-placed kinds (`addPoints`, L4490–4533; `y = sampleTerrain + FURN_LIFT`):

| `FURN` kind | Source file → dataset | Params |
|---|---|---|
| `TREE` (1) | `trees_<boro>.csv` → 2015 Street Tree Census `uvpi-gqnh` (L4534–4535) | p0 species code 0–12 rule-mapped from `spc_common` (L4517–4526), p1 `tree_dbh` (L4527). p2 marks placement: **1 = census point or TI14 avenue infill derived from a census row** (L4528, L4603), 2 = backyard yard (L4723), 4 = planted median (L4434), 0 = other generated (park scatter L4863, campus L5224). G2-safe set is p2 == 1 |
| `HYDRANT` (4) | `hydrants.geojson` → NYCDEP `5bgh-vtsn` (L4611) | p0–p2 = 0 |
| `BUS_SHELTER` (10) | `shelters.geojson` → `t4f2-8md7` (L4612) | 0; `rot` = nearest-road direction, a rule over record (L4500–4501) |
| `SUBWAY_ENTRANCE` (11) | `subway.csv` → MTA entrances `i9wp-a4ja` (L4614) | 0; same `rot` rule |
| `LINKNYC` (12) | `linknyc.geojson` → `s4kf-3yrf` (L4613) | 0; same |
| `BIKE_RACK` (17) | `bikeracks.geojson` → CityRacks `592z-n7dk` (L4615) | 0; same |

Generated kinds (G2 default = import none): lamps 2/3 (L4454–4484), sign pole **k:34** (L4477, undocumented —
past `FURN`'s end at 32), dumpster **k:38** (L4482), signals 5/6, street sign 7 (`p0`/`p1` = name idx pair,
L3515), litter 8, mailbox 9, viaduct pier **k:33** (`p0` = lift, `p1` = width, L3012), scaffold 14, bench 15,
awning 16, stoop 20, fire escape 21 (p0 = floors, p1 = `floorH`×20, L2186), water tower 22 (p0 = building height,
p1 = seed, L2110), standpipe 26, plus the rest of `FURN` (`geo.js` L22–29) that the passes emit.

### Terrain — `terrain` section

`(res+1)²` f32 nodes over the 512 m square; `res` in the header (`resOf`, L1014: 128 for tx 0–2 ∧ tz −7..−4
or pier tiles, else 32). Shipped tiles are FLAT: land nodes are `BASE_Y` = 3.24 m (L36–39, L1027) apart from
Columbia pads; water −9/−3.5. `resOf(1..2, −7..−5)` = 128 — Harlem's central tiles carry the fine grid.
G4 report value (the "elevation range Valdrada has in the square") comes out of `decode.mjs`'s summary.

## 3. `building.id` consumers — the G1 report

Valdrada buildings carry **no source id**: the 44-byte record is enumerated field by field at `tiledata.js`
L68–80 and `compile.mjs` L5809–5825 — no BIN, BBL or OSM id anywhere (the BIN exists in the compiler,
`b.bin` L369, but is never written to the tile). Valdrada **roads** do carry `segId` = CSCL `physicalid`
(L610, L680, writer L5856).

Every consumer of `building.id` in nyc-mon:

| Consumer | File:line | Uses it for | Breaks if ids change? |
|---|---|---|---|
| Wall tone pick | `city-mesh.ts` L236–239 `hashUnit(`${id}:tone`)` | WALL_TONES family member | Cosmetic reseed only |
| Brightness variation | `city-mesh.ts` L311 `hashUnit(building.id)` | ±8 % wall tint | Cosmetic |
| PBR surface family | `city-mesh.ts` L319 → `surfaces.ts` L73 `hashUnit(`${id}:surface`)` | aRoughMetal pick | Cosmetic |
| Neon colour / trim share | `city-mesh.ts` L332–333 (`neonKeyFor` L261, `:trim` hash) | neon placement | Cosmetic |
| Stoops | `city-mesh.ts` L358–359 → `facade-detail.ts` L26 | has/position | Cosmetic (v3 `d` bit may replace) |
| Fire escapes | `city-mesh.ts` L368–371 → `facade-detail.ts` L33 | has/bay | Cosmetic |
| Awnings | `city-mesh.ts` L378–379 | has/tone | Cosmetic |
| Shop signs + words | `city-mesh.ts` L383–390 → `facade-detail.ts` L170, L175 | has/panel/words | Cosmetic |
| Billboards | `city-mesh.ts` L404–406 | has/pair | Cosmetic |
| Water towers | `city-mesh.ts` L411–415 → `facade-detail.ts` L39 | has/scale/spot | Cosmetic |
| **Landmark join** | `city-mesh.ts` L280, L310 `landmarkByBuilding.get(building.id)`; schema `city-dataset.ts` L169, L267–271 | **The `landmarks[].buildingId` reference must exist** | Structural — must be re-issued for whatever ids v3 assigns |
| Uniqueness invariant | `city-dataset.ts` L227–232 (`claim`) | ids unique per collection | Structural — any scheme must keep uniqueness |
| Lit-window pattern | `windows.ts` L24–38 via the wall-colour seed (`city-mesh.ts` L311→ vertex colour) | lit share | Cosmetic (transitive) |
| **World saves** | — none — | saves key on `(datasetId, datasetVersion)` + position only (`world-save.ts` L47, `world-snapshot.ts` L112, `use-lobby-resume.ts` L46–48) | **Not a consumer — ids may change freely** |
| Fixtures/tests | `synthetic-tile.ts` L15 `b:1`; `city-dataset.test.ts` L40 dangling-landmark test | test data | none |

Same story on the other collections: `road.id` and `area.id` feed only cosmetic hashes
(`city-mesh.ts` L428, L436, L441, L446; `street-props-layout.ts` L120–132 for parked cars) and the walkability
dedup (`walkability.ts` L168, L235, L247 — internal, id-agnostic).

**Answer for Mike (G1):** rekeying building ids costs nothing structural — no save, no join outside
`landmarks.buildingId`, which v3 rewrites anyway. Option (b) (match v2 OSM ways by footprint overlap, keep
`osm:way:N` on matches, `vd:<tag>:<tile>:<index>` otherwise) additionally preserves the hash-seeded look of
every matched building and the three existing landmark joins (`osm:way:271798914`, `:271798882`, `:271798907`,
`city-world.md` L56) **if** the match lands on the same footprint. Valdrada's Harlem footprints come from DOITT,
not OSM, so they will not equal the v2 OSM rings — overlap matching (option b) rather than id reuse is required;
a match-rate report ships with the merge. **Default taken: G1(b), pending Mike.**

## 4. Gates — defaults recorded (each "default taken, pending Mike")

| Gate | Default taken |
|---|---|
| G1 | (b) OSM-way match + `vd:` fallback ids; consumer report above; match-rate report is E2's |
| G2 | Record-backed furniture only (tree census, hydrant, shelter, subway, LinkNYC, bike rack) |
| G3 | Palette; `r`,`g`,`b` decoded but not imported |
| G4 | Keep today's flat ground (`walkability.ts` L102 returns 0); Valdrada elevation range reported from `terrain` |
| G5 | Stay bundled; v3 bytes + parse ms reported by E2 |
| G6 | `harlem-apollo-<YYYYMMDD>` v3, identity position migration |
| G7 | Draft attribution: OSM (ODbL) + Valdrada (MIT code / ODbL tiles, BibTeX `@software{turkcan2026valdrada}`) + the NYC Open Data sets §2 names |
| G8 | `v0.4.0` = `2724c79`, HF tag verified |
| G9 | Facts only: tiles are ODbL 1.0 (`LICENSING.md`), attribution "© OpenStreetMap contributors" + Valdrada citation; MetaHuman terms apply to `Content/models/peds24/` only — nothing imported touches them |

## 5. Spec-vs-reality surprises

1. `tooling/city/README.md` **does not exist** — §0.2 lists it as a read and §11 as an update target. It must be
   created, not edited.
2. `tooling/city/.cache/` is **not** in `.gitignore`, though `city-world.md` L11 calls it git-ignored. Fixed in
   this lane.
3. §0.2's "section list near L5880" in `compile.mjs` is accurate (L5879–5906, of 6,125 lines).
4. `tiledata.js` is only 139 lines — the whole reader fits in one file; the port covers `parseTile`,
   `buildingsOf`, `holesOf`, `roadsOf`, `furnitureOf`, `inRing`, `applyReadOverride`, `rw13WinW`.
5. **landmarkId sign convention**: `+id` = replace, `−id` = decorate (`compile.mjs` L1551, L1571). The AR32C
   corrections write `−9`/`−10` (`landmarkSpec.js` L221–224), so N2 must compare `Math.abs(landmarkId)`.
6. **The AR32C overrides only fire in a browser**: `landmarkSpec.js` L217–229 gates the push on
   `typeof location !== 'undefined'` — plain-node reads skip them. The port applies the full default-parameter
   override set unconditionally (that is the decoder's effective behaviour).
7. `landmarkSpec.js` pulls `TW_TOWERS` from `src/city/tk/tkOverrides.js` and mutates `LANDMARKS` (the TW fix at
   L114–117) — the port inlines the post-mutation values.
8. `FURN` tops out at `PARKING_METER: 32`, but the compiler also emits **k:33** (viaduct pier, L3012),
   **k:34** (sign pole, L4477), **k:35–37 and k:39** (street-corner dressing, L2209–2210,
   L3524–3528) and **k:38** (dumpster, L4482) — undocumented kinds; decode passes them through by `k`.
9. Roads carry a stable source id (`segId` = CSCL `physicalid`) — buildings do not.
10. Header carries `names` (road-name table), `nodes` (traffic graph — not imported), `res` (terrain
    resolution), optional `railCuts`. Only `names` is needed downstream.
11. `bldgXZ` and `roadVerts` are **tile-local**; furniture `x`,`z` tile-local but `y` world-absolute
    (writer L5864–5866). `baseY` on FLAT tiles is a pavement datum (~3.52 m), not real elevation.
12. `tiledata.js`'s `near` filter uses `org ±150/662 m` (L65) — override points may sit on a neighbouring
    tile's copy of the same footprint; tiles decode independently.
13. Each feature lands on exactly one tile (`tileFor(x, z)`); a footprint's vertices may still reach past the
    tile edge, which is why `buildingsOf`'s `near` filter checks override points in `org −150 … org+662`
    (`tiledata.js` L65). A `BUILDING_OVERRIDES` point on a neighbouring tile's footprint does not fire here —
    it fires when that tile is decoded.

§2 "not yet verified" items now verified: record-vs-rule per field (§2 table above), `furn` params (`§2`
furniture table), no section carries a building source id (roads have `segId`), `cityGroundHeight` is flat
(`walkability.ts` L102). Remaining for later lanes: exact v3 byte size and device parse time (P2/P5).

## 6. P1 outcome (what this lane shipped and measured)

- `tooling/city/valdrada/fetch.mjs` downloads exactly the 20 covering tiles (+manifest) from
  `huggingface.co/datasets/mehmetkeremturkcan/valdrada/resolve/v0.4.0/Content/tiles/` into
  `tooling/city/.cache/valdrada/` (git-ignored), refuses a SHA-256 mismatch against the recorded pin, and
  writes committed `tooling/city/valdrada/pins.json` (tag `v0.4.0`, commit `2724c79`, per-file sha256+bytes).
- `tooling/city/valdrada/decode.mjs` is a field-faithful port of `tiledata.js` (parse incl. the 4-byte
  aligned header and unknown-section-type rejection; the 44/12/24/20-byte record readers; `inRing`;
  `applyReadOverride`; `rw13WinW`), carries the full 100-entry browser-default `BUILDING_OVERRIDES` set,
  and reprojects via `unproject` → `projectToScene` at 0.1 m.
- Fetched: 20 tiles, **24,910,544 bytes** (195,382-byte manifest). Decoded: **5,267 buildings**,
  **118** courtyard holes, **1,255** road segments, **23,635** furniture records.
- Record-typed furniture (`G2` set): 7,571 census/infill trees (p2==1), 1,200 hydrants,
  100 shelters, 45 subway entrances, 88 LinkNYC, 879 bike racks. (Tree p2: 0=743 generated,
  2=1,381 yard, 4=47 median — excluded.)
- Landmarks decoded: ids 1–7 and 13 as `+` (Columbia replaces), `−14` (Whittier), `−12` (Schomburg),
  **`−8`, `−9`, `−10`** on t_3_-6 — the Apollo (−8 from the compiled tile, lobby STOREFRONT cleared by
  AR32C), the corrected Theresa and State Office footprints.
- Terrain: the six tx∈{1,2}, tz∈{−7..−5} tiles carry `res` 128 (the `resOf` fine grid); the rest 32.
  Land is flat `BASE_Y` = 3.24 m everywhere (nodes read 3.2; `baseY` ≈ 3.52); t_1_-7 also carries a −9 m
  water node — G4's "elevation range" in the square is effectively 3.24 m land.
- Tests `decode.test.mjs` (6 assertions-sets, `node --test`): N1 round-trip/counts/magic/section rejection
  — pass; N2 landmark overrides — pass; N3 0.1 m reprojection + >0.5 m naive counterexample — pass;
  N4 pin integrity — pass.
