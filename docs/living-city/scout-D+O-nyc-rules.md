# Scout D+O — NYC rules, dataset gaps, and native-WebGPU feasibility

Scout report for Living City PR01 (spec §6, §9, §12 scout D and O).
Verified against sources + installed packages on 2026-10-17. Device numbers
cite Scout F evidence (docs/performance/baseline-duo-2026-10-17.md,
docs/performance/gpu-budget-2026-10-17.md) — not re-measured.

## Part 1 — NYC traffic rules the sim must encode

### Right/left on red

- **Right on red is OFF by default in New York City.** NYS VAT §1111(d)(2)
  permits right-on-red *except* in cities with population ≥1M unless a sign
  affirmatively permits it — NYC is that carve-out. DMV Driver's Manual
  ch.4 ("Traffic Control",
  dmv.ny.gov/new-york-state-drivers-manual-and-practice-tests/chapter-4-traffic-control)
  and NYC311 confirm: allowed only where a posted sign says so.
- Same carve-out covers **left on red** (one-way → one-way): legal
  statewide after stop, **not** in NYC absent a sign.
- Implementation: `noTurnOnRed` is the **default**; a per-approach
  `turnOnRedPermitted` flag exists only where the sidecar records an
  affirmative sign. The spec's "turning driver yields" behaviour is the
  dominant case — a right-turner waiting on a ped phase is normal NYC,
  not a special event.
- **Full stop before** stop line/crosswalk is required before any turn on
  red anywhere (kept for completeness; the flag rarely fires in NYC).

### Pedestrian priority

- Vehicles must **yield/stop for pedestrians in crosswalks** — signalized
  and unsignalized (NYC311 traffic rules; VAT §1151/§1152). Turning
  drivers in particular must yield even on their green when peds hold
  WALK on the crossing they cross — the spec's hero moment.
- Nonworking/malfunctioning signals: treat as all-way stop (DMV ch.4 —
  dark intersections become stop-controlled). The `signalState: dark`
  mode needs an all-way-stop fallback path in the controller.
- **Jaywalking note:** NYC decriminalized jaywalking (Local Law 92 of
  2025), but the spec's street-life slice models lawful behaviour; keep
  `pedKerbWait` as default with an opt-in "confident jaywalker" archetype
  later, clearly labeled.

### Signal timing (MUTCD 11th ed. + FHWA Signal Timing Manual)

- **WALK interval: ≥ 7 s** (may drop to 4–7 s only under conditions —
  MUTCD §4I.06; keep 7 s as our floor).
- **Pedestrian clearance (change interval):** timed at **3.5 ft/s ≈
  1.07 m/s** from pushbutton/kerb to far side or median refuge; a slower
  design speed (<3.5 ft/s) should be considered where slow
  pedestrians/wheelchair users are expected. If the change interval is
  > 7 s, a **countdown** ped signal is required — good news: countdown
  digits are exactly the readable detail spec §0 wants, and our
  pixel-font atlas path supports it.
- **Leading Pedestrian Interval:** NYC DOT deploys LPIs widely; where
  used, WALK min = LPI + 7 s and the parallel vehicular approach holds
  red. Model as a controller option `lpi: seconds`.
- **Yellow change interval:** typically 3–6 s; **red clearance**
  typically 1–2 s+, computed from approach speed + grade (FHWA Signal
  Timing Manual ch.5,
  ops.fhwa.dot.gov/publications/fhwahop08024/chapter5.htm). The ped
  change interval must fit within vehicular green+yellow+red-clearance
  relationships per §4I.06.
- **Cycle structure for the hero slice:** a simple two-phase controller
  (125th St vs cross street) with LPI + clearance is faithful enough;
  fable's approach-phase grouping is the right substrate.

### Sources

- NYS DMV ch.4 Traffic Control (URL above) — RTOR rules, dark-signal rule.
- NYC DOT signals page (nyc.gov/html/dot/html/infrastructure/signals.shtml)
  — LPI + countdown deployment context.
- MUTCD 11th ed. Part 4I (mutcd11theditionr1hl.pdf) — 7 s WALK, 3.5 ft/s
  clearance, countdown requirement.
- FHWA Signal Timing Manual ch.5 — yellow/red-clearance norms.

## Part 2 — Dataset gaps: v2 today vs what the sim needs

### What `harlem-apollo.json` v2 retains (verified, build.mjs:431-484)

Per road piece: `id osm:way:N[:K]`, `c` class, `w` width (m), `s` symmetric
sidewalk width, `p` polyline, `e` width-estimated, `n` name. Classes
cover primary→service + `crossing` (632), `sidewalk` (849), `footway`
(313), `cycleway`. Transit: 29 subway entrances, 53 shelters.

### What build.mjs reads but drops

- `lanes` — read **only** to estimate `w` when `width` tag absent
  (build.mjs width-estimation); the count itself is **not** emitted.
- `footway=crossing`, `sidewalk`/`sidewalk:both`, `railway=subway_entrance`,
  `highway=bus_stop`+`shelter`, `natural=tree`, NYCHA tags — consumed into
  classes/records, not lane metadata.

### What is never fetched or never modeled

- `oneway`, `oneway:*`, `lanes:forward/backward`, `turn:lanes`,
  `destination:lanes`, `maxspeed`, `junction=*` — never read.
- `highway=traffic_signals` nodes — **not in the Overpass query**
  (fetch.mjs:47 fetches `way["highway"]` only); `crossing=traffic_signals`
  on crossing ways also un-read.
- `kerb=*`, `tactile_paving=*`, `parking:lane:*`, `busway`/`lanes:bus`,
  stop lines — absent.
- **No node/connectivity graph**: roads are clipped polylines; junction
  topology is not represented (ways split into `id:K` pieces with no
  shared-node record).

### What must come from the sidecar vs Valdrada v3

| Field | Source | Why |
|---|---|---|
| `lanes` count, `oneway`, `speed`, `segId` | **Valdrada v3** (`l`, `ow`, `sp`, `sid` — docs/plans/harlem-v3-valdrada-prompt.md §5.2) | Lane-graph fundamentals; branches `lane-v3e1`/`lane-v3a1` exist at 24ab0fc (scaffolding). Until they land, infer: lanes≈`w`/3.0 per direction, `oneway: false`, speed from class — **all flagged `inferred`**, never silent. |
| Signal positions + phase plans | **Sidecar** (`living-city` data) | Not in v2 fetch; Valdrada prompt doesn't promise signal nodes. Place candidate heads at `findIntersections` output; each entry carries `verified: 'recorded'\|'inferred'` per spec §6. |
| Stop lines | **Sidecar** | Derivable from kerb edge + approach direction; flag inferred. |
| Crosswalk↔signal bindings | **Sidecar** | 632 crossing ways exist; bind each signalized crossing to its controller phase. |
| Turn lanes / banned turns | **Sidecar** (v3 may add `mouthA/mouthB` hints) | Lane connectivity legal-move table; default = all legal from appropriate lane position. |

**Schema rule (spec §6):** every inferred element carries an
`estimated: true`/`verified` flag — the same honesty discipline the
dataset's `e` bit already uses.

## Part 3 — Native-WebGPU feasibility (installed three.js 0.186.1)

Verified in `packages/app/node_modules/three@0.186.1` (also `packages/ui`):

| Capability | Present | Verdict |
|---|---|---|
| `BatchedMesh` (`src/objects/BatchedMesh.js`) | ✅ | **Available but not automatically a win** — our static world already merges by material and instances props. BatchedMesh's value is many distinct geometries in one draw *with per-geometry culling* — could suit signal heads/blades if per-approach culling matters. Measure before adopting; the merged-static path already delivers ~40 draw calls. |
| `BundleGroup` (`src/renderers/common/BundleGroup.js`) | ✅ | **Tried and removed** (G1, deleted 2026-11 lane-bundlefix): r186 replay froze the camera transform — the shared camera UBO is never re-uploaded for bundled objects (upstream "missing binding updates", mrdoob/three.js#30701). Measured win was ~1 ms even working. Revisit only after a three release fixes replay. |
| `SkinnedMesh` + `nodes/accessors/Skinning.js` | ✅ | GPU skinning exists in-node-graph (computeSkinning). **PENDING native validation** — official skinned-instancing/crowd demos (webgpu_compute_skinning etc.) are compatibility *research*, not proof; rn-webgpu has never run them. Plan A for crowd stays unrigged instanced bodies (fable's vertex-shader walk, PersonGenerator); plan B rigged hero peds = at most a handful of SkinnedMeshes, validated on Duo before scaling. |
| City generators (`examples/jsm/generators/…`) | ✅ all | TSL-native — see scout-B §3. |
| `GLTFLoader` | ✅ in three | Never used in the game feature today; `react-native-webgpu` provides `createImageBitmap` global → texture decode path is *plausible*; full GLB texture + skinning round-trip is **PENDING device test**. Keep registry fallback (procedural) mandatory. |
| Timestamp queries (`timestampWrites`/`trackTimestamp`) | ⚠️ partial | Present in the rn-webgpu package but **the app does not request the feature/enable trackTimestamp** — GPU-side timing currently comes from the G1 probe approach; enabling timestamp queries is a flagged follow-on, not a blocker. |
| Hard native constraints (documented) | — | No shadow maps, no output/post pass, no `scene.background` env lighting — all confirmed in the runtime layer; the fable renderer's shadow/post assumptions must be re-authored (contact decals + additive pools pattern instead). |

## Part 4 — Simulation ↔ render boundary (fixed tick + interpolation)

Proposed, consistent with the existing architecture:

- **Authoritative sim on the JS thread**: fixed 20–30 Hz accumulator
  (fable `index.js` pattern; our `ActorFrame` contract supplies a clamped
  delta). All legality, IDM, claims, ped state — pure TS, no three import,
  same discipline as `walkability.ts`/`locomotion.ts`.
- **Snapshot across the worklet boundary**: pack actor state into a flat
  `number[]`/typed-array buffer delivered through the existing
  `Synchronizable` mechanism (`render-snapshot.ts` pattern — extend it or
  add a second buffer: per-actor `{x,z,heading,speed,state}` floats +
  version counter). **No React state per actor; no native imports in the
  worklet runtime** — `game-render.ts` deliberately keeps RN imports out
  and stays a pure three.js scene.
- **Interpolation in the render actor**: each visible actor keeps prev +
  current sim-state and lerps by render-time fraction — the scene's
  `update(frame)` seam. On-demand canvas: any live actor → `update()`
  returns true → canvas stays awake; when sim idles (all actors out of
  range at night, etc.) the canvas re-sleeps — free battery win, already
  built.
- **Allocations**: zero per-frame; sim uses fable-style epoch stamps +
  preallocated arrays; renderer writes into preallocated instance buffers
  (`pickWithin`/`BandedBuffer` patterns already proven in `tree-lod.ts`,
  `street-furniture.ts`).
- **Continuity**: sim seed + clock + signal phase live above the canvas
  (`game-session.ts` module-scope precedent) so fold/unfold/remount never
  resets a mid-cycle intersection.

## Part 5 — Budgets vs the G1 ~13 ms ceiling

From Scout F evidence (baseline-duo + gpu-budget, 2026-10-17):

- `renderer.render` p50 ≈ **13.18 ms**; total JS submission p50 ≈
  **17.97 ms** — encode/submit ≈ 73 % of measured cost; `present()` p50
  ≈ 3.93 ms. Device counters ≈ **40 draw calls / ~297.6 k tris** at the
  Apollo spawn (world budget ≈ 283.6 k tris).
- Scene `update()` measured ≈ **0.2 ms** — the JS side has real headroom
  for a 20–30 Hz sim; the bottleneck is **encode/submit**, i.e. extra
  draw calls and mutable buffer uploads, not triangles or JS math.

Consequences:

1. **A separate dynamic-actor budget** (spec §9) — do not hide actors in
   the static budget: proposed ceiling **≤ ~10 extra draw calls, ≤ ~50 k
   added tris at chase view, ≤ ~1.5 ms added encode** (keeps worst-case
   submission under ~19–20 ms ≈ 60 fps territory on Duo; validate with
   the existing probe + PR47 frame-probe lane, don't add a second probe).
2. **Instance everything**: ~8–10 draws is the whole fleet budget —
   fable's shape (per-type × LOD + wheels + decal + headlight pools +
   ped mesh) fits; two-pass or per-actor meshes do not.
3. **LOD by stable id-bits** (fable `id & 1/3` distance thinning) — never
   frame parity; flicker-free and deterministic.
4. **Mutable-buffer discipline**: instance attribute updates are
   subresource writes — batch them once per tick, not per actor.
5. **Adaptive density** belongs in `perf/tier.ts` knobs (maxVehicles,
   maxPeds, draw distance) with graceful degradation — the sim stays
   correct at reduced population, it never drops frames to look busy.
6. ~~**BundleGroup**~~: the G1 bundle lane was deleted 2026-11 (frozen
   camera on replay, ~1 ms win). No bundle-membership rule applies to
   actors until upstream fixes replay.
