# PR02 — Road & sidewalk topology sidecar

Living City PR stack row 02 (`docs/plans/living-city-prompt.md` §13). A
directed **lane graph + crosswalk graph** derived from the parsed Harlem v3
tile at dataset-load time. Pure data, pure functions — no three.js, no React
— so it runs under `node --test` and can later feed the sim on any thread.

## Scope

- Nodes = real junctions: endpoints of carriageway pieces clustered by
  union-find at `NODE_MERGE_METRES = 20` (a CSCL segment ends at the
  junction-box edge, not a shared point — a divided avenue meets 125th
  Street over a ~35 m box; Harlem blocks are ~60 m so 20 m merges real
  junctions without chaining blocks).
- `seg:` undirected carriageway records — one per road piece, carrying the
  v3 fields verbatim — the substrate lane edges derive from.
- Edges =
  - `lane:` directed carriageway lanes (one edge per travel lane per
    direction; geometry offset from the road centreline by `ribbon()`),
  - `walk:` sidewalk bands from each carriageway's recorded `s` width,
  - `xwalk:` crosswalk legs at junctions — an OSM `crossing` way's
    centreline where one passes through the node (632 on this tile), a
    synthesized corner-to-corner leg from road width + leg angle elsewhere,
  - `conn:` lane→lane connectors inside each node: every in→out pair except
    reversing onto the same piece (U-turns only at termini). Turn
    classification is geometric (`through`/`left`/`right`/`uturn`);
    signal-phase legality and the conflict matrix are **PR03**, so the
    `uturn` connectors that divided avenues generate across their medians
    stay as candidates to be pruned, not as asserted legal moves.
- Consumes v3 `l`/`ow`/`sp`/`sid` **verbatim** where present. Every derived
  value carries `inferred`/`…Inferred` with the rule name (spec §6):

  | rule | meaning |
  |---|---|
  | `oneway-two-way-default` | `ow` absent → two-way (NYC default) |
  | `lanes-arterial-default` | `l` absent on motorway…tertiary → 2/direction |
  | `lanes-local-default` | `l` absent on residential/living/service → 1/direction |
  | `lanes-split-odd` | odd recorded `l` on a two-way piece → odd lane forward |
  | `speed-nyc-25` | `sp` absent → 25 mph citywide default |
  | `xwalk-osm-crossing` | centreline adopted from an OSM crossing way; the node binding is ours |
  | `xwalk-corner-fallback` | no crossing way → leg from width + angle |
  | `connector-angle-legal` | in→out except same-way reversal |
  | `connector-dead-end-uturn` | the one same-way connector, at a terminus |

- Stable geo ids: `node:` joins the sorted member keys (`s<sid>` or
  `r<roadId>`); `lane:`/`walk:`/`xwalk:`/`conn:` derive from road ids and
  node ids. All collections are emitted sorted by id, so two builds of the
  same tile are **byte-identical** (tested).
- Saved locations preserved: the sidecar is derived, never baked — the
  dataset JSON, `id`/`version`, origin, `CITY_DATASET_MIGRATIONS` and the
  world-resume save path are untouched (regression test pins the identity).

## Paths

```
packages/app/features/game/living-city/
  topology.ts           # types + buildLaneTopology(dataset) — pure
  bundled-topology.ts   # lazy bound accessor over bundledCity() (load seam)
  topology.test.ts      # fixture + real-tile tests (node --test)
docs/living-city/pr02-topology.md   # this file
```

## Dependency graph

```
city-dataset.ts (CityDatasetV3, CityRoad l/ow/sp/sid)
        │
        ├─► @acme/core unprojectFromScene   (node lon/lat — same maths the save uses)
        ├─► world/geometry.ts ribbon()      (lane/walk centreline offsets — reused, not duplicated)
        ▼
living-city/topology.ts ──► LaneTopology { nodes, lanes, walks, xwalks, connectors }
        ▲
living-city/bundled-topology.ts ──► city-data.ts bundledCity() (lazy, load-time)
```

Nothing here is imported by the scene, renderer, walkability or React — the
consumers (PR03 signal controller, PR05/PR06 sims) bind later. Downstream
note: `walk:` bands derive from the carriageway `s` field, the same
sidewalk model `walkability.ts`/`city-mesh` use; the 849 OSM `sidewalk`
ways remain available for PR06's pedestrian routing if band-only coverage
ever proves short.

## Verified intersections (Harlem tile `harlem-apollo-20261017`)

Node centroids unprojected through the dataset origin
(`unprojectFromScene`, sphere equirect — the save transform's exact
inverse). Anchors are published record points; a junction centroid sits
mid-box, so tolerance is ~one corner setback:

| Intersection | Node id | Scene (x, z) m | Node lat, lon | Anchor (source) | Δ |
|---|---|---|---|---|---|
| W 125 St & St Nicholas Av | `node:s19402.s19403.s19682.s19683` | −236.1, −77.3 | 40.81075, −73.95256 | IND 125 St station 40.810756, −73.952665 (Wikipedia) | ~11 m |
| W 125 St & Adam Clayton Powell Jr Blvd | `node:s19169.s19170.s19212.s19213.s19399.s19400.s19401` | 121.7, 121.8 | 40.80895, −73.94830 | ACP State Office Bldg 40.80923, −73.94746 + bus stops 40.80932/−73.94886, 40.80858/−73.94768 (OSM nodes 5235595642/366) | ~45 m (mid-box) |
| W 125 St & Lenox Av / Malcolm X | `node:s19345.s19346.s19381.s19382.s19400.s19418.s19419` | 359.8, 254.3 | 40.80776, −73.94547 | IRT 125 St station 40.807, −73.945 + subway-corner nodes 40.80800/40.80756, −73.9455 (OSM 2562438686/679) | ~20 m |
| W 125 St & Frederick Douglass Blvd | `node:s19247.s19248.s19401.s19402` | −118.6, −12.3 | 40.81016, −73.95116 | FDB & 125th junction, next block east of St Nicholas — consistent with the CSCL chain order on 125th | — |
| W 125 St & 5 Av | `node:s19419.s26784.s26910.s26911` | 629.4, 404.4 | 40.80641, −73.94227 | 125th & Madison/5th — east end of the hero corridor | — |

Verification method: (a) the node is where same-named CSCL `sid` chains
terminate (street names from the bake, geometry from record polylines —
no synthetic topology), and (b) the unprojected centroid falls within one
junction box of an independently published coordinate for that named
crossing. All three required anchors pass with margin.

## Counts (2026-10-17 tile)

- Nodes: **300** — 194 junctions, 32 links (segment joints), 4 interior
  dead ends (`cscl:19242` FDB, `cscl:197337` Morningside, `cscl:202836`
  W 128 St, `cscl:23333` Manhattan Av — all genuine CSCL termini, each
  verified >15 m from any other segment), 70 clipped tile-edge stubs.
- Segments: **563** carriageway pieces (every one a `cscl:` record with
  `sid`/`l`/`sp`; 389 with `ow`).
- Lane edges: **1 159** (~89.8 lane-km); 389 one-way pieces (recorded
  `ow` ±1), 174 two-way (inferred `oneway-two-way-default`); 180
  junction-box interior lanes, 113 boundary lanes.
- Walk edges: **1 126** (both sides of all 563 carriageways; every one has
  a recorded `s`).
- Crosswalks: **876** — 632 OSM-way backed (`xwalk-osm-crossing`), 244
  synthesized (`xwalk-corner-fallback`). 191 of 194 junctions anchor at
  least one real crossing way; each hero junction has 4+ legs (ACP has 4
  zebra legs plus one mid-block piece).
- Connectors: **5 950** (2 071 through, 1 481 left, 1 496 right, 902
  geometric U-turns — dominated by divided-carriageway pairs; PR03 prunes
  with signal legality).
- Record vs inferred (per carriageway piece): lanes 563/0, speed 563/0,
  oneway 389/174 — every CSCL field consumed verbatim; only `ow`
  absence and every `xwalk:`/`conn:` derivation are flagged inferred.

## Tests (`node --test features/game/living-city/topology.test.ts`)

9 tests, all passing (run 2026-10-18, node v26.12.0):

- fixture: direction rules (two-way → f+b edges, `ow` ±1 → single travel
  direction), NYC inference defaults (arterial/local lane counts, 25 mph,
  two-way), junction legs + synthetic crosswalks + connector legality;
- real tile: graph builds (~53 ms), the three anchored intersections exist
  with 4 legs each and coords inside tolerance, ids byte-identical across
  two builds, every lane lands on a node (no dangling ends inside the
  tile; clipped stubs resolve to `boundary` nodes, interior termini to the
  4 documented `deadEnd` nodes), inferred flags honest (563/563 lanes and
  speed recorded, oneway split 389/174), dataset identity untouched.

`tsc --noEmit` clean for `packages/app`; `eslint` clean on the module;
the full `features/game` suite stays green (345 tests, incl. the world
budget and clearance pins).

## Licensing

None new. Reads the existing ODbL/OSM + CSCL-backed tile already shipped;
imports only `@acme/core` maths and the repo's own `world/geometry.ts`.
All derived values are labeled inferred per spec §6 — nothing here
presents a guess as a record.

## Device status

**PENDING** — pure-data module with no render path; nothing shipped to a
device. Build cost measured in-process on an M-series Mac: ~53 ms over the
full tile, well inside the existing scene-build budget (world build is
already seconds-scale on-device; revisit if on-device measurement says
otherwise).

## Rollback

`git rm -r packages/app/features/game/living-city docs/living-city` —
nothing outside the new directory is modified, no schema or save changes
to migrate away.
