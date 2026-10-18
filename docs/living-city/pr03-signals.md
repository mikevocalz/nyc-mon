# PR03 — Signal controller + intersection conflict solver

Living City PR stack row 03 (`docs/plans/living-city-prompt.md` §7, §13).
The shared traffic-signal controller: one phase machine per signalized
junction node on the PR02 lane graph, plus a conflict matrix and FCFS claim
arbiter that decides who may occupy the junction box. Pure TS — no three.js,
no React — and timestep-agnostic: signal state is a pure function of an
accumulated clock, so `step(dt)` at 20 Hz or 30 Hz lands on identical
aspects (tested).

## Scope

- `signal-controller.ts` — `SignalController` (one junction) and
  `SignalSystem` (the whole tile + element→node routing).
- `conflict-solver.ts` — `buildConflictMatrix` and `ConflictSolver`.
- `bundled-signals.ts` — lazy load-time accessor over `bundledTopology()`,
  same seam as `bundled-topology.ts`.

### Phase machine

- Approach legs pair into **axes** (opposite azimuths within 75°; leftovers
  are singleton stems — T junctions get an axis + a stem phase). Groups are
  ordered by axis azimuth, so the plan is deterministic.
- Per group: `LEADING_PEDESTRIAN_INTERVAL` (optional) → `VEHICLE_GREEN` →
  `VEHICLE_YELLOW` → `RED_CLEARANCE`. `ALL_PEDESTRIAN_PHASE` is appended
  when `exclusivePedPhase` is set, and `DARK` when the signal has failed.
- Concurrent ped service (the NYC convention): a crosswalk gets WALK
  parallel to the green axis — each `xwalk:` leg is served by the phase
  group it best parallels, excluding the group containing the leg it
  spans. `exclusivePedPhase` confines all ped service to the exclusive
  interval instead (Barnes dance).
- **Computed clearances, not constants** (spec §7, scout-D):
  - amber = `reaction (1.0 s) + v/2a` at `a = 3.05 m/s²`, floored at 3 s —
    the FHWA/ITE change-interval formula on the approach's recorded
    (`sp`) or inferred (NYC 25 mph) speed.
  - all-red = `(crossed street width + 6.1 m vehicle)/v`, floored at 1 s.
  - WALK = `walkSeconds`, clamped to the MUTCD 7 s floor.
  - ped change interval per crosswalk = leg length / **1.07 m/s**
    (3.5 ft/s, MUTCD §4I.06).
  - vehicle green stretches until `LPI + green + amber + all-red ≥
    WALK + clearance`, so pedestrians always clear before conflicting
    movements release (invariant tested per group).
- Median u-turn connectors — PR02's divided-avenue "candidates, not legal
  moves" — are **pruned**: held at R/prohibited unless `permitUTurns`.
- Honesty: no signal heads or timing plans exist in the source data
  (scout-D part 2), so every state carries `simulated: true` — simulated
  signalization, never surveyed NYC fact (spec §6).

### Conflict matrix (`conn:` + `xwalk:`)

- **conn × conn**: each connector's path is synthesized as a cubic bezier
  from in-lane tail to out-lane head (the `bezierConnector` construction
  from Fable's `LaneNetwork.js`, re-authored); two connectors conflict
  when their sampled paths cross **or** they merge into one out-lane.
- **conn × xwalk**: a ped on leg L's crossing conflicts with every
  connector exiting onto L's roads (inbound traffic crossed the crosswalk
  before its stop line); plus a geometric fallback — synthesized path
  crossing the leg polyline — covering unbound crossings (`leg = -1`)
  and internal median pieces. `leg = -1` conservatively conflicts with
  everything in the box.

### Claim solver — FCFS + NYC priority (Fable's algorithm, cited not copied)

Every entity claims one element at a time; tickets issue in request order.
A pending claim grants only when **no held claim conflicts** and **no
permitted pending claim on a conflicting element outranks it**. Priority
is NYC right-of-way: pedestrian > through > right > left > u-turn >
turn-on-red. Same-priority conflicts resolve FCFS by ticket (entity id as
defensive final tiebreak). Results: `granted` / `queued` (red, or behind
the FIFO line) / `must-yield` (permitted but outranked — the left-turn and
turn-on-red path). Stale held claims auto-release at 30 s. This is the
claims-map arbitration Fable's `TrafficSim.js` uses (MIT, commit
`aea8b10`) — algorithm ported, no code copied.

**Dark signal → all-way stop** falls out of the same rules: every vehicle
priority flattens to one class (peds keep top priority), so grants are
pure FCFS across conflicting movements — the DMV ch.4 protocol.

**NYC turn-on-red**: `rightOnRedPermitted` / `leftOnRedPermitted` are the
affirmative-sign-record slots, `false` by default (no sign data exists →
never). Permitted red-turn claims behave as virtual all-way-stop claims at
the lowest priority — they yield to all crossing traffic and peds; the
mandatory stop first is the sim's job (PR05).

## Paths

```
packages/app/features/game/living-city/
  conflict-solver.ts        # matrix + FCFS arbiter — pure
  signal-controller.ts      # phase machine + SignalSystem facade — pure
  bundled-signals.ts        # lazy bundled accessor (load seam)
  conflict-solver.test.ts   # 14 tests: arbitration, matrix geometry, real tile
  signal-controller.test.ts # 17 tests: timing, ped intervals, rules, smoke
docs/living-city/pr03-signals.md   # this file
```

## Dependency graph

```
living-city/topology.ts (PR02: nodes/lanes/xwalks/connectors — unchanged)
        │
        ├─► living-city/conflict-solver.ts   (paths, conflict sets, claims)
        ▼
living-city/signal-controller.ts ──► SignalSystem { state, requestGrant, conflicts, step }
        ▲
living-city/bundled-signals.ts ──► bundled-topology.ts (lazy, load-time)
```

Nothing imports React, three.js or the tile JSON on the pure path. PR05
(vehicles) calls `requestGrant(entity, conn:)` per approach + releases on
exit; PR06 (pedestrians) claims `xwalk:` legs; PR07 reads `state()` aspects
for the visible heads. Uncontrolled nodes (links, dead ends, tile stubs)
report `UNSIGNALIZED` and grant freely — real priority rules there arrive
with PR05.

## API the sims consume

```ts
system.state(signalId)            // { phase, group, vehicleAspects: conn→R/Y/G,
                                  //   pedAspects: xwalk→W/F/D, dark, simulated, timing }
system.requestGrant(entity, el)   // 'granted' | 'queued' | 'must-yield'
system.release(entity)
system.conflicts(a, b)            // boolean | undefined (not co-located)
controller.plan                   // full cycle table for the dev inspector
solver.claimsView() / queueOf(el) / holdersOf(el)
```

## Phase plans on the verified junctions (measured)

| Junction | Axis | Legs | Conns | Xwalks | Green | Amber | All-red | Crossed | Cycle |
|---|---|---|---|---|---|---|---|---|---|
| 125th & St Nicholas | St Nicholas (−61°) | 1+3 | 24 | 3 | 20.1 s | 3.00 | 2.18 | 18.3 m | 53.2 s |
| | 125th (29°) | 0+2 | 24 | 2 | 22.7 s | 3.00 | 2.18 | 18.3 m | |
| 125th & ACP Jr Blvd | ACP (−61°) | 1+3 | 72 | 2 | 24.5 s | 3.00 | 2.18 | 18.3 m | 68.5 s |
| | 125th (29°) | 0+2 | 60 | 2 | 34.0 s | 3.00 | 1.74 | 13.4 m | |
| 125th & Lenox | Lenox (−61°) | 1+3 | 40 | 2 | 19.8 s | 3.00 | 2.18 | 18.3 m | 54.5 s |
| | 125th (29°) | 0+2 | 48 | 2 | 25.1 s | 3.00 | 1.36 | 9.1 m | |

All approaches are recorded 25 mph, so amber sits at the 3 s floor; greens
are ped-clearance-driven (real zebra legs are 15–33 m at 1.07 m/s).

## Conflict-matrix stats on the real junctions

| Junction | Connectors | Conn pairs tested | Conflicts | Xwalk pairs | Xwalk conflicts |
|---|---|---|---|---|---|
| 125th & St Nicholas | 48 | 695 | 317 | 240 | 88 |
| 125th & ACP Jr Blvd | 132 | 5,919 | 3,060 | 528 | 171 |
| 125th & Lenox | 88 | 2,269 | 1,217 | 352 | 82 |
| **Whole tile** | 5,950 | — | 69,915 | — | 9,591 |

Whole-tile build: **182 controllers in ~400 ms** — load-time feasible.

## Acceptance (done-when, spec §13 row 03)

`node --test 'features/game/living-city/*.test.ts'` — **31 new tests, 40/40
green** (14 solver + 17 controller); `tsc --noEmit` clean; `eslint` clean
(0 errors; 5 pre-existing warnings in unrelated world files); the full
`@acme/app` suite stays green at **588 tests**.

- **Phase timing** — amber/all-red formulas reproduce FHWA math from
  approach speed + crossed width; greens satisfy the MUTCD §4I.06 ped
  window on every group (structural invariant tested); faster approaches
  lengthen amber and shorten all-red (tested at 45 mph).
- **Protected conflicts** — only one phase group shows non-red at any
  instant, and a fuzz pass holding demand on every element for 4+ cycles
  never produced two held conflicting claims.
- **NYC right-on-red** — default: red turn claims stay `queued` a full
  phase. Sign-permitted (global and per-connector list): the claim becomes
  `must-yield`/`granted` against crossing traffic and peds. Left-on-red
  same slot, same default.
- **Red queues** — FIFO per element in ticket order; cross-movement FCFS
  verified (a follower can't jump an earlier conflicting ticket).
- **LPI + exclusive ped** — mid-LPI: served crosswalks W while all
  vehicles R; exclusive phase: all crosswalks W→F while all vehicles R,
  all peds D during vehicle phases.
- **Dark → all-way stop** — flat priority FCFS, ped priority preserved.
- **Determinism** — identical request streams give identical grants +
  states; identical absolute times give identical aspects at dt 0.05 vs
  0.5 s. Zero RNG/wall-clock reads.
- **Real-tile smoke** — controllers + full-cycle invariants on the three
  verified 125th Street junctions (table above).

## Licensing

- Fable Cities (`rawprogress/fable-cities`, MIT, `aea8b10`): conflict-claim
  FCFS arbitration with turn/road priority and the bezier connector
  construction — **algorithms adapted, no code copied**; cited in-file and
  in `scout-B-references.md` / `EXISTING_SYSTEMS_AUDIT.md`.
- Timing formulas: FHWA Signal Timing Manual ch.5 + MUTCD 11th §4I.06
  (public-domain engineering standards), NYC rule set per `scout-D+O`.
- No assets added; nothing vendored.

## Device status

**PENDING** — pure logic, nothing rendered or profiled. Whole-tile
controller build measured on this bench (~400 ms); per-tick solver cost is
bounded by pending-claim counts, not element counts. Visual heads are
PR07; performance evidence is PR09.

## Rule ambiguities escalated

1. **Ped phase style**: the spec's example (`NS-thru → NS-ped → EW-thru →
   EW-ped`) suggests ped sub-phases; NYC actually runs peds *concurrently*
   with the parallel green (+LPI). Implemented concurrent service with the
   ped window as an explicit interval pair; `exclusivePedPhase` covers the
   separate-phase reading.
2. **Median u-turns**: treated as banned by default (`permitUTurns` opt-in).
   NYC permits u-turns outside business districts, but PR02's candidates
   are median-crossing artifacts, not signed moves — pruning is the honest
   default. Flagged for the legal-move table if a record ever lands.
3. **T-junction signalization**: every junction with ≥3 legs gets a
   controller (most Manhattan T's are signalized; all simulated anyway).
4. **All-way-stop ped priority in the dark**: kept ped > vehicle — correct
   but conservative; real NYC peds filter through standing queues.
5. **Sign-record schema**: `rightOnRedPermitted`/`leftOnRedPermitted` are
   controller options today; a real `turnOnRed` sign field needs a
   sidecar/dataset-v4 slot (none exists — flagged, not fabricated).
6. **Amber as "allowed"**: vehicles may claim on amber — the stop-or-clear
   decision belongs to PR05's driver model (Fable's dilemma-zone rule).

## Rollback

Self-contained new files under `living-city/` + this doc; nothing else is
imported. `git revert` removes the whole feature — topology, dataset,
saves and the scene are untouched.
