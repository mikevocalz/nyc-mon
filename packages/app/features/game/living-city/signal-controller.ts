// Living City PR03 — the shared traffic-signal controller. One controller per
// signalized junction node runs an explicit phase machine over the PR02 lane
// graph; a `SignalSystem` owns all of them and exposes the API the vehicle and
// pedestrian sims (PR05/PR06) will call. Pure TS — no three.js, no React — and
// timestep-agnostic: signal state is a pure function of an accumulated clock,
// so `step(dt)` at any rate lands on identical aspects.
//
// NYC rules encoded here (scout-D, verified against DMV ch.4 / MUTCD 11th /
// FHWA Signal Timing Manual ch.5):
//
//  - Right-on-red is OFF by default citywide; an affirmative sign record is
//    required. `rightOnRedPermitted` is that record slot: `false` by default,
//    and when a sign ever lands it flips the affected right-turn connectors
//    to an all-way-stop-style claim against crossing traffic and peds. Left
//    on red gets the same treatment (`leftOnRedPermitted`, also off).
//  - WALK ≥ 7 s; pedestrian change interval = leg length / 1.07 m/s
//    (3.5 ft/s). The ped window must fit inside LPI + green + amber +
//    all-red of its parallel vehicular phase — the controller stretches the
//    green until it does, per MUTCD §4I.06.
//  - Yellow and all-red are computed, not constants: amber = perception-
//    reaction + v/2a from the approach speed; all-red = (crossed width +
//    vehicle length)/v — the FHWA change-interval formulas.
//  - LPI is a controller option (`lpiSeconds`): peds get WALK while the
//    parallel vehicular approach still holds red.
//  - `exclusivePedPhase` adds an ALL_PEDESTRIAN_PHASE at the cycle tail and
//    confines ped service to it (Barnes-dance style).
//  - A dark/failed signal drops every approach to the all-way-stop protocol
//    (`setDark`), which the conflict solver's flat-priority FCFS already is.
//
// Phase plan: approach legs pair into axes (opposite azimuths), each axis is
// a phase group. During a group's VEHICLE_GREEN every connector departing its
// legs shows G — throughs, rights and permitted lefts together, the NYC
// concurrent convention; the conflict solver gives throughs priority over
// lefts and makes every movement yield to peds holding a conflicting
// crosswalk. Median u-turn connectors (PR02's divided-avenue candidates) are
// pruned — held at R/prohibited unless `permitUTurns` is set.
//
// Honesty: signalization is SIMULATED. No signal heads or phase plans exist
// in the source data (scout-D part 2); `simulated: true` rides on every state
// so no consumer can silently pass timings off as surveyed NYC facts.

import {
  CLAIM_PRIORITY,
  ConflictSolver,
  buildConflictMatrix,
  connectorPriority,
  normAngle,
  type ConflictMatrix,
  type GateContext,
  type GrantResult,
} from './conflict-solver.ts';
import type { ApproachLeg, LaneTopology, TopologyNode } from './topology.ts';

/** MUTCD pedestrian design speed: 3.5 ft/s ≈ 1.07 m/s. */
export const NYC_PED_SPEED_MPS = 1.07;
/** MUTCD §4I.06 minimum WALK interval. */
export const NYC_MIN_WALK_SECONDS = 7;
/** mph -> m/s. */
const MPH_TO_MPS = 0.44704;
/** Approach legs whose azimuths differ from opposite by at most this still pair into one axis. */
const PAIR_TOLERANCE_RADIANS = (75 * Math.PI) / 180;

export type VehicleAspect = 'R' | 'Y' | 'G';
export type PedAspect = 'W' | 'F' | 'D';

/** Interval kinds — the spec §7 phase names. */
export type PhaseKind =
  | 'VEHICLE_GREEN'
  | 'VEHICLE_YELLOW'
  | 'RED_CLEARANCE'
  | 'LEADING_PEDESTRIAN_INTERVAL'
  | 'ALL_PEDESTRIAN_PHASE'
  | 'DARK'
  | 'UNSIGNALIZED';

export interface SignalOptions {
  /** WALK interval; clamped to the 7 s MUTCD floor. Default 7. */
  walkSeconds?: number;
  /** Leading pedestrian interval — WALK starts this many seconds before the parallel vehicle green. Default 0. */
  lpiSeconds?: number;
  /** Add an ALL_PEDESTRIAN_PHASE at the cycle tail and serve peds only there. Default false. */
  exclusivePedPhase?: boolean;
  /** Minimum vehicle green per phase group. Default 10 s. */
  minGreenSeconds?: number;
  /** Driver perception-reaction time in the amber formula. Default 1.0 s. */
  reactionSeconds?: number;
  /** Comfortable deceleration in the amber formula. Default 3.05 m/s² (~10 ft/s²). */
  decelerationMps2?: number;
  /** Vehicle length in the all-red formula. Default 6.1 m (20 ft). */
  vehicleLengthMeters?: number;
  /** Pedestrian clearance speed. Default 1.07 m/s (3.5 ft/s). */
  pedSpeedMps?: number;
  /**
   * Affirmative "RIGHT TURN ON RED" sign record: `true`, or a list of
   * connector ids the sign covers. NYC default is `false` — no sign data
   * exists for this tile, so this stays off unless a record lands.
   */
  rightOnRedPermitted?: boolean | readonly string[];
  /** Same slot for left-on-red (one-way to one-way); off by default. */
  leftOnRedPermitted?: boolean | readonly string[];
  /** Median u-turn connectors are pruned unless set — PR02 flagged them as candidates, not legal moves. */
  permitUTurns?: boolean;
  /** Held claims auto-release after this many seconds (liveness valve for a claim orphaned mid-box). Default 30. */
  staleClaimSeconds?: number;
  /** Start dark/failed — every approach falls to the all-way-stop protocol. */
  dark?: boolean;
}

/** One signal phase group: the legs sharing a green, plus what it serves. */
export interface PhaseGroupInfo {
  index: number;
  /** Node leg indices in this group (an axis pair, or a singleton stem). */
  legs: readonly number[];
  /** Axis azimuth folded to [-π/2, π/2) — direction-free. */
  axisAzimuth: number;
  /** Connector ids green during this group's VEHICLE_GREEN. */
  connectors: readonly string[];
  /** Crosswalk legs served during this group's ped window (empty under exclusivePedPhase). */
  xwalks: readonly string[];
  /** Fastest recorded/inferred approach speed in the group — feeds the clearance formulas. */
  approachSpeedMps: number;
  /** Width of the street being crossed — feeds the all-red formula. */
  clearanceMeters: number;
  greenSeconds: number;
  amberSeconds: number;
  allRedSeconds: number;
  /** LPI offset applied to this group's ped window (0 when no ped legs are served). */
  lpiSeconds: number;
}

export interface PhaseInterval {
  kind: PhaseKind;
  /** Phase group this interval belongs to (-1 for ALL_PEDESTRIAN_PHASE). */
  group: number;
  start: number;
  duration: number;
}

/** One crosswalk's service window inside the cycle. */
export interface PedWindow {
  xwalk: string;
  /** Cycle offset where WALK begins. */
  start: number;
  /** Cycle offset where WALK ends and flashing DON'T WALK begins. */
  walkEnd: number;
  /** Cycle offset where the change interval ends and solid DON'T WALK begins. */
  flashEnd: number;
  clearanceSeconds: number;
}

/** The fixed cycle the controller repeats — the whole timing plan, exposed for tests and the inspector. */
export interface SignalPlan {
  cycleSeconds: number;
  groups: readonly PhaseGroupInfo[];
  intervals: readonly PhaseInterval[];
  pedWindows: readonly PedWindow[];
  /** Clearance interval per crosswalk (leg length / ped speed). */
  pedClearanceSeconds: Readonly<Record<string, number>>;
}

export interface SignalState {
  /** `signal:` + node id — the id `SignalSystem.state` accepts. */
  signal: string;
  node: string;
  phase: PhaseKind;
  /** Phase group holding green/amber now, else -1 (ped intervals, all-red). */
  group: number;
  phaseElapsed: number;
  phaseDuration: number;
  /** Seconds into the repeating cycle. */
  tCycle: number;
  cycleSeconds: number;
  /** True when the signal has failed and the junction is an all-way stop. */
  dark: boolean;
  vehicleAspects: Readonly<Record<string, VehicleAspect>>;
  pedAspects: Readonly<Record<string, PedAspect>>;
  /** Simulated signalization — never surveyed NYC infrastructure (spec §6). */
  simulated: true;
}

interface ResolvedOptions {
  walkSeconds: number;
  lpiSeconds: number;
  exclusivePedPhase: boolean;
  minGreenSeconds: number;
  reactionSeconds: number;
  decelerationMps2: number;
  vehicleLengthMeters: number;
  pedSpeedMps: number;
  rightOnRed: ReadonlySet<string> | 'all' | 'none';
  leftOnRed: ReadonlySet<string> | 'all' | 'none';
  permitUTurns: boolean;
  staleClaimSeconds: number;
  dark: boolean;
}

function resolveOptions(o: SignalOptions): ResolvedOptions {
  const sign = (v: boolean | readonly string[] | undefined): ReadonlySet<string> | 'all' | 'none' =>
    v === true ? 'all' : v === undefined || v === false ? 'none' : new Set(v);
  return {
    walkSeconds: Math.max(NYC_MIN_WALK_SECONDS, o.walkSeconds ?? NYC_MIN_WALK_SECONDS),
    lpiSeconds: Math.max(0, o.lpiSeconds ?? 0),
    exclusivePedPhase: o.exclusivePedPhase ?? false,
    minGreenSeconds: o.minGreenSeconds ?? 10,
    reactionSeconds: o.reactionSeconds ?? 1.0,
    decelerationMps2: o.decelerationMps2 ?? 3.05,
    vehicleLengthMeters: o.vehicleLengthMeters ?? 6.1,
    pedSpeedMps: o.pedSpeedMps ?? NYC_PED_SPEED_MPS,
    rightOnRed: sign(o.rightOnRedPermitted),
    leftOnRed: sign(o.leftOnRedPermitted),
    permitUTurns: o.permitUTurns ?? false,
    staleClaimSeconds: o.staleClaimSeconds ?? 30,
    dark: o.dark ?? false,
  };
}

// --- Geometry helpers (local, same maths as topology.ts) ------------------------

/** Fold a direction to an axis angle in [-π/2, π/2): a and a+π are the same street. */
function axisAngle(az: number): number {
  let a = normAngle(az);
  if (a > Math.PI / 2) a -= Math.PI;
  else if (a <= -Math.PI / 2) a += Math.PI;
  return a;
}

function lastDir(points: readonly number[]): number {
  const n = points.length;
  return Math.atan2(points[n - 1]! - points[n - 3]!, points[n - 2]! - points[n - 4]!);
}

function polylineDir(points: readonly number[]): number {
  const n = points.length;
  return Math.atan2(points[n - 1]! - points[1]!, points[n - 2]! - points[0]!);
}

/** Pair approach legs into axes: opposite azimuths (within tolerance) join one group; leftovers are singleton stems. */
function pairLegs(legs: readonly ApproachLeg[]): number[][] {
  interface Candidate {
    i: number;
    j: number;
    /** Distance from a perfect 180° split. */
    dev: number;
  }
  const candidates: Candidate[] = [];
  for (let i = 0; i < legs.length; i++) {
    for (let j = i + 1; j < legs.length; j++) {
      const dev = Math.PI - Math.abs(normAngle(legs[i]!.azimuth - legs[j]!.azimuth));
      if (dev <= PAIR_TOLERANCE_RADIANS) candidates.push({ i, j, dev });
    }
  }
  candidates.sort((a, b) => a.dev - b.dev || a.i - b.i || a.j - b.j);
  const used = new Set<number>();
  const groups: number[][] = [];
  for (const c of candidates) {
    if (used.has(c.i) || used.has(c.j)) continue;
    used.add(c.i);
    used.add(c.j);
    groups.push([c.i, c.j]);
  }
  for (let i = 0; i < legs.length; i++) if (!used.has(i)) groups.push([i]);
  return groups;
}

/** Axis angle of a leg group via doubled-angle mean — stable for opposite pairs. */
function groupAxis(legs: readonly ApproachLeg[], group: readonly number[]): number {
  let x = 0;
  let z = 0;
  for (const i of group) {
    x += Math.cos(legs[i]!.azimuth * 2);
    z += Math.sin(legs[i]!.azimuth * 2);
  }
  return axisAngle(Math.atan2(z, x) / 2);
}

/**
 * A signalized junction controller: the phase machine plus the conflict
 * solver for one node. Construct per node via `SignalSystem` or directly in
 * tests.
 */
export class SignalController {
  /** `signal:` + node id. */
  readonly id: string;
  readonly node: string;
  readonly matrix: ConflictMatrix;
  readonly solver: ConflictSolver;
  readonly plan: SignalPlan;
  private readonly options: ResolvedOptions;
  private clock = 0;
  private dark: boolean;
  private readonly ctx: GateContext;
  private readonly connGroup: ReadonlyMap<string, number>;
  private readonly pruned: ReadonlySet<string>;

  constructor(topology: LaneTopology, nodeId: string, options: SignalOptions = {}) {
    const node = topology.nodeById.get(nodeId);
    if (!node) throw new Error(`signal controller: unknown node ${nodeId}`);
    this.node = nodeId;
    this.id = `signal:${nodeId}`;
    this.options = resolveOptions(options);
    this.dark = this.options.dark;
    this.matrix = buildConflictMatrix(topology, nodeId);
    this.solver = new ConflictSolver(this.matrix, { staleClaimSeconds: this.options.staleClaimSeconds });

    // ---- Phase groups -----------------------------------------------------
    const legGroups = pairLegs(node.legs).sort((a, b) => groupAxis(node.legs, a) - groupAxis(node.legs, b));
    const legToGroup = new Map<number, number>();
    legGroups.forEach((g, gi) => g.forEach((leg) => legToGroup.set(leg, gi)));
    const roadToLeg = new Map<string, number>();
    node.legs.forEach((leg, i) => leg.roadIds.forEach((r) => roadToLeg.set(r, i)));

    // Connector -> group: its in-lane's road lands on a leg, which lands in a
    // group. Internal junction-box pieces are in no leg — their group is the
    // axis their travel direction best parallels.
    const connGroup = new Map<string, number>();
    const pruned = new Set<string>();
    for (const conn of this.matrix.connectors) {
      const inLane = topology.laneById.get(conn.in)!;
      const leg = roadToLeg.get(inLane.roadId);
      let gi = leg !== undefined ? legToGroup.get(leg) : undefined;
      if (gi === undefined) {
        const dir = lastDir(inLane.points);
        let best = -1;
        let bestScore = Infinity;
        legGroups.forEach((g, i) => {
          const d = Math.abs(normAngle(dir - groupAxis(node.legs, g)));
          const score = Math.min(d, Math.PI - d);
          if (score < bestScore) {
            bestScore = score;
            best = i;
          }
        });
        gi = best;
      }
      connGroup.set(conn.id, gi);
      if (conn.turn === 'uturn' && !this.options.permitUTurns) pruned.add(conn.id);
    }
    this.connGroup = connGroup;
    this.pruned = pruned;

    // ---- Ped service ------------------------------------------------------
    // A crosswalk spanning leg L is walked parallel to the OTHER axis; serve
    // it during the group it best parallels (excluding L's own). Unbound
    // crosswalks (leg -1) pick the best-parallel group outright.
    const pedClearance: Record<string, number> = {};
    const xwalkGroup = new Map<string, number>();
    for (const x of this.matrix.xwalks) {
      pedClearance[x.id] = x.lengthMeters / this.options.pedSpeedMps;
      if (this.options.exclusivePedPhase) continue;
      const walkAz = x.leg >= 0 ? node.legs[x.leg]!.azimuth + Math.PI / 2 : polylineDir(x.points);
      let best = -1;
      let bestScore = -1;
      legGroups.forEach((g, gi) => {
        if (x.leg >= 0 && g.includes(x.leg)) return;
        const score = Math.abs(Math.cos(normAngle(walkAz - groupAxis(node.legs, g))));
        if (score > bestScore) {
          bestScore = score;
          best = gi;
        }
      });
      if (best >= 0) xwalkGroup.set(x.id, best);
    }

    // ---- Timing ------------------------------------------------------------
    const groups: PhaseGroupInfo[] = legGroups.map((legs, gi) => {
      const connectors = this.matrix.connectors.filter((c) => connGroup.get(c.id) === gi).map((c) => c.id);
      const served = this.matrix.xwalks.filter((x) => xwalkGroup.get(x.id) === gi).map((x) => x.id);
      let v = 1; // m/s floor keeps formulas defined on speedless stub legs
      for (const c of this.matrix.connectors) {
        if (connGroup.get(c.id) === gi) v = Math.max(v, (topology.laneById.get(c.in)?.speedMph ?? 25) * MPH_TO_MPS);
      }
      const crossed = legs.length === node.legs.length ? legs : node.legs.map((_, i) => i).filter((i) => !legs.includes(i));
      const clearanceMeters = Math.max(...crossed.map((i) => node.legs[i]!.widthMeters), 3);
      const amberSeconds = Math.max(3.0, this.options.reactionSeconds + v / (2 * this.options.decelerationMps2));
      const allRedSeconds = Math.max(1.0, (clearanceMeters + this.options.vehicleLengthMeters) / v);
      const lpi = served.length > 0 ? this.options.lpiSeconds : 0;
      const pedNeed = served.length > 0 ? this.options.walkSeconds + Math.max(...served.map((x) => pedClearance[x]!)) : 0;
      // The ped window must close before conflicting movements are released:
      // lpi + green + amber + all-red ≥ WALK + clearance (MUTCD §4I.06).
      const greenSeconds = Math.max(this.options.minGreenSeconds, pedNeed - lpi - amberSeconds - allRedSeconds);
      return {
        index: gi,
        legs,
        axisAzimuth: groupAxis(node.legs, legs),
        connectors,
        xwalks: served,
        approachSpeedMps: v,
        clearanceMeters,
        greenSeconds,
        amberSeconds,
        allRedSeconds,
        lpiSeconds: lpi,
      };
    });

    const intervals: PhaseInterval[] = [];
    const pedWindows: PedWindow[] = [];
    let t = 0;
    for (const g of groups) {
      if (g.lpiSeconds > 0) {
        intervals.push({ kind: 'LEADING_PEDESTRIAN_INTERVAL', group: g.index, start: t, duration: g.lpiSeconds });
        t += g.lpiSeconds;
      }
      const pedStart = t - g.lpiSeconds;
      intervals.push({ kind: 'VEHICLE_GREEN', group: g.index, start: t, duration: g.greenSeconds });
      t += g.greenSeconds;
      intervals.push({ kind: 'VEHICLE_YELLOW', group: g.index, start: t, duration: g.amberSeconds });
      t += g.amberSeconds;
      intervals.push({ kind: 'RED_CLEARANCE', group: g.index, start: t, duration: g.allRedSeconds });
      t += g.allRedSeconds;
      for (const x of g.xwalks) {
        pedWindows.push({ xwalk: x, start: pedStart, walkEnd: pedStart + this.options.walkSeconds, flashEnd: pedStart + this.options.walkSeconds + pedClearance[x]!, clearanceSeconds: pedClearance[x]! });
      }
    }
    if (this.options.exclusivePedPhase && this.matrix.xwalks.length > 0) {
      const duration = this.options.walkSeconds + Math.max(...this.matrix.xwalks.map((x) => pedClearance[x.id]!));
      intervals.push({ kind: 'ALL_PEDESTRIAN_PHASE', group: -1, start: t, duration });
      for (const x of this.matrix.xwalks) {
        pedWindows.push({ xwalk: x.id, start: t, walkEnd: t + this.options.walkSeconds, flashEnd: t + this.options.walkSeconds + pedClearance[x.id]!, clearanceSeconds: pedClearance[x.id]! });
      }
      t += duration;
    }
    this.plan = { cycleSeconds: t, groups, intervals, pedWindows, pedClearanceSeconds: pedClearance };

    this.ctx = {
      gate: (element) => this.gateFor(element),
      priority: (element) => this.priorityFor(element),
    };
  }

  /** Advance the clock and the claim arbiter. Timestep-agnostic: signal state is a pure function of accumulated time. */
  step(dt: number): void {
    this.clock += dt;
    this.solver.step(dt, this.ctx);
  }

  /** Fail/restore the signal. Dark = NYC all-way-stop rule. */
  setDark(dark: boolean): void {
    this.dark = dark;
  }

  isDark(): boolean {
    return this.dark;
  }

  /** Current signal state — aspects are a pure function of the clock. */
  state(): SignalState {
    const cycle = this.plan.cycleSeconds;
    const tCycle = cycle > 0 ? this.clock % cycle : 0;
    const interval = this.plan.intervals.find((iv) => tCycle >= iv.start && tCycle < iv.start + iv.duration);
    const phase: PhaseKind = this.dark ? 'DARK' : (interval?.kind ?? 'RED_CLEARANCE');
    const vehicleAspects: Record<string, VehicleAspect> = {};
    const pedAspects: Record<string, PedAspect> = {};
    for (const conn of this.matrix.connectors) {
      let aspect: VehicleAspect = 'R';
      if (!this.dark && !this.pruned.has(conn.id) && interval && this.connGroup.get(conn.id) === interval.group) {
        if (interval.kind === 'VEHICLE_GREEN') aspect = 'G';
        else if (interval.kind === 'VEHICLE_YELLOW') aspect = 'Y';
      }
      vehicleAspects[conn.id] = aspect;
    }
    for (const x of this.matrix.xwalks) {
      let aspect: PedAspect = 'D';
      if (!this.dark) {
        for (const w of this.plan.pedWindows) {
          if (w.xwalk !== x.id) continue;
          if (tCycle >= w.start && tCycle < w.walkEnd) aspect = 'W';
          else if (tCycle >= w.walkEnd && tCycle < w.flashEnd) aspect = 'F';
        }
      }
      pedAspects[x.id] = aspect;
    }
    return {
      signal: this.id,
      node: this.node,
      phase,
      group: interval && phase !== 'DARK' ? interval.group : -1,
      phaseElapsed: interval ? tCycle - interval.start : 0,
      phaseDuration: interval?.duration ?? 0,
      tCycle,
      cycleSeconds: cycle,
      dark: this.dark,
      vehicleAspects,
      pedAspects,
      simulated: true,
    };
  }

  /**
   * Claim right-of-way over a connector or crosswalk at this junction.
   * 'granted' — proceed; 'queued' — hold (red, or a FIFO line ahead);
   * 'must-yield' — permitted but a conflicting claim outranks you.
   */
  requestGrant(entity: string, element: string): GrantResult {
    if (this.matrix.kindOf(element) === undefined) return 'queued';
    return this.solver.request(entity, element, this.ctx);
  }

  /** The entity finished traversing (or abandoned) its claimed element. */
  release(entity: string): void {
    this.solver.release(entity);
  }

  /** Conflict query for the sim/inspector. */
  conflicts(a: string, b: string): boolean {
    return this.matrix.conflicts(a, b);
  }

  /** Elements conflicting with `element` at this junction. */
  conflictSet(element: string): ReadonlySet<string> {
    return this.matrix.conflictSet(element);
  }

  // ---- Gate + priority, read live by the solver --------------------------------

  private rtorPermitted(connId: string): boolean {
    const conn = this.matrix.connectorOf(connId)!;
    if (conn.turn === 'right') return this.options.rightOnRed === 'all' || (this.options.rightOnRed !== 'none' && this.options.rightOnRed.has(connId));
    if (conn.turn === 'left') return this.options.leftOnRed === 'all' || (this.options.leftOnRed !== 'none' && this.options.leftOnRed.has(connId));
    return false;
  }

  private gateFor(element: string): 'allowed' | 'prohibited' {
    if (this.dark) return 'allowed'; // all-way stop protocol: everything claims FCFS
    if (this.pruned.has(element)) return 'prohibited';
    const kind = this.matrix.kindOf(element);
    if (kind === 'xwalk') {
      return this.pedAspect(element) === 'W' ? 'allowed' : 'prohibited';
    }
    const aspect = this.vehicleAspect(element);
    if (aspect === 'G' || aspect === 'Y') return 'allowed';
    // NYC turn-on-red: off without a sign record; with one it behaves as a
    // virtual all-way-stop claim — lowest priority, yields to everything.
    if (aspect === 'R' && this.rtorPermitted(element)) return 'allowed';
    return 'prohibited';
  }

  private priorityFor(element: string): number {
    if (this.matrix.kindOf(element) === 'xwalk') return CLAIM_PRIORITY.pedestrian;
    if (this.dark) return CLAIM_PRIORITY.through; // flat: pure FCFS at an all-way stop
    const aspect = this.vehicleAspect(element);
    if (aspect === 'R' && this.rtorPermitted(element)) return CLAIM_PRIORITY.turnOnRed;
    const conn = this.matrix.connectorOf(element);
    return conn ? connectorPriority(conn.turn) : CLAIM_PRIORITY.uturn;
  }

  private vehicleAspect(connId: string): VehicleAspect {
    return this.aspects().vehicle.get(connId) ?? 'R';
  }

  private pedAspect(xwalkId: string): PedAspect {
    return this.aspects().ped.get(xwalkId) ?? 'D';
  }

  private aspectCache: { clock: number; dark: boolean; vehicle: Map<string, VehicleAspect>; ped: Map<string, PedAspect> } | null = null;
  private aspects(): { vehicle: Map<string, VehicleAspect>; ped: Map<string, PedAspect> } {
    if (this.aspectCache && this.aspectCache.clock === this.clock && this.aspectCache.dark === this.dark) return this.aspectCache;
    const s = this.state();
    const vehicle = new Map(Object.entries(s.vehicleAspects));
    const ped = new Map(Object.entries(s.pedAspects));
    this.aspectCache = { clock: this.clock, dark: this.dark, vehicle, ped };
    return this.aspectCache;
  }
}

// --- The system facade -----------------------------------------------------------

export interface SignalSystemOptions extends SignalOptions {
  /** Restrict signalization to these node ids. Default: every 'junction' node with ≥3 legs. */
  nodes?: readonly string[];
  /** Override which junction nodes get a controller. */
  signalize?: (node: TopologyNode) => boolean;
}

/** Result map for non-controlled elements. */
const UNCONTROLLED_GRANT: GrantResult = 'granted';

/**
 * Every signal controller over a topology plus the element→node routing the
 * sims need. `state(signalId)` accepts either the `signal:` id or a bare
 * `node:` id; `requestGrant(entity, connOrXwalk)` resolves the owning
 * junction from the element id itself.
 */
export class SignalSystem {
  readonly topology: LaneTopology;
  private readonly controllers = new Map<string, SignalController>();
  private readonly elementNode = new Map<string, string>();
  private readonly connIds: Set<string>;
  private readonly xwalkIds: Set<string>;

  constructor(topology: LaneTopology, options: SignalSystemOptions = {}) {
    this.topology = topology;
    for (const c of topology.connectors) this.elementNode.set(c.id, c.node);
    for (const x of topology.xwalks) this.elementNode.set(x.id, x.node);
    this.connIds = new Set(topology.connectors.map((c) => c.id));
    this.xwalkIds = new Set(topology.xwalks.map((x) => x.id));
    const signalize = options.signalize ?? ((node: TopologyNode) => node.kind === 'junction' && node.legs.length >= 3);
    const wanted = options.nodes ? new Set(options.nodes) : null;
    for (const node of topology.nodes) {
      if (wanted ? !wanted.has(node.id) : !signalize(node)) continue;
      this.controllers.set(node.id, new SignalController(topology, node.id, options));
    }
  }

  /** Every live controller, keyed by node id (iteration order = sorted node id). */
  get nodes(): ReadonlyMap<string, SignalController> {
    return this.controllers;
  }

  /** All `signal:` ids. */
  get signalIds(): readonly string[] {
    return [...this.controllers.keys()].map((n) => `signal:${n}`);
  }

  /** The controller for a `signal:`/`node:` id, or undefined for uncontrolled/unknown nodes. */
  controllerFor(signalId: string): SignalController | undefined {
    return this.controllers.get(signalId.startsWith('signal:') ? signalId.slice('signal:'.length) : signalId);
  }

  /** The controller owning an element id, or undefined when uncontrolled. */
  controllerForElement(element: string): SignalController | undefined {
    const node = this.elementNode.get(element);
    return node === undefined ? undefined : this.controllers.get(node);
  }

  /** Advance every controller + solver. Timestep-agnostic. */
  step(dt: number): void {
    for (const c of this.controllers.values()) c.step(dt);
  }

  /**
   * Signal state for a `signal:`/`node:` id. Uncontrolled nodes report a
   * synthesized UNSIGNALIZED state; unknown ids return undefined.
   */
  state(signalId: string): SignalState | undefined {
    const controller = this.controllerFor(signalId);
    if (controller) return controller.state();
    const nodeId = signalId.startsWith('signal:') ? signalId.slice('signal:'.length) : signalId;
    const node = this.topology.nodeById.get(nodeId);
    if (!node) return undefined;
    const vehicleAspects: Record<string, VehicleAspect> = {};
    const pedAspects: Record<string, PedAspect> = {};
    for (const c of this.topology.connectors) if (c.node === nodeId) vehicleAspects[c.id] = 'G';
    for (const x of this.topology.xwalks) if (x.node === nodeId) pedAspects[x.id] = 'W';
    return {
      signal: `signal:${nodeId}`,
      node: nodeId,
      phase: 'UNSIGNALIZED',
      group: -1,
      phaseElapsed: 0,
      phaseDuration: 0,
      tCycle: 0,
      cycleSeconds: 0,
      dark: false,
      vehicleAspects,
      pedAspects,
      simulated: true,
    };
  }

  /**
   * Claim right-of-way over any `conn:`/`xwalk:` element. Routed to the
   * owning junction; elements at uncontrolled nodes grant unconditionally
   * (mid-block links, tile-edge stubs — priority rules arrive with PR05).
   */
  requestGrant(entity: string, element: string): GrantResult {
    const controller = this.controllerForElement(element);
    if (!controller) return UNCONTROLLED_GRANT;
    return controller.requestGrant(entity, element);
  }

  /** The entity cleared its element — searched across controllers. */
  release(entity: string): void {
    for (const c of this.controllers.values()) c.release(entity);
  }

  /** Are these two elements in conflict at their junction? Undefined when they aren't co-located. */
  conflicts(a: string, b: string): boolean | undefined {
    const node = this.elementNode.get(a);
    if (node === undefined || node !== this.elementNode.get(b)) return undefined;
    return this.controllers.get(node)?.conflicts(a, b) ?? false;
  }

  /** Kind of a claimable element across the whole tile. */
  elementKind(element: string): 'connector' | 'xwalk' | undefined {
    if (this.connIds.has(element)) return 'connector';
    if (this.xwalkIds.has(element)) return 'xwalk';
    return undefined;
  }
}

/** Convenience builder matching PR02's bundled-topology seam: controllers for the whole tile. */
export function buildSignalSystem(topology: LaneTopology, options: SignalSystemOptions = {}): SignalSystem {
  return new SignalSystem(topology, options);
}
