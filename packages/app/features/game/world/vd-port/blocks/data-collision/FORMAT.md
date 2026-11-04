# Exact shell collision assets

`build-shell-collision.mjs` runs the existing triangle acceptance and BVH producer offline. It consumes every committed block shell pack and its cell metadata. It does not simplify, weld, quantize again, substitute a collider, change triangle IDs, or depend on Blender authoring references.

The production region is the dataset's 850 metre extent plus the existing 42 metre chase margin: `[-892,-1,-892,892,24,892]`. Triangles use the existing inclusive AABB coverage filter and area threshold `1e-8`. An accepted triangle remains whole. Render geometry and collider visibility ownership are unchanged.

## Outer NCP1 bank

The first 64 bytes are:

| Offset | Type | Meaning |
| --- | --- | --- |
| 0 | 4 bytes | `NCP1` |
| 4 | u16 LE | Version 1 |
| 6 | u16 LE | Header size 64 |
| 8 | u32 LE | Total bank bytes |
| 12 | u32 LE | Number of nonempty compressed cell payloads |
| 16 | u32 LE | Number of ring source identities |
| 20 | 12 bytes | Reserved zero |
| 32 | 32 bytes | SHA-256 of the exact directory JSON |

The shared `shellCollisionDirectory` function serializes version, layout, region, frame, and ring/cell directory in the same explicit order in the producer and loader. The outer file hash is excluded from that directory to avoid a cycle. `manifest.ts` records the complete bank hash. This binds the directory offsets, original shell hashes, cell coordinates/ranges/bounds and quantized frame to the binary bank.

Each nonempty cell is a single gzip member; its absolute byte range, decoded length and decoded SHA-256 are in the authenticated directory. Empty and disjoint cells have no payload. The loader verifies the whole compressed bank and directory before scene construction, then authenticates each actual source shell file. Individual scene payloads inflate into a fixed, bounded owned buffer. No decoded cell is cached globally.

## Inner NVB1 cell

Each cell starts with the 64-byte header in `triangle-collision-binary.ts`. It records layout/version, retained and original triangle counts, node count, exact array lengths, total length, leaf size 12 and producer algorithm version 1. Five aligned arrays follow:

| Array | Element type | Length |
| --- | --- | --- |
| Absolute positions | Float32 | retained triangles × 9 |
| Original source triangle IDs | Uint32 | retained triangles |
| Partition order | Uint32 | retained triangles |
| Node AABBs | Float32 | nodes × 6 |
| Child/range records | Int32 | nodes × 4 |

No geometry scan, triangle filtering, partitioning or tree rebuild runs for production shell collisions during START. The existing query implementation reads these arrays, with the same body radius, ray result IDs, floating-origin convention and mesh-visible callback. Scene disposal releases the arrays; the shared asset bank retains compressed bytes only. Actual retained buffer sizes, including binary headers, are charged to collision memory.

Generic geometry producers that inject their own bytes can still construct the original exact tree. Production preload always supplies the required paired bank and rejects changed source/frame/coverage data. Missing or corrupt required authored assets reject START rather than switching building lanes.

Native timing, query-equivalence regression execution and asset-corruption checks are deferred under the user's instruction not to test until all implementation work is complete. Asset generation is recorded separately from those acceptance checks.
