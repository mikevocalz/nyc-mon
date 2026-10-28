# Provenance and licence audit — Harlem tile v3 (`harlem-apollo-20261017`)

Lane F2, 2026-10-17, `lane-v3f2` on the v3 stack (E1 decoder `7cbe12d` → E2 bake
`8023b8b` → E3 renderer `23ec560` → F1 device `2944424`). Scope:
`docs/plans/harlem-v3-valdrada-prompt.md` §0.5 deliverables — the `sources[]`
list in `packages/app/features/game/data/harlem-apollo.json`, the Valdrada code
port, ODbL compliance, and the Living City asset ledger.

Verdicts: **VERIFIED** (checked against the registry or the pinned bytes
myself), **REPORTED-ONLY** (claim is accurate as written but rests on a
scouted/copy-deck source, or is a deliberate naming choice), **PENDING-MIKE**
(spec G9: facts reported, the call is his).

## 1. Valdrada data provenance — `sources[]` per entry

Method: each `data.cityofnewyork.us` / `data.ny.gov` id was resolved live
against the Socrata catalog API on 2026-10-17 (`/api/views/<id>.json` — name
and agency quoted below are the registry's own). Cross-checked against
Valdrada `client/DATA_SOURCES.md` @ `v0.4.0` and E1's record-vs-rule table
(`docs/implementation/harlem-v3-p0-findings.md` §2).

| # | `sources[]` entry | Socrata registry check | Fields we take | Verdict |
|---|---|---|---|---|
| 1 | `© OpenStreetMap contributors`, ODbL-1.0 → openstreetmap.org/copyright | n/a (Overpass API endpoint in `url`; the v2 fetch convention) | Areas, sidewalk/crossing/cycleway/footway ways, building ids and name donors where a v2 overlap match lands (G1b), landmark names as fallback | **VERIFIED** — the attribution string is verbatim the notice ODbL requires |
| 2 | Valdrada `v0.4.0` (commit `2724c79`), Mehmet Kerem Turkcan — ODbL-1.0 | Clone `~/src/valdrada` is `v0.4.0` = `2724c7938f20e068748ad1fd66e907d2bc662e3e`; `LICENSING.md`: the compiled city (tiles) is ODbL 1.0 | Buildings, roads, landmarks, transit, record furniture | **VERIFIED** |
| 3 | NYC Building Footprints (DOITT) `5zhs-2jue` | Registry name "BUILDING" (Building Footprints); agency now **OTI** — DOITT merged into it in 2022 | Footprint polygons, `height_roof` (record height), `ground_elevation` | **REPORTED-ONLY** — "(DOITT)" is the legacy agency name; current registry publisher is OTI. Harmless, but "(OTI, formerly DOITT)" is the precise form if Mike wants it |
| 4 | PLUTO (NYC Planning) `64uk-42ks` | Registry name "Primary Land Use Tax Lot Output (PLUTO)", agency DCP | `numfloors` (record floors), `bldgclass`/`yearbuilt`/`histdist` as classifier inputs | **FIXED THIS LANE** — was "MapPLUTO", the spatial product; the cited id and Valdrada's `pluto_<boro>.csv` are the tabular PLUTO. The tile's own `notes` already said "PLUTO numfloors". Fixed in `build.mjs`, the baked JSON, `map-data-credit.ts`, ADR 0021 |
| 5 | DOB NOW Facades compliance filings (FISP/Local Law 11) `xubg-57si` | Registry name "DOB NOW: Safety – Facades Compliance Filings", agency DOB | Exterior wall material — a classifier input to `vs` only | **VERIFIED** (paraphrase of the registry name; `query` honestly scopes it to an input, and `vs` stays an estimate per the `e` bits) |
| 6 | NYC Street Centerline (CSCL) `inkn-q76z` | Registry name "Centerline", agency OTI | Road geometry, width, lanes, `trafdir` oneway, `posted_speed`, names, `physicalid` → `sid` | **VERIFIED** — CSCL is the dataset's common name |
| 7 | 2015 Street Tree Census (NYC Parks) `uvpi-gqnh` | Registry name "2015 Street Tree Census - Tree Data", agency DPR | `trees.census` (Valdrada TREE records with `p2==1`) | **VERIFIED** |
| 8 | NYCDEP Citywide Hydrants `5bgh-vtsn` | Registry name "Hydrants", agency DEP | `furniture.hydrant` | **VERIFIED** |
| 9 | NYC Bus Stop Shelters `t4f2-8md7` | Registry name "Bus Stop Shelters", agency DOT | `transit.shelters` | **VERIFIED** |
| 10 | LinkNYC Kiosks `s4kf-3yrf` | Registry name "LinkNYC Kiosk Locations", agency OTI | `furniture.linknyc` | **VERIFIED** |
| 11 | NYC DOT Bicycle Parking (CityRacks) `592z-n7dk` | Registry name "Bicycle Parking", agency DOT | `furniture.bikeRack` | **VERIFIED** |
| 12 | MTA Subway Entrances and Exits (2024) `i9wp-a4ja`, **data.ny.gov** | Registry name "MTA Subway Entrances and Exits: 2024", agency MTA | `transit.subway` | **VERIFIED** — the `license` string is "NY Open Data Terms of Use" (state portal), correctly distinguished from NYC Open Data |

**A1's MTA flag — resolved.** `docs/COPY_DECK.md` on `lane-v3a1` warned that a
shared "View the record on NYC Open Data" link label would mislabel the MTA
row. The shipped implementation sidesteps it: `settings-content.tsx` L88–97
renders each source's own `license` string as the link label, so the MTA row
reads "NY Open Data Terms of Use" and links `data.ny.gov`. No fix needed;
the residual nit is that `licenseUrl` is the portal root rather than a terms
page — REPORTED-ONLY (data.ny.gov publishes no canonical TOU URL; the dataset
deep-link already sits in `url`).

**Where attribution surfaces.** Settings → "Legal & credits" renders every
`CITY_MAP_SOURCES` row (`map-data-credit.ts`) with its licence link;
`map-data-credit.test.ts` asserts the list equals the bundled tile's
`sources[]`, and that the game screen mounts no attribution HUD. The credit
caption still reads "Map data" — A1's deck drafts "City data" for v3; that
copy swap is the outstanding P4/G7 item.

**Checked and correctly omitted from `sources[]`:** Forestry Tree Points
(`hn5i-inap` — Valdrada applies it at runtime via `tree_forestry.json`, never
compiled into the tiles we decode, so the 125th St box's live-tree adjustment
is *not* in our bake), Parks Properties `enfh-gkve`, Borough Boundaries
`gthc-hcne`, railroad lines `anc7-97cy`, the planimetric ground-fill sets, the
2017 LiDAR DEM, NYSERDA solar, green-roof inventories, USGS 3DEP, NAIP and
NYS ITS imagery, and the backdrop sources — all are either inputs to
procedural furniture not imported (G2), Central-Park/backdrop-scoped,
runtime-only modules, or not read by the compiler revision that built these
tiles. One honesty note: OSM content *inside* the Valdrada tiles (gap-fill
footprints; colour tags, which G3 does not import) is covered by entry 1's
"© OpenStreetMap contributors" notice — the single OSM row does double duty
for our own Overpass fetch and OSM data embedded upstream.

## 2. Valdrada code provenance — the decoder port

- `tooling/city/valdrada/decode.mjs` is a port of MIT-licensed upstream code
  (`tiledata.js`, `geo.js`, `landmarkSpec.js`, `tkOverrides.js` @ `v0.4.0`).
  The upstream `LICENSE` is verbatim MIT, "Copyright (c) 2026 Mehmet Kerem
  Turkcan" — **VERIFIED** against `~/src/valdrada/LICENSE` at the pinned
  commit.
- The port's header kept the copyright line and named the licence but did
  **not** reproduce the MIT permission notice, which MIT requires in
  substantial copies. **FIXED THIS LANE:** `tooling/city/valdrada/LICENSE.valdrada`
  now carries the verbatim upstream text (diffed byte-for-byte against the
  clone), and the header points at it.
- `pins.json` integrity: all 21 files (20 tiles + `manifest.json`) present in
  the lane-v3e1 worktree cache hash-match the recorded `sha256` and byte
  counts — 21/21 OK, 0 mismatched, 0 missing. The committed `decode.test.mjs`
  N4 assertion covers the same check. **VERIFIED.**
- Upstream licence inventory vs what we imported: tiles ODbL 1.0 (imported —
  covered above); code MIT (imported — notice now complete); CARLA CC BY 4.0
  models, Rocketbox MIT, MetaHuman-flagged pedestrian bank, textures CC0 —
  **nothing imported**, those licences do not attach. E1's G9 fact stands.
- `fetch.mjs` pins `v0.4.0`/`2724c79` on the HF dataset repo; resolve URLs
  302→CDN, no auth — consistent with E1's finding. **VERIFIED.**

## 3. ODbL compliance — the honest answer

Facts (ODbL 1.0 text + Valdrada's own `LICENSING.md` reading, which matches):

- The baked `harlem-apollo.json` is a **Derivative Database** (ODbL 4.1(b)) —
  it is produced from the ODbL-licensed Valdrada tiles and our OSM extract,
  and it is redistributed inside the shipped app bundle. It is *not* merely a
  Produced Work: we ship data, not only rendered imagery.
- **§4.3 notice** — attribution of the source databases. Satisfied: the
  Settings credit carries "© OpenStreetMap contributors", names ODbL 1.0, and
  links both openstreetmap.org/copyright and the ODbL text; the same strings
  live in the tile's `sources[]` metadata. **VERIFIED.**
- **§4.4(a) share-alike** — a Derivative Database must itself be made
  available under ODbL 1.0 (or a compatible licence) with a notice saying so.
  ~~Nothing in the tile JSON states that `harlem-apollo.json` *itself* is
  ODbL~~ — **DONE 2026-10-18**: the tile now carries top-level `license`,
  `licenseUrl` and `licenseNotice` fields declaring it a Derivative Database
  offered under ODbL 1.0 (`build.mjs` emits them so every future bake keeps
  the declaration; `city-dataset.ts` schema+type carry them; the Settings
  credit renders a `CITY_MAP_DERIVED` row asserted equal to the tile fields
  in `map-data-credit.test.ts`). The grant is what ODbL requires for shipping
  the derived tile at all — the alternative to declaring it is not shipping
  the dataset. Mike should still ratify the licence position; the Produced
  Works question below remains his.
- **Produced Works** (screenshots, videos, rendered frames) need
  "© OpenStreetMap contributors" in a notice "reasonably calculated" to reach
  viewers. The Settings-only credit is a defensible but thin reading — the
  OSMF guideline contemplates attribution where users encounter the work, and
  `map-data-credit.test.ts` actively *asserts no in-game HUD label*.
  **PENDING-MIKE** — whether the Settings surface suffices or the game screen
  needs a small persistent/menu attribution.

## 4. Living City asset ledger (`docs/living-city/asset-ledger.md`, `lane-lcaudit`)

The file does not exist in this worktree; audited `origin/lane-lcaudit:docs/living-city/asset-ledger.md`
plus `scout-C-assets.md`. Every entry's hedge is appropriate; none overclaims.

| Entry | Ledger claim | Verdict |
|---|---|---|
| Kenney Car Kit GLBs (5 rows) | "CC0 (KENNEY_LICENSE.txt)" **pending** — "re-fetch kenney.nl + hash"; scout flags the licence file was bundled by fable's author, not Kenney | **REPORTED-ONLY** — correctly hedged; the `pending` gate is the right one |
| `vehicle.taxi.city`, `vehicle.bus.city`, `signal.head.nyc`, `crowd.person.starter` | three.js generators, MIT, "already vendored" | **VERIFIED** — three@0.186.1 is installed; MIT is its licence |
| `lamp.head.hero`, `texture.ref.ambientcg` | Poly Haven / ambientCG CC0 per fable CREDITS | **REPORTED-ONLY** — credited copy, "optional/reference" role is honest |
| `person.rigged.universal`, `anim.set.locomotion` (Quaternius) | "CC0 per page" **pending** — "verify downloaded zip license / free-tier contents" | **REPORTED-ONLY** — exact-package verification is correctly deferred |
| `person.rigged.kenney` | "CC0 per publisher" **pending** — "verify bundled license" | **REPORTED-ONLY** |
| `anim.proto.mixamo` | "Adobe terms — **not CC0**, no raw redistribution", **blocked for shipping** | **VERIFIED** as stated — explicit non-CC0, shipping blocked |
| `body.procedural.night-street` | night-street `src/world/cars.ts` @ `333f064`, MIT, "ready (code port)" | **REPORTED-ONLY** — the MIT claim was read from the scouted checkout's LICENSE (scout-C §2), not independently re-verified against upstream; under the ledger's own rule a `ready` row implies exact-revision re-verification, so this is the one row where `ready` runs ahead of the stated process — flag to the ledger owner, not a misattribution |
| Fable Cities code ports | Scout table: "MIT — port, keep attribution note" | **REPORTED-ONLY** — stated as scouted (LICENSE read in the reference clone), not re-verified; ledger carries no fable-derived asset row at all |

No ledger edits needed.

## 5. Cross-check of the v3 chain's docs

| Doc | Licence/provenance statements | Verdict |
|---|---|---|
| `docs/adr/0021-city-dataset-v3-valdrada.md` | OSM ODbL named correctly; "twelve sources"; `e`-bit honesty ("style and detail … read as estimates") | Consistent; the same MapPLUTO→PLUTO fix applied at L7 |
| `docs/implementation/harlem-v3-p0-findings.md` (E1) | Record-vs-rule table, G9 facts, ODbL-on-tiles | Consistent throughout |
| `docs/performance/v3-f1-2026-10-17.md`, `docs/DEVICE_CHECKS.md` | No licence claims | Clean |
| `docs/HANDOFF.md` | No v3 licence claims | Clean |
| `docs/implementation/city-world.md` | Still the v2 doc (spec §11's v3 rewrite is outstanding); its last line claimed a `MapAttribution.tsx` HUD that no longer exists | **FIXED THIS LANE** — now describes the real Settings surface; the v3 rewrite itself remains an open §11 deliverable. Its "foliage texture is CC0 (Quaternius)" claim predates v3 and stands flat — REPORTED-ONLY |
| `tooling/city/build.mjs` | Header comments: "Valdrada tiles © OpenStreetMap contributors + Mehmet Kerem Turkcan, ODbL 1.0"; `notes` strings in the baked JSON are precise about record vs rule | Consistent |
| `lane-v3a1` docs (parallel branch, not in this tree) | `COPY_DECK.md` credit strings: correct, MTA flag resolved as above. `DESIGN_SYSTEM.md` L260 calls `STYLE` "**record-backed**" | **Inconsistency to flag to A1's lane** — E1's table and ADR 0021 both classify `vs` as a compiler *rule over records* carrying no fact bit; "record-derived" is defensible, "record-backed" reads as a fact claim. Not fixed here (different branch) |
| `tooling/city/README.md` | Spec §0.2 read and §11 deliverable | Still missing (E1 flagged it; no lane has created it) — REPORTED |

No stray CC0 claims and no "raw Valdrada data" claims (rgb import,
photoreal peds, GLSL) anywhere in the v3 docs — the rejected-on-sight list
held.

## 6. Changes made in this lane

1. `packages/app/features/game/data/harlem-apollo.json`,
   `packages/app/features/game/map-data-credit.ts`,
   `tooling/city/build.mjs`, `docs/adr/0021-city-dataset-v3-valdrada.md`:
   "MapPLUTO (NYC Planning)" → "PLUTO (NYC Planning)" — the cited dataset
   `64uk-42ks` is the tabular PLUTO, matching the tile's own `notes`.
2. `tooling/city/valdrada/LICENSE.valdrada`: new file, verbatim upstream MIT
   text; `decode.mjs` header now points at it (MIT requires the permission
   notice in substantial copies, and the port is one).
3. `docs/implementation/city-world.md` last line: removed the stale
   `MapAttribution.tsx` HUD claim; describes the actual Settings credit
   surface and its test.

`node --test packages/app/features/game/map-data-credit.test.ts`: 3/3 pass
after the rename (the test pins credits == tile `sources[]`).

## 7. Escalated to Mike (PENDING-MIKE)

1. **ODbL §4.4 share-alike declaration** — state in the tile and/or docs that
   the derived `harlem-apollo.json` is itself offered under ODbL 1.0.
2. **Produced-Work attribution surface** — whether the Settings-only credit
   satisfies ODbL/OSMF expectations, or the game screen needs an in-view or
   menu-level "© OpenStreetMap contributors" notice.
3. **Publisher naming** — "(DOITT)" vs "(OTI, formerly DOITT)" on the
   Building Footprints row; cosmetic either way.
4. **`licenseUrl` for the MTA row** — `data.ny.gov` portal root today; dataset
   deep-link already sits in `url`.

Open follow-ups owned by other lanes (recorded, not mine to fix):
`tooling/city/README.md` still missing; `city-world.md` v3 rewrite still
pending; "Map data"→"City data" caption swap pending G7 copy approval; A1's
`DESIGN_SYSTEM.md` "record-backed" STYLE wording on `lane-v3a1`.
