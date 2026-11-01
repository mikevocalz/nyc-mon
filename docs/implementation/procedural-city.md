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
- **VGC1 kind producers**: colliders/pednet/spawns/labels read the spec's
  use tags — the readers exist (`vd-port/systems/`), the gen emitters do
  not.
- **Consumers**: nothing reads `use`/`styleId` yet beyond facade params.
- **Visual verification**: host-tested only. No rendered frame, no device
  numbers, no walk-profile residency measurement with the flag on. Spec
  build on the real tile measured ~42 ms once per world build (host).
