# Procedural city — `world/gen` (Phase 3, PR 3 slice 1)

Seeded procedural building generation riding the Valdrada cell stack. Zero
disk: no packs, no cell source, no manifests — a cell's spec is the authority
and the arrays are derived on demand.

## What generates

Per 128 m cell (`cells/cell-rules.ts CELL`), two lot sources:

- **Marked areas** (`dataset.areas`): a `school` area gets a school block
  (70 % cover, 3–5 floors, CIVIC_STONE typology), a `pitch` gets a low
  grandstand on its north edge (1–2 floors, INDUSTRIAL). The open kinds —
  `park`, `garden`, `grass`, `playground`, `plaza`, `parking`, `water` —
  record `park` marker lots (floors 0, no massing) so later consumers see the
  use tag without re-deriving it.
- **Block interiors**: a 4×4 grid of 28 m-pitch lot slots per cell, kept at
  50 % (`GEN_FILL_SHARE`), 12–22 m footprints — courtyard scale. A candidate
  is rejected by a record footprint (rect-vs-ring, not the bbox — L-shaped
  footprints keep their gaps), a road corridor (carriageway/2 + sidewalk +
  4 m margin, slab test vs the inflated rect), a marked area's ring, or the
  playable-bounds predicate (`ctx.inBounds`).

Use vocabulary (`GEN_USES`, the taxonomy the dataset lacks): `school`,
`office`, `stadium`, `park`, `home`, `mixed`. Interior weights: home 0.55,
mixed 0.30, office 0.15. Each use maps to a `class`, a Valdrada STYLE id set
and a floor range (`spec.ts USE_RULES`).

## The seed contract

`GEN_SEED = 0x47454e` (ASCII 'GEN'), deliberately far from
`LIVING_CITY_SEED` (0x1c2026) and the bake's 0x4a9011. `genSeedFor(cellKey)`
= `hashUnit` (FNV-1a) scaled back to the u32, the seed constant inside the
hashed key — re-rolling the constant reseeds every cell without touching the
sequence. One mulberry32 stream per spec, consumed in fixed order (areas in
dataset order, then the lot grid row-major; every candidate consumes its
nine draws whether or not it survives). Same `cellKey` + dataset → same spec
→ byte-identical arrays, which is what makes eviction-and-regenerate honest:
`release()` drops the arrays and the next `prefetch` re-emits the identical
bytes. Verified by `gen.test.ts`.

## The layer

`gen/layer.ts` registers through `ctx.registerChunks` exactly like the
blocks' near level: one package per cell with massing, `prefetch` runs the
emission synchronously (a full cell is ≤ ~1 k verts of box massing — the
whole tile's 52 packaged cells generate in ~1 ms, worst single cell 0.55 ms
on the host), `ready` flips, `release` drops.

- Attribute layout = the near reader's (`blocks/codec.ts NearArrays`):
  f32x3 position (cell-local frame), RGBA8 colour + emissive (the near
  encoding: colour alpha = day share lo/4, emissive rgb = linear glow/4
  sRGB-coded, emissive alpha = night share hi/4), f32x2 uv zeros, u16 index.
- Material: `makeBlocksMaterial` with `fw14 = null` — the near branch (no
  `vdShell`), so gen massing gets the record buildings' facet lighting, sky
  mirror and night handling; the FW14 grid and its texture stay out (one
  fewer bind; a second pipeline instance is accepted — measured pipelines
  only matter flag-on).
- Stream spec: `reachM 320` fixed across presets (inside the ipad/phone
  resident radius 360 so wanted cells are always admissible; between the
  blocks' 60–120 m near reach and the far tier's 13 km macro — a mid/near
  fill that fades before far). `fade: true`, `pin: false`,
  `sharedMaterial: true` (the dither rides the layer's own mask).
- Budget: `vdPort.gen` rows on every preset — ipad-a12x/phone
  `{4 MiB, 48 draws, 60k tris}`, high `{8 MiB, 128 draws, 200k tris}` —
  sized like `lite`, not `near` (a gen cell is ~0.4 k tris vs a lite cell's
  tens of thousands). Draws bind first, as intended for a fill layer.
- Massing: one box per lot, two past 7 floors (18 % setback inset). 20
  verts / 10 tris a box; wall tone = `WALL_TONES[class]` picked by
  style+salt, roof = `CITY_COLORS.roof`, per-use emission gain.
- Package bounds carry a 1 mm pad: f32 stored positions can sit a few ulps
  outside an f64 corner box — bounds must cover what the GPU draws.

## The flag

`EXPO_PUBLIC_WORLD_GEN` — opt-in, **off by default** (the `parseSkyRigFlag`
truthy set), read as `EXPERIMENTAL_WORLD_GEN` in `gen/layer.ts`. Wired into
the `parts` list in `vd-port/index.ts`; off, the parts list and the render
are unchanged. No-op without a streaming preset (a whole-built world has no
streamer to feed).

## Deferred to later slices

- **District authority** (real parcelization): interior lots sit on a fixed
  28 m grid today — seeded slots, not real parcels. Overlaps with record
  footprints are prevented; adjacency to them is not modelled.
- **Area massing** past school/pitch; plaza/parking/playground treatments.
- **VGC1 kind packs**: slice 2 emits the record *shapes* in memory
  (places.ts); nothing writes or reads VGC1 packs for gen content, and no
  VD_SYSTEM_MANIFEST merge exists — the baked kinds stay record-only.
- **Visual verification**: host-tested only. No rendered frame, no device
  numbers, no walk-profile residency measurement with the flag on. Spec
  build on the real tile measured ~42 ms once per world build (host).

## Slice 2 — places: generated content into the Mon systems

`world/gen/places.ts` turns one cell's spec into the record shapes the
systems already consume — same spec, same bytes, still pure and still
behind `EXPO_PUBLIC_WORLD_GEN` (read via `gen/flag.ts`, extracted so pure
consumers needn't pull the layer's three chain).

### What a cell emits (`genCellPlaces(spec, groundY)`)

- **`anchors`**: POI anchors for the place uses — `school`, `stadium`
  (pitch), `park` (all open grounds, incl. plaza areas) and `office`.
  `{use, position, radiusM, name?}`: position is f32x3 cell-local about
  the cell centre (y absolute, the near convention), radiusM is half the
  lot's shorter side. `home`/`mixed` infill anchors nothing. Names are
  descriptor words off the marked area (`School`, `Park`, `Playing
  pitch`, `Plaza`…) — the labels' no-invented-text rule keeps offices
  anonymous; `GenLotSpec.area` now carries the source `AreaKind` so a
  park marker names 'Plaza' where the area was one.
- **`prisms`**: a collider prism per building lot (floors > 0), in the
  `ColliderPrism` shape of `vd-port/systems/colliders.ts` — footprint
  ring extruded `groundY → groundY + floors × floorHeight`, no holes,
  `landmarkId`/`flags` 0, `style` = the lot's styleId. `srcId` takes the
  u32 top bit plus packed (cell, lot index): record ids pack (tile,
  index) below 2^27, so gen prisms can never alias record buildings.
- **`walks`**: WalkEdge-compatible stubs (`living-city/topology.ts`
  shape, `walk:gen:`/`node:gen:` ids): an 'edge' perimeter loop standing
  1.4 m off each building lot, a 'gate' path along the longer axis
  through each open lot (water skipped). Stubs — nothing stitches them
  into `LaneTopology` yet.
- **`spawnAnchors` + `habitats`**: `SpawnAnchor` records (the kind-4
  decode shape) mapped into the six-habitat wire vocabulary via
  `GEN_USE_HABITAT`: school → `community_hub` (CIVIC_STONE is the record
  rule's civic style), open grounds → `plaza`, any lot ≥ 20 m →
  `rooftop` on its roof — the write-spawns height rule verbatim. `park`
  itself is not in the wire vocabulary: bloodlines listing it match
  nothing baked today either.

### Consumers wired

- **Walkability** (`world/bundled-queries.ts`): `createGenBlockedFor`
  builds a blocked index over the tile's gen prisms — the same
  body-radius rim rule walkability.ts runs — ANDed into `isWalkable`
  exactly like the obstacles layer, only when the flag is on. Flag off:
  `genBlocked` is `null`, the composed query is unchanged.
- **Spawn habitats**: no runtime spawn ring exists yet (the kind-4
  decoders have no live reader). The seam is record-shape parity:
  `spawnAnchors`/`habitats` drop verbatim into a spawn-zone table. Least
  restructuring possible — there is no spawn code to restructure.
- **POI labels** (`city-walk/CityWalkStage.tsx`): `genPoiLabelsFor`
  feeds named gen places into the overlay's existing `'landmark'`
  `WalkLabel` channel — no new kind, flag off the list is `[]`. The
  Go-to destination list and `nearestDestination` are untouched:
  generated places are labels, not travel targets.

### Still deferred (after slice 2)

- **VGC1 kind-6 packs**: gen content emits no packs; the systems
  manifest merge (record + gen packs keyed `gen/<cx>_<cz>` or similar)
  is the deferred integration when a real runtime reader lands.
- **District-authority spec**: real parcelization still pending — walk
  stubs skirt fixed-grid lots, not real block faces.
- **Pednet stitching**: gen walk edges are stubs; a consumer that joins
  them to `node:` junctions of the record graph is unwritten.
- **Device/visual verification**: still host-only — flag-on frames,
  residency and spawn behaviour unverified on device.

## Slice 3 — manifest merge, district spec, pednet stitching

### The systems manifest merge (the audit gap)

`cell-source/index.ts` now ships `VD_MANIFEST`: `VD_SYSTEM_MANIFEST`'s
1,708 pack refs spread over `VD_CELL_MANIFEST`'s 1,692 cell refs — the
namespaces are disjoint (`colliders/`/`pednet/`/`traffic/`/`spawns/`/
`labels/` against `far/`/`lite/`/`near/`/`ringN-*`/`structures/`), so the
merge is a union, never an overwrite. `configureVdCellSource` defaults to
it, which closes the engine-audit gap: system pack keys are now inside
the pin, so their bundled copies verify sha256 + bytes like geometry
cells instead of riding the unmanifested-bundled fallback unverified.
`vdSystemFetch(kind, key, bundled?)` is the `<kind>/<cell>` key joiner
for readers. The first runtime reader: `CityWalkStage`'s street-label
source now loads `labels/` packs through `vdSystemFetch` — same bytes,
now pin-checked. Colliders decode through the same path in the manifest
test; pednet/traffic/spawns still have no live reader (the LaneTopology
sidecar serves their job today), so their packs reach fetch-and-decode
but not a simulation.

### The generated-city district

`core/realtime/gen-district.ts` holds `GEN_DISTRICT_ID`
('harlem-apollo-gen') and `genDistrictSpec(walkable)`: the default
district contract — 50 ms tick, same speeds and bounds — under the gen
id, with the wall query injected (core stays env-free). The app seam
`world/gen/district.ts` `worldDistrict()` returns that spec built on the
tile's composed `isWalkable` — which already ANDs the gen-prism blocked
layer in — only while `EXPO_PUBLIC_WORLD_GEN` is on; off, it returns
null and nothing registers. `buildWorldSave` records the id on a fresh
save the same way (`previous?.districtId` still wins), flag off the
field stays null. Dex `districtId` stays null on every form — the canon
field is unauthored and the generated city invents no Mon homes.

### Pednet stitching

`world/gen/pednet.ts` is where the walk stubs land: `genWalkEdgesFor`
enumerates the tile's stubs, `stitchGenWalks` re-keys a **gate** end to
the nearest record band end's junction node when it lands within
`GEN_GATE_ATTACH_METRES` (12 m — inside the sim's own 28 m corner-link
cap, so the sim's distance and jaywalk checks still gate the hop), and
`appendGenWalks` folds the result into `LaneTopology.walks` sorted-by-id
with `stats.walkEdges` counting it. **'edge' loops never re-key** — a
closed circulate stub has no ends to attach, and PedSim's own
`nodeA !== nodeB` spawn filter keeps ambient peds off them anyway. A
gate with no junction in reach stays an isolated `node:gen:` stub:
spawnable, but a ped reaching its end only turns back
(`decideAtBandEnd`'s turnback option — the gen node isn't in
`nodeById`, which that code already tolerates). `bundledTopology()`
performs the append only flag-on; flag off the built sidecar is
byte-identical, `walk:gen:` ids included. Measured on the bundled tile:
1,126 record walks + 306 gen stubs (78 loops, 228 gates) — 34 gates
attach at one end (one attaches at both); the rest stay isolated stubs,
which is the honest shape of mid-block open lots with no junction in
reach.

### Still deferred (after slice 3)

- **VGC1 kind-6 packs / gen pack emission**: gen content still emits no
  packs, and pednet/traffic/spawns packs still have no live consumer —
  the topology sidecar answers what they would.
- **Real parcelization**: interior lots are still seeded slots on the
  28 m grid; the district spec wraps the composed walkable, it does not
  reshape the lots.
- **Device/visual verification**: still host-only — flag-on frames,
  residency, corner-link hops and district ticks unverified on device.

## Slice 4 — coverage: the district profile and the deferred package

The gen layer stops at the dataset square no longer. Two pieces:
`genDistrictForCell` gives every cell a dataset-free density profile, and
`genCellPackageDeferred` makes registration O(1) a cell so the layer can
blanket a bounded region instead of spec'ing the tile up front.

### The district profile (`spec.ts`)

`genSpecForCell` splits on a new `GenSpecParams.recordsExtentMeters` (the
layer passes `dataset.extentMeters`): a cell the index does not know AND
whose centre sits outside the records square takes the **district branch**
(`source: 'district'`); every other cell — bucketed, or bucket-less but
inside the square — takes the **records path verbatim**. That condition is
the whole byte-identity argument: the only cells that changed are cells
that produced nothing before (no bucket ⇒ no area lots; outside the
square ⇒ the `inside` gate rejected every interior candidate). Callers
that omit `recordsExtentMeters` get the pre-slice-4 derivation on every
cell, so `places.ts`/`pednet.ts` and the existing tests are untouched by
construction.

A district cell runs the same 4×4 slot grid and the same nine draws per
candidate (the seeded-slot contract), with three changes:

- the keep roll answers the district's `fill`, not `GEN_FILL_SHARE`
  (`params.fillShare` still overrides, for tests);
- the use roll first spends `parkShare` (a `park` marker lot, no
  massing), then walks the district's built-use weights over
  `home/mixed/office/school/stadium`; `floorsAdd` stretches the top of
  every built use's floor range — the core's towers;
- slot (0, 0) is the **anchor**: always built, never park, so every
  district cell raises at least one box and no deferred package is ever
  born empty on district ground.

No keep-outs run (the index knows nothing here) and `inside` is not
consulted — the caller's enumeration is the bound.

`genDistrictForCell(cx, cz)` — deterministic from
`hashUnit('gen:district:'+key)`: radial bands off the tile centre
(125th St; x east, z south), wobbled ±800 m per cell so district edges
fray instead of drawing a clean circle:

| district | where | fill | park | built-use mix | floorsAdd |
|----------|-------|------|------|---------------|-----------|
| `core`   | southerly cone (z/r > 0.45), 5–11 km — the Manhattan spine (Midtown→Downtown) | 0.88 | 0.02 | office .55 / mixed .30 / home .11 / school .02 / stadium .02 | +6 |
| `mid`    | ≤3.2 km any direction, or the spine to 14 km (z/r > 0.3) — inner borough texture | 0.60 | 0.06 | home .45 / mixed .30 / office .15 / school .03 / stadium .02 | +2 |
| `edge`   | ≤19 km — borough scale | 0.38 | 0.15 | home .55 / mixed .15 / office .05 / school .10 / stadium .15 | 0 |
| `open`   | beyond | 0.14 | 0.30 | home .50 / mixed .08 / office .02 / school .10 / stadium .30 | 0 |

### The deferred package and the extent (`layer.ts`)

The alternative designs were *eager spec over a bounded region* vs *lazy
packages*. Eager over even a modest region repeats slice 1's ~42 ms spec
build many times over; a truly unbounded "any `gen/` key on demand" scheme
has no streamer seam (slots come from the registered `packages` array, and
a pick already walks every slot for `boxDistance`). So the choice is a
**bounded extent of lazy packages**: `GEN_EXTENT_CELLS = 32` — cells
[-32, 31] each axis, a [-4096, 4096) m square, ~67 km², covering the home
tile plus the near void a ground-level walk reaches (Morningside, Central
Park, the near Bronx bank). 4,096 cells ⇒ ~4 k extra distance tests a
pick (~0.35 ms steady-state measured on the host) and ~12–14 ms
registration on the real tile — startup is O(1) per cell.

`genCellPackageDeferred` registers conservative fields — cell-box plan
bounds padded to `groundY ± (24, GEN_MAX_HEIGHT_M+16)` and densest-cell
estimates for `bytes`/`vertexCount`/`triangles` — and computes nothing
until `prefetch`, which specs, boxes and emits in one go when the
streamer enters the reach ring (sub-ms a cell; ~0.008 ms/cell average
measured eager over the whole extent, district cells far under the 2 ms
budget). Every read that feeds a budget decision happens after prefetch,
so the estimates only ever reach the registration stat. A records cell
whose spec leaves no massing marks itself `suppressed()` after its first
prefetch — the want test refuses it thereafter, the same net shape as
slice 1's "no package" but discovered lazily. `release` drops the arrays
only; spec and boxes stay, so a re-prefetch re-emits byte-identical.

`genRecordCellAt` keeps gen out of cells the baked manifest already
streams (every `lite`/`near`/`ringN-*`/`structures` cell in
`VD_CELL_MANIFEST` outside the dataset square) — district fill on top of a
baked ring would raise buildings inside record buildings. On the real
tile: 309 cells kept out, **3,787 packages registered**; measured spec
mix: 240 records cells (in-square or bucketed) + 3,547 district cells
(mid 2,547 / edge 1,121 / core 119 corner cells past 5 km).

### Coverage math — honest fraction of the 1.5 M target

- Registered region: 3,787 cells → **~30,200 built lots** (+ ~2,400 open
  park markers) — ~8× the tile's 3,742 record buildings, covering ~67 km².
- Extrapolated to five-borough ground (~300 km² ≈ 18k cells) at this
  granularity: ~110–150k buildings — **~8–10 % of the target**.
- So slice 4 reaches **~2 % of 1.5 M** in registered cells. The 28 m grid
  caps a cell at 16 lots; real NYC blocks run 30–40 buildings per cell —
  parcelization could ~3× this, still not 1.5 M. The honest path to the
  target is a coarser instanced/streamed gen tier (far-scale silhouettes
  from the same spec), not denser near cells — per-cell work stays
  sub-millisecond *by keeping* the 16-slot grid.

### Still deferred (after slice 4)

- **Systems records past the tile**: `genPlacesForTile`,
  `genWalkEdgesFor`, `createGenBlockedFor` and `genPoiLabelsFor` still
  enumerate the dataset square — district cells emit the same shapes
  (coverage.test.ts proves it) but nothing indexes their prisms, walks
  or anchors tile-wide yet. Walkability past the tile is already
  record-false, so the gap is data, not correctness.
- **Full-borough coverage**: 1.5 M needs the instanced far-gen tier
  above; `GEN_EXTENT_CELLS` is a slot-count bound, not a coverage claim.
- **VGC1 kind-6 packs / real parcelization / device proof**: unchanged
  from slice 3 — flag-on frames, residency and walk-profile numbers
  remain unverified on device.
