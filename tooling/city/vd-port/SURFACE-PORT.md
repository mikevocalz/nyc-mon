# Authored block surfaces

Status: implementation in progress. The bundled legacy near pack still omits
authored material detail. VDN3 codec tests do not establish visual completion.
PR #171 remains a draft until regenerated surfaces pass physical iPad checks.

## Source and assets

The builders are Valdrada source commit
`2724c7938f20e068748ad1fd66e907d2bc662e3e` (MIT). Dataset release `v0.4.0`
resolves to `09b583662e760b5976d636d341d0e5f81a7c7fcf`; the source Git commit
is not a dataset revision. Preserve both identities in provenance.

Run `node tooling/city/vd-port/fetch-vegetation.mjs` to populate the ignored
vegetation cache. It checks every byte count and SHA-256 against
`vegetation-pins.json` and refuses a mismatched cached file. The source atlas
contains albedo coverage and normal/translucency channels. Hedge alpha carries
AO or height, rather than opacity. Retain those roles during packing.

## VDN3 layout 1

The 64-byte header includes the full 32-byte material registry SHA-256. Each
52-byte source vertex contains the existing quantized position (8 bytes), raw
source RGB as binary16 (6), presence flags (2), float32 UV (8), octahedral
SNORM16 normal (4), material ID (2), binary16 grime (2), variant address (4),
and float32 weather (16). Legacy VDN1 and VDN2 retain their existing contract.

Decode RGB and grime to float32 for GPU upload. The six vertex buffers consume
76 bytes per vertex; native half-float support is unnecessary. RGB includes HDR
values above one, and grime can exceed one. Reject nonfinite values and half
overflow; do not saturate them. Material and variant addresses are constant
over each triangle. Preserve seams when welding or simplifying.

Material descriptors and family variant rows are separate tables. Keep source
UV transforms, color spaces, wrap modes, alpha, emission and custom attributes.
Transform normals with the inverse transpose, correct mirrored winding, and
restore source coordinates for world-mapped procedural patterns and weather.
Unknown shader families must stop the bake rather than acquire a generic
material silently.

### Invalid source normals

The pinned Standard SG Gvc program
`32e78de07260fc42e78739b0c766cab037abb0972d16290ef4eec4b8d398a0e9`
contains nondegenerate triangles whose three authored normals are zero. For
this program, the bake derives the unit face normal from the original
triangle winding, then applies the inverse transpose. Mirrored transforms
reverse the output winding separately. Positions, indices, UVs and colors are
preserved. This is intentional asset cleanup, rather than bit-exact normal
parity. The audit records every repaired mesh, material, triangle and source
cross product. Mixed zero normals, unknown programs and nonfinite values fail
the bake. Exact zero-area triangles are omitted and counted separately.

The same cleanup is approved for the named Standard `ar33sign:metalvc` material,
shader `90dafc8a6565b3512e240989827cb1643675097cb4b2cf5ee0b49277fe99adce`,
only with the pinned `signKit.js` closure
`9736faa6153bf9b4f21b8c5e2e10ef9c5316ef89a557f2967c9568d3c122ee46`.
The read-only diagnosis identified 24 nondegenerate faces across structures
`w125-365` (2), `w125-163` (8) and `w125-361` (14), with no mixed or nonfinite
normals. Every repair records its structure, mesh path, triangle, original cross
product, shader identity and source closure. Other Standard materials remain
outside this rule.

## Residency and acceptance

The settled region census covers 175 structures and 1,169 material descriptors:
76 shader hashes and 84 key/hash variants. Capture waits for source fonts and
network activity to settle, because asynchronous sign loading replaces provisional
materials. All descriptors match exactly one runtime classifier, with no missing
active material parameters. Full-family row generation and geometry replay remain
required; identity coverage does not establish complete assets. The texture payload
is too large to keep wholly resident on the A12X. Deduplicate identical payloads and
stream cell-referenced pages with explicit ownership and disposal. A cell must
have all required family geometry and texture pages before revealing its
surfaces. Hide its shell only after the complete cohort has faded in.

The full geometry audit passes all 175 structures: 7,454,823 retained triangles,
13,603 exact zero-area omissions, 56 audited Gvc normal repairs and 24 audited
MetalVC repairs. The latter affect only three source meshes in structures
`fk:w125-365`, `fk:w125-163` and `fk:w125-361`. Other invalid normal cases remain
errors. Full parameter replay also passes 1,169 material rows and 5,128 exact
variant/frame records; packed texture bindings and native delivery still require
separate verification.

Before release, verify Apollo lettering, mapped walls, glass, signs, weather,
day/night lighting and near/shell transitions on the attached iPad. Measure
startup, streaming frame cost and texture residency. Record actual evidence
and limitations separately from codec or shader compilation tests.

## Program coverage audit

Run `audit-surface-programs.mjs <settled-census.json> <gaps.json>` to compare
captured identities with the explicit program contracts and available helpers.
The report retains distinct source keys, material types, renderer flags and
source file locations. A matching classifier proves identity coverage; it does
not prove that a complete material factory, texture bank or native draw passed.
Unknown programs remain bake failures. Helpers must retain their authored
composition order when a factory binds them.

The pure Apollo, custom-building and vegetation contracts pin the settled
template, hook defines, source type and SHA-256. Their source basis is
`shaderlib-material-template-and-hook-defines-v1`; the exact Three.js and source
file hashes bind the shader chunks. Legacy provisional Standard-template hashes
for Apollo's Basic tubes are deliberately rejected.


## Native compression checkpoint

The physical A12X app device reports `texture-compression-astc` enabled. The
separate three-set ASTC pilot retains original KTX dimensions, mipmaps and all
channels, including normal XYZ and ORM alpha. The transcoder verifies source
SHA-256 and the installed Basis JS/WASM hashes. It does not resize textures.
The runtime verifies enabled-device support before page IO and creates compressed
textures directly. An unsupported compressed page fails explicitly.

The paired ASTC pilot registry is
`e1251285e1e93684cb2c517251d0f2477e5a81a997d6454f779e8a68e8c4a6c5`.
Its 14 families, 17 materials and 5,255 triangles pass recording-GPU replay using
54,168,520 page bytes plus 9,056 table bytes. This retains 108 original mip uploads
across 12 pages. Physical image correctness, active-game memory and frame cost
remain acceptance requirements. The legacy production asset bundle is unchanged.
