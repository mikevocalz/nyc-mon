# City tooling

The baked Harlem tile (`packages/app/features/game/data/harlem-apollo.json`)
comes from two pipelines. v3 uses Valdrada records; v2 (kept for migration)
used Overpass/OSM directly.

## v3 (current) — Valdrada records

| Step | File | What it does |
| --- | --- | --- |
| Fetch | `valdrada/fetch.mjs` | Downloads the pinned Valdrada tiles listed in `valdrada/pins.json` (URL + sha256 per tile) into `tooling/city/.cache/` (git-ignored; bytes are ODbL 1.0). |
| Decode | `valdrada/decode.mjs` | Decodes the binary record format (see `docs/adr/0021-city-dataset-v3-valdrada.md`), unprojects to local metres, exposes buildings/roads/furniture/landmarks. Valdrada is MIT — full notice in `valdrada/LICENSE.valdrada`. |
| Build | `build.mjs` | Matches records to OSM way footprints, bakes dataset v3 (`harlem-apollo-20261017`) with per-building facts (`f`, `fh`, `d`, `sh`, `ww`, `fi`, `vs`) and road `segId`s, marks everything rule-derived as an estimate. |
| Check | `print-counts.mjs` | Parses the baked file with `parseCityDataset` and prints counts, size and parse time. |

Valdrada is pinned at tag `v0.4.0` (commit `2724c79`); the clone lives at
`~/src/valdrada`. Test the decoder with `node --test valdrada/decode.test.mjs`.

## v2 (legacy) — Overpass/OSM

| Step | File | What it does |
| --- | --- | --- |
| Fetch | `fetch.mjs` | Overpass queries in a bbox around the origin; cached in `.cache/`. |
| Build | `build.mjs` (v2 mode) | Projects, simplifies, classifies, estimates, writes the v2 tile. |
| Foliage | `bake-foliage.mjs` | Copies the CC0 Quaternius leaf-card alpha into `world/leaf-alpha.ts`. |

Saves keyed on a v2 tile migrate to v3 with identity-position behaviour via
`CITY_DATASET_MIGRATIONS` (`packages/core/world/migrate.ts`).

## Attribution

The tile's `sources[]` array drives the Settings credits and is audited in
`docs/licenses/provenance-2026-10-17.md`. OSM data is ODbL 1.0; see the ADR
for the derivative-database decision.
