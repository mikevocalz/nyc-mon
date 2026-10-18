// Living City PR03 — the intersection conflict matrix and the claim solver
// that arbitrates who may occupy it. Pure TS, no three.js, no React: the same
// code runs under `node --test` and inside the fixed-step simulation tick.
//
// Two halves:
//
//  1. `buildConflictMatrix` decides which pairs of junction elements —
//     `conn:` lane connectors and `conn:`↔`xwalk:` crosswalk legs — can never
//     be occupied at once. Connector conflict is geometric: each connector is
//     synthesised as a cubic bezier from its in-lane tail to its out-lane head
//     (the approach Fable Cities' LaneNetwork uses, re-authored here) and two
//     connectors conflict when their paths cross or they merge into the same
//     out-lane. Crosswalk conflict is topological: a ped on the crosswalk
//     spanning leg L is exposed to every vehicle exiting onto L's roads.
//
//  2. `ConflictSolver` runs first-come-first-served claim arbitration — the
//     algorithm pattern documented in Fable Cities' TrafficSim (MIT,
//     github.com/rawprogress/fable-cities, commit aea8b10 — algorithm ported,
//     no code copied). Every claim takes a monotonically increasing ticket; a
//     pending claim may be granted only when no held claim conflicts and no
//     permitted pending claim on a conflicting element has a higher movement
//     priority or an equal priority with an earlier ticket. Priority order is
//     the NYC right-of-way order: pedestrians > through > right > left >
//     u-turn > turn-on-red. With a dark signal every vehicle claim shares one
//     priority, which degenerates the rule to the all-way-stop protocol the
//     DMV driver's manual prescribes for a malfunctioning intersection.
//
// Everything is deterministic: tickets are issued in request order, ties
// break on the entity id, collections iterate in id-sorted order, and no wall
// clock or RNG is consulted. Two runs with the same request stream produce
// identical grants.

import type { LaneConnector, LaneEdge, LaneTopology, XwalkLeg } from './topology.ts';

/** Elements a claim can target: lane connectors and crosswalk legs. */
export type ClaimElementKind = 'connector' | 'xwalk';

/**
 * Movement priority — lower number wins a conflict. Order encodes NYC
 * right-of-way: pedestrians first; permitted (unprotected) turns yield to
 * through traffic; turn-on-red yields to everything and requires a stop first.
 */
export const CLAIM_PRIORITY = {
  pedestrian: 0,
  through: 1,
  right: 2,
  left: 3,
  uturn: 4,
  turnOnRed: 5,
} as const;
export type ClaimPriority = (typeof CLAIM_PRIORITY)[keyof typeof CLAIM_PRIORITY];

export type GrantResult =
  /** The element is reserved for this entity; it may proceed. */
  | 'granted'
  /** The entity may not enter yet: the movement is prohibited now, or a FIFO line ahead of it holds the element. */
  | 'queued'
  /** The movement is permitted but a conflicting claim is held or outranks it — proceed only after yielding. */
  | 'must-yield';

/** What a movement may do right now, supplied live by the phase machine. */
export type ElementGate =
  /** Green/amber (vehicles) or WALK (pedestrians) — claims may be granted subject to conflicts. */
  | 'allowed'
  /** Red or DON'T WALK — claims wait. */
  | 'prohibited';

/** Live rules the solver consults while arbitrating; the controller owns them. */
export interface GateContext {
  /** Phase permission for an element, evaluated at call time. */
  gate(element: string): ElementGate;
  /** Movement priority for a claim on the element — a turn-on-red override may differ from the connector's class priority. */
  priority(element: string, entity: string): number;
}

export interface ConflictMatrixStats {
  /** conn:↔conn: pairs whose sampled paths were tested. */
  connectorPairs: number;
  /** Pairs found conflicting (path crossing or shared out-lane). */
  connectorConflicts: number;
  /** conn:↔xwalk: pairs tested. */
  xwalkPairs: number;
  /** conn:↔xwalk: pairs found conflicting (leg rule or path crossing the leg polyline). */
  xwalkConflicts: number;
}

export interface ConflictMatrix {
  /** Junction node id this matrix covers. */
  node: string;
  /** Every claimable element at the node, sorted (`conn:` then `xwalk:`, each id-sorted). */
  elements: readonly string[];
  connectors: readonly LaneConnector[];
  xwalks: readonly XwalkLeg[];
  /** True when the two elements may not be occupied simultaneously. Symmetric; never self-conflicting. */
  conflicts(a: string, b: string): boolean;
  /** The ids conflicting with `element` (empty set for unknown ids). */
  conflictSet(element: string): ReadonlySet<string>;
  /** 'connector' for conn: ids, 'xwalk' for xwalk: ids, undefined for foreign ids. */
  kindOf(element: string): ClaimElementKind | undefined;
  /** The connector record for a conn: id (undefined for xwalk/foreign ids). */
  connectorOf(element: string): LaneConnector | undefined;
  /** The crosswalk record for an xwalk: id. */
  xwalkOf(element: string): XwalkLeg | undefined;
  /** Synthesised centreline for a connector (debug rendering + tests). */
  connectorPath(connector: string): readonly number[];
  stats: ConflictMatrixStats;
}

// --- Geometry helpers ----------------------------------------------------------

/** Wrap to (-π, π]. */
function normAngle(a: number): number {
  let r = a % (Math.PI * 2);
  if (r <= -Math.PI) r += Math.PI * 2;
  else if (r > Math.PI) r -= Math.PI * 2;
  return r;
}

function tailOf(points: readonly number[]): [number, number] {
  const n = points.length;
  return [points[n - 2]!, points[n - 1]!];
}

function headOf(points: readonly number[]): [number, number] {
  return [points[0]!, points[1]!];
}

function tailDir(points: readonly number[]): [number, number] {
  const n = points.length;
  const dx = points[n - 2]! - points[n - 4]!;
  const dz = points[n - 1]! - points[n - 3]!;
  const l = Math.hypot(dx, dz) || 1;
  return [dx / l, dz / l];
}

function headDir(points: readonly number[]): [number, number] {
  const dx = points[2]! - points[0]!;
  const dz = points[3]! - points[1]!;
  const l = Math.hypot(dx, dz) || 1;
  return [dx / l, dz / l];
}

/**
 * Synthesised connector centreline: a cubic bezier leaving the in-lane tail
 * along its heading and arriving at the out-lane head along its heading, the
 * construction Fable's `bezierConnector` uses. Handle length scales with the
 * gap so wide turns sweep wide; samples every ~1.5 m (8…48 points).
 */
function synthesizeConnectorPath(inLane: LaneEdge, outLane: LaneEdge): number[] {
  const [x0, z0] = tailOf(inLane.points);
  const [x3, z3] = headOf(outLane.points);
  const [tx0, tz0] = tailDir(inLane.points);
  const [tx3, tz3] = headDir(outLane.points);
  const d = Math.hypot(x3 - x0, z3 - z0);
  const h = Math.min(Math.max(d * 0.5, 2), 18);
  const x1 = x0 + tx0 * h;
  const z1 = z0 + tz0 * h;
  const x2 = x3 - tx3 * h;
  const z2 = z3 - tz3 * h;
  const n = Math.min(48, Math.max(8, Math.ceil(d / 1.5)));
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;
    const a = mt * mt * mt;
    const b = 3 * mt * mt * t;
    const c = 3 * mt * t * t;
    const e = t * t * t;
    pts.push(a * x0 + b * x1 + c * x2 + e * x3, a * z0 + b * z1 + c * z2 + e * z3);
  }
  return pts;
}

/** Strict segment crossing (proper intersection; shared endpoints don't count). */
function segmentsCross(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): boolean {
  const d1 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx);
  const d2 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx);
  const d3 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
  const d4 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function pathsCross(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 2; i < a.length; i += 2) {
    for (let j = 2; j < b.length; j += 2) {
      if (segmentsCross(a[i - 2]!, a[i - 1]!, a[i]!, a[i + 1]!, b[j - 2]!, b[j - 1]!, b[j]!, b[j + 1]!)) return true;
    }
  }
  return false;
}

function pathBounds(a: readonly number[]): [number, number, number, number] {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (let i = 0; i < a.length; i += 2) {
    x0 = Math.min(x0, a[i]!);
    z0 = Math.min(z0, a[i + 1]!);
    x1 = Math.max(x1, a[i]!);
    z1 = Math.max(z1, a[i + 1]!);
  }
  return [x0, z0, x1, z1];
}

/**
 * The conflict matrix for one junction node. Deterministic: pairs are tested
 * in id order and the result is a pure function of the topology.
 */
export function buildConflictMatrix(topology: LaneTopology, nodeId: string): ConflictMatrix {
  const node = topology.nodeById.get(nodeId);
  if (!node) throw new Error(`conflict matrix: unknown node ${nodeId}`);
  const connectors = topology.connectors.filter((c) => c.node === nodeId);
  const xwalks = topology.xwalks.filter((x) => x.node === nodeId);
  const connById = new Map(connectors.map((c) => [c.id, c]));
  const xwalkById = new Map(xwalks.map((x) => [x.id, x]));
  const roadToLeg = new Map<string, number>();
  node.legs.forEach((leg, i) => leg.roadIds.forEach((r) => roadToLeg.set(r, i)));

  const stats: ConflictMatrixStats = { connectorPairs: 0, connectorConflicts: 0, xwalkPairs: 0, xwalkConflicts: 0 };
  const edges = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    (edges.get(a) ?? edges.set(a, new Set()).get(a)!).add(b);
    (edges.get(b) ?? edges.set(b, new Set()).get(b)!).add(a);
  };

  // ---- conn: vs conn: — sampled-path crossings plus shared out-lane merges ----
  const paths = new Map<string, number[]>();
  const bounds = new Map<string, [number, number, number, number]>();
  for (const c of connectors) {
    const inLane = topology.laneById.get(c.in);
    const outLane = topology.laneById.get(c.out);
    if (!inLane || !outLane) continue;
    const path = synthesizeConnectorPath(inLane, outLane);
    paths.set(c.id, path);
    bounds.set(c.id, pathBounds(path));
  }
  for (let i = 0; i < connectors.length; i++) {
    const a = connectors[i]!;
    for (let j = i + 1; j < connectors.length; j++) {
      const b = connectors[j]!;
      // Two connectors feeding one out-lane merge inside the box: no
      // simultaneous occupancy (the same in-lane is car-following's job).
      const sameOut = a.out === b.out;
      const pa = bounds.get(a.id);
      const pb = bounds.get(b.id);
      let crossing = false;
      if (pa && pb && pa[0] <= pb[2] && pb[0] <= pa[2] && pa[1] <= pb[3] && pb[1] <= pa[3]) {
        stats.connectorPairs++;
        crossing = pathsCross(paths.get(a.id)!, paths.get(b.id)!);
      }
      if (sameOut || crossing) {
        link(a.id, b.id);
        stats.connectorConflicts++;
      }
    }
  }

  // ---- conn: vs xwalk: — a ped on leg L's crossing meets every exit onto L ----
  for (const x of xwalks) {
    for (const c of connectors) {
      stats.xwalkPairs++;
      const outLane = topology.laneById.get(c.out);
      // Primary rule: the connector exits onto a road of the leg this
      // crosswalk spans. Supplementary: the synthesised path physically
      // crosses the crosswalk polyline (covers unpaired legs, internal
      // median pieces and skew crossings the leg index can't express). A
      // crosswalk with no leg binding conservatively conflicts with every
      // connector in the box.
      const exitsOnto = x.leg >= 0 && outLane !== undefined && (node.legs[x.leg]?.roadIds.includes(outLane.roadId) ?? false);
      const physical = pathsCross(paths.get(c.id) ?? [], x.points);
      if (x.leg < 0 || exitsOnto || physical) {
        link(c.id, x.id);
        stats.xwalkConflicts++;
      }
    }
  }

  const elements = [...connectors.map((c) => c.id), ...xwalks.map((x) => x.id)].sort();
  const empty: ReadonlySet<string> = new Set();
  return {
    node: nodeId,
    elements,
    connectors,
    xwalks,
    conflicts: (a, b) => a !== b && (edges.get(a)?.has(b) ?? false),
    conflictSet: (element) => edges.get(element) ?? empty,
    kindOf: (element) => (connById.has(element) ? 'connector' : xwalkById.has(element) ? 'xwalk' : undefined),
    connectorOf: (element) => connById.get(element),
    xwalkOf: (element) => xwalkById.get(element),
    connectorPath: (connector) => paths.get(connector) ?? [],
    stats,
  };
}

// --- Claim arbitration ----------------------------------------------------------

interface Claim {
  entity: string;
  element: string;
  /** Monotonic issue order — the FCFS ticket (Fable's `claims` map pattern). */
  ticket: number;
  /** Priority snapshot taken when the claim was made. */
  priority: number;
  /** Set when the claim moved from the pending queue to the held set. */
  held: boolean;
  heldAt: number;
  /** Grant order for diagnostics/tests — strictly increasing across grants. */
  grantSeq: number;
}

export interface SolverClaimView {
  entity: string;
  element: string;
  ticket: number;
  priority: number;
  held: boolean;
  grantSeq: number;
}

/**
 * First-come-first-served claim arbiter for one junction. The phase machine
 * supplies `GateContext` — what each element is allowed to do *now* — and the
 * solver answers `request`/`step` deterministically from it.
 */
export class ConflictSolver {
  private readonly matrix: ConflictMatrix;
  private readonly staleAfterSeconds: number;
  private clock = 0;
  private ticketCounter = 0;
  private grantCounter = 0;
  /** entity -> its single live claim. */
  private readonly claims = new Map<string, Claim>();
  /** element -> pending FIFO queue (id-order initialised for deterministic sweeps). */
  private readonly queues = new Map<string, Claim[]>();
  /** element -> held claims (multiple entities may hold one element — car-following serialises them). */
  private readonly held = new Map<string, Set<string>>();

  constructor(matrix: ConflictMatrix, options: { staleClaimSeconds?: number } = {}) {
    this.matrix = matrix;
    this.staleAfterSeconds = options.staleClaimSeconds ?? 30;
  }

  /**
   * Ask for right-of-way over an element. One entity holds at most one claim;
   * re-requesting a different element abandons the old claim (the entity has
   * committed to a new movement). The answer reflects the claim's state *now*:
   * 'granted' when held, 'queued' when prohibited or behind the FIFO line,
   * 'must-yield' when permitted but outranked by a conflicting claim.
   */
  request(entity: string, element: string, ctx: GateContext): GrantResult {
    const existing = this.claims.get(entity);
    if (existing && existing.element === element) {
      // A re-request on a held claim is a heartbeat: an entity actively
      // asking to keep its element is not stale — only entities that stop
      // asking (despawned, crashed, done) hit the stale-after expiry.
      if (existing.held) {
        existing.heldAt = this.clock;
        return 'granted';
      }
      return this.evaluate(existing, ctx);
    }
    if (existing) this.drop(existing);
    const claim: Claim = {
      entity,
      element,
      ticket: this.ticketCounter++,
      priority: ctx.priority(element, entity),
      held: false,
      heldAt: 0,
      grantSeq: 0,
    };
    this.claims.set(entity, claim);
    (this.queues.get(element) ?? this.queues.set(element, []).get(element)!).push(claim);
    return this.evaluate(claim, ctx);
  }

  /**
   * Advance the arbiter: expire stale held claims, then sweep every element's
   * pending queue in id order granting all claims that are permitted and
   * unblocked. Deterministic — the grant sequence is a pure function of the
   * request stream and the gate over time.
   */
  step(dt: number, ctx: GateContext): void {
    this.clock += dt;
    for (const [element, set] of this.held) {
      for (const entity of [...set]) {
        const claim = this.claims.get(entity);
        if (claim && this.clock - claim.heldAt > this.staleAfterSeconds) {
          set.delete(entity);
          this.claims.delete(entity);
        }
      }
      if (set.size === 0) this.held.delete(element);
    }
    for (const element of this.matrix.elements) {
      const queue = this.queues.get(element);
      if (!queue || queue.length === 0) continue;
      if (ctx.gate(element) !== 'allowed') continue;
      for (const claim of [...queue]) {
        if (this.blockers(claim, ctx).length === 0) this.grant(claim, ctx);
      }
    }
  }

  /** The entity finished traversing its element (or abandoned the movement). */
  release(entity: string): void {
    const claim = this.claims.get(entity);
    if (claim) this.drop(claim);
  }

  /** Snapshot of every live claim, sorted by ticket — a stable debug/test view. */
  claimsView(): readonly SolverClaimView[] {
    return [...this.claims.values()]
      .sort((a, b) => a.ticket - b.ticket || (a.entity < b.entity ? -1 : 1))
      .map((c) => ({ entity: c.entity, element: c.element, ticket: c.ticket, priority: c.priority, held: c.held, grantSeq: c.grantSeq }));
  }

  /** Pending entity ids on an element, FIFO order (tests + dev inspector). */
  queueOf(element: string): readonly string[] {
    return (this.queues.get(element) ?? []).map((c) => c.entity);
  }

  /** Held entity ids on an element, grant order. */
  holdersOf(element: string): readonly string[] {
    const set = this.held.get(element);
    if (!set) return [];
    return [...set]
      .map((e) => this.claims.get(e))
      .filter((c): c is Claim => c !== undefined)
      .sort((a, b) => a.grantSeq - b.grantSeq)
      .map((c) => c.entity);
  }

  private evaluate(claim: Claim, ctx: GateContext): GrantResult {
    const queue = this.queues.get(claim.element) ?? [];
    if (queue[0] !== claim) return 'queued';
    if (ctx.gate(claim.element) !== 'allowed') return 'queued';
    if (this.blockers(claim, ctx).length > 0) return 'must-yield';
    this.grant(claim, ctx);
    return 'granted';
  }

  /**
   * Conflicting claims that outrank this one: any *held* claim on a
   * conflicting element blocks (it is committed, mid-traversal), and any
   * *permitted pending* claim with higher movement priority — or equal
   * priority and an earlier ticket — blocks. Pending claims behind a red are
   * future demand and do not block; entity id is the final deterministic tie
   * key when a caller somehow shares a ticket (defensive — tickets are unique).
   */
  private blockers(claim: Claim, ctx: GateContext): Claim[] {
    const out: Claim[] = [];
    for (const other of this.conflictingElements(claim.element)) {
      for (const entity of this.held.get(other) ?? []) {
        const c = this.claims.get(entity);
        if (c && c !== claim) out.push(c);
      }
      for (const c of this.queues.get(other) ?? []) {
        if (c === claim || c.held) continue;
        if (ctx.gate(c.element) !== 'allowed') continue;
        if (c.priority < claim.priority || (c.priority === claim.priority && (c.ticket < claim.ticket || (c.ticket === claim.ticket && c.entity < claim.entity)))) {
          out.push(c);
        }
      }
    }
    return out.sort((a, b) => a.ticket - b.ticket || (a.entity < b.entity ? -1 : 1));
  }

  private conflictingElements(element: string): readonly string[] {
    return [...this.matrix.conflictSet(element)].sort();
  }

  private grant(claim: Claim, _ctx: GateContext): void {
    const queue = this.queues.get(claim.element);
    if (queue) {
      const i = queue.indexOf(claim);
      if (i >= 0) queue.splice(i, 1);
      if (queue.length === 0) this.queues.delete(claim.element);
    }
    claim.held = true;
    claim.heldAt = this.clock;
    claim.grantSeq = this.grantCounter++;
    (this.held.get(claim.element) ?? this.held.set(claim.element, new Set()).get(claim.element)!).add(claim.entity);
  }

  private drop(claim: Claim): void {
    this.claims.delete(claim.entity);
    const queue = this.queues.get(claim.element);
    if (queue) {
      const i = queue.indexOf(claim);
      if (i >= 0) queue.splice(i, 1);
      if (queue.length === 0) this.queues.delete(claim.element);
    }
    const set = this.held.get(claim.element);
    if (set) {
      set.delete(claim.entity);
      if (set.size === 0) this.held.delete(claim.element);
    }
  }
}

/** Movement priority for a connector's turn class (vehicles). */
export function connectorPriority(turn: LaneConnector['turn']): number {
  switch (turn) {
    case 'through':
      return CLAIM_PRIORITY.through;
    case 'right':
      return CLAIM_PRIORITY.right;
    case 'left':
      return CLAIM_PRIORITY.left;
    case 'uturn':
      return CLAIM_PRIORITY.uturn;
  }
}

export { normAngle };
