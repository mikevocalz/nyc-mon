# City world: Harlem around the Apollo

The Game tab's world is a baked OpenStreetMap tile of Harlem, about 1.7 km on a side and centred on the Apollo Theater (253 W 125th St). It draws buildings with tagged heights and a material class, streets with sidewalks and lane markings, parks, plazas and water, street and park trees, and accents on three landmarks. It replaces the PR #30 slice: 17 grey boxes and 9 dark strips from a 150 m tile.

The techniques come from `metro-live` in [vg-demos-all](https://github.com/vietgangzz/vg-demos-all), which builds a full Ho Chi Minh City corridor from OSM on the same stack (three r186 `three/webgpu`, react-native-webgpu, TypeGPU). Its code is MIT; the notice is at the end of this file.

## Pipeline

| Step | File | What it does |
| --- | --- | --- |
| Fetch | `tooling/city/fetch.mjs` | Overpass queries for buildings, roads, areas, trees, landmark names and transit nodes (subway entrances, bus stops) in a bbox around the origin; cached in `tooling/city/.cache/` (git-ignored). Mirror retry ported from metro-live `scripts/osm/fetch.mjs`. |
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
| `transit` | `subway`: `railway=subway_entrance` nodes. `shelters`: `highway=bus_stop` nodes tagged `shelter=yes`. Flat x, z. Optional: tiles baked before 2026-10-16 parse with both empty. |

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

Before the 2026-10-16 frame-budget pass (below), baked in node on the same Mac, the real tile became 13 draw calls: 10 merged meshes (163 551 triangles, contact shadows and walls about 64 000 each, roofs 25 000) and 3 instanced tree meshes of 7 464 instances. A near crown is 60 triangles, so near trees add about 450 000 triangles; past 450 m the 20-triangle far crowns replace them. Scene build took 196 ms in node. The scene test caps the tile at 22 meshes. None of this is a phone measurement.

## Scene

`city-scene.ts` keeps the `CityCamera` contract (`x`, `z`, `yaw`, `distance`) and the on-demand canvas. `world/` builds everything static:

| File | Role |
| --- | --- |
| `world/index.ts` | `buildCityWorld`: sky dome, ground, city meshes, trees, hemisphere and sun lights, fog; `setViewDistance` drives LOD and fog. |
| `world/city-mesh.ts` | Walls, roofs, contact shadows, areas, sidewalks, roads and landmark accents, all written into one vertex buffer per material while building (metro-live bakes with `mergeByMaterial` after the fact; this skips the per-feature meshes). |
| `world/materials.ts` | TSL node materials: sky gradient, facade windows and shopfronts, asphalt with double yellow centre lines, zebra crossings and gutters, soft contact shadow, leaf cards. |
| `world/foliage.ts`, `world/tree-lod.ts` | Instanced leaf crowns (10 cards around one core) and trunks within 70 m of the Caller, plain crowns out to 400 m, none beyond. |
| `world/signage.ts`, `world/pixel-font.ts`, `world/street-furniture.ts` | Street-name signs at named intersections and LED streetlights: layout (pure), the lettering atlas, the instanced meshes. |
| `world/windows.ts` | Which windows are lit, per building; the facade shader runs the same hash. |
| `world/budget.ts` | Visible-triangle count, the rule the Duo measurement used. |
| `world/walkability.ts`, `world/bundled-queries.ts` | `isWalkable(x, z)` and `cityGroundHeight(x, z)`. |
| `world/palette.ts` | Material colours from `@acme/theme` tokens. |

react-native-webgpu rules from the metro-live README, all followed: no shadow maps (a TSL contact shadow strip around every footprint, leaning away from the sun, stands in), no output pass (linear output, no tone mapping), and no `scene.background = Color` (an unlit dome drawn first; the renderer clear colour matches the horizon as a fallback). Colours are fed to three as linear values, so the frame shows the token colours as authored without switching off colour management for the app's other scenes.

Decision: BUILD the shaders in TSL. metro-live writes them in TypeGPU through `@typegpu/three`; `@acme/app` does not declare `typegpu` or `@typegpu/three`, and this lane adds no runtime dependency. DEFER a TypeGPU port until the app package declares them.

Level of detail by camera distance: windows and lane markings fade to their average colour from about 250 m (no shimmer), leaf crowns are off past 450 m, all trees hide past 1.6 km, and fog closes in with distance. Near and far planes follow the zoom (near = 2 % of distance, 0.1 to 5 m) so depth holds from 8 m to 3 km. Ground layers: areas from 2 cm (each kind 2.5 mm above the last, so a pitch sits on its park; it was 0.01 mm per area), sidewalks 4.5 cm, roads 6 cm, crossings 6.5 cm, contact shadows 8 cm, each with polygon offset.

### Frame budget (Surface Duo, 2026-10-16)

The "janky floor" was frame rate, not depth. On the Duo the city presented 14.7 fps while walking (gaps of 3 to 7 vsyncs) with 857 000 triangles a frame, at 1x and 2x pixel ratio alike, so the GPU was vertex bound. 627 000 of those triangles were trees: all 7 464 drew as 60-triangle leaf crowns plus 24-triangle trunks every frame, because one InstancedMesh is culled as one volume. The JS store trace had no position reversals, so the flicker was the stutter.

The scene now draws around the Caller (`world.setFocus`, called with the camera target every frame; each part rebuilds only after a 10 m move, into preallocated buffers):

- Trees (`tree-lod.ts`): leaf crowns and trunks within 70 m, nearest 240 at most; plain 20-triangle crowns out to 400 m (more from overview range); nothing past that.
- Contact shadows and sign lettering: buildings and signs are written in 50 m z bands, and one draw range shows the bands within 160 m.
- Light pools: the 48 nearest lamps within 110 m.

Visible triangles on the real tile at the Apollo spawn, chase 8 m (before the street-level pass below), counted by `visibleTriangles` (index or vertex count / 3, times instance count, over visible meshes): 791 301 before (node, the same rule; the device's 857 559 includes the Caller and the HUD scene), about 186 000 after, with the futuristic layer and street furniture included. `world/budget.test.ts` keeps chase 8, 18 and 40 m and a 400 m walk along 125th Street under 200 000. 20 city meshes. None of this is a device frame time yet.

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
| Sky zenith (dusk, D17) | royal 900 + 35 % ink 950 (brand night) | |
| Sky middle | royal 600 + 40 % carolina 700 | |
| Sky horizon, fog, clear | orange 300 + 35 % royal 300 | #D2B8AB |
| Sun glow | orange 400 | #FD9D40 |
| Sun / hemisphere sky / ground | orange 200 / carolina 300 + 40 % royal 300 / concrete 500 | |
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
| Neon trims, storefronts, billboards | orange 500, royal 400, carolina 400, apple 400, leaf 400 | |
| Lit windows | orange 200 / orange 300 / carolina 200 | |
| Sidewalk joint grid / kerb line | carolina 400 / royal 400 | |
| Sign blade / lettering | leaf 800 / signage white | |
| Poles / lamp head / light pool | ink 800 / orange 50 + 50 % carolina 100 / orange 200 | |

Each building's wall colour varies ±8 % by a hash of its id, so a row of brownstones does not read as one slab.

## The near-future layer (D17)

The city is at dusk: the sun about 25 degrees up in the south-west, the cel key at 0.62 of the studio level. Every glow is added after the cel colour through `emissiveNode` (three r186 `NodeMaterial.setupLighting` adds it on the unlit basic material too), so the shadow, mid and lit bands stay, and fog still applies on top.

| Piece | How | Cost at the spawn |
| --- | --- | --- |
| Lit windows | Facade shader: per window, `windows.ts`'s hash against a per-building density (25 to 75 %) seeded from the wall colour; warm, amber or cool; the lit share as a flat glow past 260 m | 0 triangles |
| Neon rooflines | A 26 cm band 6 cm off the wall at the roofline, one brand colour per building, on 18 % to 85 % of buildings by height | in `city:neon`, about 25 000 |
| Storefront fascias | A lit band at 3.15 to 3.45 m on every wall within 14 m of a primary, secondary or trunk road | in `city:neon` |
| Billboards | LED panels (brand gradient, scan lines and dot pitch near the camera) on the street face of buildings 16 m and up along those roads; 48 at most, no lettering or logos | 96 |
| Sidewalk grid, kerb line | Carolina joints every 1.5 m from world position; a royal line 35 cm in from each kerb; both fade out before they alias | 0 |
| Streetlights | A pole every 32 m along each carriageway, sides alternating, 0.8 m past the kerb; flat LED head over the road; additive pool under the 48 nearest | 420 lights |

No bloom: three's post-processing needs the output pass, which renders black on react-native-webgpu, and `packages/ui/three` has none to reuse.

## Street level (D18)

Where the camera lives (chase 8 m, eye about 4 m), Harlem now has the things that say New York. All of it is merged into existing buffers or instanced, and every base that reaches the sidewalk passes the street clearance below.

| What | Where it comes from | How it is drawn |
| --- | --- | --- |
| Wall tones | `WALL_TONES` in `palette.ts`: brownstone, warm brownstone, sandstone; four bricks (red, dark, buff, the base); limestone and stucco on civic, church and plain fronts; three glass tints. One per building by a hash of its id, then the ±8 % brightness | vertex colour |
| Window surrounds | Facade shader: a dark frame round each pane, a pale stone lintel above and a sill below (masonry), dark mullions on glass | 0 triangles |
| Shopfronts | Facade shader: a fifth of the ground-floor bays have a corrugated roll-down gate; the rest glow warm behind the glass | 0 triangles |
| Cornices | A projecting band and soffit under the roof line of every masonry street front under 45 m (4 725) | `walls-masonry` |
| Stoops | Brownstones on side streets, 80 % of street fronts: landing, six steps, iron rails and newels; only where the foot of the stoop is clear of the carriageway (691) | `street-detail`, banded |
| Fire escapes | Brick walk-ups of 12 to 32 m, 60 % of street faces 7 m and wider: a balcony, rail and zig-zag ladder per upper floor (747 facades) | `street-detail`, banded |
| Awnings | Commercial frontage (the fascia walls): 55 % of 4.5 m bays, six brand-derived colours (1 460) | `street-detail`, banded |
| Shop signs | 35 % of commercial frontages: a lit panel in place of the fascia band, with a generic trade in the pixel font (`DELI GROCERY`, `LAUNDROMAT`, `99 CENTS`; no brand names) (439) | `neon` panel, `sign-lettering` |
| Water towers | 28 % of buildings of five storeys and up, not glass, where the roof fits the tank: legs, deck, staved tank, conical roof (409) | `roofs` |
| Apollo | APOLLO in red on the marquee's light band, and stacked on both faces of the blade sign, which now stands out from the wall | `landmarks`, `landmark-lettering` |
| Hydrants, litter baskets | Hydrants every 75 m along the kerbs, clear of streetlights (753); a basket by each sign pole and every 90 m on the avenues (283) | `street-props`, banded |
| Parked cars, taxis | Parking lane of carriageways 10 m and wider, a slot every 6.4 m, 55 % filled, 20 % taxis; a slot stays empty when either end is on a crossing, within 3 m of another carriageway, or within 4.6 m of a hydrant (767, 143 taxis). The palette has no yellow, so taxis take the orange steps the lane lines use | `cars`, instanced, the nearest 220 within 200 m |
| Subway entrances | OSM `railway=subway_entrance` (29 in the tile): stair well, green iron railings, two green globe lamps; moved up to 3 m onto the sidewalk and nudged up to 1 m to fit (27 placed, 2 dropped) | `transit`, `transit-lights` |
| Bus shelters | OSM `highway=bus_stop` with `shelter=yes` (53): posts, roof, glass back and side, bench, a lit ad panel with no artwork (52 placed, 1 dropped) | `transit`, `transit-lights` |

Banded meshes are written in 50 m z bands and drawn within 160 m of the Caller, like the contact shadows. Building the scene now takes about 450 ms in node (was 218 ms).

Triangles at the Apollo spawn, chase 8 m: 283 553 (was 183 149), in 26 meshes. `world/budget.test.ts` holds chase 8, 18, 40 m and the 125th Street walk under 300 000. `world/parts.test.ts` checks that every triangle of every part, stoop, fire escape, awning, water tower and line of lettering faces its normal.

## Street clearance

Nothing stands in the street. `createStreetClearance` (`world/walkability.ts`) is the one check for every tree, streetlight and sign pole: a carriageway is each non-walkway road segment (crossings and service roads included) buffered by the half width the road mesh draws plus a 0.3 m kerb margin. Sidewalk furniture stands in the band from 0.5 m past the kerb to the sidewalk width minus 0.3 m; where OSM maps the sidewalk as its own way, the band assumes 3 m. Building footprints (grown 0.2 m) are also off limits.

- OSM trees inside a carriageway move to the nearest band point within 3 m, else drop. Generated trees there drop.
- A crown (2.6 m reach at scale 1, at trunk height) may hang at most 1.5 m over the carriageway edge; larger crowns shrink, and would drop below scale 0.6.
- Streetlights stand 0.8 m past the kerb; a position in a crossing, a cross street or a building is skipped. Sign poles try the corners at 0.9, 1.4, 2.0 and 2.8 m past both kerbs and take the clear corner nearest the Apollo; an intersection with no clear corner gets no sign.

On the 2026-10-15 tile: 34 OSM trees moved, 4 dropped, 493 generated trees dropped, 2 702 crowns shrunk, none dropped for overhang; 6 967 of 7 464 trees remain. 210 of 218 intersections are signed; 420 streetlights. `world/clearance.test.ts` checks every base on the real tile, with signs, lights and every 25th tree also against a brute-force pass over all roads.

## Street signs

NYC street-name blades, white on green, two per pole (the lower names one street, the upper the cross street), each running along the street it names so it reads face-on from the cross street.

- **Data:** the bake already keeps OSM `name` as `n` on roads (480 named, 66 distinct carriageway names), so `tooling/city` is unchanged. `findIntersections` crosses every pair of differently named carriageway segments in a 40 m grid, skips near-parallel pairs, and merges crossings of the same two names within 30 m (divided avenues). The 2026-10-15 tile gives 218 intersections; 210 have a clear corner and get a sign.
- **Placement:** the pole stands on the clear sidewalk corner nearest the Apollo, outside both carriageways (see Street clearance; setbacks are divided by the sine of the angle on skewed corners). Names print as Manhattan blades do: `West 125th Street` becomes `W 125 ST`; names too long for a 2.3 m blade condense to 55 % width, then middle words become initials (`ADAM C POWELL JR BLVD`).
- **Lettering:** a 5 x 7 capital pixel font written into a 64 x 48 `DataTexture` at run time (one atlas and material, `materials.lettering`, shared with the shop signs and the Apollo), one quad per letter on each face, nearest filtering. react-native-webgpu has no DOM canvas, so `CanvasTexture` and troika cannot run there, and the repo had no 3D text. Drawing lit pixels as merged quads came to 171 000 triangles for the tile; atlas quads are about 17 000, of which the near bands draw about 3 500.
- **Meshes:** poles (signs and streetlights share one InstancedMesh), blades (one InstancedMesh, two per sign), lettering (one merged mesh), lamp heads, light pools. Blades, lettering and pools hide past 320 m camera distance.

## Not done

- Building parts, roof shapes, setbacks and `min_height` (towers are prisms).
- Elevation: Harlem slopes toward St. Nicholas and Morningside Parks; the ground is flat.
- Full night, weather, wind sway, animated billboards (the canvas is on demand and static between moves).
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
