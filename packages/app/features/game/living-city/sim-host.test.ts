import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CityDatasetV3, CityRoad } from '../city-dataset.ts';
import { buildSignalSystem } from './signal-controller.ts';
import { LivingCityHost } from './sim-host.ts';
import { buildLaneTopology, type LaneTopology } from './topology.ts';
import { SIM_DT, vehicleSnapshotCount, vehicleSnapshotVersion } from './vehicle-sim.ts';

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
