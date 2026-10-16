# City world: Harlem around the Apollo

The Game tab's world is a baked OpenStreetMap tile of Harlem, about 1.7 km on a side and centred on the Apollo Theater (253 W 125th St). It draws buildings with tagged heights and a material class, streets with sidewalks and lane markings, parks, plazas and water, street and park trees, and accents on three landmarks. It replaces the PR #30 slice: 17 grey boxes and 9 dark strips from a 150 m tile.

The techniques come from `metro-live` in [vg-demos-all](https://github.com/vietgangzz/vg-demos-all), which builds a full Ho Chi Minh City corridor from OSM on the same stack (three r186 `three/webgpu`, react-native-webgpu, TypeGPU). Its code is MIT; the notice is at the end of this file.

## Pipeline

| Step | File | What it does |
| --- | --- | --- |
| Fetch | `tooling/city/fetch.mjs` | Overpass queries for buildings, roads, areas, trees and landmark names in a bbox around the origin; cached in `tooling/city/.cache/` (git-ignored). Mirror retry ported from metro-live `scripts/osm/fetch.mjs`. |
| Build | `tooling/city/build.mjs` | Projects to local metres, simplifies (Douglas-Peucker), clips (Sutherland-Hodgman), assembles multipolygons, classifies, estimates, plants fill trees, finds landmarks. Writes `packages/app/features/game/data/harlem-apollo.json`. Geometry helpers ported from metro-live `scripts/osm/build.mjs`. |
| Foliage | `tooling/city/bake-foliage.mjs` | Copies the alpha of the CC0 Quaternius leaf card out of metro-live's `data/foliage.json` into `world/leaf-alpha.ts`. No image decoder runs on the phone. |
| Check | `tooling/city/print-counts.mjs` | Parses the baked file with the app's `parseCityDataset` and prints counts, size and parse time. |

`tooling/city/compile-osm.py` (the v1 compiler) is removed: one pipeline, in the same language as the reference.

## Dataset v2

`parseCityDataset` (Zod, `city-dataset.ts`) validates the tile before any GPU allocation and returns owned data. Coordinates are local metres around `origin` (x east, z south, 0.1 m), the same equirectangular projection as `projectCityPoint` and `packages/core/world/transform.ts`.

| Key | Content |
| --- | --- |
| `version`, `id`, `origin` | `2`, `harlem-apollo-20261014`, `[-73.94975, 40.81005]`. Id and origin are unchanged from v1 so world saves keep their place. |
| `extentMeters`, `source`, `notes` | Half-size of the square, Overpass provenance (HTTPS URL, ODbL, retrieval time, query), and every estimate rule in words. |
| `buildings[]` | `id` (`osm:way:N`), open ring `p`, optional holes `i`, height `h`, class `c`, flags `e` (bit 1 height estimated, bit 2 class estimated), name `n`. |
| `roads[]` | `id`, class `c`, carriageway width `w`, sidewalk width each side `s`, polyline `p`, `e` = 1 when the width is a class default, name `n`. |
| `areas[]` | `id`, kind `k` (park, garden, grass, pitch, playground, plaza, parking, water, school), ring and holes. |
| `trees` | `osm`: natural=tree nodes. `fill`: generated street and park planting, fixed seed. Fill trees are decoration, not map data. |
| `landmarks[]` | `key` (apollo-theater, hotel-theresa, acp-state-office), OSM name, the building it attaches to, centroid. A landmark OSM does not name is left out, never invented. |

Limits: 20 000 buildings, 10 000 roads, 4 000 areas, 25 000 trees, 600 000 points, 4 096 points per ring, 2 000 m tile radius. The scene caps features at 40 000; geometry is merged per material, so the cap bounds build time and memory rather than draw calls.

**Migration.** A v1 tile still parses: it is projected once into v2 shape (buildings become class `plain`, roads `residential` without sidewalks). World saves key on `(datasetId, datasetVersion)`, so a save written against v1 needs `CITY_DATASET_MIGRATIONS` (identity position step, v1 to v2) passed to `resolveResume` as `datasetMigrations`. Without it the lobby reports v1 saves as `incompatible-dataset`. That call lives in `lobby/use-lobby-resume.ts`, outside this lane.

### Estimates

- Height: the `height` tag (metres or feet), else `building:levels` × 3.2 m + 1 m, else a type fallback (row house 12 m, apartments 18 m, commercial 10 m, office and hotel 30 m, church 18 m, school 16 m, garage 4 m, default 10 m).
- Class, first match wins: church (building or amenity tag), nycha, civic (government, school, hospital and similar), glass (glass material, or an office, commercial or hotel building 45 m or taller), brownstone and brick from `building:material`. Everything else is a styling estimate: low residential splits about 55/45 between brownstone and brick by a hash of the OSM id, taller residential and low commercial are brick, sheds and garages are plain.
- **NYCHA rule.** `nycha` comes only from an OSM `operator` or `owner` tag naming the New York City Housing Authority. Appearance never marks public housing (MOBILE_WORLD_PR_PACK, NYCHA constraint 3). OSM is not the verified NYCHA development dataset, so the class only picks a facade colour; no facelift or overlay is keyed on it until FUT-01 checks it against that dataset.
- Roads: `width` tag, else `lanes` × 3.3 m, else a class default (primary 18 m, secondary 14 m, tertiary 12 m, residential 9 m). Sidewalks are symmetric class defaults (primary 6 m, secondary 5 m, tertiary and residential 4.5 m), dropped where OSM maps the sidewalk separately.

## The baked tile (2026-10-15)

Output of `node tooling/city/print-counts.mjs`, which parses the file with the app's own `parseCityDataset`:

| | |
| --- | --- |
| File | 985 KB compact JSON (1 008 699 bytes); parse 46 ms on an M-series Mac, not measured on a phone |
| Retrieved | 2026-10-16T03:14:46Z from Overpass, square ±850 m around the origin |
| Buildings | 3 761: brick 1 943, brownstone 1 465, plain 245, civic 52, church 31, glass 25, nycha 0. 28 heights estimated; 3 653 classes estimated |
| Roads | 2 414: sidewalk 849, crossing 632, footway 313, service 166, residential 164, secondary 147, primary 120, tertiary 23 |
| Areas | 172: pitch 34, playground 28, parking 24, park 21, garden 21, grass 16, school 15, plaza 12, water 1 |
| Trees | 487 from OSM, 6 977 generated (5 956 street, 1 021 park) |
| Landmarks | Apollo Theater (`osm:way:271798914`), Theresa Towers, the former Hotel Theresa (`osm:way:271798882`), Adam Clayton Powell Jr. State Office Building (`osm:way:271798907`) |

No building is `nycha`: none in range carries a NYCHA `operator` or `owner` tag, so none is marked, even where public housing stands. Most Harlem streets map their sidewalks as separate ways, so those streets get no generated sidewalk and the mapped one draws instead.

Baked in node on the same Mac, the real tile becomes 13 draw calls: 10 merged meshes (163 551 triangles, contact shadows and walls about 64 000 each, roofs 25 000) and 3 instanced tree meshes of 7 464 instances. A near crown is 60 triangles, so near trees add about 450 000 triangles; past 450 m the 20-triangle far crowns replace them. Scene build took 196 ms in node. The scene test caps the tile at 16 meshes. None of this is a phone measurement.

## Scene

`city-scene.ts` keeps the `CityCamera` contract (`x`, `z`, `yaw`, `distance`) and the on-demand canvas. `world/` builds everything static:

| File | Role |
| --- | --- |
| `world/index.ts` | `buildCityWorld`: sky dome, ground, city meshes, trees, hemisphere and sun lights, fog; `setViewDistance` drives LOD and fog. |
| `world/city-mesh.ts` | Walls, roofs, contact shadows, areas, sidewalks, roads and landmark accents, all written into one vertex buffer per material while building (metro-live bakes with `mergeByMaterial` after the fact; this skips the per-feature meshes). |
| `world/materials.ts` | TSL node materials: sky gradient, facade windows and shopfronts, asphalt with double yellow centre lines, zebra crossings and gutters, soft contact shadow, leaf cards. |
| `world/foliage.ts` | Instanced leaf crowns (10 cards around one core) near the camera, plain crowns far away, hidden beyond 1.6 km. |
| `world/walkability.ts`, `world/bundled-queries.ts` | `isWalkable(x, z)` and `cityGroundHeight(x, z)`. |
| `world/palette.ts` | Material colours from `@acme/theme` tokens. |

react-native-webgpu rules from the metro-live README, all followed: no shadow maps (a TSL contact shadow strip around every footprint, leaning away from the sun, stands in), no output pass (linear output, no tone mapping), and no `scene.background = Color` (an unlit dome drawn first; the renderer clear colour matches the horizon as a fallback). Colours are fed to three as linear values, so the frame shows the token colours as authored without switching off colour management for the app's other scenes.

Decision: BUILD the shaders in TSL. metro-live writes them in TypeGPU through `@typegpu/three`; `@acme/app` does not declare `typegpu` or `@typegpu/three`, and this lane adds no runtime dependency. DEFER a TypeGPU port until the app package declares them.

Level of detail by camera distance: windows and lane markings fade to their average colour from about 250 m (no shimmer), leaf crowns swap to plain crowns past 450 m, trunks hide past 675 m, all trees hide past 1.6 km, and fog closes in with distance. Near and far planes follow the zoom (near = 2 % of distance, 0.1 to 5 m) so depth holds from 8 m to 3 km; ground layers sit 2 to 8 cm apart with polygon offset.

### Camera

Distance clamps to 8–3000 m (was 30). Pitch eases from 0.35 rad at 8 m to atan(0.8) ≈ 0.675 rad at 220 m and stays there farther out, so the overview framing, and the "height = 0.8 × distance" that `camera-input.ts` pan maths assumes, are unchanged from 220 m out. Close in, the camera looks at 1.2 m above the target (a Caller's chest) instead of the pavement. `moveCityCamera` in `city-camera.ts` still clamps zoom at 30 m and `CHASE_DISTANCES` starts at 30; both belong to the character lane and should move to 8.

### Actors

`CitySceneParams.actors` takes `SceneActorFactory[]` (`scene-actor.ts`). Each factory runs once with the scene's THREE; its object joins the scene; `update(frame)` runs every frame before the camera is placed and before render; the scene calls the canvas `invalidate` while any actor returns true, so the on-demand canvas keeps drawing only while something moves. The paused canvas hands the scene `delta = 0`, so the scene measures the gap between its own redraws (clamped to 0.1 s) and gives actors that instead; the first frame after rest moves nothing. Actors are disposed with the scene. Changing the actor list needs a remount, like the dataset.

### Walkability

`isWalkable(x, z)`: blocked inside a building footprint (padded by a 0.3 m body radius) or water; walkable on any road with its sidewalks, footways, parks, gardens, lawns, pitches, playgrounds, plazas, parking lots and school yards; blocked elsewhere (back yards and unmapped lots) and outside the tile. A 32 m grid keeps each query to nearby features. `cityGroundHeight` is 0 everywhere: the tile has no elevation yet. `character/world-queries.ts` re-exports both. On the baked tile, 40.8 % of an 8 m grid over ±800 m is walkable. The origin (0, 0) is mid-block behind the Apollo and is not walkable; the Apollo's 125th Street sidewalk is at about (-28, 22) and the carriageway centre opposite it at (-34.7, 33.6). `INITIAL_CITY_CAMERA` (in `city-camera.ts`, outside this lane) still targets (0, 0), so a Caller spawned there walks out to the nearest street.

## Colours

Every colour comes from `palette` in `@acme/theme`; mixes are linear blends in display space (`mixHex`).

| Material | Recipe | Value |
| --- | --- | --- |
| Sky zenith | carolina 400 + 25 % royal 300 | #7ABAF6 |
| Sky horizon, fog, clear | carolina 100 + 55 % orange 50 | #F4F5F6 |
| Sun glow | orange 100 | #FFEDDB |
| Sun / hemisphere sky / ground | orange 50 / carolina 100 / concrete 400 | |
| Ground (lots, unmapped) | concrete 200 + 25 % orange 100 | #DDDAD7 |
| Park / garden / grass / pitch | leaf 400 + 35 % leaf 500 / leaf 400 / leaf 300 / leaf 500 | #5EBB5A / #6FC26B / #9FD79D / #3FAE3A |
| Playground / plaza / parking / school | orange 200 / concrete 100 / concrete 300 / concrete 200 + 30 % orange 200 | |
| Water | carolina 500 + 30 % royal 400 | #489DF3 |
| Asphalt / centre line / zebra | ink 700 / orange 300 / concrete 50 | #3C3F51 / #FEBE80 / #F3F4F4 |
| Sidewalk | concrete 300 | #B8BBBE |
| Brownstone | orange 900 + 35 % concrete 700 | #58391C |
| Brick | (orange 800 + 50 % apple 800) + 30 % concrete 500 | |
| NYCHA brick | (orange 800 + 50 % apple 900) + 25 % concrete 600 | #6F331B |
| Glass / office | carolina 700 + 35 % concrete 400 | #5885AB |
| Civic limestone | concrete 100 + 50 % orange 50 | #F5F2EF |
| Church stone | concrete 400 + 30 % orange 200 | #B8AFA7 |
| Plain | concrete 200 | |
| Roof | concrete 600, 20 % toward the wall colour | |
| Windows | ink 800 + 40 % carolina 900 | #223350 |
| Leaves / trunk | leaf 700 to leaf 500 per tree / orange 950 + 40 % ink 800 | |
| Contact shadow | ink 900 at up to 34 % opacity | #14182E |
| Apollo marquee and blade sign / marquee lights | apple 500 / orange 200 | |
| Hotel Theresa walls / crown band | concrete 50 / orange 200 | |
| ACP State Office roof band | royal 400 | #4082FA |

Each building's wall colour varies ±8 % by a hash of its id, so a row of brownstones does not read as one slab.

## Not done

- Building parts, roof shapes, setbacks and `min_height` (towers are prisms).
- Elevation: Harlem slopes toward St. Nicholas and Morningside Parks; the ground is flat.
- Night, weather, wind sway (the canvas is on demand and static between moves).
- NYCHA classification against the verified dataset (FUT-01) and any facelift.
- Tile streaming beyond the one bundled tile (stage 3).
- Device measurements: no frame time, memory or nonblack-frame capture from this lane. The PR #29 gate still needs a physical capture.

## MIT notice (vg-demos-all)

Ported or adapted from vg-demos-all: Overpass fetch and retry, `simplify`, `clipRing`, `assembleRings`, `area`, `inside` (`tooling/city/fetch.mjs`, `build.mjs`), `mulberry32` and the merge-by-material approach (`world/geometry.ts`, `world/city-mesh.ts`), the leaf crown, base64 decode and leaf material (`world/foliage.ts`, `world/materials.ts`), and the contact-shadow, ground and building shader ideas (`world/materials.ts`). The repository's one LICENSE file is the Expo template's MIT license; no other license file exists and neither `package.json` nor the README names another, so it covers the demo code (checked 2026-10-15 on the local copy at `~/Downloads/vg-demos-all`). The foliage texture is CC0 (Quaternius).

```
The MIT License (MIT)

Copyright (c) 2015-present 650 Industries, Inc. (aka Expo)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

OpenStreetMap data © OpenStreetMap contributors, ODbL 1.0. The Game screen shows the attribution (`MapAttribution.tsx`).
