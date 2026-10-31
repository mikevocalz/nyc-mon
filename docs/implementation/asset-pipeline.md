# Asset production pipeline — Blender → GLB → LOD → manifest → R2/Bunny → three

Phase 2 (PR 2) state doc, written 2026-10-31 on `pixy-branch`. Maps the target
§9 chain — `Blender Skills → Blender MCP → Procedural Geometry → Optimization →
LOD/HLOD → Meshopt/GLB → KTX2 → Manifest → Cloudflare R2 → Three.js` — onto what
the repo actually has, with the verified bits marked.

## Verified today

- **Blender MCP live**: `blender_mcp.py` addon installed, Blender 5.2.3 LTS
  listening on `localhost:9876`. `execute_code` drove a real bpy script → GLB
  export (`/tmp/phase2-smoke.glb`, valid glTF 2.0 binary). The exporter reports
  **Draco and MeshOptimizer bridges available** in the installed Blender — the
  Meshopt/GLB encode stage needs no external tooling for Blender-side work.
  `tooling/blender/hatching/build.py` is already written to run live in an MCP
  session via `build.run(path)` (README:30-33).
- **Blender Skills pack vendored**: `skills/blender-skills/` @ upstream
  `8f778d2` (MIT) — 94 skill dirs + shared `references/` (asset-pipeline,
  mcp-integration, mcp-tools, polycount-budgets, validation-checklist…). Entry
  point `blender-director/SKILL.md`. Pure markdown, no scripts — safety-reviewed.
  Registered in `skills/README.md` (lanes B1, E). Caveat recorded in SOURCE.md:
  pack skills expect a BlenderMCP connection; without it they degrade to manual
  UI guidance. This checkout has the addon socket working.

## Stage-by-stage state (from the Phase-2 audit)

| Stage | State | Evidence | Gap |
|---|---|---|---|
| Procedural geometry | Proven, egg-scoped | `tooling/blender/hatching/` (fracture/goo/baby_proxy/build) — headless `blender -b -P build.py -- manifests/<egg>.json` | Nothing general-purpose |
| GLB output | Proven | `packages/assets/eggs/<egg>/<egg>-hatch.glb` (4 eggs shipped) + Blender export verified today | — |
| Optimization | Partial | `compress.sh` = gltf-transform dedup+quantize only (deliberately no meshopt/Draco — Hermes lacks WASM); `MeshoptSimplifier` powers city LOD | No generic asset optimize pass; Mon GLBs ship 19–24 MB unoptimized |
| LOD/HLOD | City: proven (3 tiers + far L4/L6 + imposters). Assets: **none** | `harvest.js`, `write.mjs`, `bake-cars.mjs` (near/mid/far index lists) | No per-GLB LOD0/1/2 generation; no per-asset HLOD |
| KTX2 | Decode only | `bake-cars.mjs`, `bake-pbr.mjs` transcode `KHR_texture_basisu` in | No encoder stage anywhere |
| Manifest | Per-lane | `hatch.manifest.json`, `vd-cells-manifest.ts`, `vd-systems-manifest.ts`, Payload `mon-models` rows | No asset→manifest for new GLB geometry |
| R2 release | Proven, city-only | `r2-publish.mjs` (SigV4, sha256 re-hash, immutable, release-last manifest, rollback) + `r2-verify.mjs` | Locked to vd-cell manifest shape; no GLB asset lane (eggs bundle, Mons go Bunny) |
| Validation | Working, fragmented | `validate.py` (egg-deep), `validate-glb.mjs` (container+bounds), `glb.ts` (upload gate), `asset-validation.ts` (descriptors), city tests | No tri/material/UV/normals checks on GLBs; nothing runs in CI |
| Collision proxies | City only | `write-colliders.mjs` (prism VGC1) | No per-asset collider generation |
| Mon/character production | Manual upload only | Payload admin staged upload → `checkMonModelFile`/`readGlb` → Bunny → `/v1/mon-models/glb/<dex>` | 2/115 forms exist; no rig/clip/morph conformance check (runtime wants `jawBone`, `lid_*`, `up_turn_*` — `mon-rig.ts`), no LODs, no batch tooling |

## Next slices (PR 2 continues)

1. `tooling/assets/lod.mjs` — generic LOD0/1/2 bake via `MeshoptSimplifier`
   (already a dependency) + manifest entry reusing `asset-validation.ts`'s
   near/medium/far tier vocabulary. Cheapest real win.
2. Asset manifest writer + R2 publish lane for GLB geometry, or a deliberate
   decision to keep GLB assets on Bunny — record the choice here.
3. KTX2 encode stage (toktx/basisu or gltf-transform `uastc`/`etc1s`) — needs a
   runtime proof that the three/Viro texture path handles `KHR_texture_basisu`
   before mass conversion.
4. CI: wire `validate-glb.mjs` + a tri/UV/normals check into a workflow.
5. Mon batch conformance check against `mon-rig.ts` expectations.

## Notes for lanes

- Keep editable `.blend` sources out of shipped asset dirs (`packages/assets/eggs/*/source/` pattern already does this).
- meshopt/Draco in GLBs shipped to native is a hard no while Hermes lacks WASM — quantize (KHR_mesh_quantization) is the compatible codec (`compress.sh`, `glbDequantize.ts`).
- Do not claim MCP-driven assets were produced unless the `execute_code` transcript is in the PR.
