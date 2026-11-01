# Scout A — Current world architecture & conflicts

Scout report for Living City PR01 (docs/plans/living-city-prompt.md §1, §12).
Read on `lane-lcaudit` at `24ab0fc`, 2026-10-17. Everything below was read
from the working tree; line numbers are for this commit.

## 1. What exists today

### Dataset boundary

- `packages/app/features/game/city-dataset.ts` — `parseCityDataset` (Zod)
  validates `data/harlem-apollo.json` (985 KB, v2, id `harlem-apollo-20261014`,
  origin `[-73.94975, 40.81005]`) before any GPU allocation. Returns owned
  v2 data: buildings, roads, areas, trees, landmarks, transit.
- Coordinates: local metres, **+x east, −z north** (so +z is south), +y up,
  0.1 m precision. Projection is equirectangular about the origin,
  duplicated in `packages/core/world/transform.ts` (`projectToScene`) and
  pinned equal by `packages/core/test/world-resume.test.ts`. Saves key on
  `(datasetId, datasetVersion)`; `CITY_DATASET_MIGRATIONS` carries v1→v2
  identity (`city-dataset.ts:341`).
- Bake pipeline: `tooling/city/fetch.mjs` (Overpass, cached), `build.mjs`
  (projects, simplifies, classifies, writes the JSON), `print-counts.mjs`
  (parses with the app's own parser). Ported from metro-live (MIT; notice in
  `docs/implementation/city-world.md:219-247`).

### Scene and render boundary

- `city-scene.ts` — `createCityScene(context, params)` builds the scene,
  owns the `CityCamera {x,z,yaw,distance}` contract (8–3000 m), and calls
  each actor's `update(frame)` before placing the camera. The canvas is
  **on demand**: it only redraws while an actor reports `update() === true`
  (`city-scene.ts:192-218`). Actor frame = `{delta, time, reducedMotion}`;
  delta is clamped to 0.1 s and measured by the scene itself when the canvas
  wakes from pause.
- `scene-actor.ts` — the actor seam: `SceneActorFactory(THREE) →
  {id, object, update(frame)→boolean, dispose()}`. Pure types, no three
  import. Actors never touch the world's meshes; the world never reads
  actor state. **This is the natural mount point for a traffic/pedestrian
  system.**
- `world/index.ts` — `buildCityWorld` assembles everything static: sky
  dome, ground, `city-mesh` merged meshes, trees (`foliage/tree-lod`),
  `street-furniture` (signs + streetlights), `street-props` (hydrants,
  baskets, parked cars, transit). `setViewDistance` drives LOD; `setFocus(x,z)`
  rebuilds near-field buffers after a ~10 m move into preallocated storage.
- `render-snapshot.ts` + `render-runtime/game-render.ts` — the worklet
  render path: JS-side state is packed into a flat `number[]` handed across
  a `Synchronizable`; the worklet runtime owns its own three.js + scene and
  reads the latest snapshot each tick. Currently 21 slots (camera, Caller,
  view). **A living-city sim must publish actor state through this same
  channel — flat arrays, versioned, no per-actor React state.**
- `game-session.ts` — module-scope Zustand stores deliberately outlive the
  GameScreen component (fold/unfold/rotate never reset state). Simulation
  seed+clock should live at this layer or above, not in the canvas.

### Street-level systems already built (do NOT rebuild)

| System | Files | What it provides |
|---|---|---|
| Parked cars | `world/street-props-layout.ts` (`placeParkedCars`), `world/street-props.ts` (`city:cars`) | Slot every 6.4 m on carriageways ≥10 m, 55% hash occupancy, 20% taxis; cleared from crossings, intersections (3 m), hydrants (4.6 m, NYC rule), buildings. One InstancedMesh, nearest 220 within 200 m follow the Caller. `CAR_LENGTH 4.6`, `CAR_WIDTH 1.9`. |
| Streetlights | `world/signage.ts` (`placeStreetlights`), `world/street-furniture.ts` | LED pole every 32 m, sides alternating, 0.8 m past kerb; 420 poles + flat heads; additive light pools under the 48 nearest within 110 m (`POOL_CAP`, `POOL_RADIUS`). |
| Street signs | `world/signage.ts` (`findIntersections`, `placeSigns`), `world/pixel-font.ts`, `world/lettering.ts` | NYC green blades at 210 of 218 named intersections; 5×7 pixel-font DataTexture atlas (no DOM canvas on rn-webgpu — this is the proven way to get text). |
| Clearance / walkability | `world/walkability.ts` | `createStreetClearance` — carriageway buffers + kerb margin, sidewalk band, `standable`/`inCrossing`/`clearOfOthers`/`toSidewalk`/`nearest` queries over a 32 m grid. `createWalkQueries` — `isWalkable(x,z)` for the Caller (buildings + 0.3 m body radius block; roads+sidewalks+footways+parks walkable). |
| Intersection discovery | `world/signage.ts:82` `findIntersections` | Crosses differently-named carriageway segment pairs in a 40 m grid, merges within 30 m → `StreetCross {x,z,streets[2]{name,dir,width}}`. 218 found on this tile. **A candidate seed list for signalized intersections** — but it ignores unnamed roads and T-junctions of same-name streets. |
| Instanced-near-field pattern | `world/tree-lod.ts` (`pickWithin`, `TREE_REFRESH_METRES`), `street-furniture.ts`, `street-props.ts` | Preallocated Float32/Int32 scratch, nearest-N selection within radius, instance buffers rewritten only after a 10 m move. Directly reusable for moving-actor instance management. |
| Budget | `world/budget.ts` + `world/budget.test.ts` | `visibleTriangles` rule; test holds chase 8/18/40 m + 125th St walk under 300 k. |
| Caller | `character/` (`locomotion.ts`, `caller-proxy.ts`, `caller-store.ts`) | Gait/speed/collision-slide maths, pure; the one existing moving actor. |

## 2. What the dataset gives a lane graph — and what it does NOT

From `harlem-apollo.json` + `build.mjs:431-484`:

- Roads carry: `id` (`osm:way:N[:K]` — clipped pieces get suffixed), class `c`
  (`primary/secondary/tertiary/residential/living/service/pedestrian/footway/
  sidewalk/crossing/cycleway/motorway/trunk`), width `w`, symmetric sidewalk
  `s`, polyline `p`, `e` (width-estimated flag), `n` name.
- **Crossings exist**: 632 `footway=crossing` ways, plus 849 `sidewalk` and
  313 `footway` ways — a real pedestrian skeleton.
- **Missing for traffic**: `oneway`, `lanes` (read only to estimate width,
  then dropped), `lanes:forward/backward`, `turn:lanes`, `maxspeed`,
  `highway=traffic_signals` nodes (never fetched — `fetch.mjs:47` queries
  `way["highway"]` only), `crossing=traffic_signals`, kerb/tactile tags,
  `parking:lane:*`, bus lanes. **No node/connectivity graph**: roads are
  clipped polylines; junction topology must be derived (fable's approach:
  shared-endpoint nodes) or shipped in the v3 schema.
- **Valdrada v3 is IN FLIGHT** — branches `lane-v3e1`, `lane-v3a1` exist as
  worktrees at `24ab0fc` (scaffolding, no code yet);
  `docs/plans/harlem-v3-valdrada-prompt.md` §5.2 extends `roads[]` with
  `l` (lanes), `ow` (oneway), `sp` (speed), `sid` (segId) plus
  `furniture` (hydrant/linknyc/bikeRack) and a `sources[]` list.
  **Recommendation:** build the `LaneGraph` adapter against a sidecar
  interface that maps v2 today (inferred lanes from `w`/class, all two-way,
  labeled as inferred) and consumes v3 fields verbatim when they land —
  flagged `verified` vs `inferred` per spec §6.

## 3. Reuse map for traffic/pedestrians

| Need | Reuse | Notes |
|---|---|---|
| Roadside parking | `placeParkedCars` output — treat each filled slot as occupied space in the lane graph (moving cars never overlap); its clearance rules already encode hydrant/crossing law. | Slots are deterministic by hash — a parked car is addressable by `(road.id, side, index)`. |
| Sidewalk/pedestrian graph | `WALKWAY_CLASSES` split + crossing ways + `clearance.toSidewalk`/`nearest` + walkability grid | The *query* layer exists; what's missing is a routable graph (nodes at kerb ends, connectors across crossings). Build `PedestrianGraph` on the same segment-grid machinery. |
| Intersection set | `findIntersections` as bootstrap; augment with same-name T-junctions + unnamed-road crossings for real coverage | 218 named-pair crossings is a good start; the spec wants ≥3 verified intersections first. |
| Vehicle placement/heading | `placeParkedCars` kerb-offset + facing convention; `frame()` in `world/parts.ts` | Local frame convention: x along road. |
| Lamp/light-pool | `furniture.lights` placements + `POOL_CAP` additive pools — extend to a clock-driven on/off + headlight pools; do NOT add a second lamp system | The heads are already instanced; pools already refresh around the Caller. |
| Text/glyphs | `pixel-font.ts` atlas — ped-signal WALK/hand and countdown digits should sample this same atlas budget | react-native-webgpu has no DOM canvas — proven path. |
| Materials | `materials.cars` per-instance tone attribute (`TONE_ATTRIBUTE`, PAINT marker), `car-materials.ts` L4 clearcoat PBR | Moving fleet can share the `cars` material family or a sibling; L4's dusk lamp-switch pattern is the model for headlight emissive. |
| Sim/render split | `render-snapshot.ts` slot array + `Synchronizable`; `ActorFrame` contract | Extend snapshot (or add a second Synchronizable) with packed actor transforms; interpolate between sim ticks in the actor's `update`. |
| Continuity | `game-session.ts` module-scope stores; `world-resume/` save lifecycle | Sim seed+clock+signal phases must survive remount; saves must not silently carry sim state across dataset versions. |

## 4. Open branches/PRs that overlap (from `gh pr list`, 2026-10-17)

| PR | Branch | Overlap risk |
|---|---|---|
| 56 OPEN draft | `lane-e2-toon-material` | **High** — clean-room toon material touches the same `world/materials.ts` surface a traffic renderer would extend. Sequence: land traffic instancing with its own material file; do not fork materials.ts. |
| 54 OPEN draft | `lane-e1-toon-look-spec` | Doc only; same area (E lanes replace the cel look). |
| 48 OPEN | `feat/nycmon-surface-detail-20261016` | Benchmark lane touching `facade-detail.ts` / masonry close-up. No functional conflict; watch for shared `world/` test edits. |
| 47 OPEN | `perf/nycmon-duo-frame-probe-20261016` | Frame probe + device gates — **reuse it**, don't add a second probe. |
| 49 OPEN | `feat/nycmon-cinematic-shot-20261016` | Camera lane (Klipp shots) — touchpoint is `city-camera.ts`, orthogonal to actors. |
| 50 OPEN | `feat/nycmon-district-authority-20261016` | Colyseus district authority — future multiplayer ownership of actor state. Design sim state so authority can own it later; don't hard-wire singletons. |
| 51 OPEN | `test/nycmon-pixijs3d-comparison-20261016` | Test-only; no overlap. |
| 18 OPEN | `draft/quest-presence` | XR presentation; living-city actors must keep working when the world is presented on Quest — keep sim renderer-agnostic. |
| in-flight | `lane-v3e1`, `lane-v3a1` | Valdrada v3 dataset — see §2. Lane graph consumes `l/ow/sp/sid` when it lands; don't bake v2-only assumptions into the graph schema. |

Merged-recent context to not regress: R1 vsync worklet pacing, U1 UI-thread
attribution, L1–L6 realism lanes (sky rig, PBR, glass, car PBR, post,
tiers, render scale — all behind env flags). G1's BundleGroup
(`EXPO_PUBLIC_WORLD_BUNDLES`) was deleted 2026-11 — the r186 replay froze
the camera transform (upstream missing binding updates) — so actors have
no bundle-membership rule to keep; the whole scene is one direct pass.

## 5. A living-city lane must NOT duplicate

1. **A second parked-car system** — extend `placeParkedCars` occupancy;
   moving cars spawn on lanes, parked slots stay static.
2. **A second streetlight/sign system** — lamps exist; add clock-driven
   emissive/pool switching and signal heads as *new* instanced objects, not
   a parallel furniture pass.
3. **A second scene/canvas/renderer** — one `createCityScene`, one canvas;
   actors mount through `SceneActorFactory`.
4. **A second walkability/clearance index** — pedestrians and props share
   `createStreetClearance`; a `PedestrianGraph` consumes it, it doesn't
   replace it.
5. **Per-frame allocations / per-actor React state** — the codebase's
   discipline: preallocated typed arrays, flat snapshots, `update()`
   returning boolean for the on-demand canvas.
6. **Procedural city grids** — the OSM/Valdrada tile is the road network;
   three.js `CityGenerator`'s grid must never supply topology (spec §10A).
7. **React state per actor or `setInterval` visuals** — signal heads read
   the one controller state each frame.

## 6. Gaps a lane must fill (not duplicates — genuinely absent)

- Directed lane graph, connectors, turn legality, conflict matrix.
- Signal controller + phase machine (nothing exists).
- Vehicle kinematics (IDM following, steering, wheel/spin state).
- Pedestrian routing (sidewalk lanes, kerb-wait, crossing permission).
- Game clock / time-of-day authority (today's sky is a static pick; L1 rig
  has named skies but no continuous clock).
- `WorldAssetRegistry` + GLB import path (no GLTFLoader usage anywhere in
  the game feature today).
