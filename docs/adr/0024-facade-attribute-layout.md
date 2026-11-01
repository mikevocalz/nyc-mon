# 0024 — Facade attribute layout for the physically lit walls

- **Status:** Proposed. The layout, byte cost and draw count are node-verified on the real Harlem tile. What the facades look like on iPhone 17 and iPad Pro is open until the Phase 0 rows and the D2 frames exist (ADR 0023).
- **Date:** 2026-10-27
- **Deciders:** Mike
- **Builds on:** ADR 0023 (renderer mode; `EXPO_PUBLIC_WORLD_PHYSICAL`).
- **Sources:**
  - `docs/plans/slop-grade-city-prompt.md` §5.4 "Facade inputs" (L307) and §6.4.
  - Slop New York @ `be65d0a`, `js/tsl-materials.js` `WALL_KINDS`, `createFacadeBoxes`, `facadeCell`.
- **Code:** `packages/app/features/game/world/physical/facade-attributes.ts` (layout, `packFamilyPier`), `physical/class-family.ts` (`seedTone`, `masonryIndex`, `cornerPier`), `physical/facade.ts` (the graph that reads them), `world/city-mesh.ts` ~L327–373 (writers) and ~L718–725 (`facadeBytes`), `world/geometry.ts` `VertexBuffer.toGeometry` ~L155–161 (the existing 16 floats). Tests: `physical/city-mesh-physical.test.ts`, `physical/materials.test.ts`, `city-mesh-v3.test.ts`.

## Context

Slop builds each facade from boxes, so its facade graphs read per-box local coordinates and a handful of per-building numbers: floor height, window width, a seed and a corner pier (`createFacadeBoxes`, `facadeCell`). nyc-mon does not draw boxes. `city-mesh.ts` merges every wall of the tile into shared buffers, which is how the tile stays at 12 city draws (`future-layer-2026-10-18.md`; `city-mesh-v3.test.ts` L56–57). A merged buffer has no "this box", so the numbers Slop reads from the box have to travel with each vertex.

## Decision

Under `EXPO_PUBLIC_WORLD_PHYSICAL`, `buildCityMeshes(..., { facadeAttributes: true })` writes two `vec4` attributes on the wall buffers:

| Attribute | x | y | z | w |
|---|---|---|---|---|
| `aFacadeWall` | along the wall, m | wall width, m | wall height, m | wall kind (`WALL_KINDS`: shop 0, entry 1, rear 2, lot line 3, blank stone 4) |
| `aFacadeGrid` | floor height, m | window width, m | seed + tone | family × 4 + corner pier, m |

Packing:

- **Seed + tone** (`class-family.ts` ~L99–106): an integer seed 0–999 from the building id, plus a tone fraction kept inside 0.1–0.9, so `floor()` recovers the seed and the fraction never sits near an integer. At 1,000 a float32 still resolves about 6 × 10⁻⁵, well inside that margin.
- **Family and corner pier** (`packFamilyPier`, `facade-attributes.ts` L36–41): `masonryIndex × 4 + pier`, with the pier clamped to 0–3.99 m. The index runs over `MASONRY_FAMILIES` (`limestone`, `brick`, `brownstone`); curtain wall carries −1, which clamps to 0, and its graph ignores the field.
- **`along`** runs from the wall's start corner in ring order, which is Slop's `wallS` with no flip. Vertices that are not wall quads (cornices share the masonry buffer) get `PAD_WALL`, a 1 m blank-stone wall that the graph draws as trim with no windows.

Scope: the attributes go on `city:walls-masonry` and `city:walls-glass` only. Areas, sidewalks, roads, roofs, landmarks, neon, billboards, street detail, landmark lettering and contact shadows get nothing (`city-mesh-physical.test.ts` L82–86).

## Cost

| Measure | Value | Where |
|---|---|---|
| Added per wall vertex | 8 floats, 32 B | `FACADE_FLOATS_PER_VERTEX`, `facade-attributes.ts` L33 |
| Existing per wall vertex | 16 floats, 64 B: position 3, normal 3, colour 3, uv 2, `aRoughMetal` 2, `aOcclusion` 1, `aFacade` 2 | `geometry.ts` ~L155–161 (counted by hand; no test states 64) |
| Growth on the two wall buffers | +50 % | 32 / 64 |
| Wall vertices on the real tile | 247,812 | `city-mesh-physical.test.ts` L80 |
| Added bytes on the real tile | 7,929,984 B (7.56 MiB) | `city-mesh-physical.test.ts` L81 |
| City draws, flag on | 12, unchanged | `city-mesh-physical.test.ts` L55–56; `materials.test.ts` L73 |
| Physical-mode draws on top | road paint +1, fire escapes +3 | `materials.test.ts` L72–75 |
| Total, flag on | 16 | sum of the rows above; no single test asserts 16 |

With the flag off the bake writes the bytes it always has: `city-mesh-physical.test.ts` L38–49 deep-compares the plain bake against the `{}` options bake, and L57–62 checks that the flag-on bake leaves every pre-existing attribute unchanged.

## Options considered

### A. Per-vertex attributes on the merged wall buffers (chosen)

| Dimension | Assessment |
|---|---|
| Draws | None added; the walls stay two draws |
| Memory | 7.56 MiB of vertex data on this tile |
| Shader cost | Two extra vertex fetches; no texture read |
| Fit to Slop | Direct: the graph reads the same numbers `createFacadeBoxes` puts on a box |

### B. One draw per building with uniforms

Rejected. The draw count would go from 12 to one per building on the tile, which is the thing the merged bake exists to prevent.

### C. A per-building data texture indexed by a building-id attribute

| Dimension | Assessment |
|---|---|
| Memory | Smaller: one float id per vertex plus a small texture |
| Shader cost | A dependent texture read in every facade fragment |
| Gaps | `along` and wall size are per wall, not per building, so they still need attributes; the saving shrinks to the `aFacadeGrid` half |

Rejected for this lane. It is the fallback if the 7.56 MiB shows up as a memory problem in the iPhone 17 soak (§6.5).

## Consequences

- The wall buffers grow by half under the flag. Anything that budgets GPU memory for the tile (`perf/tier.ts`, the §6.5 measurements) counts 7.56 MiB more on this tile.
- A new building class has to map to a family in `class-family.ts` before it gets a facade; an unmapped class shows as blank stone.
- A larger tile scales the cost linearly with wall vertices: 32 B each.
- A corner pier wider than 3.99 m cannot be packed; the ×4 step would have to widen first.

## Verification status

- **Node-verified:** the layout, the 247,812 vertices, the 7,929,984 B, 12 city draws flag on and off, road paint present, three fire-escape meshes, and flag-off byte identity (`city-mesh-physical.test.ts`, `materials.test.ts`, `city-mesh-v3.test.ts`).
- **Not verified:** frames and GPU memory on iPhone 17 and iPad Pro. No device run backs this ADR.
