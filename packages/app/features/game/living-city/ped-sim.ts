// Living City PR06 — the pedestrian simulation. Pure TS: no three.js, no
// React, no timers — `step(dt)` advances one fixed tick and every decision is
// a pure function of sim state plus a seeded RNG, so two runs with the same
// seed produce byte-identical snapshots (tested). Same conventions as
// vehicle-sim.ts (PR05), whose Fable Cities citations apply here too.
//
// A pedestrian's world is three element kinds:
//
//  - `walk:` bands (PR02 sidewalk centrelines, derived from carriageway `s`
//    widths). The 849 OSM `sidewalk` ways stay unused — pr02-topology.md
//    deferred them to this PR as a reserve, and band + corner coverage
//    proved sufficient at the slice junctions.
//  - `xwalk:` legs (PR02 crosswalk centrelines) traversed as an ad-hoc
//    crossing path: kerb position → xwalk endpoints → far kerb band point.
//  - `corner:` links — synthesized at build time between adjacent walk-band
//    ends at one junction (the corner sidewalk), rejected when the segment
//    crosses a carriageway lane (that's a jaywalk, never offered).
//
// NYC rules (spec §7): a ped waits at the kerb until its crosswalk claim is
// granted, and the solver's gate only allows xwalk claims during WALK — so
// entering on flashing or solid DON'T WALK is impossible by construction.
// Once granted, the ped is committed: it finishes the crossing at ≥1.07 m/s
// (MUTCD clearance speed) even as FDW runs out — "finish-or-honest-state":
// it never teleports off the road; the held claim keeps conflicting vehicle
// claims blocked (pedBlocks) until the far kerb releases it.
//
// Separation steering keeps people honest: a 4 m spatial hash, a
// collision-cone advance clamp along the travel tangent (the sqrt floor
// term — 0.55 m on open sidewalk, 0.34 m kerb-crush near corridor ends),
// keep-right lateral targets, shoulder-room sidesteps and a post-move
// failsafe that rolls back only closing moves — pairwise distance is a
// tested invariant. Static obstacles (trees/furniture/transit records,
// supplied via options) steer peds laterally inside the band corridor.
//
// The packed snapshot is EXTENDED, not forked: the vehicle layout is
// untouched; a ped section is appended after the vehicle records —
// [count, stride, spawnTotal, despawnTotal] then count × PSNAP_STRIDE rows
// with the same field order as vehicle rows. Readers find it at
// `pedSectionOffset`; flag-off publishes nothing at all.

import type { FlatPoints } from '../city-dataset.ts';
import { buildConflictMatrix, type ConflictMatrix } from './conflict-solver.ts';
import { NYC_PED_SPEED_MPS, type SignalSystem } from './signal-controller.ts';
import type { LaneTopology, WalkEdge, XwalkLeg } from './topology.ts';
import {
  VSNAP,
  VSNAP_HEADER,
  VSNAP_STRIDE,
  cumulative,
  mulberry32,
  normAngle,
  packVehicleSnapshot,
  poseAlong,
  type PathGeom,
  type VehicleSim,
} from './vehicle-sim.ts';

// --- Tunables ------------------------------------------------------------------

/** Personal-space floor on open sidewalk: pairwise distance never drops below this (tested invariant). */
const MIN_SEPARATION_METRES = 0.55;
/**
 * Kerb-crush floor near corridor ends (mouths, band ends at junctions):
 * crowds genuinely squeeze to ~shoulder width there — a fixed 0.55 in the
 * pinch deadlocks a six-ped slice on a real zebra, 0.34 lets people brush
 * past exactly as they do at a kerb ramp.
 */
const KERB_CRUSH_METRES = 0.34;
/** Distance from a corridor end where the crush floor applies. */
const KERB_CRUSH_ZONE_METRES = 3.2;
/** Neighbourhood radius for the spatial hash query. */
const NEIGHBOUR_RADIUS_METRES = 2.5;
/** Spatial-hash cell size. */
const HASH_CELL_METRES = 4;
/** Kerb stand-back: peds wait this far before the band's closest approach to the xwalk. */
const KERB_SETBACK_METRES = 0.4;
/** The queue's head stands this far behind the kerb point — landings stay clear. */
const QUEUE_HEAD_METRES = 1.0;
/** File spacing along the band behind the head. */
const QUEUE_SLOT_METRES = 0.8;
/** Shuffle-forward speed while waiting in the file. */
const QUEUE_CREEP_MPS = 0.55;
/** 'walkTo' completes within this distance of its target s. */
const ARRIVE_TOLERANCE_METRES = 0.5;
/** A wanderer may pick an xwalk whose near endpoint is within this of the band end it's standing at. */
const XWALK_DECIDE_REACH_METRES = 10;
/** Corner links longer than this are never offered (that's across the junction, not around a corner). */
const CORNER_LINK_MAX_METRES = 28;
/** Lateral clamp on a crosswalk/corner corridor — zebra paint reads ~3 m wide. */
const XWALK_LAT_MAX_METRES = 1.2;
/** Two-way zebra channel: streams ride this far right of the centreline. */
const XWALK_CHANNEL_METRES = 0.9;
/** How far toward the channel side a departing ped's kerb-edge approach may drift. */
const KERB_EDGE_METRES = 0.75;
/** Same-mouth entries serialize until the leader has cleared this far into the zebra. */
const ENTRY_SERIAL_METRES = 2.2;
const CORNER_LAT_MAX_METRES = 1.5;
/** Lateral keep-right offset target (metres right of corridor centre, capped per band). */
const KEEP_RIGHT_MAX_METRES = 0.8;
/** How fast the lateral offset eases toward its target, m/s. */
const LAT_RATE_MPS = 1.6;
/** A ped hurries to at least this speed once it is committed and WALK has ended. */
const FDW_HURRY_MPS = 1.5;
/** Static obstacles inside the corridor are dodged when they sit this close to the ped's lateral line. */
const OBSTACLE_CLEARANCE_METRES = 0.55;
/** Ambient spawn cadence and geometry (mirrors the vehicle spawner). */
const PED_SPAWN_PERIOD_SECONDS = 0.8;
const PED_SPAWN_HEAD_CLEARANCE = 1.2;
const DEFAULT_PED_SPAWN_MIN_FOCUS_METRES = 40;
const DEFAULT_PED_DESPAWN_FOCUS_METRES = 420;

// --- Ped classes -----------------------------------------------------------------

export type PedKind = 'adult' | 'kid';
export const PED_KINDS: readonly PedKind[] = ['adult', 'kid'];
/** The semantic id the renderer resolves for each kind — the sim never names a mesh. */
export const PED_SEMANTIC_ID: Record<PedKind, string> = { adult: 'ped.adult', kid: 'ped.kid' };
/** Desired-speed ranges per kind (m/s); the seeded draw sits inside the band. */
const PED_SPEED: Record<PedKind, [number, number]> = { adult: [1.15, 1.6], kid: [0.95, 1.3] };
/** Ambient mix: mostly adults, some kids. */
const PED_SPAWN_MIX: readonly [PedKind, number][] = [
  ['adult', 0.85],
  ['kid', 0.15],
];

// --- Snapshot layout (appended ped section — the vehicle layout is untouched) ----

/**
 * Ped section appended after `VSNAP_HEADER + vehCount*VSNAP_STRIDE` vehicle
 * numbers: a 4-number header then `count` records of `PSNAP_STRIDE` numbers
 * in the SAME field order as vehicle records. Presence is detectable by
 * `snapshot.length > pedSectionOffset` — older vehicle-only readers never
 * reach it.
 *
 * Header: [count, stride, spawnTotal, despawnTotal]
 * Record: [id, kind, prevX, prevZ, prevYaw, x, z, yaw, speed, flags, age, reserved]
 */
export const PSNAP_HEADER = 4;
export const PSNAP_STRIDE = 12;
export const PSNAP = { count: 0, stride: 1, spawnTotal: 2, despawnTotal: 3 } as const;

/** Per-record flags — the renderer and dev inspector read these; behaviour is not encoded here. */
export const PFLAG = {
  /** Standing at the kerb with a pending/queued crosswalk claim. */
  waiting: 1,
  /** Traversing a crosswalk leg. */
  crossing: 2,
  /** Committed to a crossing while WALK has already ended (FDW or DWLK) — finishing honestly. */
  clearing: 4,
  /** On a corner link between two walk bands. */
  corner: 8,
  /** Held by another pedestrian (separation stop) this tick. */
  heldPed: 16,
  /** Deviating around a static obstacle this tick. */
  obstructed: 32,
} as const;

// --- Public types ------------------------------------------------------------------

export type PedState = 'walk' | 'wait' | 'cross' | 'corner';

export interface PedSpawnSpec {
  readonly kind?: PedKind;
  /** `walk:` band the pedestrian starts on. */
  readonly walk: string;
  readonly s?: number;
  /** Travel direction along the stored polyline (wander plan only — loop computes its own). */
  readonly dir?: 1 | -1;
  /**
   * 'wander' strolls band to band, corner-linking or crossing xwalks by
   * seeded choice at each junction. 'loop' ping-pongs on `xwalk`: kerb →
   * WALK → cross → stroll out → walk back → wait again — the PR06 slice.
   */
  readonly plan?: 'wander' | 'loop';
  /** The `xwalk:` id a 'loop' ped serves. Required for 'loop', ignored otherwise. */
  readonly xwalk?: string;
  /** Post-cross stroll distance before turning back for the next crossing ('loop'). Default 14–38 m seeded. */
  readonly strollMetres?: number;
  /**
   * PR09: marks an auto-populated crowd member (the spawner sets it).
   * Tier step-downs may retire ambient peds; scripted scenario spawns
   * never carry the flag and are never culled.
   */
  readonly ambient?: boolean;
}

export interface PedSimOptions {
  /** Deterministic seed (mulberry32). Default 1. */
  readonly seed?: number;
  /** Pedestrians to place at tick 0 — the scripted half of the crowd (the six-ped slice lives here). */
  readonly peds?: readonly PedSpawnSpec[];
  /** Ambient population target. Default 0 (scripted crowds only). */
  readonly targetPeds?: number;
  /** Explicit spawn-band candidates; default: every non-internal band ≥ 12 m. */
  readonly spawnWalks?: readonly string[];
  /** Ambient spawns keep this far from focus (anti-pop). Default 40 m — peds read smaller than cars. */
  readonly spawnMinDistance?: number;
  /** Pedestrians beyond this from focus despawn. Default 420 m. */
  readonly despawnDistance?: number;
  /**
   * Static sidewalk obstacles, flat [x, z, ...] in scene metres — street
   * trees, hydrants, LinkNYC kiosks, bike racks, subway stairs, shelters.
   * Projected once onto the bands they fall inside; peds steer around them
   * laterally. Cheap: a build-time grid index, not a per-tick query.
   */
  readonly obstacles?: FlatPoints;
  /**
   * Standalone convenience: step the signal system inside `step(dt)`. Leave
   * false under the LivingCityHost — the vehicle sim already owns the
   * signal clock there, and double-stepping would halve phase times.
   */
  readonly advanceSignals?: boolean;
  /**
   * Live view of the vehicle fleet (the host wires the fleet view here).
   * Only consulted at UNCONTROLLED junctions — signalized kerbs are made
   * safe by the solver, but an unsignalized crossing has no claims
   * arbitration, so a polite ped waits for a real gap before stepping off.
   */
  readonly vehicles?: () => readonly { element: string; s: number; speed: number }[];
}

/** What the snapshot writer and the tests see: one row per live pedestrian. */
export interface PedView {
  readonly id: number;
  readonly kind: PedKind;
  readonly state: PedState;
  /** Current corridor: a `walk:`/`xwalk:`/`corner:` element id. */
  readonly element: string;
  readonly s: number;
  readonly speed: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly prevX: number;
  readonly prevZ: number;
  readonly prevYaw: number;
  readonly flags: number;
  readonly age: number;
  /** The crosswalk this ped's claim targets, or ''. */
  readonly claimXwalk: string;
}

export interface PedSimMetrics {
  tick: number;
  simTime: number;
  pedestrians: number;
  spawnTotal: number;
  despawnTotal: number;
  peakPeds: number;
}

// --- Corridor geometry --------------------------------------------------------------

interface PedPose {
  x: number;
  z: number;
  yaw: number;
}

const SCRATCH: PedPose = { x: 0, z: 0, yaw: 0 };

/** The `+lat` normal for a travel heading (left-handed scene: x east, z south; right-of-travel = +lat for heading +x). */
function normalOf(yaw: number): { x: number; z: number } {
  return { x: -Math.cos(yaw), z: Math.sin(yaw) };
}

/** Arc s of the polyline point nearest (x, z) — kerb points, xwalk entries, spawn snapping. */
function nearestS(geom: PathGeom, x: number, z: number): number {
  let best = Infinity;
  let bestS = 0;
  const p = geom.points;
  for (let i = 2; i < p.length; i += 2) {
    const ax = p[i - 2]!;
    const az = p[i - 1]!;
    const bx = p[i]!;
    const bz = p[i + 1]!;
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
    const d2 = (ax + dx * t - x) ** 2 + (az + dz * t - z) ** 2;
    if (d2 < best) {
      best = d2;
      bestS = geom.cum[i / 2 - 1]! + Math.sqrt(l2) * t;
    }
  }
  return bestS;
}

/** Strict segment crossing (proper intersection only) — corner links test candidate paths against lane centrelines. */
function segmentsCross(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): boolean {
  const d1 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx);
  const d2 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx);
  const d3 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
  const d4 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function pathCrossesSeg(path: FlatPoints, ax: number, az: number, bx: number, bz: number): boolean {
  for (let i = 2; i < path.length; i += 2) {
    if (segmentsCross(path[i - 2]!, path[i - 1]!, path[i]!, path[i + 1]!, ax, az, bx, bz)) return true;
  }
  return false;
}

// --- The sim -------------------------------------------------------------------------

/** A walk-band end anchored at a node — the unit corner links and xwalk decisions hang off. */
interface BandEnd {
  readonly walk: WalkEdge;
  /** 0 = the nodeA end (polyline head), 1 = the nodeB end (tail). */
  readonly end: 0 | 1;
  readonly x: number;
  readonly z: number;
}

interface CornerLink {
  /** `corner:` id for diagnostics/flags. */
  readonly id: string;
  readonly geom: PathGeom;
  /** Where the ped lands after the hop. */
  readonly exit: { readonly band: string; readonly s: number; readonly dir: 1 | -1 };
}

type PedTask =
  | { readonly kind: 'walkTo'; readonly sTarget: number; readonly xwalk: string }
  | { readonly kind: 'waitKerb'; readonly xwalk: string }
  | {
      readonly kind: 'link';
      readonly linkKind: 'xwalk' | 'corner';
      readonly geom: PathGeom;
      readonly exit: { readonly band: string; readonly s: number; readonly dir: 1 | -1 };
      /** Which xwalk end this crossing entered from (0 = polyline head) — xwalk links only; serializes the kerb file. */
      readonly entryEnd?: 0 | 1;
    }
  | { readonly kind: 'stroll'; remaining: number };

interface Ped {
  id: number;
  entity: string;
  kind: PedKind;
  plan: 'wander' | 'loop';
  loopXwalk: string;
  loopStroll: number;
  /** `walk:` band the ped currently belongs to (kept as the owning band while on a link). */
  element: string;
  mode: 'band' | 'link';
  /** Display element id — band id, xwalk id or corner id (what the view/snapshot reports). */
  viewElement: string;
  s: number;
  dir: 1 | -1;
  lat: number;
  latTarget: number;
  v: number;
  desired: number;
  task: PedTask;
  claimXwalk: string;
  /** The kerb-file slot target the ped creeps toward while waiting (waitKerb only). */
  slotS: number;
  /** Seeded personal quirk in [0,1): waiting jitter, tie-breaks. */
  bias: number;
  x: number;
  z: number;
  yaw: number;
  prevX: number;
  prevZ: number;
  prevYaw: number;
  age: number;
  flags: number;
  /** PR09: auto-spawned crowd member — the tier caps may retire it early. */
  ambient: boolean;
  /**
   * PR09: tier step-down marked this ambient ped for removal — it is
   * culled by the spawner pass once it sits beyond the anti-pop distance
   * (`spawnMinDistance`), so the crowd thins off-camera rather than
   * popping mid-sidewalk.
   */
  retiring: boolean;
}

export class PedSim {
  readonly topology: LaneTopology;
  readonly signals: SignalSystem;
  readonly metrics: PedSimMetrics = { tick: 0, simTime: 0, pedestrians: 0, spawnTotal: 0, despawnTotal: 0, peakPeds: 0 };

  private readonly rng: () => number;
  private readonly peds: Ped[] = [];
  private nextPedId = 1;
  private spawnAcc = 0;
  /** PR09: mutable — the tier system retargets the ambient population live. */
  private targetPeds: number;
  private readonly spawnMinDistance: number;
  private readonly despawnDistance: number;
  private readonly advanceSignals: boolean;
  private readonly fleet: (() => readonly { element: string; s: number; speed: number }[]) | undefined;
  private focusX = Number.NaN;
  private focusZ = Number.NaN;

  private readonly walkById = new Map<string, WalkEdge>();
  private readonly walkGeoms = new Map<string, PathGeom>();
  /** `${walkId}:${end}` -> corner links out of that band end. */
  private readonly corners = new Map<string, CornerLink[]>();
  /** node id -> band ends anchored there. */
  private readonly bandEnds = new Map<string, BandEnd[]>();
  /** node id -> xwalk legs at that junction. */
  private readonly xwalksAt = new Map<string, XwalkLeg[]>();
  /** walk id -> static obstacles inside the corridor, sorted by s. */
  private readonly obstacles = new Map<string, { s: number; lat: number }[]>();
  private readonly spawnCandidates: readonly WalkEdge[];
  private readonly hash = new Map<number, Ped[]>();
  private readonly aspectCache = new Map<string, ReturnType<SignalSystem['state']>>();

  constructor(topology: LaneTopology, signals: SignalSystem, options: PedSimOptions = {}) {
    this.topology = topology;
    this.signals = signals;
    this.rng = mulberry32(options.seed ?? 1);
    this.targetPeds = options.targetPeds ?? 0;
    this.spawnMinDistance = options.spawnMinDistance ?? DEFAULT_PED_SPAWN_MIN_FOCUS_METRES;
    this.despawnDistance = options.despawnDistance ?? DEFAULT_PED_DESPAWN_FOCUS_METRES;
    this.advanceSignals = options.advanceSignals ?? false;
    this.fleet = options.vehicles;
    for (const w of topology.walks) this.walkById.set(w.id, w);
    for (const x of topology.xwalks) {
      (this.xwalksAt.get(x.node) ?? this.xwalksAt.set(x.node, []).get(x.node)!).push(x);
    }
    this.buildCornerLinks();
    if (options.obstacles) this.indexObstacles(options.obstacles);
    this.spawnCandidates =
      options.spawnWalks !== undefined
        ? options.spawnWalks.map((id) => this.walkById.get(id)).filter((w): w is WalkEdge => w !== undefined)
        : topology.walks.filter((w) => w.nodeA !== w.nodeB && this.walkGeom(w.id).length >= 12);
    for (const spec of options.peds ?? []) this.spawn(spec);
  }

  setFocus(x: number, z: number): void {
    this.focusX = x;
    this.focusZ = z;
  }

  /**
   * PR09: retarget the crowd cap live (the actor-tier step-down). Raising
   * the target lets the spawner refill; lowering it retires the excess
   * *ambient* peds — farthest from focus first — which the spawner pass
   * despawns once they sit beyond the anti-pop distance. Scripted slice
   * spawns are never marked, so a target below the scripted count leaves
   * the scenario untouched.
   */
  setTargetPeds(target: number): void {
    this.targetPeds = Math.max(0, Math.floor(target));
    for (const p of this.peds) p.retiring = false;
    let excess = this.peds.length - this.targetPeds;
    if (excess <= 0) return;
    const ambient = this.peds.filter((p) => p.ambient);
    if (Number.isFinite(this.focusX)) {
      ambient.sort(
        (a, b) =>
          Math.hypot(b.x - this.focusX, b.z - this.focusZ) - Math.hypot(a.x - this.focusX, a.z - this.focusZ),
      );
    }
    for (const p of ambient) {
      if (excess <= 0) break;
      p.retiring = true;
      excess--;
    }
  }

  // --- Static indexes ---------------------------------------------------------------

  private walkGeom(id: string): PathGeom {
    let g = this.walkGeoms.get(id);
    if (g === undefined) {
      const w = this.walkById.get(id);
      g = w ? { points: w.points, ...cumulative(w.points) } : { points: [], cum: new Float64Array(0), length: 0 };
      this.walkGeoms.set(id, g);
    }
    return g;
  }

  /**
   * Corner links: pairs of band ends at one junction that share a sidewalk
   * corner. Two ends link when they're on different road pieces (same piece
   * = opposite sides of one street = jaywalking), close enough to be one
   * corner, and the hop between them never crosses a carriageway lane
   * centreline — the walkability test that keeps peds out of the street.
   */
  private buildCornerLinks(): void {
    for (const w of this.topology.walks) {
      const n = w.points.length;
      const ends: [string, 0 | 1][] = [
        [w.nodeA, 0],
        [w.nodeB, 1],
      ];
      for (const [node, end] of ends) {
        const list = this.bandEnds.get(node) ?? this.bandEnds.set(node, []).get(node)!;
        list.push({ walk: w, end, x: w.points[end === 0 ? 0 : n - 2]!, z: w.points[end === 0 ? 1 : n - 1]! });
      }
    }
    for (const [nodeId, ends] of this.bandEnds) {
      const lanes = [...(this.topology.lanesTo.get(nodeId) ?? []), ...(this.topology.lanesFrom.get(nodeId) ?? [])];
      for (const a of ends) {
        for (const b of ends) {
          if (a.walk === b.walk || a.walk.roadId === b.walk.roadId) continue;
          const d = Math.hypot(b.x - a.x, b.z - a.z);
          if (d < 0.3 || d > CORNER_LINK_MAX_METRES) continue;
          let jaywalk = false;
          for (const lane of lanes) {
            if (pathCrossesSeg(lane.points, a.x, a.z, b.x, b.z)) {
              jaywalk = true;
              break;
            }
          }
          if (jaywalk) continue;
          const key = `${a.walk.id}:${a.end}`;
          const list = this.corners.get(key) ?? this.corners.set(key, []).get(key)!;
          // Deterministic id, sorted insertion — link candidates iterate band ends in collection order.
          const exitS = b.end === 0 ? 0 : this.walkGeom(b.walk.id).length;
          list.push({
            id: `corner:${a.walk.id}:${a.end}>${b.walk.id}:${b.end}`,
            geom: { points: [a.x, a.z, b.x, b.z], ...cumulative([a.x, a.z, b.x, b.z]) },
            exit: { band: b.walk.id, s: exitS, dir: b.end === 0 ? 1 : -1 },
          });
        }
      }
    }
    for (const list of this.corners.values()) list.sort((a, b) => (a.id < b.id ? -1 : 1));
  }

  /**
   * Project static obstacles onto the bands they fall inside. A grid over
   * band segments keeps the build O(obstacles × nearby segments), not
   * O(obstacles × the whole tile).
   */
  private indexObstacles(points: FlatPoints): void {
    const CELL = 16;
    const grid = new Map<number, { walk: WalkEdge; geom: PathGeom }[]>();
    const key = (x: number, z: number) => Math.floor(x / CELL) * 1_000_003 + Math.floor(z / CELL);
    for (const w of this.topology.walks) {
      const geom = this.walkGeom(w.id);
      for (let i = 0; i + 1 < w.points.length; i += 2) {
        const k = key(w.points[i]!, w.points[i + 1]!);
        const rec = { walk: w, geom };
        const list = grid.get(k) ?? grid.set(k, []).get(k)!;
        if (!list.includes(rec)) list.push(rec);
      }
    }
    for (let i = 0; i + 1 < points.length; i += 2) {
      const ox = points[i]!;
      const oz = points[i + 1]!;
      const cx = Math.floor(ox / CELL);
      const cz = Math.floor(oz / CELL);
      const seen = new Set<string>();
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gz = cz - 1; gz <= cz + 1; gz++) {
          for (const { walk, geom } of grid.get(gx * 1_000_003 + gz) ?? []) {
            if (seen.has(walk.id)) continue;
            seen.add(walk.id);
            const s = nearestS(geom, ox, oz);
            poseAlong(geom, s, SCRATCH);
            const d = Math.hypot(SCRATCH.x - ox, SCRATCH.z - oz);
            const half = walk.widthMeters / 2;
            if (d > half + 0.5) continue;
            const nrm = normalOf(SCRATCH.yaw);
            const lat = (ox - SCRATCH.x) * nrm.x + (oz - SCRATCH.z) * nrm.z;
            const list = this.obstacles.get(walk.id) ?? this.obstacles.set(walk.id, []).get(walk.id)!;
            list.push({ s, lat });
          }
        }
      }
    }
    for (const list of this.obstacles.values()) list.sort((a, b) => a.s - b.s);
  }

  // --- Signals ------------------------------------------------------------------------

  private signalState(nodeId: string): ReturnType<SignalSystem['state']> | undefined {
    let st = this.aspectCache.get(nodeId);
    if (st === undefined) {
      st = this.signals.state(nodeId);
      if (st) this.aspectCache.set(nodeId, st);
    }
    return st;
  }

  private pedAspect(xwalk: XwalkLeg): 'W' | 'F' | 'D' {
    return this.signalState(xwalk.node)?.pedAspects[xwalk.id] ?? 'W';
  }

  private request(ped: Ped, xwalk: string): 'granted' | 'queued' | 'must-yield' {
    return this.signals.requestGrant(ped.entity, xwalk);
  }

  private releaseClaim(ped: Ped): void {
    if (ped.claimXwalk === '') return;
    this.signals.release(ped.entity);
    ped.claimXwalk = '';
  }

  // --- Kerb geometry ---------------------------------------------------------------------

  /** Arc s on `band` closest to the given xwalk endpoint (end 0 = polyline head). */
  private kerbS(bandId: string, xwalk: XwalkLeg, end: 0 | 1): number {
    const n = xwalk.points.length;
    const x = xwalk.points[end === 0 ? 0 : n - 2]!;
    const z = xwalk.points[end === 0 ? 1 : n - 1]!;
    return nearestS(this.walkGeom(bandId), x, z);
  }

  private xwalkEnd(xwalk: XwalkLeg, end: 0 | 1): { x: number; z: number } {
    const n = xwalk.points.length;
    return { x: xwalk.points[end === 0 ? 0 : n - 2]!, z: xwalk.points[end === 0 ? 1 : n - 1]! };
  }

  /**
   * The channel-shifted mouth point for a crossing that enters at `nearEnd`:
   * right of travel across the zebra. The two directions get mouths on
   * opposite sides of the kerb, so queues and landings never share ground.
   */
  private channelPoint(xwalk: XwalkLeg, nearEnd: 0 | 1): { x: number; z: number } {
    const a0 = this.xwalkEnd(xwalk, nearEnd);
    const b0 = this.xwalkEnd(xwalk, nearEnd === 0 ? 1 : 0);
    const ax = b0.x - a0.x;
    const az = b0.z - a0.z;
    const alen = Math.hypot(ax, az) || 1;
    return { x: a0.x + (-az / alen) * XWALK_CHANNEL_METRES, z: a0.z + (ax / alen) * XWALK_CHANNEL_METRES };
  }

  /** The band under an xwalk endpoint: the recorded match first, else the nearest band anchored at the node. */
  private bandUnder(xwalk: XwalkLeg, end: 0 | 1, px: number, pz: number): { band: string; s: number } | null {
    const recorded = xwalk.walks[end];
    if (recorded && this.walkById.has(recorded)) {
      return { band: recorded, s: this.kerbS(recorded, xwalk, end) };
    }
    let best: { band: string; s: number } | null = null;
    let bestD = XWALK_DECIDE_REACH_METRES;
    for (const be of this.bandEnds.get(xwalk.node) ?? []) {
      const s = nearestS(this.walkGeom(be.walk.id), px, pz);
      poseAlong(this.walkGeom(be.walk.id), s, SCRATCH);
      const d = Math.hypot(SCRATCH.x - px, SCRATCH.z - pz);
      if (d < bestD) {
        bestD = d;
        best = { band: be.walk.id, s };
      }
    }
    return best;
  }

  /**
   * The crossing path: kerb position → near xwalk endpoint → across → far
   * endpoint → far band's closest point. Built per entry so the hop from the
   * wait pose onto the zebra is part of the traversal — no teleports.
   *
   * The zebra polyline is shifted ~0.9 m to the RIGHT of this ped's travel
   * direction, like the two streams of people a real crosswalk carries:
   * opposite-direction crowds ride different channels and never meet
   * head-on at the shared mouth vertex.
   */
  private buildCrossing(ped: Ped, xwalk: XwalkLeg): { geom: PathGeom; exit: { band: string; s: number; dir: 1 | -1 }; entryEnd: 0 | 1 } | null {
    const p = xwalk.points;
    const n = p.length;
    const dA = Math.hypot(p[0]! - ped.x, p[1]! - ped.z);
    const dB = Math.hypot(p[n - 2]! - ped.x, p[n - 1]! - ped.z);
    const nearEnd: 0 | 1 = dA <= dB ? 0 : 1;
    const farEnd: 0 | 1 = nearEnd === 0 ? 1 : 0;
    const far = this.xwalkEnd(xwalk, farEnd);
    const landing = this.bandUnder(xwalk, farEnd, far.x, far.z);
    if (!landing) return null;
    // Channel offset: right of travel along the zebra axis.
    const a0 = this.xwalkEnd(xwalk, nearEnd);
    const b0 = this.xwalkEnd(xwalk, farEnd);
    const ax = b0.x - a0.x;
    const az = b0.z - a0.z;
    const alen = Math.hypot(ax, az) || 1;
    const chx = (-az / alen) * XWALK_CHANNEL_METRES;
    const chz = (ax / alen) * XWALK_CHANNEL_METRES;
    const pts: number[] = [ped.x, ped.z];
    // Kerb-edge approach: sample the band from my arc position to the
    // channel mouth, each point drifted toward the channel (street) side.
    // The file of same-mouth waiters loiters near the band axis, so a
    // departing ped threads the curb edge beside them — a straight
    // pos→mouth hop swept diagonally through the file and deadlocked the
    // slice (the head ped froze 2 m in, queue-mates parked in its fan).
    const chNear = this.channelPoint(xwalk, nearEnd);
    const nearBand = this.walkGeom(ped.element);
    const kerb = nearestS(nearBand, chNear.x, chNear.z);
    const span = kerb - ped.s;
    const steps = Math.max(1, Math.ceil(Math.abs(span)));
    for (let i = 1; i <= steps; i++) {
      const si = Math.max(0, Math.min(nearBand.length, ped.s + span * (i / steps)));
      poseAlong(nearBand, si, SCRATCH);
      const n = normalOf(SCRATCH.yaw);
      const latToward = (chNear.x - SCRATCH.x) * n.x + (chNear.z - SCRATCH.z) * n.z;
      const off = Math.max(-KERB_EDGE_METRES, Math.min(KERB_EDGE_METRES, latToward));
      const px = SCRATCH.x + n.x * off;
      const pz = SCRATCH.z + n.z * off;
      if (Math.hypot(px - pts[pts.length - 2]!, pz - pts[pts.length - 1]!) > 0.15) pts.push(px, pz);
    }
    if (nearEnd === 0) {
      for (let i = 0; i < n; i += 2) pts.push(p[i]! + chx, p[i + 1]! + chz);
    } else {
      for (let i = n - 2; i >= 0; i -= 2) pts.push(p[i]! + chx, p[i + 1]! + chz);
    }
    // Land on the far band at its closest point to MY channel's far mouth
    // (far end + my right-of-travel offset). The reverse stream's kerb file
    // lives on the other side of the mouth, so arriving peds never land
    // inside a waiting queue.
    const landingGeom = this.walkGeom(landing.band);
    const landingS = nearestS(landingGeom, far.x + chx, far.z + chz);
    poseAlong(landingGeom, landingS, SCRATCH);
    pts.push(SCRATCH.x, SCRATCH.z);
    const geom = { points: pts, ...cumulative(pts) };
    // Continue away from the junction along the far band.
    const len = landingGeom.length;
    let dir: 1 | -1;
    if (landingS <= 0.5) dir = 1;
    else if (landingS >= len - 0.5) dir = -1;
    else {
      poseAlong(landingGeom, landingS + 1, SCRATCH);
      const dPlus = Math.hypot(SCRATCH.x - far.x, SCRATCH.z - far.z);
      poseAlong(landingGeom, landingS - 1, SCRATCH);
      const dMinus = Math.hypot(SCRATCH.x - far.x, SCRATCH.z - far.z);
      dir = dPlus >= dMinus ? 1 : -1;
    }
    return { geom, exit: { band: landing.band, s: landingS, dir }, entryEnd: nearEnd };
  }

  // --- Spawning / despawning ------------------------------------------------------------

  spawn(spec: PedSpawnSpec): number {
    const band = this.walkById.get(spec.walk);
    const geom = band ? this.walkGeom(band.id) : undefined;
    if (!band || !geom || geom.length < 1) return -1;
    const plan = spec.plan ?? 'wander';
    const loopXwalk = plan === 'loop' ? this.topology.xwalks.find((x) => x.id === spec.xwalk) : undefined;
    if (plan === 'loop' && !loopXwalk) return -1;
    const s = Math.max(0.3, Math.min(geom.length - 0.3, spec.s ?? geom.length / 2));
    const id = this.nextPedId++;
    const kind = spec.kind ?? 'adult';
    const [vLo, vHi] = PED_SPEED[kind];
    const ped: Ped = {
      id,
      entity: `ped:${id}`,
      kind,
      plan,
      loopXwalk: spec.xwalk ?? '',
      loopStroll: spec.strollMetres ?? 0,
      element: band.id,
      mode: 'band',
      viewElement: band.id,
      s,
      dir: spec.dir ?? 1,
      lat: 0,
      latTarget: 0,
      v: 0,
      desired: vLo + this.rng() * (vHi - vLo),
      task: { kind: 'stroll', remaining: Infinity },
      claimXwalk: '',
      slotS: s,
      bias: this.rng(),
      x: 0,
      z: 0,
      yaw: 0,
      prevX: 0,
      prevZ: 0,
      prevYaw: 0,
      age: 0,
      flags: 0,
      ambient: spec.ambient === true,
      retiring: false,
    };
    this.poseOnBand(ped, ped.element, ped.s, ped.lat);
    if (plan === 'loop') {
      // Position must be known before taskWalkToKerb picks the near xwalk end.
      this.taskWalkToKerb(ped, band.id, loopXwalk!);
    } else {
      ped.dir = spec.dir ?? (this.rng() < 0.5 ? 1 : -1);
      this.poseOnBand(ped, ped.element, ped.s, ped.lat);
    }
    ped.prevX = ped.x;
    ped.prevZ = ped.z;
    ped.prevYaw = ped.yaw;
    this.peds.push(ped);
    this.metrics.spawnTotal++;
    this.metrics.peakPeds = Math.max(this.metrics.peakPeds, this.peds.length);
    return id;
  }

  /** Task: walk along the band to the kerb queue for whichever xwalk end is nearer the ped. */
  private taskWalkToKerb(ped: Ped, bandId: string, xwalk: XwalkLeg): void {
    const near = this.nearEndOf(ped, xwalk);
    // The file queues behind the CHANNEL mouth, not the raw xwalk end — the
    // departure corridor and the kerbside line then live on the same side
    // of the mouth, and the opposite stream lands on the other.
    const ch = this.channelPoint(xwalk, near);
    const kerb = nearestS(this.walkGeom(bandId), ch.x, ch.z);
    const dir: 1 | -1 = kerb >= ped.s ? 1 : -1;
    ped.dir = dir;
    // Join at the head-of-queue position: the slot system in waitKerb then
    // shuffles the ped back to its real place in the file. The kerb point
    // itself stays free — it's where crossers land.
    const sWait = Math.max(0, Math.min(this.walkGeom(bandId).length, kerb - dir * (KERB_SETBACK_METRES + QUEUE_HEAD_METRES)));
    if (Math.abs(sWait - ped.s) <= ARRIVE_TOLERANCE_METRES) {
      ped.task = { kind: 'waitKerb', xwalk: xwalk.id };
      return;
    }
    ped.task = { kind: 'walkTo', sTarget: sWait, xwalk: xwalk.id };
  }

  private nearEndOf(ped: Ped, xwalk: XwalkLeg): 0 | 1 {
    const p = xwalk.points;
    const n = p.length;
    const dA = Math.hypot(p[0]! - ped.x, p[1]! - ped.z);
    const dB = Math.hypot(p[n - 2]! - ped.x, p[n - 1]! - ped.z);
    return dA <= dB ? 0 : 1;
  }

  /**
   * Is my kerb mouth empty of moving foot traffic? Only peds already ON a
   * link count — fellow kerb-waiters stand this close by design and must
   * not block each other. One entrant at a time: the first ped to step off
   * occupies the mouth for ~1 s, so a queue files in rather than funnelling.
   */
  private mouthClear(ped: Ped, xwalk: XwalkLeg): boolean {
    const near = this.channelPoint(xwalk, this.nearEndOf(ped, xwalk));
    for (const q of this.peds) {
      if (q === ped || q.mode !== 'link') continue;
      if (Math.hypot(q.x - near.x, q.z - near.z) < 1.5) return false;
    }
    return true;
  }

  /**
   * Am I at the front of this kerb's line? Every waiter enters on an angled
   * path to the channel mouth; if a queue-mate stands closer to MY mouth
   * than I do, letting both go funnels them into each other. Strict
   * distance order (id tie-break) files the queue — the second in line
   * steps off once the leader has cleared the mouth.
   */
  private frontOfQueue(ped: Ped, xwalk: XwalkLeg): boolean {
    const near = this.channelPoint(xwalk, this.nearEndOf(ped, xwalk));
    const mine = Math.hypot(ped.x - near.x, ped.z - near.z);
    for (const q of this.peds) {
      if (q === ped || q.mode !== 'band') continue;
      const task = q.task;
      const wants = (task.kind === 'waitKerb' || task.kind === 'walkTo') && task.xwalk === xwalk.id;
      if (!wants) continue;
      const theirs = Math.hypot(q.x - near.x, q.z - near.z);
      if (theirs < mine - 0.05 || (Math.abs(theirs - mine) <= 0.05 && q.id < ped.id)) return false;
    }
    return true;
  }

  /**
   * Is the first ~2.5 m of my crossing path clear of foot traffic? Same-
   * mouth queue-mates are skipped — the file order (frontOfQueue) already
   * serializes them, and they legitimately stand on the band behind me.
   * Everyone else (wanderers, other-xwalk crowds, corner-link peds) blocks
   * my departure fan.
   */
  private entryClear(ped: Ped, xwalk: XwalkLeg, geom: PathGeom): boolean {
    const pts = geom.points;
    const REACH = 2.5;
    const FLOOR = MIN_SEPARATION_METRES + 0.1;
    let acc = 0;
    for (let i = 2; i + 1 < pts.length && acc < REACH; i += 2) {
      const ax = pts[i - 2]!;
      const az = pts[i - 1]!;
      const bx = pts[i]!;
      const bz = pts[i + 1]!;
      const dx = bx - ax;
      const dz = bz - az;
      const l2 = dx * dx + dz * dz;
      for (const q of this.peds) {
        if (q === ped) continue;
        const task = q.task;
        if ((task.kind === 'waitKerb' || task.kind === 'walkTo') && task.xwalk === xwalk.id) continue;
        const t = l2 > 0 ? Math.max(0, Math.min(1, ((q.x - ax) * dx + (q.z - az) * dz) / l2)) : 0;
        const d = Math.hypot(ax + dx * t - q.x, az + dz * t - q.z);
        if (d < FLOOR) return false;
      }
      acc += Math.sqrt(l2);
    }
    return true;
  }

  /**
   * True while a same-mouth crosser is still inside the first
   * ENTRY_SERIAL metres of the zebra. Serializes the kerb file through
   * the ramp — two peds stepping off abreast knot inside a ~1 m channel
   * and froze the slice in early runs; real people single-file the ramp.
   */
  private zebraEntryBusy(ped: Ped, xwalk: XwalkLeg): boolean {
    const myEnd = this.nearEndOf(ped, xwalk);
    for (const q of this.peds) {
      if (q === ped || q.mode !== 'link' || q.task.kind !== 'link' || q.task.linkKind !== 'xwalk') continue;
      if (q.viewElement !== xwalk.id || q.task.entryEnd !== myEnd) continue;
      if (q.s < ENTRY_SERIAL_METRES) return true;
    }
    return false;
  }

  /**
   * My slot in this kerb's file: how many same-mouth waiters stand closer
   * to the mouth than me. Recomputed every tick — the file shuffles forward
   * as the head steps off, like a real kerbside line.
   */
  private queueSlot(ped: Ped, xwalk: XwalkLeg, near: { x: number; z: number }): number {
    const mine = Math.hypot(ped.x - near.x, ped.z - near.z);
    let k = 0;
    for (const q of this.peds) {
      if (q === ped || q.mode !== 'band' || q.task.kind !== 'waitKerb' || q.task.xwalk !== xwalk.id) continue;
      if (this.nearEndOf(q, xwalk) !== this.nearEndOf(ped, xwalk)) continue;
      const theirs = Math.hypot(q.x - near.x, q.z - near.z);
      if (theirs < mine - 0.05 || (Math.abs(theirs - mine) <= 0.05 && q.id < ped.id)) k++;
    }
    return k;
  }

  private despawn(ped: Ped): void {
    this.releaseClaim(ped);
    const i = this.peds.indexOf(ped);
    if (i >= 0) this.peds.splice(i, 1);
    this.metrics.despawnTotal++;
  }

  // --- Routing decisions -------------------------------------------------------------------

  /**
   * A wanderer reaching a band end picks: a corner link (keep strolling,
   * weight 3), a crosswalk whose near end is at this end (weight 1 each), or
   * turn back (weight 1, the dead-end/boundary fallback). Deterministic —
   * the seeded draw runs in ped id order.
   */
  private decideAtBandEnd(ped: Ped): void {
    const band = this.walkById.get(ped.element)!;
    const nodeId = ped.dir === 1 ? band.nodeB : band.nodeA;
    const node = this.topology.nodeById.get(nodeId);
    const key = `${band.id}:${ped.dir === 1 ? 1 : 0}`;
    const options: { weight: number; run: () => void }[] = [];
    for (const link of this.corners.get(key) ?? []) {
      options.push({
        weight: 3,
        run: () => {
          ped.mode = 'link';
          ped.viewElement = link.id;
          ped.s = 0;
          ped.task = { kind: 'link', linkKind: 'corner', geom: link.geom, exit: link.exit };
        },
      });
    }
    if (node && (node.kind === 'junction' || node.kind === 'link')) {
      const geom = this.walkGeom(band.id);
      poseAlong(geom, ped.dir === 1 ? geom.length : 0, SCRATCH);
      const ex = SCRATCH.x;
      const ez = SCRATCH.z;
      for (const x of this.xwalksAt.get(nodeId) ?? []) {
        const endA = this.xwalkEnd(x, 0);
        const endB = this.xwalkEnd(x, 1);
        const near = Math.min(Math.hypot(endA.x - ex, endA.z - ez), Math.hypot(endB.x - ex, endB.z - ez));
        if (near > XWALK_DECIDE_REACH_METRES) continue;
        options.push({
          weight: 1,
          run: () => this.taskWalkToKerb(ped, band.id, x),
        });
      }
    }
    // Turnback is always an option — the only one at boundaries/dead ends.
    options.push({
      weight: 1,
      run: () => {
        ped.dir = ped.dir === 1 ? -1 : 1;
        ped.task = { kind: 'stroll', remaining: Infinity };
      },
    });
    let r = this.rng() * options.reduce((sum, o) => sum + o.weight, 0);
    for (const o of options) {
      r -= o.weight;
      if (r <= 0) {
        o.run();
        return;
      }
    }
    options[options.length - 1]!.run();
  }

  /** The next task after a completed stroll (loop peds head back to the kerb; wanderers already decided). */
  private afterStroll(ped: Ped): void {
    if (ped.plan === 'loop') {
      const xwalk = this.topology.xwalks.find((x) => x.id === ped.loopXwalk);
      if (xwalk && ped.mode === 'band') {
        this.taskWalkToKerb(ped, ped.element, xwalk);
        return;
      }
    }
    ped.task = { kind: 'stroll', remaining: Infinity };
  }

  // --- Uncontrolled-crossing caution ---------------------------------------------------------

  /**
   * At a junction with no controller the solver grants instantly, so the
   * claim can't serialize peds against traffic. Before stepping off the
   * kerb at an unsignalized crossing, wait for a real gap: no vehicle on a
   * conflicting element, and no vehicle approaching one of the inbound
   * lanes close enough to reach the zebra before the ped could clear the
   * first conflict zone. Signalized kerbs skip this — pedBlocks does it.
   */
  private readonly uncontrolledMatrices = new Map<string, ConflictMatrix>();

  private matrixFor(nodeId: string): ConflictMatrix | undefined {
    let m = this.uncontrolledMatrices.get(nodeId);
    if (m === undefined) {
      try {
        m = buildConflictMatrix(this.topology, nodeId);
      } catch {
        return undefined;
      }
      this.uncontrolledMatrices.set(nodeId, m);
    }
    return m;
  }

  private uncontrolledGapClear(xwalk: XwalkLeg): boolean {
    const controller = this.signals.controllerForElement(xwalk.id);
    if (controller || !this.fleet) return true;
    const conflict = this.matrixFor(xwalk.node);
    const set = conflict?.conflictSet(xwalk.id);
    const lanesIn = this.topology.lanesTo.get(xwalk.node) ?? [];
    for (const v of this.fleet()) {
      if (set?.has(v.element)) return false;
      for (const lane of lanesIn) {
        if (v.element !== lane.id) continue;
        const gap = lane.lengthMeters - v.s;
        const reach = Math.max(6, (v.speed * v.speed) / (2 * 3.05) + v.speed * 1.0);
        if (gap < reach) return false;
      }
    }
    return true;
  }

  // --- Pose helpers -------------------------------------------------------------------------

  private geomOf(ped: Ped): PathGeom {
    if (ped.mode === 'link' && ped.task.kind === 'link') return ped.task.geom;
    return this.walkGeom(ped.element);
  }

  /** Corridor half-width cap for the lateral offset on the ped's current element. */
  private latMax(ped: Ped): number {
    if (ped.mode === 'link' && ped.task.kind === 'link') {
      return ped.task.linkKind === 'xwalk' ? XWALK_LAT_MAX_METRES : CORNER_LAT_MAX_METRES;
    }
    const band = this.walkById.get(ped.element);
    return Math.max(0.25, (band?.widthMeters ?? 1) / 2 - 0.35);
  }

  private poseOnBand(ped: Ped, element: string, s: number, lat: number): void {
    const geom = this.walkGeom(element);
    poseAlong(geom, s, SCRATCH);
    const nrm = normalOf(SCRATCH.yaw);
    ped.x = SCRATCH.x + nrm.x * lat;
    ped.z = SCRATCH.z + nrm.z * lat;
    ped.yaw = SCRATCH.yaw + (ped.dir === -1 ? Math.PI : 0);
    ped.yaw = normAngle(ped.yaw);
  }

  private poseOnLink(ped: Ped): void {
    if (ped.task.kind !== 'link') return;
    const geom = ped.task.geom;
    poseAlong(geom, ped.s, SCRATCH);
    const nrm = normalOf(SCRATCH.yaw);
    ped.x = SCRATCH.x + nrm.x * ped.lat;
    ped.z = SCRATCH.z + nrm.z * ped.lat;
    ped.yaw = SCRATCH.yaw;
  }

  // --- Per-tick control ------------------------------------------------------------------------

  private rebuildHash(): void {
    this.hash.clear();
    for (const p of this.peds) {
      const k = Math.floor(p.x / HASH_CELL_METRES) * 100_003 + Math.floor(p.z / HASH_CELL_METRES);
      (this.hash.get(k) ?? this.hash.set(k, []).get(k)!).push(p);
    }
  }

  private neighboursOf(ped: Ped): Ped[] {
    const cx = Math.floor(ped.x / HASH_CELL_METRES);
    const cz = Math.floor(ped.z / HASH_CELL_METRES);
    const out: Ped[] = [];
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gz = cz - 1; gz <= cz + 1; gz++) {
        for (const q of this.hash.get(gx * 100_003 + gz) ?? []) {
          if (q !== ped && Math.hypot(q.x - ped.x, q.z - ped.z) <= NEIGHBOUR_RADIUS_METRES) out.push(q);
        }
      }
    }
    out.sort((a, b) => a.id - b.id); // deterministic evaluation order
    return out;
  }

  /** The pair's separation floor — the kerb-crush allowance near a corridor end. */
  private crowdFloor(ped: Ped): number {
    const g = this.geomOf(ped);
    return ped.s < KERB_CRUSH_ZONE_METRES || ped.s > g.length - KERB_CRUSH_ZONE_METRES ? KERB_CRUSH_METRES : MIN_SEPARATION_METRES;
  }

  step(dt: number): void {
    if (this.advanceSignals) this.signals.step(dt);
    this.aspectCache.clear();
    this.rebuildHash();
    for (const p of [...this.peds].sort((a, b) => a.id - b.id)) {
      this.updatePed(p, dt);
    }
    this.metrics.pedestrians = this.peds.length;
    this.spawner(dt);
    this.metrics.tick++;
    this.metrics.simTime += dt;
  }

  private updatePed(ped: Ped, dt: number): void {
    ped.prevX = ped.x;
    ped.prevZ = ped.z;
    ped.prevYaw = ped.yaw;
    ped.age += dt;
    let flags = 0;

    // ---- Task control: what does this ped want this tick? --------------------------
    let v0 = ped.desired;
    let wantAdvance = true;
    let latMax = this.latMax(ped);
    const keepRight = KEEP_RIGHT_MAX_METRES * (ped.mode === 'link' ? 1 : ped.dir);
    ped.latTarget = Math.min(latMax, keepRight);

    if (ped.task.kind === 'waitKerb') {
      flags |= PFLAG.waiting;
      const xw = this.topology.xwalks.find((x) => x.id === (ped.task as { readonly xwalk: string }).xwalk);
      // Kerbside file: stand in the slot my distance-to-mouth earns me and
      // creep forward as the queue drains. The head stands QUEUE_HEAD off
      // the kerb point so landing crossers always find it clear.
      ped.slotS = ped.s;
      if (xw) {
        const nearEnd = this.nearEndOf(ped, xw);
        const near = this.channelPoint(xw, nearEnd);
        const kerb = nearestS(this.walkGeom(ped.element), near.x, near.z);
        const k = this.queueSlot(ped, xw, near);
        const glen = this.walkGeom(ped.element).length;
        ped.slotS = Math.max(0, Math.min(glen, kerb - ped.dir * (KERB_SETBACK_METRES + QUEUE_HEAD_METRES + k * QUEUE_SLOT_METRES)));
        const gap = (ped.slotS - ped.s) * ped.dir;
        if (gap > 0.25) {
          // Shuffle up the file — a slow honest creep, not a stand.
          wantAdvance = true;
          v0 = QUEUE_CREEP_MPS;
        }
      }
      if (!wantAdvance) {
        v0 = 0;
        // Loiter: a narrow shoulder spread along the file, not a fan.
        ped.latTarget = Math.min(latMax, keepRight * 0.4 + (ped.bias - 0.5) * 0.5);
      }
      if (xw) {
        // Still kerbside when WALK lapses (mouth stayed busy): release the
        // held claim — a ped that never stepped off must not keep vehicles
        // out through their own green. Re-requests on the next WALK.
        if (this.pedAspect(xw) !== 'W') this.releaseClaim(ped);
        const res = this.request(ped, xw.id);
        if (res === 'granted') {
          const crossing = this.buildCrossing(ped, xw);
          if (!crossing) {
            // The far kerb lands on nothing walkable — abandon the claim and wander on.
            this.signals.release(ped.entity);
            ped.task = { kind: 'stroll', remaining: Infinity };
          } else if (!this.uncontrolledGapClear(xw)) {
            // Unsignalized crossing: the claim granted instantly, but traffic
            // isn't claim-ordered here — drop the claim and retry next tick
            // when the gap may be clean.
            this.signals.release(ped.entity);
          } else if (!this.mouthClear(ped, xw) || !this.frontOfQueue(ped, xw) || this.zebraEntryBusy(ped, xw) || !this.entryClear(ped, xw, crossing.geom)) {
            // "Let them off before you get on" + queue order + single-file
            // through the ramp: someone is still moving through this kerb
            // mouth, a queue-mate stands closer to it, the head is still in
            // the ramp's first metres, or a pedestrian sits inside my
            // departure fan. Hold the granted claim at the kerb — the zebra
            // stays reserved against conflicting traffic until I can step off.
            ped.claimXwalk = xw.id;
          } else {
            ped.claimXwalk = xw.id;
            ped.mode = 'link';
            ped.viewElement = xw.id;
            ped.s = 0;
            ped.task = { kind: 'link', linkKind: 'xwalk', geom: crossing.geom, exit: crossing.exit, entryEnd: crossing.entryEnd };
            wantAdvance = true;
            v0 = Math.max(ped.desired, NYC_PED_SPEED_MPS);
            flags |= PFLAG.crossing;
          }
        }
      }
    } else if (ped.task.kind === 'link') {
      flags |= ped.task.linkKind === 'xwalk' ? PFLAG.crossing : PFLAG.corner;
      if (ped.task.linkKind === 'xwalk') {
        const xw = this.topology.xwalks.find((x) => x.id === ped.viewElement);
        v0 = Math.max(ped.desired, NYC_PED_SPEED_MPS);
        // Heartbeat the held claim: a re-request refreshes heldAt, so the
        // zebra stays reserved while I'm committed — even if clearing takes
        // longer than the solver's stale-claim window (a crowd pinch is not
        // an abandoned claim).
        if (ped.claimXwalk !== '') this.request(ped, ped.claimXwalk);
        if (xw && this.pedAspect(xw) !== 'W') {
          // Committed past the WALK interval: finish honestly, hurry.
          flags |= PFLAG.clearing;
          v0 = Math.max(ped.desired, FDW_HURRY_MPS);
        }
      }
      latMax = this.latMax(ped);
      ped.latTarget = Math.min(latMax, KEEP_RIGHT_MAX_METRES);
    }

    // ---- Neighbours: separation steering ------------------------------------------
    const neighbours = this.neighboursOf(ped);
    const geom = this.geomOf(ped);
    const myFloor = this.crowdFloor(ped);
    poseAlong(geom, ped.s, SCRATCH);
    let dx = Math.sin(SCRATCH.yaw) * (ped.mode === 'link' ? 1 : ped.dir);
    let dz = Math.cos(SCRATCH.yaw) * (ped.mode === 'link' ? 1 : ped.dir);
    const nrm = normalOf(Math.atan2(dx, dz));
    let maxAdvance = wantAdvance ? v0 * dt : 0;
    let held = false;
    for (const q of neighbours) {
      const rx = q.x - ped.x;
      const rz = q.z - ped.z;
      const along = rx * dx + rz * dz;
      const latQ = rx * nrm.x + rz * nrm.z;
      // Longitudinal: never advance into another pedestrian — the 2D gap
      // clamp. An oncoming ped offset by at least MIN_SEPARATION passes
      // beside me (keep-right puts opposing streams on opposite sides), so
      // only genuinely-lane-mates brake. The earlier wider band deadlocked
      // a zebra: two face-on peds at ~1.5 m lateral each froze the other.
      if (along > 0.02) {
        const qdirX = Math.sin(q.yaw);
        const qdirZ = Math.cos(q.yaw);
        const leadAdv = Math.max(0, q.v * dt * (qdirX * dx + qdirZ * dz)); // leader's motion along my tangent
        const latAbs = Math.abs(latQ);
        const floor = Math.min(myFloor, this.crowdFloor(q));
        // Only a neighbour inside the collision cone brakes me: the sqrt
        // term is the exact longitudinal standoff that keeps the pair's
        // closest approach at the floor. A neighbour at latAbs ≥ floor
        // passes beside me on straight-ahead motion — clamping those
        // (an earlier soft "follow gap" band did) deadlocks kerb queues,
        // where a queued ped legitimately stands 0.6–0.8 m beside a
        // departing crosser's corridor.
        if (latAbs < floor) {
          const allowed = along - Math.sqrt(floor * floor - latAbs * latAbs) + leadAdv;
          if (allowed < maxAdvance) {
            maxAdvance = Math.max(0, allowed);
            held = true;
          }
        }
      }
      // Lateral: shoulder room — drift away inside the corridor. NOT gated
      // on forward motion: a blocked ped still sidesteps (that's what lets
      // a face-on pair on a zebra slide past instead of freezing).
      if (Math.abs(latQ) < 0.7 && Math.abs(along) < 1.4) {
        const push = latQ === 0 ? (ped.bias < 0.5 ? 1 : -1) : latQ > 0 ? -1 : 1;
        ped.latTarget += push * (0.7 - Math.abs(latQ)) * 0.7;
      }
      // Kerbside courtesy, wider and stronger: I'm on the band and q is
      // mid-crossing — ease out of its corridor. A waiter parked inside a
      // departure fan otherwise freezes a committed crosser forever; real
      // people shift aside to let the street-crosser through.
      if (ped.mode === 'band' && q.mode === 'link' && Math.abs(along) < 2.4 && Math.abs(latQ) < 1.9) {
        const push = latQ === 0 ? (ped.bias < 0.5 ? 1 : -1) : latQ > 0 ? -1 : 1;
        ped.latTarget += push * (1.9 - Math.abs(latQ)) * 0.6;
      }
    }
    ped.latTarget = Math.max(-latMax, Math.min(latMax, ped.latTarget));

    // ---- Static obstacles on bands: steer inside the corridor -----------------------
    if (ped.mode === 'band') {
      const list = this.obstacles.get(ped.element);
      if (list) {
        for (const o of list) {
          const ahead = (o.s - ped.s) * ped.dir;
          if (ahead < 0 || ahead > 3.2) continue;
          if (Math.abs(o.lat - ped.lat) < OBSTACLE_CLEARANCE_METRES) {
            const side = ped.lat >= o.lat ? 1 : -1;
            const dodge = o.lat + side * (OBSTACLE_CLEARANCE_METRES + 0.15);
            if (Math.abs(dodge) <= latMax + 0.3) {
              ped.latTarget = Math.max(-latMax, Math.min(latMax, dodge));
              flags |= PFLAG.obstructed;
            }
          }
        }
      }
    }

    // ---- Integrate ---------------------------------------------------------------------
    ped.v = wantAdvance ? Math.min(v0, maxAdvance / dt) : 0;
    if (wantAdvance && held && maxAdvance <= 1e-9) flags |= PFLAG.heldPed;
    ped.lat += Math.max(-LAT_RATE_MPS * dt, Math.min(LAT_RATE_MPS * dt, ped.latTarget - ped.lat));
    let advance = ped.v * dt;
    if (advance < 1e-9) advance = 0;
    // Pre-move state for the separation failsafe: EVERY field the integrate
    // block touches, so a collision restores a coherent pose — the earlier
    // x/z-only rollback left s/lat advanced and the next pose write
    // re-projected straight back into the collision.
    const preS = ped.s;
    const preTask = ped.task;
    const preMode = ped.mode;
    const preElement = ped.element;
    const preView = ped.viewElement;
    const preDir = ped.dir;
    const preClaim = ped.claimXwalk;

    if (ped.mode === 'link' && ped.task.kind === 'link') {
      const total = ped.task.geom.length;
      ped.s = Math.min(total, ped.s + advance);
      if (ped.s >= total - 1e-6) {
        // Traversal done: land where there's ROOM on the exit band — a real
        // person adjusts where they step off the kerb rather than parking
        // on top of whoever's standing at the ramp. Try the recorded spot,
        // then ±0.45 m steps along the band.
        const exit = ped.task.exit;
        const bg = this.walkGeom(exit.band);
        let es = -1;
        for (const off of [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, 1.8, -1.8, 2.4, -2.4, 3.2, -3.2, 4, -4, 5, -5]) {
          const cand = Math.max(0, Math.min(bg.length, exit.s + off));
          poseAlong(bg, cand, SCRATCH);
          let ok = true;
          for (const q of this.peds) {
            if (q !== ped && Math.hypot(q.x - SCRATCH.x, q.z - SCRATCH.z) < KERB_CRUSH_METRES + 0.08) {
              ok = false;
              break;
            }
          }
          if (ok) {
            es = cand;
            break;
          }
        }
        if (es < 0) {
          // Landing fully blocked — stand at the link's end and retry next
          // tick (honest hold, no teleport through the crowd).
          this.poseOnLink(ped);
          flags |= PFLAG.heldPed;
        } else {
          if (ped.task.linkKind === 'xwalk') this.releaseClaim(ped);
          ped.mode = 'band';
          ped.element = exit.band;
          ped.viewElement = exit.band;
          ped.s = es;
          ped.dir = exit.dir;
          ped.lat = 0;
          ped.task = ped.plan === 'loop'
            ? { kind: 'stroll', remaining: ped.loopStroll > 0 ? ped.loopStroll : 14 + this.rng() * 24 }
            : { kind: 'stroll', remaining: Infinity };
          this.poseOnBand(ped, ped.element, ped.s, ped.lat);
        }
      } else {
        this.poseOnLink(ped);
      }
    } else {
      // On a band.
      const glen = geom.length;
      if (ped.task.kind === 'walkTo') {
        const remaining = (ped.task.sTarget - ped.s) * ped.dir;
        if (remaining <= Math.max(ARRIVE_TOLERANCE_METRES, advance)) {
          ped.s = Math.max(0, Math.min(glen, ped.task.sTarget));
          ped.task = { kind: 'waitKerb', xwalk: ped.task.xwalk };
          advance = 0;
        } else {
          ped.s = Math.max(0, Math.min(glen, ped.s + ped.dir * advance));
        }
      } else if (advance > 0) {
        // A kerb waiter creeps only as far as its file slot.
        if (ped.task.kind === 'waitKerb') {
          advance = Math.max(0, Math.min(advance, (ped.slotS - ped.s) * ped.dir));
        }
        ped.s += ped.dir * advance;
        if (ped.task.kind === 'stroll' && ped.task.remaining !== Infinity) {
          ped.task.remaining -= advance;
        }
      }
      // Band-end transitions fire only for strolling peds — a kerb waiter or
      // walkTo arrival standing at a band end must not re-decide every tick.
      if (ped.task.kind === 'stroll' || ped.task.kind === 'walkTo') {
        if (ped.s >= glen - 1e-6 && ped.dir === 1) {
          ped.s = glen;
          if (ped.plan === 'wander' && ped.task.kind === 'stroll') this.decideAtBandEnd(ped);
          else if (ped.task.kind === 'stroll') this.afterStroll(ped);
        } else if (ped.s <= 1e-6 && ped.dir === -1) {
          ped.s = 0;
          if (ped.plan === 'wander' && ped.task.kind === 'stroll') this.decideAtBandEnd(ped);
          else if (ped.task.kind === 'stroll') this.afterStroll(ped);
        } else if (ped.task.kind === 'stroll' && ped.task.remaining <= 0) {
          this.afterStroll(ped);
        }
      }
      this.poseOnBand(ped, ped.element, ped.s, ped.lat);
      // A kerb waiter faces the crossing it wants, like a real person.
      if (ped.task.kind === 'waitKerb') {
        const xw = this.topology.xwalks.find((x) => x.id === (ped.task as { readonly xwalk: string }).xwalk);
        if (xw) {
          const near = this.xwalkEnd(xw, this.nearEndOf(ped, xw));
          ped.yaw = Math.atan2(near.x - ped.x, near.z - ped.z);
        }
      }
    }

    // ---- Post-move separation failsafe ------------------------------------------------
    // The advance clamp is the guarantee; this rollback catches the cases
    // it can't — perpendicular funnels, a lateral ease sliding into a
    // neighbour while advance = 0, a neighbour's own earlier move this
    // tick. It fires only when THIS move closed the gap below the floor:
    // two peds already inside the bubble (a two-abreast kerb entry during
    // the crush zone, say) must be free to keep moving — parallel or
    // separating motion lets the lateral dodge space them out, while a
    // blanket distance check would freeze them overlapped forever.
    {
      let collide = false;
      for (const q of neighbours) {
        const floor = Math.min(myFloor, this.crowdFloor(q));
        const nd = Math.hypot(q.x - ped.x, q.z - ped.z);
        if (nd < floor * 0.9 && nd < Math.hypot(q.x - ped.prevX, q.z - ped.prevZ) - 1e-6) {
          collide = true;
          break;
        }
      }
      if (collide) {
        ped.s = preS;
        // Keep the lateral ease: it's the sidestep that lets a face-on pair
        // slide past. Only forward progress and routing state roll back —
        // the restored x/z is the last safe pose, and next tick's check
        // validates the new lat before it can draw inside anyone.
        ped.task = preTask;
        ped.mode = preMode;
        ped.element = preElement;
        ped.viewElement = preView;
        ped.dir = preDir;
        // A rolled-back link completion released the solver claim first;
        // re-request it so a ped still standing on the zebra holds a claim.
        if (ped.claimXwalk !== preClaim && preClaim !== '') {
          ped.claimXwalk = preClaim;
          this.request(ped, preClaim);
        }
        ped.x = ped.prevX;
        ped.z = ped.prevZ;
        ped.yaw = ped.prevYaw;
        ped.v = 0;
        flags |= PFLAG.heldPed;
      }
    }

    ped.flags = flags;
  }

  // --- Ambient population --------------------------------------------------------------

  private autoSpawnKind(): PedKind {
    let r = this.rng();
    for (const [kind, w] of PED_SPAWN_MIX) {
      r -= w;
      if (r <= 0) return kind;
    }
    return 'adult';
  }

  private spawner(dt: number): void {
    this.spawnAcc += dt;
    if (this.spawnAcc < PED_SPAWN_PERIOD_SECONDS) return;
    this.spawnAcc = 0;
    if (Number.isFinite(this.focusX)) {
      for (const p of [...this.peds]) {
        const d = Math.hypot(p.x - this.focusX, p.z - this.focusZ);
        // PR09: retiring ambient peds are culled past the anti-pop radius
        // so the lower tier actually sheds its cost without a visible pop.
        if (d > this.despawnDistance || (p.retiring && d > this.spawnMinDistance)) this.despawn(p);
      }
    } else {
      for (const p of [...this.peds]) if (p.retiring) this.despawn(p);
    }
    if (this.peds.length >= this.targetPeds || this.spawnCandidates.length === 0) return;
    const band = this.spawnCandidates[Math.floor(this.rng() * this.spawnCandidates.length)]!;
    const geom = this.walkGeom(band.id);
    if (geom.length < 12) return;
    const s = 2 + this.rng() * (geom.length - 4);
    poseAlong(geom, s, SCRATCH);
    if (Number.isFinite(this.focusX) && Math.hypot(SCRATCH.x - this.focusX, SCRATCH.z - this.focusZ) < this.spawnMinDistance) return;
    for (const p of this.peds) {
      if (Math.hypot(p.x - SCRATCH.x, p.z - SCRATCH.z) < PED_SPAWN_HEAD_CLEARANCE) return;
    }
    this.spawn({ kind: this.autoSpawnKind(), walk: band.id, s, plan: 'wander', dir: this.rng() < 0.5 ? 1 : -1, ambient: true });
  }

  // --- Views ----------------------------------------------------------------------------

  private readonly viewRows: PedView[] = [];

  pedestriansView(): readonly PedView[] {
    this.viewRows.length = 0;
    for (const p of this.peds) {
      const state: PedState =
        p.task.kind === 'waitKerb' ? 'wait' : p.mode === 'link' ? (p.task.kind === 'link' && p.task.linkKind === 'xwalk' ? 'cross' : 'corner') : 'walk';
      this.viewRows.push({
        id: p.id,
        kind: p.kind,
        state,
        element: p.viewElement,
        s: p.s,
        speed: p.v,
        x: p.x,
        z: p.z,
        yaw: p.yaw,
        prevX: p.prevX,
        prevZ: p.prevZ,
        prevYaw: p.prevYaw,
        flags: p.flags,
        age: p.age,
        claimXwalk: p.claimXwalk,
      });
    }
    return this.viewRows;
  }

  pedView(id: number): PedView | undefined {
    return this.pedestriansView().find((p) => p.id === id);
  }
}

// --- Snapshot codec (the appended ped section) ----------------------------------------------

/** Pack the crowd into a fresh ped-section array: [count, stride, spawnTotal, despawnTotal] + records. */
export function packPedSection(sim: PedSim): number[] {
  const rows = sim.pedestriansView();
  const out = new Array<number>(PSNAP_HEADER + rows.length * PSNAP_STRIDE).fill(0);
  out[PSNAP.count] = rows.length;
  out[PSNAP.stride] = PSNAP_STRIDE;
  out[PSNAP.spawnTotal] = sim.metrics.spawnTotal;
  out[PSNAP.despawnTotal] = sim.metrics.despawnTotal;
  rows.forEach((p, i) => {
    const o = PSNAP_HEADER + i * PSNAP_STRIDE;
    out[o] = p.id;
    out[o + 1] = PED_KINDS.indexOf(p.kind);
    out[o + 2] = p.prevX;
    out[o + 3] = p.prevZ;
    out[o + 4] = p.prevYaw;
    out[o + 5] = p.x;
    out[o + 6] = p.z;
    out[o + 7] = p.yaw;
    out[o + 8] = p.speed;
    out[o + 9] = p.flags;
    out[o + 10] = p.age;
    out[o + 11] = 0;
  });
  return out;
}

/** The empty ped section — keeps the layout stable when no peds are live. */
export function emptyPedSection(): number[] {
  return [0, PSNAP_STRIDE, 0, 0];
}

/**
 * The combined actor snapshot the host publishes: the untouched vehicle
 * layout with the ped section appended. Fresh array every call — the
 * Synchronizable identity rule holds.
 */
export function packActorSnapshot(version: number, vehicles: VehicleSim, peds: PedSim): number[] {
  const veh = packVehicleSnapshot(version, vehicles);
  const ped = packPedSection(peds);
  return [...veh, ...ped];
}

/** The combined empty snapshot — valid vehicle header + empty ped section. */
export function emptyActorSnapshot(): number[] {
  const out = new Array<number>(VSNAP_HEADER + PSNAP_HEADER).fill(0);
  out[VSNAP.stride] = VSNAP_STRIDE;
  out[VSNAP_HEADER + PSNAP.stride] = PSNAP_STRIDE;
  return out;
}

/** Absolute offset of the ped section header inside a combined snapshot. */
export function pedSectionOffset(snapshot: readonly number[] | null | undefined): number {
  if (!snapshot || snapshot.length < VSNAP_HEADER) return VSNAP_HEADER;
  return VSNAP_HEADER + (snapshot[VSNAP.count] ?? 0) * (snapshot[VSNAP.stride] ?? VSNAP_STRIDE);
}

export function pedSnapshotCount(snapshot: readonly number[] | null | undefined): number {
  if (!snapshot) return 0;
  const off = pedSectionOffset(snapshot);
  return snapshot.length > off ? (snapshot[off + PSNAP.count] ?? 0) : 0;
}

/**
 * One pedestrian record's interpolated pose — same one-tick-behind lerp the
 * vehicle channel uses, reading from the ped section of a combined snapshot.
 */
export function interpolatePedPose(
  snapshot: readonly number[],
  index: number,
  alpha: number,
  out: { x: number; z: number; yaw: number },
): { x: number; z: number; yaw: number } {
  const o = pedSectionOffset(snapshot) + PSNAP_HEADER + index * PSNAP_STRIDE;
  const a = Math.max(0, Math.min(1, alpha));
  out.x = (snapshot[o + 2] ?? 0) + ((snapshot[o + 5] ?? 0) - (snapshot[o + 2] ?? 0)) * a;
  out.z = (snapshot[o + 3] ?? 0) + ((snapshot[o + 6] ?? 0) - (snapshot[o + 3] ?? 0)) * a;
  const dy = normAngle((snapshot[o + 7] ?? 0) - (snapshot[o + 4] ?? 0));
  out.yaw = (snapshot[o + 4] ?? 0) + dy * a;
  return out;
}
