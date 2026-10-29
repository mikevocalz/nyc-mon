// Living City PR05 — the moving-vehicle simulation. Pure TS: no three.js,
// no React, no timers — `step(dt)` advances one fixed tick and every
// decision is a pure function of sim state plus a seeded RNG, so two runs
// with the same seed produce byte-identical snapshots (tested).
//
// Algorithms adapted (cited, not copied) from Fable Cities' TrafficSim.js
// (MIT, github.com/rawprogress/fable-cities, commit aea8b10 —
// docs/living-city/scout-B-references.md):
//
//  - IDM car-following: free acceleration toward the lane speed limit with
//    gap-keeping to the leader and to virtual stop obstacles (stop lines,
//    yield lines). Treiber IDM form a = A(1-(v/v0)^δ-(s*/s)²),
//    s* = s0 + v·T + v·Δv/2√(A·b).
//  - Junction entry arbitration through PR03's claims (FCFS + NYC movement
//    priority) — the sim requests, the solver answers granted/queued/
//    must-yield.
//  - Blocked-exit anti-gridlock: never enter a junction whose exit lane
//    cannot take the vehicle (Fable's "don't enter what you can't clear").
//  - Amber dilemma: on Y, stop when v²/2·4.2 + 1 m fits before the stop
//    line, clear through when it does not — no hard teleports.
//
// NYC rules (spec §7): vehicles stop ahead of the crosswalk (the stop line
// is placed behind the point where the approach lane crosses the leg's
// xwalk polyline), right-on-red never happens (PR03 gates it off citywide),
// and a held pedestrian claim on a conflicting crosswalk blocks entry —
// `pedClaimAt` is the query PR06's pedestrian entities plug into.
//
// A vehicle's world is path elements: `lane:` edges (PR02) and `conn:`
// junction connectors (PR03's synthesized bezier centrelines). Position on
// an element is the arc position s of the FRONT bumper; the renderer reads
// the packed snapshot, never the sim objects (sim identity is independent
// of presentation meshes, spec §5).

import type { FlatPoints } from '../city-dataset.ts';
import { buildConflictMatrix, normAngle, type ConflictMatrix, type GrantResult } from './conflict-solver.ts';
import type { SignalState, SignalSystem } from './signal-controller.ts';
import type { LaneConnector, LaneEdge, LaneTopology, TopologyNode } from './topology.ts';

// --- Tunables ------------------------------------------------------------------

/** Fixed sim tick — 24 Hz, inside the spec's 20–30 Hz band. The host accumulator enforces it. */
export const SIM_DT = 1 / 24;
const MPH_TO_MPS = 0.44704;

/** Treiber IDM parameters — the set Fable's TrafficSim uses (A_MAX, B_COMF, S0, T_HEAD, DEC_MAX). */
export const IDM = { aMax: 2.85, bComf: 3.3, s0: 2.05, tHead: 1.05, decMax: -7.6, delta: 4 } as const;

/** A junction claim is registered once the stop line is this close (covers 16 m median lanes). */
const CLAIM_RANGE_METRES = 18;
/** Stop line sits this far behind the crosswalk crossing point (and behind the lane end). */
const STOP_SETBACK_METRES = 1.6;
/** Free space the exit lane must offer beyond the vehicle's own length before it may enter the box. */
const EXIT_MARGIN_METRES = 1.0;
/** Amber dilemma deceleration (Fable's rule): stopping need = v²/2·4.2 + 1 m. */
const AMBER_DECEL_MPS2 = 4.2;
const AMBER_MARGIN_METRES = 1.0;
/** Speed through a connector by turn class, m/s. */
const TURN_SPEED: Record<LaneConnector['turn'], number> = { through: 8, left: 6, right: 5, uturn: 3 };
/** Hard hold just short of a lane end when the claim never came (safety clamp; IDM stops earlier). */
const LANE_END_GUARD_METRES = 0.1;
/** Spawner cadence and geometry. */
const SPAWN_PERIOD_SECONDS = 0.4;
const SPAWN_HEAD_CLEARANCE = 2.0;
/** A bus spawns on a route lane starting within this band past the anti-pop radius (where one exists). */
const BUS_SPAWN_BAND_METRES = 120;
const DEFAULT_SPAWN_MIN_FOCUS_METRES = 130;
const DEFAULT_DESPAWN_FOCUS_METRES = 500;
/** Vehicles are dropped once they are this far from focus — far past any readable view. */
/** The Caller's collision footprint — vehicles hold its near edge like a stop line. */
const CALLER_RADIUS_METRES = 1.2;

// --- Vehicle classes -----------------------------------------------------------

export type VehicleKind = 'sedan' | 'taxi' | 'van' | 'bus';
export const VEHICLE_KINDS: readonly VehicleKind[] = ['sedan', 'taxi', 'van', 'bus'];
/** Bumper-to-bumper length per class, metres (parked-car spec uses 4.6 m for sedans). */
export const VEHICLE_LENGTH: Record<VehicleKind, number> = { sedan: 4.6, taxi: 4.6, van: 5.0, bus: 12.0 };
/** Width per class, metres — the caller corridor sweeps half of this around the path centreline. */
export const VEHICLE_WIDTH: Record<VehicleKind, number> = { sedan: 1.8, taxi: 1.8, van: 1.9, bus: 2.55 };
/** The semantic id the renderer resolves for each class — sim never names a mesh. */
export const VEHICLE_SEMANTIC_ID: Record<VehicleKind, string> = {
  sedan: 'vehicle.sedan',
  taxi: 'vehicle.sedan',
  van: 'vehicle.van',
  bus: 'vehicle.bus',
};
/** Spawn mix for the auto-population (NYC-ish: mostly sedans, some taxis and vans, few buses). */
const SPAWN_MIX: readonly [VehicleKind, number][] = [
  ['sedan', 0.55],
  ['taxi', 0.2],
  ['van', 0.15],
  ['bus', 0.1],
];
/** The same mix without buses, for a sim whose buses come from `busTarget` on the bus routes instead. */
const CAR_MIX: readonly [VehicleKind, number][] = SPAWN_MIX.filter(([kind]) => kind !== 'bus').map(([kind, w]) => [kind, w / 0.9]);

// --- Snapshot layout (the flat channel the renderer reads) ---------------------

/**
 * The packed vehicle snapshot: an 8-number header then `count` records of
 * `VSNAP_STRIDE` numbers. Written fresh every sim tick — the Worklets rule
 * (render-snapshot.ts): never reuse an array handed to a Synchronizable.
 *
 * Header: [version, tick, tickDt, count, stride, simTime, spawnTotal, despawnTotal]
 * Record: [id, kind, prevX, prevZ, prevYaw, x, z, yaw, speed, flags, age, reserved]
 */
export const VSNAP_HEADER = 8;
export const VSNAP_STRIDE = 12;
export const VSNAP = { version: 0, tick: 1, tickDt: 2, count: 3, stride: 4, simTime: 5, spawnTotal: 6, despawnTotal: 7 } as const;

/** Per-record flags — the renderer and the dev inspector read these; sim behaviour is not encoded here. */
export const VFLAG = {
  braking: 1,
  stoppedForSignal: 2,
  blinkLeft: 4,
  blinkRight: 8,
  inJunction: 16,
  yielding: 32,
  blockedExit: 64,
  /** PR07: headlights required by the world clock (dusk/night/rain) — set from the env the host injects. */
  headlights: 128,
} as const;

/**
 * The world-clock environment the sim reads once per tick (PR07). The
 * host writes it from the authoritative CityClock before `step(dt)`;
 * pure data in, flag bits out — behaviour is untouched.
 */
export interface SimEnvironment {
  /** Vehicles show headlights/taillights (dusk, night or rain). */
  readonly headlights: boolean;
  /** Rain intensity 0–1 — reserved for surface/speed effects in a later PR. */
  readonly rain: number;
}

const DEFAULT_SIM_ENVIRONMENT: SimEnvironment = { headlights: false, rain: 0 };

// --- Public types ----------------------------------------------------------------

export type WaitReason = 'signal' | 'yield' | 'ped' | 'blocked' | 'queue' | 'caller' | null;

export interface SpawnSpec {
  readonly kind?: VehicleKind;
  /** Lane the vehicle starts on (front-bumper s). */
  readonly lane: string;
  readonly s?: number;
  readonly speed?: number;
  /** Fixed route: lane ids to traverse in order, followed by free auto-extension. */
  readonly route?: readonly string[];
  /** Vehicle holds position until this sim-time (a stalled queue / double-parked stand-in for tests). */
  readonly holdUntil?: number;
  /**
   * PR09: marks an auto-populated fleet member (the spawner sets it).
   * Tier step-downs may retire ambient vehicles; scripted scenario spawns
   * never carry the flag and are never culled.
   */
  readonly ambient?: boolean;
}

export interface VehicleSimOptions {
  /** Deterministic seed (mulberry32). Default 1. */
  readonly seed?: number;
  /** Vehicles to place at tick 0 — the scripted half of the fleet (scenario A lives here). */
  readonly vehicles?: readonly SpawnSpec[];
  /** Auto-population target. Default 0 (scripted fleets only). */
  readonly targetVehicles?: number;
  /** Explicit spawn-lane candidates; default: every lane whose `from` node is boundary, plus interior lanes ≥ minFocusDistance from focus. */
  readonly spawnLanes?: readonly string[];
  /** Auto-spawn keeps this far from focus (anti-pop). Default 130 m. */
  readonly spawnMinDistance?: number;
  /** Vehicles beyond this from focus despawn. Default 500 m. */
  readonly despawnDistance?: number;
  /**
   * Buses to keep running on the bus-route lanes (LaneEdge.busRoute), inside `targetVehicles`. Set, it replaces the
   * random 10 % bus share: buses spawn only on a route lane and turn onto route lanes where the junction allows.
   * Unset keeps the old mix (scripted scenarios and their tests).
   */
  readonly busTarget?: number;
}

/** What the snapshot writer and the tests see: one row per live vehicle. */
export interface VehicleView {
  readonly id: number;
  readonly kind: VehicleKind;
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
  readonly waitReason: WaitReason;
}

export interface VehicleSimMetrics {
  tick: number;
  simTime: number;
  vehicles: number;
  spawnTotal: number;
  despawnTotal: number;
  peakVehicles: number;
}

// --- Seeded RNG (mulberry32 — deterministic across runs/platforms) --------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Path geometry (lane centrelines + connector beziers, arc-length indexed) ----

/** An arc-length indexed polyline — lane centrelines, connector beziers and (PR06) walk bands/crossing paths share the maths. */
export interface PathGeom {
  readonly points: FlatPoints;
  /** Cumulative arc length per vertex (same index space as points/2). */
  readonly cum: Float64Array;
  readonly length: number;
}

export function cumulative(points: FlatPoints): { cum: Float64Array; length: number } {
  const n = points.length / 2;
  const cum = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    cum[i] = cum[i - 1]! + Math.hypot(points[i * 2]! - points[i * 2 - 2]!, points[i * 2 + 1]! - points[i * 2 - 1]!);
  }
  return { cum, length: cum[n - 1] ?? 0 };
}

/** Position + travel heading (three.js rotation.y convention: facing = (sin yaw, cos yaw) on x/z) at arc s. */
export function poseAlong(geom: PathGeom, s: number, out: { x: number; z: number; yaw: number }): void {
  const { points, cum, length } = geom;
  const n = cum.length;
  if (n === 0) {
    out.x = 0;
    out.z = 0;
    out.yaw = 0;
    return;
  }
  const t = Math.max(0, Math.min(length, s));
  // Linear scan is fine: lane centrelines carry a handful of vertices.
  let i = 1;
  while (i < n - 1 && cum[i]! < t) i++;
  const s0 = cum[i - 1]!;
  const s1 = cum[i]!;
  const f = s1 > s0 ? (t - s0) / (s1 - s0) : 0;
  const ax = points[i * 2 - 2]!;
  const az = points[i * 2 - 1]!;
  const bx = points[i * 2]!;
  const bz = points[i * 2 + 1]!;
  out.x = ax + (bx - ax) * f;
  out.z = az + (bz - az) * f;
  const dx = bx - ax;
  const dz = bz - az;
  out.yaw = dx === 0 && dz === 0 ? out.yaw : Math.atan2(dx, dz);
}

/** Arc s where polyline `a` first crosses polyline `b`, or -1. Used to place stop lines behind crosswalks. */
export function polylineCrossS(a: FlatPoints, b: FlatPoints): number {
  let s = 0;
  for (let i = 2; i < a.length; i += 2) {
    const ax = a[i - 2]!;
    const az = a[i - 1]!;
    const bx = a[i]!;
    const bz = a[i + 1]!;
    const segLen = Math.hypot(bx - ax, bz - az);
    for (let j = 2; j < b.length; j += 2) {
      const cx = b[j - 2]!;
      const cz = b[j - 1]!;
      const dx = b[j]!;
      const dz = b[j + 1]!;
      const den = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
      if (den === 0) continue;
      const u = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / den;
      const w = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / den;
      if (u >= 0 && u <= 1 && w >= 0 && w <= 1) return s + u * segLen;
    }
    s += segLen;
  }
  return -1;
}

/** Arc s and lateral distance of the polyline point nearest (x, z) — the caller-projection query. */
function nearestAlong(geom: PathGeom, x: number, z: number, out: { s: number; d: number }): void {
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
  out.s = bestS;
  out.d = Math.sqrt(best);
}

// --- The sim ---------------------------------------------------------------------

interface Vehicle {
  id: number;
  entity: string;
  kind: VehicleKind;
  len: number;
  /** Current path element: a `lane:` id or a `conn:` id. */
  element: string;
  elementKind: 'lane' | 'conn';
  /** Front-bumper arc position on the element. */
  s: number;
  v: number;
  /** Upcoming lane ids; route[0] is the lane the next connector exits onto. */
  route: string[];
  /** The connector being approached/traversed (cache of the route[0] resolution). */
  conn: LaneConnector | null;
  /** Connector id currently held/pending as a solver claim (empty when none). */
  claimed: string;
  /** The s on the current lane where the vehicle must stop for the junction ahead. */
  holdS: number;
  waitReason: WaitReason;
  /** Sim-time the vehicle stands still regardless (double-park/queue stand-in). */
  holdUntil: number;
  accel: number;
  braking: boolean;
  blink: -1 | 0 | 1;
  x: number;
  z: number;
  yaw: number;
  prevX: number;
  prevZ: number;
  prevYaw: number;
  age: number;
  /** Route exhausted at the element end: despawn when the element finishes. */
  leaving: boolean;
  /** PR09: auto-spawned fleet member — the tier caps may retire it early. */
  ambient: boolean;
  /**
   * PR09: tier step-down marked this ambient vehicle for removal — it is
   * culled by the spawner pass once it sits beyond the anti-pop distance,
   * so the crowd thins off-camera rather than popping on screen and never
   * runs a signal it should have read.
   */
  retiring: boolean;
  /** Last computed VFLAG bits for the snapshot. */
  flagsCache: number;
}

const SCRATCH_POSE = { x: 0, z: 0, yaw: 0 };
const SCRATCH_HIT = { s: 0, d: 0 };

/**
 * The vehicle fleet over one lane topology + signal system. Step it with a
 * fixed dt (the host's accumulator); everything else — routing, claiming,
 * braking — falls out of the rules above.
 */
export class VehicleSim {
  readonly topology: LaneTopology;
  readonly signals: SignalSystem;
  readonly metrics: VehicleSimMetrics = { tick: 0, simTime: 0, vehicles: 0, spawnTotal: 0, despawnTotal: 0, peakVehicles: 0 };

  private readonly rng: () => number;
  private readonly vehicles: Vehicle[] = [];
  private nextVehicleId = 1;
  private spawnAcc = 0;
  /** PR09: mutable — the tier system retargets the ambient population live. */
  private targetVehicles: number;
  private readonly spawnMinDistance: number;
  private readonly despawnDistance: number;
  private focusX = Number.NaN;
  private focusZ = Number.NaN;
  /** Live Caller position — NaN while unspawned/absent (channel closed, zero behaviour change). */
  private callerX = Number.NaN;
  private callerZ = Number.NaN;
  private env: SimEnvironment = DEFAULT_SIM_ENVIRONMENT;

  // --- Static lookups built once ----------------------------------------------
  private readonly connsFrom = new Map<string, LaneConnector[]>();
  private readonly connById = new Map<string, LaneConnector>();
  private readonly controlled = new Set<string>();
  private readonly laneGeoms = new Map<string, PathGeom>();
  private readonly connGeoms = new Map<string, PathGeom>();
  private readonly matrices = new Map<string, ConflictMatrix>();
  private readonly stopLines = new Map<string, number>();
  private readonly spawnCandidates: readonly LaneEdge[];
  private readonly busSpawnCandidates: readonly LaneEdge[];
  private readonly busTarget: number | null;
  // --- Per-tick caches ----------------------------------------------------------
  private readonly occupancy = new Map<string, Vehicle[]>();
  private readonly aspectCache = new Map<string, SignalState>();

  constructor(topology: LaneTopology, signals: SignalSystem, options: VehicleSimOptions = {}) {
    this.topology = topology;
    this.signals = signals;
    this.rng = mulberry32(options.seed ?? 1);
    this.targetVehicles = options.targetVehicles ?? 0;
    this.spawnMinDistance = options.spawnMinDistance ?? DEFAULT_SPAWN_MIN_FOCUS_METRES;
    this.despawnDistance = options.despawnDistance ?? DEFAULT_DESPAWN_FOCUS_METRES;
    for (const c of topology.connectors) {
      this.connById.set(c.id, c);
      (this.connsFrom.get(c.in) ?? this.connsFrom.set(c.in, []).get(c.in)!).push(c);
    }
    for (const list of this.connsFrom.values()) list.sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const id of signals.nodes.keys()) this.controlled.add(id);
    this.spawnCandidates =
      options.spawnLanes !== undefined
        ? options.spawnLanes.map((id) => this.lane(id)).filter((l): l is LaneEdge => l !== undefined)
        : topology.lanes.filter((l) => !l.internal && l.lengthMeters >= 30);
    this.busSpawnCandidates = this.spawnCandidates.filter((l) => l.busRoute === true);
    this.busTarget = options.busTarget === undefined ? null : Math.max(0, Math.floor(options.busTarget));
    for (const spec of options.vehicles ?? []) this.spawn(spec);
  }

  // --- Focus (spawn/despawn zone around the camera; sim stays pure) --------------
  setFocus(x: number, z: number): void {
    this.focusX = x;
    this.focusZ = z;
  }

  /**
   * The Caller obstacle channel: the host feeds the Caller's live world
   * position once per frame; a vehicle whose planned path sweeps the
   * Caller's footprint inside its braking lookahead holds behind it like a
   * stop line. `clearCaller()` closes the channel — with no Caller spawned
   * the sim is byte-identical to before.
   */
  setCaller(x: number, z: number): void {
    this.callerX = x;
    this.callerZ = z;
  }

  clearCaller(): void {
    this.callerX = Number.NaN;
    this.callerZ = Number.NaN;
  }

  /**
   * PR07: the world-clock environment for the next ticks. The host calls
   * this before `step(dt)`; it only feeds the VFLAG.headlights bit in the
   * snapshot, never driving behaviour — a day/night flag flip cannot
   * reorder traffic.
   */
  setEnvironment(env: SimEnvironment): void {
    this.env = env;
  }

  /**
   * PR09: retarget the fleet cap live (the actor-tier step-down). Raising
   * the target just lets the spawner refill; lowering it retires the
   * excess *ambient* vehicles — farthest from focus first — which the
   * spawner pass then despawns once they sit beyond the anti-pop distance
   * (`spawnMinDistance`). Scripted slice spawns are never marked, so a
   * target below the scripted count leaves the scenario untouched.
   */
  setTargetVehicles(target: number): void {
    this.targetVehicles = Math.max(0, Math.floor(target));
    for (const v of this.vehicles) v.retiring = false;
    let excess = this.vehicles.length - this.targetVehicles;
    if (excess <= 0) return;
    const ambient = this.vehicles.filter((v) => v.ambient);
    if (Number.isFinite(this.focusX)) {
      ambient.sort(
        (a, b) =>
          Math.hypot(b.x - this.focusX, b.z - this.focusZ) - Math.hypot(a.x - this.focusX, a.z - this.focusZ),
      );
    }
    for (const v of ambient) {
      if (excess <= 0) break;
      v.retiring = true;
      excess--;
    }
  }

  // --- Element geometry -----------------------------------------------------------

  private lane(id: string): LaneEdge | undefined {
    return this.topology.laneById.get(id);
  }

  private laneGeom(id: string): PathGeom | undefined {
    let g = this.laneGeoms.get(id);
    if (g === undefined) {
      const lane = this.lane(id);
      if (!lane) return undefined;
      const { cum, length } = cumulative(lane.points);
      g = { points: lane.points, cum, length };
      this.laneGeoms.set(id, g);
    }
    return g;
  }

  /** The conflict matrix for a node — the signalized controller's own, or a lazily built one for uncontrolled nodes (paths still needed for motion). */
  private matrixFor(nodeId: string): ConflictMatrix {
    let m = this.matrices.get(nodeId);
    if (m === undefined) {
      const controller = this.signals.controllerFor(nodeId);
      m = controller ? controller.matrix : buildConflictMatrix(this.topology, nodeId);
      this.matrices.set(nodeId, m);
    }
    return m;
  }

  private connGeom(conn: LaneConnector): PathGeom {
    let g = this.connGeoms.get(conn.id);
    if (g === undefined) {
      const points = this.matrixFor(conn.node).connectorPath(conn.id);
      const { cum, length } = cumulative(points as FlatPoints);
      g = { points: points as FlatPoints, cum, length };
      this.connGeoms.set(conn.id, g);
    }
    return g;
  }

  private geomOf(element: string, kind: 'lane' | 'conn'): PathGeom | undefined {
    if (kind === 'lane') return this.laneGeom(element);
    const conn = this.connById.get(element);
    return conn ? this.connGeom(conn) : undefined;
  }

  private poseAt(element: string, kind: 'lane' | 'conn', s: number, out: { x: number; z: number; yaw: number }): void {
    const geom = this.geomOf(element, kind);
    if (geom) poseAlong(geom, s, out);
  }

  /** The s on a lane where the front bumper must stop — behind the crosswalk the approach crosses, else behind the lane end. */
  private stopLineOf(lane: LaneEdge): number {
    let s = this.stopLines.get(lane.id);
    if (s !== undefined) return s;
    const geom = this.laneGeom(lane.id);
    s = geom ? Math.max(0, geom.length - STOP_SETBACK_METRES) : 0;
    if (geom) {
      const node = this.topology.nodeById.get(lane.to);
      if (node) {
        const leg = node.legs.findIndex((l) => l.roadIds.includes(lane.roadId));
        let best = -1;
        for (const x of this.topology.xwalks) {
          if (x.node !== node.id) continue;
          if (leg >= 0 && x.leg >= 0 && x.leg !== leg) continue;
          const cross = polylineCrossS(geom.points, x.points);
          if (cross > best && cross <= geom.length) best = cross;
        }
        if (best > 0) s = Math.max(0, best - STOP_SETBACK_METRES);
      }
    }
    this.stopLines.set(lane.id, s);
    return s;
  }

  // --- Signals --------------------------------------------------------------------

  private signalState(nodeId: string): SignalState | undefined {
    let st = this.aspectCache.get(nodeId);
    if (!st) {
      st = this.signals.state(nodeId);
      if (st) this.aspectCache.set(nodeId, st);
    }
    return st;
  }

  private vehicleAspect(conn: LaneConnector): 'R' | 'Y' | 'G' {
    const st = this.signalState(conn.node);
    return st?.vehicleAspects[conn.id] ?? 'G';
  }

  private request(v: Vehicle, conn: LaneConnector): GrantResult {
    const result = this.signals.requestGrant(v.entity, conn.id);
    if (result === 'granted') v.claimed = conn.id;
    else v.claimed = '';
    return result;
  }

  private releaseClaim(v: Vehicle): void {
    // Unconditional: a queued claim leaves `claimed` empty but still sits in
    // the solver's FIFO — skip the release and it blocks the junction forever.
    this.signals.release(v.entity);
    v.claimed = '';
  }

  // --- PR06 seam --------------------------------------------------------------------

  /**
   * The pedestrians currently claiming a crosswalk leg: entity ids holding
   * or queueing a claim at the junction that owns `xwalkId`. This is the
   * query PR06's pedestrian entities plug into — a ped claims its xwalk via
   * `signals.requestGrant(pedEntity, xwalkId)`, and every connector whose
   * path conflicts sees it here before the vehicle enters the box. With no
   * pedestrian entities in the world this always returns [].
   */
  pedClaimAt(xwalkId: string): readonly string[] {
    const controller = this.signals.controllerForElement(xwalkId);
    if (!controller) return [];
    return [...controller.solver.holdersOf(xwalkId), ...controller.solver.queueOf(xwalkId)];
  }

  /** True while a held pedestrian claim sits on a crosswalk conflicting with this connector. */
  private pedBlocks(conn: LaneConnector): boolean {
    const controller = this.signals.controllerForElement(conn.id);
    if (!controller) return false;
    for (const el of controller.conflictSet(conn.id)) {
      if (controller.matrix.kindOf(el) === 'xwalk' && controller.solver.holdersOf(el).length > 0) return true;
    }
    return false;
  }

  // --- Spawning / despawning --------------------------------------------------------

  /** Place a vehicle. Returns its numeric id, or -1 when the lane/s is invalid or occupied. */
  spawn(spec: SpawnSpec): number {
    const lane = this.lane(spec.lane);
    const geom = lane ? this.laneGeom(lane.id) : undefined;
    if (!lane || !geom) return -1;
    const s = Math.max(0, Math.min(geom.length - 0.5, spec.s ?? 0));
    const kind = spec.kind ?? 'sedan';
    const id = this.nextVehicleId++;
    const v: Vehicle = {
      id,
      entity: `veh:${id}`,
      kind,
      len: VEHICLE_LENGTH[kind],
      element: lane.id,
      elementKind: 'lane',
      s,
      v: Math.max(0, spec.speed ?? Math.min(8, lane.speedMph * MPH_TO_MPS)),
      route: [...(spec.route ?? [])],
      conn: null,
      claimed: '',
      holdS: -1,
      waitReason: null,
      holdUntil: spec.holdUntil ?? -1,
      accel: 0,
      braking: false,
      blink: 0,
      x: 0,
      z: 0,
      yaw: 0,
      prevX: 0,
      prevZ: 0,
      prevYaw: 0,
      age: 0,
      leaving: false,
      ambient: spec.ambient === true,
      retiring: false,
      flagsCache: 0,
    };
    this.poseAt(v.element, 'lane', v.s - v.len / 2, SCRATCH_POSE);
    v.x = SCRATCH_POSE.x;
    v.z = SCRATCH_POSE.z;
    v.yaw = SCRATCH_POSE.yaw;
    v.prevX = v.x;
    v.prevZ = v.z;
    v.prevYaw = v.yaw;
    this.vehicles.push(v);
    this.metrics.spawnTotal++;
    this.metrics.peakVehicles = Math.max(this.metrics.peakVehicles, this.vehicles.length);
    return id;
  }

  /** The lane-start candidates the auto-population may use, filtered for head room and the anti-pop focus distance. */
  private autoSpawnLane(cands: readonly LaneEdge[] = this.spawnCandidates, kind: VehicleKind = 'sedan'): LaneEdge | null {
    if (cands.length === 0) return null;
    // Room for the new vehicle behind the one ahead: a car's 6 m, or the bus's own length (12 m does not fit a car's gap).
    const room = (kind === 'bus' ? VEHICLE_LENGTH.bus + 1.4 : 6) + SPAWN_HEAD_CLEARANCE;
    // One random probe per cadence keeps the cost O(1); dense traffic simply retries.
    const lane = cands[Math.floor(this.rng() * cands.length)]!;
    const fromNode = this.topology.nodeById.get(lane.from);
    const atBoundary = fromNode?.kind === 'boundary';
    if (!atBoundary && Number.isFinite(this.focusX)) {
      const p = lane.points;
      const d = Math.hypot(p[0]! - this.focusX, p[1]! - this.focusZ);
      if (d < this.spawnMinDistance) return null;
    }
    for (const w of this.vehicles) {
      if (w.elementKind === 'lane' && w.element === lane.id && w.s - w.len < room) return null;
      if (w.elementKind === 'conn') {
        const c = this.connById.get(w.element);
        if (c && c.out === lane.id && this.connGeom(c).length - w.s < room) return null;
      }
    }
    return lane;
  }

  private autoSpawnKind(): VehicleKind {
    let r = this.rng();
    for (const [kind, w] of this.busTarget === null ? SPAWN_MIX : CAR_MIX) {
      r -= w;
      if (r <= 0) return kind;
    }
    return 'sedan';
  }

  private despawn(v: Vehicle): void {
    this.releaseClaim(v);
    const i = this.vehicles.indexOf(v);
    if (i >= 0) this.vehicles.splice(i, 1);
    this.metrics.despawnTotal++;
  }

  // --- Routing ----------------------------------------------------------------------

  /**
   * Ensure route[0] exists by choosing a legal exit at the current lane's
   * `to` node. Median u-turn candidates stay excluded except at dead ends —
   * they are PR02's geometric candidates, pruned by PR03 at signals and
   * never taken as free choices. Returns false when nothing legal remains
   * (boundary stub or exhausted route): the vehicle leaves at the lane end.
   */
  private ensureRoute(v: Vehicle): boolean {
    if (v.elementKind !== 'lane') return true;
    if (v.route.length > 0) {
      const conn = (this.connsFrom.get(v.element) ?? []).find((c) => c.out === v.route[0]);
      if (conn) {
        v.conn = conn;
        return true;
      }
      // The scripted route asked for a move that does not exist — drop it rather than assert an illegal turn.
      v.route.shift();
      return this.ensureRoute(v);
    }
    const node = this.topology.nodeById.get(this.lane(v.element)!.to);
    const candidates = (this.connsFrom.get(v.element) ?? []).filter((c) => c.turn !== 'uturn' || node?.kind === 'deadEnd');
    if (candidates.length === 0) {
      v.conn = null;
      v.leaving = true;
      return false;
    }
    // A bus keeps to the bus routes where the junction offers one; off them (a route's end) it takes any legal move.
    const onRoute = v.kind === 'bus' ? candidates.filter((c) => this.lane(c.out)?.busRoute === true) : candidates;
    const pool = onRoute.length > 0 ? onRoute : candidates;
    const conn = pool[Math.floor(this.rng() * pool.length)]!;
    v.route.push(conn.out);
    v.conn = conn;
    return true;
  }

  /** Free space at the out-lane head: how much room a new vehicle would get. */
  private exitFree(conn: LaneConnector): number {
    let free = Infinity;
    for (const w of this.vehicles) {
      if (w.elementKind === 'lane' && w.element === conn.out) {
        free = Math.min(free, w.s - w.len);
      } else if (w.elementKind === 'conn') {
        const c = this.connById.get(w.element);
        if (c && c.out === conn.out) free = Math.min(free, this.connGeom(c).length - w.s);
      }
    }
    return free;
  }

  // --- Per-tick control ---------------------------------------------------------------

  private rebuildOccupancy(): void {
    this.occupancy.clear();
    for (const v of this.vehicles) {
      (this.occupancy.get(v.element) ?? this.occupancy.set(v.element, []).get(v.element)!).push(v);
    }
    for (const list of this.occupancy.values()) list.sort((a, b) => a.s - b.s);
  }

  step(dt: number): void {
    this.signals.step(dt);
    this.aspectCache.clear();
    this.rebuildOccupancy();
    // Deterministic order: id-sorted iteration. Spawns appends keep order stable.
    for (const v of [...this.vehicles].sort((a, b) => a.id - b.id)) {
      this.updateVehicle(v, dt);
    }
    this.metrics.vehicles = this.vehicles.length;
    this.spawner(dt);
    this.metrics.tick++;
    this.metrics.simTime += dt;
  }

  // --- The driver's brain: one vehicle, one tick ---------------------------------------

  private updateVehicle(v: Vehicle, dt: number): void {
    v.prevX = v.x;
    v.prevZ = v.z;
    v.prevYaw = v.yaw;
    v.age += dt;

    const geom = this.geomOf(v.element, v.elementKind);
    if (!geom) {
      this.despawn(v);
      return;
    }
    const remaining = geom.length - v.s;

    // Held parking stand-in (queues/double-parks in tests and scripted scenes).
    if (this.metrics.simTime < v.holdUntil) {
      v.v = 0;
      v.accel = 0;
      v.braking = true;
      v.waitReason = 'queue';
      v.flagsCache = VFLAG.braking | (this.env.headlights ? VFLAG.headlights : 0);
      return;
    }

    let v0: number;
    let stopS = Infinity;
    let want = 0; // flags for the snapshot
    v.waitReason = null;
    v.blink = 0;

    if (v.elementKind === 'lane') {
      const lane = this.lane(v.element)!;
      v0 = lane.speedMph * MPH_TO_MPS;
      const lookahead = Math.max(24, v.v * 2.2 + (v.v * v.v) / (2 * IDM.bComf) + 10);
      if (remaining <= lookahead + CLAIM_RANGE_METRES) this.ensureRoute(v);
      const conn = v.conn;
      // Heartbeat a held claim once per tick: the solver expires grants that
      // stop re-requesting, so a committed vehicle held at the line (ped
      // yield, blocked exit, leader jam) must keep its claim alive — otherwise
      // it eventually proceeds on a claim that no longer exists.
      if (conn && v.claimed === conn.id) this.request(v, conn);
      if (conn && remaining <= lookahead) {
        const aspect = this.vehicleAspect(conn);
        const stop = this.stopLineOf(lane);
        const held = v.claimed === conn.id;
        if (aspect === 'R' && !held) {
          // Register the ticket (FIFO fairness) but hold at the line.
          if (remaining <= CLAIM_RANGE_METRES) this.request(v, conn);
          stopS = Math.min(stopS, stop);
          v.waitReason = 'signal';
          want |= VFLAG.stoppedForSignal;
        } else if (aspect === 'Y' && !held) {
          const need = (v.v * v.v) / (2 * AMBER_DECEL_MPS2) + AMBER_MARGIN_METRES;
          if (stop - v.s > need) {
            stopS = Math.min(stopS, stop);
            v.waitReason = 'signal';
            want |= VFLAG.stoppedForSignal;
          } else if (remaining <= CLAIM_RANGE_METRES) {
            // Too close to stop safely: claim and clear through.
            const res = this.request(v, conn);
            if (res !== 'granted') {
              stopS = Math.min(stopS, stop);
              v.waitReason = res === 'must-yield' ? 'yield' : 'signal';
            }
          }
        } else {
          // Green (or uncontrolled node): ped yield → blocked exit → claim.
          if (this.pedBlocks(conn)) {
            stopS = Math.min(stopS, stop);
            v.waitReason = 'ped';
            want |= VFLAG.yielding;
          } else if (this.exitFree(conn) < v.len + EXIT_MARGIN_METRES) {
            // Anti-gridlock: never enter a box the exit cannot clear.
            stopS = Math.min(stopS, stop);
            v.waitReason = 'blocked';
            want |= VFLAG.blockedExit;
          } else if (held) {
            // committed — proceed
          } else if (remaining <= CLAIM_RANGE_METRES) {
            const res = this.request(v, conn);
            if (res !== 'granted') {
              stopS = Math.min(stopS, stop);
              v.waitReason = res === 'must-yield' ? 'yield' : 'signal';
              if (res === 'must-yield') want |= VFLAG.yielding;
            }
          }
        }
        if (conn.turn === 'left' || conn.turn === 'uturn') v.blink = -1;
        else if (conn.turn === 'right') v.blink = 1;
      } else if (!conn && v.leaving && remaining <= lookahead) {
        // Route exhausted at a tile edge: drive off the map, no brake.
      }
    } else {
      // On a connector: committed through the box at turn speed.
      const conn = this.connById.get(v.element)!;
      v0 = TURN_SPEED[conn.turn] ?? TURN_SPEED.through;
      want |= VFLAG.inJunction;
      if (conn.turn === 'left' || conn.turn === 'uturn') v.blink = -1;
      else if (conn.turn === 'right') v.blink = 1;
    }

    // ---- Leader obstacle (car-following along the planned path) ----------------
    const lookahead = Math.max(24, v.v * 2.2 + (v.v * v.v) / (2 * IDM.bComf) + 10);
    const leader = this.leader(v, lookahead);
    const caller = this.callerGap(v, lookahead);
    let accel = this.idm(v.v, v0, Infinity, 0);
    if (leader) accel = Math.min(accel, this.idm(v.v, v0, leader.gap, leader.v));
    if (stopS < Infinity) accel = Math.min(accel, this.idm(v.v, v0, stopS - v.s, 0));
    if (caller < Infinity) {
      accel = Math.min(accel, this.idm(v.v, v0, caller, 0));
      if (caller <= Math.min(stopS - v.s, leader?.gap ?? Infinity)) {
        // The Caller — not a signal, ped claim or queue — is the binding hold.
        v.waitReason = 'caller';
        want |= VFLAG.yielding;
      }
    }
    accel = Math.max(IDM.decMax, accel);

    // ---- Integrate -------------------------------------------------------------
    v.accel = accel;
    v.braking = accel < -0.6 || (v.v === 0 && v.waitReason !== null);
    v.v = Math.max(0, v.v + accel * dt);
    let advance = v.v * dt;
    let guard = geom.length - LANE_END_GUARD_METRES;

    // Never cross an element boundary without the right to: stop short and hold.
    if (v.elementKind === 'lane' && v.conn && v.claimed !== v.conn.id && v.s + advance > guard) {
      v.s = guard;
      v.v = 0;
      advance = 0;
    }

    // ---- Element transitions ---------------------------------------------------
    let hops = 0;
    while (advance > 0 && hops++ < 8) {
      const room = (this.geomOf(v.element, v.elementKind)?.length ?? 0) - v.s;
      if (advance <= room) {
        v.s += advance;
        advance = 0;
        break;
      }
      v.s += room;
      advance -= room;
      if (v.elementKind === 'lane') {
        // Enter the junction connector — only reachable with a held claim.
        const conn = v.conn;
        if (!conn) {
          this.despawn(v);
          return;
        }
        v.element = conn.id;
        v.elementKind = 'conn';
        v.s = 0;
      } else {
        // Out of the box onto the route's next lane; release the claim.
        const conn = this.connById.get(v.element)!;
        this.releaseClaim(v);
        const out = v.route.shift();
        v.element = out ?? conn.out;
        v.elementKind = 'lane';
        v.s = 0;
        v.conn = null;
        // The new lane may already need its own connector resolved next tick.
      }
    }

    // ---- Pose ------------------------------------------------------------------
    this.poseAt(v.element, v.elementKind, v.s - v.len / 2, SCRATCH_POSE);
    v.x = SCRATCH_POSE.x;
    v.z = SCRATCH_POSE.z;
    v.yaw = SCRATCH_POSE.yaw;
    v.holdS = Math.min(stopS, caller === Infinity ? Infinity : v.s + Math.max(0, caller));
    v.holdS = v.holdS === Infinity ? -1 : v.holdS;

    // Flags for the snapshot.
    let flags = want;
    if (v.braking) flags |= VFLAG.braking;
    if (v.blink < 0) flags |= VFLAG.blinkLeft;
    else if (v.blink > 0) flags |= VFLAG.blinkRight;
    if (this.env.headlights) flags |= VFLAG.headlights;
    v.flagsCache = flags;
  }

  /**
   * The leader on the same element, or projected onto the planned path
   * ahead (the pending connector, then route lanes in order). Returns the
   * front-bumper gap and the leader's speed.
   */
  private leader(v: Vehicle, lookahead: number): { gap: number; v: number } | null {
    const same = this.occupancy.get(v.element) ?? [];
    for (const w of same) {
      if (w !== v && w.s > v.s + 1e-6) return { gap: w.s - w.len - v.s, v: w.v };
    }
    let travelled = (this.geomOf(v.element, v.elementKind)?.length ?? 0) - v.s;
    // The lookahead chain: (pending connector) → route[0] → its connector → route[1]…
    let routeIdx = 0;
    let pendingConn: LaneConnector | null = v.elementKind === 'lane' ? v.conn : null;
    for (let hop = 0; hop < 4 && travelled < lookahead; hop++) {
      let geom: PathGeom | undefined;
      let id: string;
      if (pendingConn) {
        id = pendingConn.id;
        geom = this.connGeom(pendingConn);
        pendingConn = null;
      } else {
        const laneId = v.route[routeIdx];
        if (laneId === undefined) break;
        id = laneId;
        geom = this.laneGeom(laneId);
        routeIdx++;
        pendingConn = (this.connsFrom.get(laneId) ?? []).find((c) => c.out === v.route[routeIdx]) ?? null;
      }
      if (!geom) break;
      const first = (this.occupancy.get(id) ?? [])[0];
      if (first) return { gap: travelled + first.s - first.len, v: first.v };
      travelled += geom.length;
    }
    return null;
  }

  /**
   * The gap from the front bumper to the Caller's near edge measured along
   * the planned path — the same chain `leader()` walks (current element →
   * pending connector → route lanes, 4 hops). The Caller only counts while
   * its footprint sits inside the swept corridor (radius + half the
   * vehicle's width off the path centreline), so a Caller on the sidewalk
   * never brakes traffic; a Caller fully behind the front bumper is
   * ignored so nothing brakes retroactively. Infinity = no constraint.
   */
  private callerGap(v: Vehicle, lookahead: number): number {
    if (!Number.isFinite(this.callerX)) return Infinity;
    const corridor = CALLER_RADIUS_METRES + VEHICLE_WIDTH[v.kind] / 2;
    let best = Infinity;
    const current = this.geomOf(v.element, v.elementKind);
    if (current) {
      nearestAlong(current, this.callerX, this.callerZ, SCRATCH_HIT);
      if (SCRATCH_HIT.d <= corridor && SCRATCH_HIT.s + CALLER_RADIUS_METRES >= v.s) {
        const gap = SCRATCH_HIT.s - CALLER_RADIUS_METRES - v.s;
        if (gap < lookahead) best = gap;
      }
    }
    let travelled = (current?.length ?? 0) - v.s;
    let routeIdx = 0;
    let pendingConn: LaneConnector | null = v.elementKind === 'lane' ? v.conn : null;
    for (let hop = 0; hop < 4 && travelled < lookahead; hop++) {
      let geom: PathGeom | undefined;
      if (pendingConn) {
        geom = this.connGeom(pendingConn);
        pendingConn = null;
      } else {
        const laneId = v.route[routeIdx];
        if (laneId === undefined) break;
        geom = this.laneGeom(laneId);
        routeIdx++;
        pendingConn = (this.connsFrom.get(laneId) ?? []).find((c) => c.out === v.route[routeIdx]) ?? null;
      }
      if (!geom) break;
      nearestAlong(geom, this.callerX, this.callerZ, SCRATCH_HIT);
      if (SCRATCH_HIT.d <= corridor) {
        const gap = travelled + SCRATCH_HIT.s - CALLER_RADIUS_METRES;
        if (gap < best && gap < lookahead) best = gap;
      }
      travelled += geom.length;
    }
    return best;
  }

  /** Treiber IDM acceleration toward v0 with an obstacle `gap` metres ahead moving at `vLead`. */
  private idm(v: number, v0: number, gap: number, vLead: number): number {
    const dv = v - vLead;
    const sStar = IDM.s0 + Math.max(0, v * IDM.tHead + (v * dv) / (2 * Math.sqrt(IDM.aMax * IDM.bComf)));
    const free = 1 - Math.pow(v / Math.max(v0, 0.1), IDM.delta);
    const interact = gap > 0 ? (sStar * sStar) / (gap * gap) : Infinity;
    return IDM.aMax * (free - interact);
  }

  private spawner(dt: number): void {
    this.spawnAcc += dt;
    if (this.spawnAcc < SPAWN_PERIOD_SECONDS) return;
    this.spawnAcc = 0;
    // Retire anything that wandered past the retention zone FIRST — the
    // target check below must see the freed slots or the fleet stalls.
    if (Number.isFinite(this.focusX)) {
      for (const v of [...this.vehicles]) {
        const d = Math.hypot(v.x - this.focusX, v.z - this.focusZ);
        // PR09: retiring ambient vehicles are culled past the anti-pop
        // radius — invisible (or nearly so), and sooner than the
        // retention distance so the lower tier actually sheds its cost.
        if (d > this.despawnDistance || (v.retiring && d > this.spawnMinDistance)) this.despawn(v);
      }
    } else {
      // No focus yet: retiring marks still apply — cull them outright,
      // nothing is rendering to pop.
      for (const v of [...this.vehicles]) if (v.retiring) this.despawn(v);
    }
    if (this.vehicles.length >= this.targetVehicles) return;
    if (this.busTarget !== null && this.busTarget > 0) {
      let buses = 0;
      for (const v of this.vehicles) if (v.kind === 'bus' && !v.retiring) buses++;
      if (buses < this.busTarget) {
        // Just past the anti-pop radius, so the bus drives into view instead of wandering the far end of the tile.
        let cands = this.busSpawnCandidates;
        if (Number.isFinite(this.focusX)) {
          const near = cands.filter((l) => Math.hypot(l.points[0]! - this.focusX, l.points[1]! - this.focusZ) < this.spawnMinDistance + BUS_SPAWN_BAND_METRES);
          if (near.length > 0) cands = near;
        }
        const route = this.autoSpawnLane(cands, 'bus');
        if (route) {
          this.spawn({ kind: 'bus', lane: route.id, s: 0, ambient: true });
          return;
        }
      }
    }
    const lane = this.autoSpawnLane();
    if (lane) this.spawn({ kind: this.autoSpawnKind(), lane: lane.id, s: 0, ambient: true });
  }

  // --- Views ------------------------------------------------------------------------

  private readonly viewRow: VehicleView[] = [];

  /** Live vehicles in id order (sim order — deterministic). */
  vehiclesView(): readonly VehicleView[] {
    this.viewRow.length = 0;
    for (const v of this.vehicles) {
      this.viewRow.push({
        id: v.id,
        kind: v.kind,
        element: v.element,
        s: v.s,
        speed: v.v,
        x: v.x,
        z: v.z,
        yaw: v.yaw,
        prevX: v.prevX,
        prevZ: v.prevZ,
        prevYaw: v.prevYaw,
        flags: v.flagsCache,
        age: v.age,
        waitReason: v.waitReason,
      });
    }
    return this.viewRow;
  }

  /** Test/debug access to one vehicle's internals. */
  vehicleView(id: number): VehicleView | undefined {
    return this.vehiclesView().find((v) => v.id === id);
  }
}

// --- Snapshot codec (shared protocol between the sim host and the renderer) ----

/**
 * Pack the fleet into a fresh flat array. Callers writing to a
 * Synchronizable must publish this array directly — it is already fresh, so
 * the worklets identity-cache rule is satisfied (never serialize an array
 * twice).
 */
export function packVehicleSnapshot(version: number, sim: VehicleSim): number[] {
  const rows = sim.vehiclesView();
  const out = new Array<number>(VSNAP_HEADER + rows.length * VSNAP_STRIDE).fill(0);
  out[VSNAP.version] = version;
  out[VSNAP.tick] = sim.metrics.tick;
  out[VSNAP.tickDt] = SIM_DT;
  out[VSNAP.count] = rows.length;
  out[VSNAP.stride] = VSNAP_STRIDE;
  out[VSNAP.simTime] = sim.metrics.simTime;
  out[VSNAP.spawnTotal] = sim.metrics.spawnTotal;
  out[VSNAP.despawnTotal] = sim.metrics.despawnTotal;
  rows.forEach((v, i) => {
    const o = VSNAP_HEADER + i * VSNAP_STRIDE;
    out[o] = v.id;
    out[o + 1] = VEHICLE_KINDS.indexOf(v.kind);
    out[o + 2] = v.prevX;
    out[o + 3] = v.prevZ;
    out[o + 4] = v.prevYaw;
    out[o + 5] = v.x;
    out[o + 6] = v.z;
    out[o + 7] = v.yaw;
    out[o + 8] = v.speed;
    out[o + 9] = v.flags;
    out[o + 10] = v.age;
    out[o + 11] = 0;
  });
  return out;
}

/** An empty snapshot that still carries a valid header (the Synchronizable's initial value). */
export function emptyVehicleSnapshot(): number[] {
  const out = new Array<number>(VSNAP_HEADER).fill(0);
  out[VSNAP.stride] = VSNAP_STRIDE;
  return out;
}

export function vehicleSnapshotCount(snapshot: readonly number[] | null | undefined): number {
  if (!snapshot || snapshot.length < VSNAP_HEADER) return 0;
  return snapshot[VSNAP.count] ?? 0;
}

export function vehicleSnapshotVersion(snapshot: readonly number[] | null | undefined): number {
  return snapshot?.[VSNAP.version] ?? 0;
}

/**
 * One vehicle record's interpolated pose. `alpha` runs 0→1 across the tick
 * after the snapshot arrived (renderer displays one tick in the past);
 * yaws take the shortest arc. Pure — the actor calls it per record per frame.
 */
export function interpolateVehiclePose(
  snapshot: readonly number[],
  index: number,
  alpha: number,
  out: { x: number; z: number; yaw: number },
): { x: number; z: number; yaw: number } {
  const o = VSNAP_HEADER + index * VSNAP_STRIDE;
  const a = Math.max(0, Math.min(1, alpha));
  out.x = (snapshot[o + 2] ?? 0) + ((snapshot[o + 5] ?? 0) - (snapshot[o + 2] ?? 0)) * a;
  out.z = (snapshot[o + 3] ?? 0) + ((snapshot[o + 6] ?? 0) - (snapshot[o + 3] ?? 0)) * a;
  const dy = normAngle((snapshot[o + 7] ?? 0) - (snapshot[o + 4] ?? 0));
  out.yaw = (snapshot[o + 4] ?? 0) + dy * a;
  return out;
}

export { normAngle };
export type { TopologyNode };
