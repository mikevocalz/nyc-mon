# Draw-call breakdown + first reduction — Phase 4 (PR 4), slice 5

Status: implemented behind `EXPO_PUBLIC_WORLD_SHADOW_INTERVAL` (default 1 =
every frame, i.e. off). The breakdown harness itself is committed as a test.
All evidence is host-side on the recording GPUDevice — the device only counts
submits, so these are JS-side draw-call numbers, which is exactly the audit's
bottleneck #1 (per-draw TSL/JSI submit encode,
docs/performance/engine-audit-2026-10-31.md §8). No device numbers.

Skills consulted: `skills/threejs-skills/` — grep for
batching/instancing/merge/frustum (`threejs-geometry` §369-530 covers
`InstancedMesh`/`mergeGeometries` at API level, `threejs-fundamentals` covers
`frustumCulled`); no coverage of cascaded shadow maps, `autoUpdate`/
`needsUpdate` throttling or WebGPU pass structure — the mechanism was
verified in installed `three@0.187.0` source instead. Repo `AGENTS.md`, the
audit, and `meshlet-pipeline-eval.md` (whose 221-draw probe this slice re-measures).

## 1. How it was measured

`render-runtime/recording-gpu.test-support.ts` gained `record.passDraws`
(draws per begun pass, additive — nothing else changed). The new
`city-scene.draw-breakdown.test-support.ts` builds the same scene as the
physical first-frame harness (bundled `harlem-apollo.json`, physical + vd,
iPad Pro 2732×2048 buffer, camera `{x:0,z:0,yaw:0,distance:200}`) and
instruments `renderer.backend.draw(renderObject, info)` for one frame —
each call carries `object.name` and the render `camera`, so every draw is
attributed to a pass and a category exactly (calls with
`getDrawParameters() === null` are the early-outs and don't submit; they're
filtered, and the count then equals `record.draws`). Cascade cameras are
captured from `sun.shadow.getCamera(i)`.

**Settle caveat — measure only when flat.** The streamer keeps building
cells for many frames, so early draw counts ratchet; a 3-frame flat run can
still be a budget lull. The harness settles when `stats.pending ===
stats.fetching` (everything unbuilt is prefetch-blocked — no cell host in
node) AND draws hold for 15 frames. `late.drift` on a frame 60 frames later
asserts `{}` — the table is a real steady state, not a lull.

## 2. The breakdown (steady state, 177 draws/frame)

The meshlet probe's "221 draws" was a different camera/stream state; on this
settled frame the total is **177**: 59 scene-pass + **105 shadow (59%)** +
13 post.

| Pass | Draws | What |
|---|---|---|
| scene (perspective → MRT) | 59 | the visible city |
| shadow cascade 0 (near) | 41 | sun atlas, `SunShadowNode.renderShadow` |
| shadow cascade 1 (far) | 64 | second viewport of the same atlas |
| post chain (SSR/bloom/grade) | 12 | quad per effect |
| output | 1 | `Render Pipeline` to canvas |

| Category (objects drawn) | scene | shadow | total |
|---|---|---|---|
| streamed cells (detail/facelift/paint/contact) | 21 | 29 | 50 |
| vd blocks (shell + near cells) | 8 | 38 | 46 |
| cars (vd-instanced pools) | 14 | 16 | 30 |
| trees (all tiers) | 5 | 10 | 15 |
| merged walls/roofs/billboards | 4 | 8 | 12 |
| ground/decals | 5 | 2 | 7 |
| fire escapes | 1 | 2 | 3 |
| sky | 1 | 0 | 1 |
| structures + storefronts | 0 | 0 | 0 |
| living-city actors | 0 | 0 | 0 |
| post chain | 13 | 0 | 13 |

Frustum culling works: 51 `city:vd-blocks-shell` objects exist, **8** draw in
the scene pass (the rest are outside the frustum); streamed cells cull
per-cell. What does *not* cull against the view frustum is casting: the
shells alone still submit **38** draws into the two cascades — nearly half
of all shadow work, because each cascade re-renders every caster inside its
own fitted frustum.

## 3. Candidates evaluated

| Candidate | Verdict |
|---|---|
| (a) Cell merging | No. 21 scene draws for all streamed cells; merging adjacent cells saves ~10 draws at best and breaks per-cell fade + per-cell frustum culling. Small, invasive. |
| (b) Instancing gaps | None found. Cars are pooled vd-instanced meshes (14 draws), trees are InstancedMesh tiers, furniture/structures are pooled. |
| (c) Shadow pass | **Dominant: 105/177.** Implemented — see §4. |
| (d) Culling | No gap at this pose: shells cull 51→8, cells cull per bounds, instanced `frustumCulled=false` is deliberate (pools span the tile). |
| Mount `physical/culling.ts` | Low ROI. Slop's port is tested but never wired; its `proxyableMaterial` gate excludes nearly every caster here (cells carry `maskNode` dither, vd-instanced/structures carry `positionNode`, tree leaves carry `alphaTest`/side), and chunked instancing only handles `isInstancedMesh` (our pools are `Mesh` + `InstancedBufferGeometry`, and our InstancedMeshes set `frustumCulled=false`, which `isStaticMesh` rejects). |
| `sunShadow: 1` (drop a cascade) | Bigger visual change than throttling (far shadows disappear entirely, single-map character differs); remains available as `EXPO_PUBLIC_WORLD_DROP=sunShadow` or a tier change. |
| Caster pruning (`noSunShadow`) | The casters are mostly buildings that should cast. Shells (38 draws) are the tempting prune, but distant-building shadows do read at overview — a flag-gated prune option, not a free win. |

## 4. Implemented: `EXPO_PUBLIC_WORLD_SHADOW_INTERVAL`

The cascades re-render every drawn frame even though the city is mostly
static. `ShadowNode.updateBefore` already honours the standard
`shadow.autoUpdate`/`needsUpdate` gate (three r187
`src/nodes/lighting/ShadowNode.js:806-824`), so the rig can throttle the
whole atlas without a patch:

- `physical-look.ts`: `WORLD_SHADOW_INTERVAL` parses the env flag (int >1,
  capped at 8; default 1).
- `physical-rig.ts`: `PhysicalRigOptions.shadowInterval`. Under N>1 the
  sun's `shadow.autoUpdate = false` and `needsUpdate` rises every Nth
  `rig.update()`, plus on the events that can't wait — preset apply (sun
  direction), shadow-far change (altitude), focus move (shadow1 light).
  First frame always renders.
- `city-scene.ts`: passes the flag into `createPhysicalRig`. Physical lane
  only; the classic VD directional shadow is untouched.

### Measured (harness, child process, same scene)

| | draws/frame | shadow draws |
|---|---|---|
| baseline (interval 1) | 177 | 105 |
| interval 2 | alternating `72,177,72,177…` → **avg 124.5** | **avg 52.5 (−50%)** |

**−52.5 draws/frame (−29.7%) on average; skipped frames are the
shadow-off frame (72).** The test asserts the alternation and the two
levels. GPU-side savings on device (one 2×2048+ tile render skipped every
other frame) come on top and are unmeasured here.

### Visual cost (why it's a flag)

Moving casters' shadows refresh at 60/N Hz — under interval 2, car/ped
shadows lag one frame; a static camera produces identical atlases between
ticks, so nothing else changes. Camera moves still get correct shadows
within N−1 frames via the tick (plus the far/focus pokes). Not default-on:
the city has living actors.

## 5. Tests

- `world/physical-rig.test.ts` — interval gate: `autoUpdate` off, ticks on
  schedule, preset/far changes poke, default untouched.
- `city-scene.draw-breakdown.test.ts` — pins the 177/105/59/13 table, the
  blocks culling split (8 scene / 38 shadow), zero drift, and the
  interval-2 alternation + levels in a child process.

## 6. Still on the table

| Lever | Ceiling (draws) | Why not now |
|---|---|---|
| `noSunShadow` on shells / far cells | ~38 | visible: distant buildings lose shadows; needs a flag + device look |
| cascade drop (`sunShadow` 2→1 option) | ~41–64 | visible: far shadows gone; tier/flag decision |
| caster pruning to near-cascade only | ~20–30 | per-cascade caster splitting needs SunShadowNode patching |
| cell coalescing for streamed cells | ~10 | breaks fade/culling granularity |
| mount `culling.ts` shadow proxies | small | most casters fail `proxyableMaterial` (§3) |
| shadow update every-N *frames wall-clock* vs drawn frames | same as interval | interval already counts drawn frames |

## 7. Caveats

- Host-side draw counts only; the Duo's submit-encode win is proportional
  but unmeasured (device unattached — audit §7).
- The breakdown is one camera pose (distance 200 overview): streaming-heavy
  poses shift the scene/cell numbers; the shadow share holds wherever the
  sun casts.
- `pending = fetching = 171` — host has no cell host, so 171 packages can
  never land; on device the resident set is larger and the scene-pass count
  higher. Shadow share should grow, not shrink, in a fuller scene.
- Interval semantics count *drawn* frames: on the on-demand canvas a paused
  scene doesn't tick, so a stale atlas can't linger across an idle gap.
