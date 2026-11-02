import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseCityDataset, type CityDatasetV3, type CityRoad } from '../city-dataset.ts';
import {
  CLAIM_PRIORITY,
  ConflictSolver,
  buildConflictMatrix,
  connectorPriority,
  type ConflictMatrix,
  type GateContext,
} from './conflict-solver.ts';
import { buildLaneTopology, type LaneTopology } from './topology.ts';

// --- Hand-built matrices: arbitration logic needs no topology -------------------

function matrix(elements: readonly string[], pairs: readonly (readonly [string, string])[]): ConflictMatrix {
  const set = (e: string) => new Set(pairs.flatMap(([a, b]) => (a === e ? [b] : b === e ? [a] : [])));
  return {
    node: 'n',
    elements,
    connectors: [],
    xwalks: [],
    conflicts: (a, b) => set(a).has(b),
    conflictSet: set,
    kindOf: (e) => (e.startsWith('xwalk:') ? 'xwalk' : 'connector'),
    connectorOf: () => undefined,
    xwalkOf: () => undefined,
    connectorPath: () => [],
    stats: { connectorPairs: pairs.length, connectorConflicts: pairs.length, xwalkPairs: 0, xwalkConflicts: 0 },
  };
}

/** Everything permitted, priorities taken from a lookup (default: through). */
function ctx(priorities: Readonly<Record<string, number>> = {}, gate: (e: string) => 'allowed' | 'prohibited' = () => 'allowed'): GateContext {
  return { gate, priority: (e) => priorities[e] ?? CLAIM_PRIORITY.through };
}

test('FCFS: a granted claim holds the element; a conflicting claim waits and follows release', () => {
  const m = matrix(['a', 'b'], [['a', 'b']]);
  const s = new ConflictSolver(m);
  const c = ctx();
  assert.equal(s.request('car-1', 'a', c), 'granted');
  assert.equal(s.request('car-2', 'b', c), 'must-yield');
  // The held claim is the only blocker; a non-conflicting element is free.
  assert.deepEqual(s.holdersOf('a'), ['car-1']);
  s.release('car-1');
  assert.equal(s.request('car-2', 'b', c), 'granted');
});

test('pending claims queue FIFO per element and drain in ticket order', () => {
  const m = matrix(['e'], []);
  const s = new ConflictSolver(m);
  const red: GateContext = { gate: () => 'prohibited', priority: () => CLAIM_PRIORITY.through };
  assert.equal(s.request('v3', 'e', red), 'queued');
  assert.equal(s.request('v1', 'e', red), 'queued');
  assert.equal(s.request('v2', 'e', red), 'queued');
  assert.deepEqual(s.queueOf('e'), ['v3', 'v1', 'v2']);
  // Green: the whole queue is grantable (one element doesn't self-conflict) but grant order stays FIFO.
  s.step(0.05, ctx());
  const seq = Object.fromEntries(s.claimsView().map((v) => [v.entity, v.grantSeq]));
  assert.ok(seq['v3']! < seq['v1']! && seq['v1']! < seq['v2']!, `grant order ${JSON.stringify(seq)}`);
  assert.deepEqual(s.holdersOf('e'), ['v3', 'v1', 'v2']);
});

test('movement priority: a pending permitted left cannot block a through, and must yield to it', () => {
  // left(L) conflicts with through(T) and with blocker(D). Hold D so L stays pending,
  // then T arrives: T is unblocked (L is pending + lower priority) and L yields harder.
  const m = matrix(['l', 't', 'd'], [['l', 't'], ['l', 'd']]);
  const s = new ConflictSolver(m);
  const c = ctx({ l: CLAIM_PRIORITY.left, t: CLAIM_PRIORITY.through, d: CLAIM_PRIORITY.through });
  assert.equal(s.request('bus', 'd', c), 'granted'); // blocks L only
  assert.equal(s.request('lefty', 'l', c), 'must-yield');
  assert.equal(s.request('thru', 't', c), 'granted'); // pending lower-priority L does not block
  s.release('bus');
  assert.equal(s.request('lefty', 'l', c), 'must-yield'); // held through still conflicts
  s.release('thru');
  assert.equal(s.request('lefty', 'l', c), 'granted');
});

test('equal-priority conflicts resolve FCFS — the all-way-stop protocol', () => {
  // Two crossing movements, same priority (dark signal behaviour). Right-of-way
  // follows arrival order across conflicting elements: a follower can't jump a
  // cross-street claim that arrived first, even riding a held element.
  const m = matrix(['ns', 'ew'], [['ns', 'ew']]);
  const s = new ConflictSolver(m);
  const c = ctx(); // all 'through'
  assert.equal(s.request('first', 'ns', c), 'granted');
  assert.equal(s.request('second', 'ew', c), 'must-yield');
  assert.equal(s.request('tail', 'ns', c), 'must-yield'); // 'second' holds an earlier conflicting ticket
  s.release('first');
  s.step(0.05, c);
  assert.equal(s.request('second', 'ew', c), 'granted'); // the queue drains in ticket order
  assert.equal(s.request('tail', 'ns', c), 'must-yield'); // 'second' is mid-box now
  s.release('second');
  assert.equal(s.request('tail', 'ns', c), 'granted');
});

test('pedestrian priority: a ped claim outranks a turning vehicle claim', () => {
  const m = matrix(['turn', 'xwalk:1'], [['turn', 'xwalk:1']]);
  const s = new ConflictSolver(m);
  const c = ctx({ 'xwalk:1': CLAIM_PRIORITY.pedestrian, turn: CLAIM_PRIORITY.right });
  assert.equal(s.request('walker', 'xwalk:1', c), 'granted');
  assert.equal(s.request('car', 'turn', c), 'must-yield');
  s.release('walker');
  assert.equal(s.request('car', 'turn', c), 'granted');
  // Reversed arrival: ped pending on a held vehicle also waits ('must-yield' at the kerb).
  const s2 = new ConflictSolver(m);
  assert.equal(s2.request('car', 'turn', c), 'granted');
  assert.equal(s2.request('walker', 'xwalk:1', c), 'must-yield');
});

test('a pending claim behind a red does not block a conflicting green claim', () => {
  const m = matrix(['ns', 'ew'], [['ns', 'ew']]);
  const s = new ConflictSolver(m);
  const c: GateContext = { gate: (e) => (e === 'ns' ? 'prohibited' : 'allowed'), priority: () => CLAIM_PRIORITY.through };
  assert.equal(s.request('waiting-ns', 'ns', c), 'queued');
  assert.equal(s.request('moving-ew', 'ew', c), 'granted'); // future demand doesn't block
});

test('stale held claims auto-release after the configured timeout', () => {
  const m = matrix(['a', 'b'], [['a', 'b']]);
  const s = new ConflictSolver(m, { staleClaimSeconds: 10 });
  const c = ctx();
  assert.equal(s.request('orphan', 'a', c), 'granted');
  assert.equal(s.request('v', 'b', c), 'must-yield');
  s.step(11, c);
  assert.equal(s.request('v', 'b', c), 'granted');
});

test('re-requesting a different element abandons the old claim; ids are deterministic', () => {
  const m = matrix(['a', 'b'], [['a', 'b']]);
  const s = new ConflictSolver(m);
  const c = ctx();
  assert.equal(s.request('car', 'a', c), 'granted');
  assert.equal(s.request('car', 'b', c), 'granted'); // moved on: 'a' released
  assert.deepEqual(s.claimsView().map((v) => v.element), ['b']);
  // Same request stream on a second solver -> identical view.
  const s2 = new ConflictSolver(m);
  s2.request('car', 'a', c);
  s2.request('car', 'b', c);
  assert.deepEqual(s.claimsView(), s2.claimsView());
});

test('connectorPriority orders NYC right-of-way: through < right < left < uturn; peds above all', () => {
  assert.ok(CLAIM_PRIORITY.pedestrian < connectorPriority('through'));
  assert.ok(connectorPriority('through') < connectorPriority('right'));
  assert.ok(connectorPriority('right') < connectorPriority('left'));
  assert.ok(connectorPriority('left') < connectorPriority('uturn'));
  assert.ok(connectorPriority('uturn') < CLAIM_PRIORITY.turnOnRed);
});

// --- Matrix geometry over a fixture junction ------------------------------------

function tile(roads: CityRoad[], id = 't'): CityDatasetV3 {
  return {
    version: 3, id, origin: [-73.95, 40.81], extentMeters: 200,
    sources: [{ url: 'https://www.openstreetmap.org/copyright', attribution: 't', license: 'ODbL-1.0', retrievedAt: '2026-10-16T00:00:00Z' }],
    notes: [], buildings: [], areas: [], landmarks: [], roads,
    trees: { census: [], fill: [] }, transit: { subway: [], shelters: [] }, furniture: { hydrant: [], linknyc: [], bikeRack: [] },
  };
}

const road = (id: string, cls: CityRoad['class'], points: number[], width: number, extra: Partial<CityRoad> = {}): CityRoad => ({
  id, class: cls, widthMeters: width, sidewalkMeters: 3, points, widthEstimated: false, ...extra,
});

/** A signalized four-way: EW and NS streets in two pieces each, four OSM crossing ways. */
function crossTopology(): LaneTopology {
  return buildLaneTopology(tile([
    road('ew-w', 'residential', [-60, 0, -6, 0], 12, { lanes: 2 }),
    road('ew-e', 'residential', [6, 0, 60, 0], 12, { lanes: 2 }),
    road('ns-n', 'residential', [0, -60, 0, -6], 12, { lanes: 2 }),
    road('ns-s', 'residential', [0, 6, 0, 60], 12, { lanes: 2 }),
    road('cw-e', 'crossing', [8, -8, 8, 8], 2),
    road('cw-w', 'crossing', [-8, -8, -8, 8], 2),
    road('cw-n', 'crossing', [-8, -8, 8, -8], 2),
    road('cw-s', 'crossing', [-8, 8, 8, 8], 2),
  ]));
}

const CONN = (s: string) => `conn:lane:${s}`;
const nodeIdOf = (t: LaneTopology) => t.nodes.find((n) => n.kind === 'junction')!.id;

test('matrix: crossing movements conflict, parallel movements do not', () => {
  const t = crossTopology();
  const m = buildConflictMatrix(t, nodeIdOf(t));
  const wThrough = CONN('ew-w:f:0>lane:ew-e:f:0');
  const eThrough = CONN('ew-e:b:0>lane:ew-w:b:0');
  const nThrough = CONN('ns-n:f:0>lane:ns-s:f:0');
  const wLeft = CONN('ew-w:f:0>lane:ns-n:b:0');
  // Opposing throughs share no space.
  assert.equal(m.conflicts(wThrough, eThrough), false);
  // Crossing throughs do.
  assert.equal(m.conflicts(wThrough, nThrough), true);
  // A permitted left crosses the oncoming through.
  assert.equal(m.conflicts(wLeft, eThrough), true);
  // A left does not cross its own direction's through behind it.
  assert.equal(m.conflicts(wLeft, wThrough), false);
});

test('matrix: a crosswalk conflicts with every connector exiting onto its leg', () => {
  const t = crossTopology();
  const node = t.nodeById.get(nodeIdOf(t))!;
  const m = buildConflictMatrix(t, node.id);
  const cwS = t.xwalks.find((x) => x.id.endsWith(':cw-s'))!;
  // Out lanes on the south leg's road (ns-s): the two turns onto it plus the N through.
  const ontoS = ['conn:lane:ew-w:f:0>lane:ns-s:f:0', 'conn:lane:ew-e:b:0>lane:ns-s:f:0', 'conn:lane:ns-n:f:0>lane:ns-s:f:0'];
  for (const c of ontoS) assert.ok(m.conflicts(c, cwS.id), `${c} must conflict with ${cwS.id}`);
  // Connectors that never reach the south leg leave it alone.
  assert.equal(m.conflicts('conn:lane:ew-w:f:0>lane:ns-n:b:0', cwS.id), false);
  // ...and every crosswalk keeps at least three conflicting vehicle movements.
  for (const x of m.xwalks) assert.ok(m.conflictSet(x.id).size >= 3, `${x.id} conflicts ${m.conflictSet(x.id).size}`);
});

test('matrix: merging into one out-lane conflicts even without a path crossing', () => {
  const t = crossTopology();
  const m = buildConflictMatrix(t, nodeIdOf(t));
  // Both the N through and the W right-turn feed lane:ns-s:f:0.
  assert.ok(m.conflicts('conn:lane:ns-n:f:0>lane:ns-s:f:0', 'conn:lane:ew-w:f:0>lane:ns-s:f:0'));
});

test('matrix: connector paths are synthesised for every connector and stats are counted', () => {
  const t = crossTopology();
  const m = buildConflictMatrix(t, nodeIdOf(t));
  for (const c of m.connectors) assert.ok(m.connectorPath(c.id).length >= 16, `${c.id} has a path`);
  assert.ok(m.stats.connectorConflicts > 0 && m.stats.xwalkConflicts >= 12);
  // Determinism: a second build links the same pairs.
  const m2 = buildConflictMatrix(t, nodeIdOf(t));
  for (const e of m.elements) assert.deepEqual([...m.conflictSet(e)].sort(), [...m2.conflictSet(e)].sort());
});

// --- Real tile ------------------------------------------------------------------

function bundled(): LaneTopology {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  return buildLaneTopology(dataset);
}

test('matrix on the real junctions: crossing throughs conflict, same-axis throughs do not', () => {
  const topo = bundled();
  for (const nodeId of [
    'node:s19402.s19403.s19682.s19683', // W 125 St & St Nicholas Av
    'node:s19169.s19170.s19212.s19213.s19399.s19400.s19401', // ACP Jr Blvd
    'node:s19345.s19346.s19381.s19382.s19400.s19418.s19419', // Lenox / Malcolm X
  ]) {
    const m = buildConflictMatrix(topo, nodeId);
    assert.ok(m.connectors.length > 0 && m.xwalks.length >= 4, `${nodeId}`);
    // Every xwalk conflicts with something; every junction has real vehicle conflicts.
    for (const x of m.xwalks) assert.ok(m.conflictSet(x.id).size > 0, `${x.id} is exposed`);
    assert.ok(m.stats.connectorConflicts > 0, `${nodeId} has vehicle conflicts`);
    // A node's own throughs on the same approach axis stay compatible:
    // find two opposing throughs (same out-lane road pair reversed) — assert at
    // least one non-conflicting through/through pair exists per junction.
    const throughs = m.connectors.filter((c) => c.turn === 'through');
    let compatiblePair = 0;
    for (let i = 0; i < throughs.length; i++)
      for (let j = i + 1; j < throughs.length; j++) if (!m.conflicts(throughs[i]!.id, throughs[j]!.id)) compatiblePair++;
    assert.ok(compatiblePair > 0, `${nodeId} has compatible through movements`);
  }
});
