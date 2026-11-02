import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CityDatasetV3, CityRoad } from '../city-dataset.ts';
import { buildSignalSystem } from './signal-controller.ts';
import { LivingCityHost } from './sim-host.ts';
import { buildLaneTopology, type LaneTopology } from './topology.ts';
import { SIM_DT, cumulative, poseAlong, vehicleSnapshotCount, vehicleSnapshotVersion } from './vehicle-sim.ts';
import { pedSnapshotCount } from './ped-sim.ts';
import { readEnvSection } from './clock.ts';
import { envSectionOffset, signalRoster, signalSectionCount } from './signal-viz.ts';

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
  ]));
}

function host(seed = 5, vehicles = 0): LivingCityHost {
  const topology = crossTopology();
  const lane = topology.lanes[0]!;
  return new LivingCityHost({
    topology,
    signals: buildSignalSystem(topology),
    seed,
    vehicles: vehicles ? [{ lane: lane.id, s: 4 }] : [],
    now: (() => { let t = 0; return () => (t += 4); })(),
    maxFrameSeconds: 5,
  });
}

test('fixed-step accumulator: fractional frames floor to whole sim ticks', () => {
  const h = host();
  h.step(SIM_DT * 0.4);
  assert.equal(h.stats().ticksRun, 0, 'sub-tick frame runs nothing');
  h.step(SIM_DT * 0.7);
  assert.equal(h.stats().ticksRun, 1, 'accumulator carries the remainder');
  h.step(SIM_DT * 10);
  assert.equal(h.stats().ticksRun, 11);
});

test('one fresh packed snapshot per tick; version and count flow through', () => {
  const h = host(7, 1);
  const seen: number[][] = [];
  h.addSink((snap) => seen.push(snap));
  assert.equal(seen.length, 1, 'sink replays the latest snapshot on subscribe');
  h.step(SIM_DT);
  h.step(SIM_DT);
  h.step(SIM_DT);
  assert.equal(seen.length, 4);
  assert.equal(vehicleSnapshotCount(seen[0]!), 0, 'replay is the pre-tick empty snapshot');
  assert.ok(seen.slice(1).every((s) => vehicleSnapshotCount(s) === 1));
  assert.equal(vehicleSnapshotVersion(seen[3]!), 3);
  const distinct = new Set(seen);
  assert.equal(distinct.size, seen.length, 'every publish is a fresh array (Synchronizable rule)');
  // The sink received the exact published array — not a copy: identity is the protocol.
  assert.equal(h.latestSnapshot(), seen[3]);
});

test('attach/detach ref-counts the ticker; the sim clock keeps state while parked', () => {
  const topo = crossTopology();
  let pending: (() => void) | null = null;
  let now = 0;
  const manual = new LivingCityHost({
    topology: topo,
    signals: buildSignalSystem(topo),
    seed: 1,
    now: () => (now += 50),
    schedule: (cb) => {
      pending = cb;
      return 1;
    },
    cancel: () => {
      pending = null;
    },
  });
  manual.attach();
  manual.attach();
  assert.equal(manual.stats().consumers, 2);
  assert.ok(manual.stats().running);
  const fire = () => {
    assert.ok(pending, 'a frame is armed');
    pending();
  };
  assert.ok(pending, 'one pending frame');
  fire(); // first frame has dt = 0
  fire(); // second frame: +50 ms → at least one 24 Hz tick
  assert.ok(manual.stats().ticksRun >= 1);
  manual.detach();
  assert.ok(manual.stats().running, 'still ticking for the second consumer');
  manual.detach();
  assert.equal(manual.stats().running, false, 'ticker parks when the last consumer leaves');
  assert.equal(pending, null, 'no frame left armed');
  const ticks = manual.stats().ticksRun;
  manual.attach();
  fire();
  fire();
  assert.ok(manual.stats().ticksRun > ticks, 'resume keeps sim state, never re-seeds');
  manual.stop();
});

// --- PR06: the pedestrian crowd rides the same publish --------------------------------------

test('combined snapshot: the ped section rides the same publish, host stats report the crowd', () => {
  const topology = crossTopology();
  const band = topology.walks[0]!;
  const h = new LivingCityHost({
    topology,
    signals: buildSignalSystem(topology),
    seed: 5,
    vehicles: [],
    peds: { seed: 5, peds: [{ kind: 'adult', walk: band.id, s: 2 }] },
    now: (() => { let t = 0; return () => (t += 4); })(),
    maxFrameSeconds: 5,
  });
  const seen: number[][] = [];
  h.addSink((snap) => seen.push(snap));
  assert.equal(pedSnapshotCount(seen[0]!), 0, 'the pre-tick replay carries an empty ped section');
  h.step(SIM_DT);
  h.step(SIM_DT);
  assert.equal(pedSnapshotCount(seen[2]!), 1, 'the crowd travels inside the same snapshot array');
  const stats = h.stats();
  assert.equal(stats.pedestrians, 1);
  assert.ok(stats.lastPedTickMs >= 0, 'ped tick cost is metered');
});

test('host determinism: equal seeds and equal step streams pack identical combined snapshots', () => {
  const mk = () => {
    const topology = crossTopology();
    const band = topology.walks[0]!;
    return new LivingCityHost({
      topology,
      signals: buildSignalSystem(topology),
      seed: 9,
      vehicles: [{ lane: topology.lanes[0]!.id, s: 4 }],
      peds: { seed: 9, peds: [{ kind: 'adult', walk: band.id, s: 2 }, { kind: 'kid', walk: band.id, s: 5 }] },
      now: (() => { let t = 0; return () => (t += 4); })(),
      maxFrameSeconds: 5,
    });
  };
  const a = mk();
  const b = mk();
  for (let i = 0; i < 240; i++) {
    a.step(SIM_DT);
    b.step(SIM_DT);
  }
  assert.deepEqual(a.latestSnapshot(), b.latestSnapshot(), 'same seed + same frames → identical world state');
});

// --- The Caller channel: the host feeds the live position into the vehicle sim ------------

test('caller channel: the injected getter feeds the sim each frame, null closes it', () => {
  const topology = crossTopology();
  const lane = topology.lanes[0]!;
  const { cum, length } = cumulative(lane.points);
  const pose = { x: 0, z: 0, yaw: 0 };
  poseAlong({ points: lane.points, cum, length }, 24, pose);
  let callerPos: { x: number; z: number } | null = { x: pose.x, z: pose.z };
  let pending: (() => void) | null = null;
  let now = 0;
  const h = new LivingCityHost({
    topology,
    signals: buildSignalSystem(topology),
    seed: 3,
    vehicles: [{ lane: lane.id, s: 4, speed: 6 }],
    caller: () => callerPos,
    now: () => (now += 50),
    schedule: (cb) => {
      pending = cb;
      return 1;
    },
    cancel: () => {
      pending = null;
    },
  });
  h.attach();
  const fire = () => {
    assert.ok(pending, 'a frame is armed');
    pending();
  };
  for (let i = 0; i < 240; i++) fire();
  const held = h.sim.vehicleView(1)!;
  assert.ok(held.speed < 0.1, `traffic held for the Caller (v=${held.speed.toFixed(2)})`);
  assert.ok(held.s < 24 - 1.0, `held behind the Caller's spot (s=${held.s.toFixed(2)})`);
  callerPos = null;
  for (let i = 0; i < 240; i++) fire();
  assert.ok((h.sim.vehicleView(1)?.s ?? 0) > 24 || h.sim.vehicleView(1)?.element !== lane.id, 'traffic resumed once unspawned');
  h.stop();
});

// --- PR07: signal + env sections ride the same publish --------------------------------

test('world snapshot: the signal and env sections append behind the ped section', () => {
  const topology = crossTopology();
  const signals = buildSignalSystem(topology);
  const h = new LivingCityHost({
    topology,
    signals,
    seed: 5,
    vehicles: [],
    timeOfDayHours: 20.0,
    now: (() => { let t = 0; return () => (t += 4); })(),
    maxFrameSeconds: 5,
  });
  h.step(SIM_DT);
  const snap = h.latestSnapshot();
  assert.equal(signalSectionCount(snap), signalRoster(signals).length, 'every roster element is packed');
  const env = readEnvSection(snap, envSectionOffset(snap), 0);
  assert.ok(Math.abs(env.hour - 20.0) < 0.01, `the env carries the clock (got ${env.hour})`);
  assert.ok(env.lampLevel > 0.5, 'a 20:00 start has the lamps up');
  assert.equal(env.headlights, 1, 'a 20:00 start wants headlights');
  // The earlier sections are untouched: header fields and the ped count decode as before.
  assert.equal(vehicleSnapshotVersion(snap), 1);
  assert.equal(pedSnapshotCount(snap), 0);
});
