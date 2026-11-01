# 0021 — City dataset v3: Valdrada as the building and street source

- **Status:** Proposed
- **Date:** 2026-10-17
- **Deciders:** Mike (creator) signs off; lane E2 (Schema and bake) implements
- **Builds on:** ADR 0020 (world save and exact resume), `docs/design/handoff/harlem-v3.md` (A1), `docs/implementation/harlem-v3-p0-findings.md` (E1), `docs/plans/harlem-v3-valdrada-prompt.md` §7
- **Sources:** Valdrada v0.4.0, commit `2724c79` (<https://huggingface.co/datasets/mehmetkeremturkcan/valdrada>), which itself aggregates the NYC open records listed in the baked `sources[]` (DOITT footprints, PLUTO, DOB NOW/FISP, CSCL, Parks Tree Census, DEP hydrants, bus shelters, LinkNYC, DOT CityRacks, MTA entrances) beside the tile's existing OSM extract (<https://www.openstreetmap.org/copyright>, ODbL 1.0)
- **Code:** `tooling/city/build.mjs`, `tooling/city/valdrada/*`, `tooling/city/print-counts.mjs`, `packages/app/features/game/city-dataset.ts`, `packages/app/features/game/data/harlem-apollo.json`, `packages/app/features/game/map-data-credit.ts`, `packages/core/world/{migrate,resume}.ts`

## Context

The v2 Apollo tile (`harlem-apollo-20261014`) drew its buildings and street detail almost entirely from OSM: 28 of 3761 buildings carried a record height, floors existed nowhere, trees were 487 census rows padded with 6977 generated fills, and no street furniture was record-backed. The plan for v3 is that every field is traceable to a named public record or explicitly marked as an estimate (provenance bits, not silence). Valdrada is the record-backed merge of the same public NYC datasets for the same square, so the tile can keep its geometry contract while each value carries a source.

## Decision

**The dataset id moves with the data.** A re-baked tile is `harlem-apollo-20261017`, version 3. A new dated id is what makes a save written against v2 visibly "for another dataset" instead of silently wrong; `CITY_DATASET_MIGRATIONS` then bridges it explicitly.

**Migrations bridge across dataset ids.** `DatasetMigration` gains `fromDatasetIds?: readonly string[]`: a step names the superseded ids it accepts. `resolveResume` walks the chain — a v2 save on `harlem-apollo-20261014` migrates to v3 by an identity position move (same origin, same projection), and a v1 save reaches v3 through the v1→v2 then v2→v3 steps. An id no step accepts stays `incompatible-dataset`, never a teleport (ADR 0020's rule).

**Building ids follow G1(b): match to v2 OSM ways by footprint overlap.** A Valdrada footprint that overlaps a v2 `osm:way:N` keeps that id so landmark references and save-time identity survive; unmatched records get `vd:<tag>:<tile>:<index>`. The bake reached 3668/3742 matched (98.0%); the three landmarks resolve to `osm:way:271798914` (Apollo), `osm:way:271798882` (Theresa), `osm:way:271798907` (ACP office).

**Schema v3 is additive.** `source` becomes `sources[]` (name, url, retrieval timestamp); buildings add record fields (`f` floors, `fh`, `vs`, `sh`, `ww`, `fi` front edge, `d` detail mask, optional `n` name); roads add record fields (`l`, `ow`, `sp`, `sid`, optional `n`); trees split into `{ census, fill }`; furniture `{ hydrant, linknyc, bikeRack }` and transit `{ subway, shelters }` are new collections; the `e` bitmask marks which fields are record-backed (height, class, floors, style, detail). Class, style and detail bits are never set in the bake — those values come from compiler rules, so they read as estimates.

**v1 and v2 still parse.** The parser accepts all three versions and normalises them into the v3 runtime shape; v1's WGS84 features project through `projectCityPoint` as before. Consumers moved to `CityDatasetV3` (`trees.census`, `sources`, furniture) with no renderer change.

**Provenance is a first-class surface.** `map-data-credit.ts` carries the source list as data so settings renders the bundled attribution without importing the 1.2 MB dataset, and `print-counts.mjs` reports counts, byte size, parse time, provenance bits and the landmark footprint check for any baked file.

## Consequences

- The tile grows 986 KB → 1209 KB and parses in ~6 ms (v2 ~6 ms); the triangle budget test's ceiling moved 300k → 320k since record carriageway widths open more parking slots near the Apollo and the census tree count is ~9× (the Duo's frame rate was already shown not to track triangle count in the D18 pass).
- Walkable coverage is the union of buffered centrelines; v3's join between the OSM sidewalk way and the CSCL carriageway left a ~6 cm hairline seam beside `osm:way:271805697` that could trap the Caller. `walkability.ts` pads each path buffer by `PATH_SEAM_PAD` (0.15 m) so near-touching coverages join; locomotion itself is unchanged.
- 74 Valdrada footprints had no v2 OSM counterpart and carry `vd:` ids; they are visible in `print-counts.mjs` output for auditing.
- Fill trees remain estimates by construction; census trees, furniture and transit are record rows, and the `e` bits say which is which per building.
- The settings credits list twelve sources; the OSM ODbL notice stays first.
- If a v4 bake moves the origin, its `migratePosition` must re-project (ADR 0020); the v2→v3 step is identity because origin and projection did not change.
