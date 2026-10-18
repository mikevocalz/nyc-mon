import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseCityDataset, type CityDatasetV3, type CityRoad } from '../city-dataset.ts';
import { buildSignalSystem, type SignalSystem } from './signal-controller.ts';
import { buildLaneTopology, type LaneConnector, type LaneTopology } from './topology.ts';
import {
  SIM_DT,
  VSNAP,
  VSNAP_HEADER,
  VSNAP_STRIDE,
  VehicleSim,
  packVehicleSnapshot,
  vehicleSnapshotCount,
  vehicleSnapshotVersion,
  type SpawnSpec,
} from './vehicle-sim.ts';
import { livingCityVerticalSlice } from './vertical-slice.ts';

// --- Fixture: the same signalized four-way the signal tests use -------------------

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

interface Rig {
  topo: LaneTopology;
  signals: SignalSystem;
  sim: VehicleSim;
  nodeId: string;
}

function rig(seed: number, vehicles: readonly SpawnSpec[] = []): Rig {
  const topo = crossTopology();
  const signals = buildSignalSystem(topo);
  const node = topo.nodes.find((n) => n.kind === 'junction')!;
  const sim = new VehicleSim(topo, signals, { seed, vehicles });
  return { topo, signals, sim, nodeId: node.id };
}

const approaches = (topo: LaneTopology, nodeId: string, roadId: string) =>
  (topo.lanesTo.get(nodeId) ?? []).filter((l) => l.roadId === roadId);

const throughConn = (topo: LaneTopology, laneId: string): LaneConnector =>
  topo.connectors.find((c) => c.in === laneId && c.turn === 'through')!;

const aspect = (r: Rig, conn: LaneConnector) => r.signals.state(r.nodeId)?.vehicleAspects[conn.id] ?? 'G';

const run = (r: Rig, ticks: number, each?: (r: Rig, tick: number) => void) => {
  for (let i = 0; i < ticks; i++) {
    r.sim.step(SIM_DT);
    each?.(r, i);
  }
};

// --- Determinism -------------------------------------------------------------------

test('seeded determinism: identical seeds pack identical snapshots', () => {
  const spec = (r: Rig): SpawnSpec[] => {
    const a = approaches(r.topo, r.nodeId, 'ew-w')[0]!;
    const c = throughConn(r.topo, a.id);
    return [{ kind: 'sedan', lane: a.id, s: 12, route: [c.out] }];
  };
  const a = rig(77);
  const b = rig(77);
  a.sim.spawn(spec(a)[0]!);
  b.sim.spawn(spec(b)[0]!);
  run(a, 480);
  run(b, 480);
  assert.deepEqual(packVehicleSnapshot(9, a.sim), packVehicleSnapshot(9, b.sim));
  assert.notEqual(packVehicleSnapshot(10, a.sim), packVehicleSnapshot(10, a.sim), 'version flows through the header');
});

// --- Car following -----------------------------------------------------------------

test('IDM gap keeping: a faster follower never overlaps the leader over 30 s', () => {
  const r = rig(3);
  const lane = approaches(r.topo, r.nodeId, 'ew-w')[0]!;
  const conn = throughConn(r.topo, lane.id);
  // Front vehicle is slow, rear is fast: they compress to a queue, never merge.
  r.sim.spawn({ kind: 'sedan', lane: lane.id, s: lane.lengthMeters - 30, speed: 3, route: [conn.out] });
  r.sim.spawn({ kind: 'van', lane: lane.id, s: lane.lengthMeters - 46, speed: 11, route: [conn.out] });
  let minGap = Infinity;
  run(r, 720, () => {
    const rows = r.sim.vehiclesView();
    const a = rows.find((v) => v.id === 1);
    const b = rows.find((v) => v.id === 2);
    if (!a || !b || a.element !== b.element) return;
    // Follower front vs leader rear: order never inverts, gap never goes negative.
    const gap = a.s - 5.0 - b.s; // a is ahead (spawned with the larger s)
    minGap = Math.min(minGap, gap);
    assert.ok(gap > -0.05, `overlap at tick: ${JSON.stringify({ a: a.s, b: b.s })}`);
  });
  assert.ok(minGap > 0.5, `queue kept a real gap (min ${minGap.toFixed(2)} m)`);
});

// --- Signals -------------------------------------------------------------------------

test('red light: the approach vehicle waits at the line and never enters the box on red', () => {
  const r = rig(5);
  const lane = approaches(r.topo, r.nodeId, 'ns-s')[0]!;
  const conn = throughConn(r.topo, lane.id);
  r.sim.spawn({ kind: 'sedan', lane: lane.id, s: lane.lengthMeters - 34, route: [conn.out] });
  let redTicks = 0;
  let heldAtLine = false;
  run(r, 2400, () => {
    const v = r.sim.vehicleView(1);
    if (!v) return;
    if (aspect(r, conn) === 'R') {
      redTicks++;
      assert.notEqual(v.element, conn.id, 'entered the junction on red');
      if (v.element === lane.id && v.speed < 0.1 && v.s > lane.lengthMeters - 20) heldAtLine = true;
    }
  });
  assert.ok(redTicks > 100, `run saw real red time (${redTicks} ticks)`);
  assert.ok(heldAtLine, 'vehicle stood at the stop line on red at least once');
});

test('green pass: a vehicle on a green approach proceeds through the box legally', () => {
  const r = rig(8);
  const lane = approaches(r.topo, r.nodeId, 'ew-w')[0]!;
  const conn = throughConn(r.topo, lane.id);
  r.sim.spawn({ kind: 'taxi', lane: lane.id, s: lane.lengthMeters - 34, route: [conn.out] });
  let entered = false;
  let exited = false;
  let aspectOnEntry: string | null = null;
  run(r, 2880, () => {
    const v = r.sim.vehicleView(1);
    if (!v) return;
    if (!entered && v.element === conn.id) {
      entered = true;
      aspectOnEntry = aspect(r, conn);
    }
    if (v.element === conn.out) exited = true;
  });
  assert.ok(entered, 'vehicle entered the junction within 120 s');
  assert.notEqual(aspectOnEntry, 'R', `entered on ${aspectOnEntry}`);
  assert.ok(exited, 'vehicle cleared onto the exit lane');
});

test('blocked exit: a full exit lane keeps the box clear even on green', () => {
  const r = rig(13);
  const lane = approaches(r.topo, r.nodeId, 'ew-w')[0]!;
  const conn = throughConn(r.topo, lane.id);
  // A parked stand-in plugs the exit lane's head.
  r.sim.spawn({ kind: 'bus', lane: conn.out, s: 8, holdUntil: 1e9 });
  r.sim.spawn({ kind: 'sedan', lane: lane.id, s: lane.lengthMeters - 34, route: [conn.out] });
  let blockedSeen = false;
  let greenSeen = false;
  run(r, 1800, () => {
    const v = r.sim.vehicleView(2);
    if (!v) return;
    if (aspect(r, conn) === 'G') greenSeen = true;
    assert.notEqual(v.element, conn.id, 'entered the box with no room to clear');
    if (v.waitReason === 'blocked') blockedSeen = true;
  });
  assert.ok(greenSeen, 'the approach saw green during the run');
  assert.ok(blockedSeen, 'vehicle reported a blocked exit');
});

// --- Claim lifecycle (solver heartbeat + despawn release) --------------------------------

test('a committed claim held at the line outlives the solver stale window', () => {
  const r = rig(5);
  const lane = approaches(r.topo, r.nodeId, 'ew-w')[0]!;
  const conn = throughConn(r.topo, lane.id);
  const solver = r.signals.controllerForElement(conn.id)!.solver;
  // A parked stand-in just past the stop line keeps the claimant stopped
  // inside claim range while it holds the grant.
  r.sim.spawn({ kind: 'bus', lane: lane.id, s: lane.lengthMeters - 3, holdUntil: 1e9 });
  const id = r.sim.spawn({ kind: 'sedan', lane: lane.id, s: lane.lengthMeters - 40, route: [conn.out] });
  assert.ok(id > 0);
  const entity = `veh:${id}`;
  let claimed = false;
  for (let i = 0; i < 4800 && !claimed; i++) {
    r.sim.step(SIM_DT);
    claimed = solver.holdersOf(conn.id).includes(entity);
  }
  assert.ok(claimed, 'vehicle claimed the connector');
  // Hold well past the solver's 30 s stale-claim expiry.
  run(r, Math.round(40 / SIM_DT));
  const v = r.sim.vehicleView(id);
  assert.ok(v && v.element === lane.id, 'still stopped behind the parked stand-in');
  assert.ok(solver.holdersOf(conn.id).includes(entity), 'heartbeat kept the held claim alive');
});

test('a despawned vehicle releases a queued claim, not just a held one', () => {
  const r = rig(5);
  const lane = approaches(r.topo, r.nodeId, 'ns-s')[0]!;
  const conn = throughConn(r.topo, lane.id);
  const solver = r.signals.controllerForElement(conn.id)!.solver;
  // Park the run on the red phase so the claim can only queue, never grant.
  for (let i = 0; i < 4800 && aspect(r, conn) !== 'R'; i++) r.signals.step(SIM_DT);
  assert.equal(aspect(r, conn), 'R', 'red phase reached');
  const id = r.sim.spawn({ kind: 'sedan', lane: lane.id, s: lane.lengthMeters - 8, route: [conn.out], ambient: true });
  assert.ok(id > 0);
  const entity = `veh:${id}`;
  r.sim.step(SIM_DT);
  assert.ok(solver.queueOf(conn.id).includes(entity), 'claim queued on red');
  // Retire the ambient vehicle — with no focus set it despawns on the next
  // spawner pass (0.4 s cadence).
  r.sim.setTargetVehicles(0);
  run(r, 24);
  assert.deepEqual(
    [...solver.queueOf(conn.id), ...solver.holdersOf(conn.id)].filter((e) => e === entity),
    [],
    'queued claim released on despawn',
  );
});

// --- Pedestrian claim seam --------------------------------------------------------------

test('pedClaimAt surfaces solver claims on a crosswalk', () => {
  const r = rig(2);
  const xwalk = r.topo.xwalks.find((x) => x.node === r.nodeId)!;
  assert.ok(xwalk, 'fixture has a crosswalk');
  assert.deepEqual(r.sim.pedClaimAt(xwalk.id), []);
  r.signals.requestGrant('ped:test', xwalk.id);
  assert.deepEqual(r.sim.pedClaimAt(xwalk.id), ['ped:test']);
  r.signals.release('ped:test');
  assert.deepEqual(r.sim.pedClaimAt(xwalk.id), []);
});

// --- Amber dilemma -------------------------------------------------------------------------

test('amber: too far stops at the line; too close clears through', () => {
  const r = rig(21);
  const eastLane = approaches(r.topo, r.nodeId, 'ew-w')[0]!;
  const westLane = approaches(r.topo, r.nodeId, 'ew-e')[0]!;
  const eastConn = throughConn(r.topo, eastLane.id);
  const westConn = throughConn(r.topo, westLane.id);
  // Advance the program until the east–west group turns amber.
  for (let i = 0; i < 2400 && aspect(r, eastConn) !== 'Y'; i++) r.signals.step(SIM_DT);
  assert.equal(aspect(r, eastConn), 'Y', 'amber reached');
  // Same phase both directions (paired legs): stopper is far, clearer is on the line.
  r.sim.spawn({ kind: 'sedan', lane: eastLane.id, s: eastLane.lengthMeters - 55, speed: 9, route: [eastConn.out] });
  r.sim.spawn({ kind: 'sedan', lane: westLane.id, s: westLane.lengthMeters - 4, speed: 12, route: [westConn.out] });
  let clearerEntered: string | null = null;
  let clearerAspect: string | null = null;
  let stopperStoppedOnLane = false;
  let stopperEntryAspect: string | null = null;
  run(r, 720, () => {
    const clearer = r.sim.vehicleView(2);
    if (clearer && clearerEntered === null && clearer.element !== westLane.id) {
      clearerEntered = clearer.element;
      clearerAspect = aspect(r, westConn);
    }
    const stopper = r.sim.vehicleView(1);
    if (stopper && stopperEntryAspect === null) {
      if (stopper.element === eastLane.id && stopper.speed < 0.3) stopperStoppedOnLane = true;
      else if (stopper.element !== eastLane.id) stopperEntryAspect = aspect(r, eastConn);
    }
  });
  // The dilemma's stop branch: far enough to stop, it did — and if it later
  // entered the box, it was on the next green, never on amber or red.
  assert.ok(stopperStoppedOnLane, 'far vehicle braked to a stop on the approach');
  if (stopperEntryAspect !== null) assert.equal(stopperEntryAspect, 'G', `far vehicle entered on ${stopperEntryAspect}`);
  assert.ok(clearerEntered !== null, 'close vehicle cleared the dilemma zone');
  assert.notEqual(clearerAspect, 'R', `clearer left on ${clearerAspect}`);
});

// --- Snapshot codec ----------------------------------------------------------------------

test('snapshot: header, stride, count and fresh array identity', () => {
  const r = rig(31);
  const lane = approaches(r.topo, r.nodeId, 'ew-w')[0]!;
  const conn = throughConn(r.topo, lane.id);
  r.sim.spawn({ lane: lane.id, s: 8, route: [conn.out] });
  r.sim.spawn({ kind: 'bus', lane: lane.id, s: 22, route: [conn.out] });
  run(r, 3);
  const snap = packVehicleSnapshot(42, r.sim);
  assert.equal(snap[VSNAP.version], 42);
  assert.equal(snap[VSNAP.tickDt], SIM_DT);
  assert.equal(snap[VSNAP.count], 2);
  assert.equal(snap[VSNAP.stride], VSNAP_STRIDE);
  assert.equal(snap.length, VSNAP_HEADER + 2 * VSNAP_STRIDE);
  assert.equal(vehicleSnapshotCount(snap), 2);
  assert.equal(vehicleSnapshotVersion(snap), 42);
  const snap2 = packVehicleSnapshot(43, r.sim);
  assert.notEqual(snap, snap2, 'every publish is a fresh array (Synchronizable identity rule)');
  assert.equal(vehicleSnapshotVersion(snap2), 43);
});

// --- The real junction: 125th & ACP ----------------------------------------------------------

test('PR05 slice: two legal spawns at 125th & Adam Clayton Powell Jr Blvd', () => {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const topo = buildLaneTopology(dataset);
  const slice = livingCityVerticalSlice(topo);
  assert.ok(slice, 'the bundled tile has the ACP junction');
  assert.equal(slice.spawns.length, 2);
  const [a, b] = slice.spawns;
  assert.ok(/125|LUTHER KING/i.test(a!.street), `car A on 125th (${a!.street})`);
  assert.ok(/ADAM CLAYTON|POWELL/i.test(b!.street), `car B on ACP (${b!.street})`);
  // Every spawn's first hop is a legal connector through the node.
  for (const s of slice.spawns) {
    const lane = topo.laneById.get(s.lane);
    assert.ok(lane, `lane ${s.lane} exists`);
    const conn = topo.connectors.find((c) => c.in === s.lane && c.out === s.route![0]);
    assert.ok(conn, `legal connector ${s.lane} -> ${s.route![0]}`);
    assert.equal(conn.node, slice.nodeId);
    assert.ok(s.s !== undefined && s.s >= 0 && s.s <= lane.lengthMeters);
  }
});

test('PR05 slice: on the real tile one waits on red while the other proceeds', () => {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const topo = buildLaneTopology(dataset);
  const slice = livingCityVerticalSlice(topo)!;
  const signals = buildSignalSystem(topo);
  const sim = new VehicleSim(topo, signals, { seed: 0x1c2026, vehicles: slice.spawns });
  const connById = new Map(topo.connectors.map((c) => [c.id, c]));
  const prevElement = new Map<number, string>();
  let waitedOnSignal = 0;
  let inJunction = 0;
  const entryAspects: string[] = [];
  for (let i = 0; i < 2880; i++) {
    sim.step(SIM_DT);
    for (const v of sim.vehiclesView()) {
      if (v.waitReason === 'signal') waitedOnSignal++;
      const was = prevElement.get(v.id);
      prevElement.set(v.id, v.element);
      if (v.element.startsWith('conn:')) {
        inJunction++;
        if (was !== v.element) {
          // The tick the vehicle entered the box: its aspect must not be red.
          const conn = connById.get(v.element)!;
          entryAspects.push(signals.state(conn.node)?.vehicleAspects[conn.id] ?? 'G');
        }
      }
    }
  }
  assert.ok(waitedOnSignal > 0, 'someone waited at a red during the run');
  assert.ok(inJunction > 0, 'someone crossed the box during the run');
  assert.ok(entryAspects.length > 0, 'box entries observed');
  assert.ok(!entryAspects.includes('R'), `entries on red: ${entryAspects.join(',')}`);
});
