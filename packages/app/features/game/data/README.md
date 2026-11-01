# Harlem around the Apollo Theater

`harlem-apollo.json` is an offline OpenStreetMap extract of Harlem in a square about 1.7 km across, centred near the Apollo Theater on West 125th Street. It is real map geometry, not a decorative generated city. It is not a five-borough map, routing service, safety map or authoritative building survey.

Data © OpenStreetMap contributors, distributed under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). See [OSM copyright and attribution requirements](https://www.openstreetmap.org/copyright). Any map surface must visibly display the attribution and license link. This data license is separate from the code license.

## Format (v2)

Coordinates are local metres around `origin` (x east, z south, 0.1 m precision), the same projection as `projectCityPoint`. The file carries buildings with height and a material class, roads by class with carriageway and sidewalk widths, land-use areas, trees, a landmark list, and subway entrances and sheltered bus stops (`transit`, positions only). `parseCityDataset` (Zod) validates every field and the tile radius before anything reaches the GPU, and still accepts the PR #30 v1 shape by migrating it. The full field list and the estimate rules live in `docs/implementation/city-world.md`; the `notes` array in the JSON repeats the rules that produced this file.

What is estimated, not measured:

- Heights without a `height` or `building:levels` tag come from a fallback by building type (flag bit 1 in `e`).
- Material classes other than `church`, `civic`, `glass` and tagged materials are styling estimates (flag bit 2). `nycha` comes only from an OSM `operator`/`owner` tag naming the New York City Housing Authority, never from appearance, and is not yet checked against the NYCHA development dataset.
- Road widths without a `width` tag come from the road class; sidewalks are symmetric class defaults.
- `trees.fill` is generated street and park planting with a fixed seed. Only `trees.osm` are mapped trees.

## Reproduce

```bash
node tooling/city/fetch.mjs      # Overpass download into tooling/city/.cache (add --refresh to re-download)
node tooling/city/build.mjs      # writes this file
node tooling/city/print-counts.mjs   # parses it with parseCityDataset and prints counts and size
```

Editor identities, edit history, contact details and unrelated tags are excluded. Do not poll Overpass or the editing API from the app or use either as a runtime map backend.
