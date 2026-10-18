# Living City — Existing Systems Audit

PR01 deliverable (docs/plans/living-city-prompt.md §1, §12). Consolidated
2026-10-17 on `lane-lcaudit` at `24ab0fc` from the four scout reports in this
directory — the detail lives in them; this file is the decision surface.
Scout F (device baseline) was already satisfied and is cited, not redone.

## What exists today

- **Dataset**: `harlem-apollo.json` v2, `harlem-apollo-20261014`, ~1.7 km tile,
  985 KB, sphere equirect projection (`projectToScene`), saves keyed on
  `(id, version)` with `CITY_DATASET_MIGRATIONS`. Roads carry class/width/
  sidewalks/polyline/name only — **no lanes, oneway, speeds, signal nodes, or
  junction graph**.
- **Scene**: `createCityScene` owns one on-demand canvas; actors mount through
  `SceneActorFactory(THREE)` returning `{id, object, update(frame)→bool,
  dispose}` — **the exact mount point for living-city actors**.
- **Sim/render channel**: `render-snapshot.ts` flat `number[]` through a
  `Synchronizable` into the worklet runtime — actor state must publish the
  same way; no per-actor React state, no native imports in the worklet.
- **Street systems already built** (scout-A §3): parked-car placement with
  NYC clearance rules, LED streetlights + pooled light pools, sign blades via
  a pixel-font atlas (the proven text path on rn-webgpu), a clearance/
  walkability index with `standable`/`inCrossing` queries, `findIntersections`
  (218 named crossings), and the instanced near-field selection pattern.
- **Continuity**: module-scope Zustand stores in `game-session.ts` survive
  fold/unfold/remount — sim seed+clock+phases belong there or above.

## Missing systems (genuinely absent — must be built)

Directed lane graph + connectors + turn legality + conflict matrix; signal
controller phase machine; vehicle kinematics (IDM/steering); pedestrian
routing over the sidewalk skeleton; a game-clock authority (sky picks are
static today); `WorldAssetRegistry` + a GLB import path (no GLTFLoader in the
game feature yet).

## Overlapping PRs and in-flight lanes

Highest overlap: **PR #56** (`lane-e2-toon-material`, `world/materials.ts`) —
traffic instancing ships its own material file, no fork. **PR #47**'s frame
probe is reused, not duplicated. **PR #50** (Colyseus) means sim state is
designed so an authority can own it later — no hard-wired singletons.
**Valdrada v3** (`lane-v3e1`/`v3a1`, in flight) adds `l/ow/sp/sid` road fields
— the lane graph consumes a sidecar interface that infers v2 fields *flagged
`inferred`* today and reads v3 verbatim when it lands.

## Reference verdicts (scout-B/C, licenses verified)

- **ADAPT ALGORITHM**: fable-cities `LaneNetwork.js`/`TrafficSim.js` (MIT) —
  IDM, claims/FCFS arbitration, conflict matrix, amber-dilemma, ped kerb-wait;
  port concepts, re-author rendering in TSL (its GLSL/shadow/post assumptions
  do not survive rn-webgpu).
- **USE / pending hash**: Kenney Car Kit 3.1 GLBs (CC0, bundled in fable);
  three.js 0.186.1 city generators (MIT, TSL-native, installed — zero-risk
  visual source; TrafficlightGenerator is decorative only — heads wire to
  controller state via instance attributes).
- **REJECT as sources**: procedural grids for topology; Mixamo (not CC0, no
  redistribution); Valdrada GLSL/photoreal assets (different program).

## Device truth (scout-F, measured)

Duo 1, 60 Hz: frame p50 36 ms walking, render encode p50 ~13.18 ms (~73 % of
submission), ~40 draw calls / ~298 k tris. Encode is the wall — the dynamic-
actor budget is **≤ ~10 extra draws / ≤ ~50 k tris / ≤ ~1.5 ms added encode**;
30 FPS at a tested tier is the honest floor until the encode lane (post-G1)
recovers headroom. GLB texture round-trip and GPU skinning on rn-webgpu are
**PENDING device proof** — procedural fallback stays mandatory.

## Risks

Simulation determinism across pause/fold (addressed by the module-scope seed
+ fixed-tick + interpolation plan, scout-D part 4); signal-legality correctness
needs scenario tests before visual polish; asset licensing needs per-file
hash re-check at vendoring time (ledger rows marked `pending`); encode budget
means density is adaptive-by-tier, never free.

## Next

PR02 sidecar/topology and PR04 registry can run in parallel per §13; the
one-intersection vertical slice precedes any scaling.
