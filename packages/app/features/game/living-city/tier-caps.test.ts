// PR09 — Living City actor-tier caps: the host/sim half of the tier
// system (the table itself lives in perf/tier.ts; its tests pin the
// 'high' row against the authored PR05–07 counts). These tests prove the
// runtime half: setTargetVehicles/setTargetPeds retire ambient actors
// gracefully — farthest from focus first, never scripted slice spawns,
// never a mid-screen pop (the cull waits for the anti-pop radius).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CityDatasetV3, CityRoad } from '../city-dataset.ts';
import { buildSignalSystem } from './signal-controller.ts';
import { LivingCityHost } from './sim-host.ts';
import { buildLaneTopology, type LaneTopology } from './topology.ts';
import { SIM_DT, VehicleSim } from './vehicle-sim.ts';
import { PedSim } from './ped-sim.ts';
import { PED_BOX_CAP, SIGNAL_HEAD_CAP } from './signal-viz.ts';
import { LIVING_CITY_CAPS } from '../perf/tier.ts';

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

/** The signalized four-way the vehicle/ped tests share — crossing legs become xwalks. */
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

const step = (sim: { step(dt: number): void }, seconds: number) => {
  for (let t = 0; t < seconds; t += SIM_DT) sim.step(SIM_DT);
};

test('PR09 caps: the high row is byte-identical to the authored PR05–07 defaults', () => {
  const high = LIVING_CITY_CAPS.high;
  // The authored ambient populations (bundled-host.ts LIVING_CITY_AMBIENT
  // / LIVING_CITY_PED_AMBIENT) and the signal-viz near-field caps.
  assert.equal(high.vehicles, 12);
  assert.equal(high.peds, 16);
  assert.equal(high.signalHeadCap, SIGNAL_HEAD_CAP);
  assert.equal(high.pedBoxCap, PED_BOX_CAP);
  assert.equal(high.lampGlow, true);
});

test('PR09: setTargetVehicles retires ambient vehicles only — scripted spawns survive', () => {
  const topo = crossTopology();
  const scriptedLane = topo.lanes[0]!;
  const sim = new VehicleSim(topo, buildSignalSystem(topo), {
    seed: 9,
    // holdUntil parks the scripted car — it must outlive the whole run so
    // the cull assertion isn't racing a route exhaust at a tile edge.
    vehicles: [{ lane: scriptedLane.id, s: 4, holdUntil: 1e9 }],
    targetVehicles: 6,
  });
  // No focus → ambient spawns land anywhere, and the retiring cull is
  // immediate (nothing renders to pop).
  step(sim, 12);
  const grown = sim.vehiclesView().length;
  assert.ok(grown >= 3, `ambient fleet grew (${grown})`);
  assert.ok(grown <= 6);

  sim.setTargetVehicles(1);
  step(sim, 1); // one spawner pass (0.4 s cadence) is enough
  const left = sim.vehiclesView();
  assert.equal(left.length, 1, 'the scripted vehicle is the only survivor');
  assert.equal(left[0]!.id, 1, 'spawn order: the scripted car was first');
});

test('PR09: setTargetVehicles never retires below the scripted fleet', () => {
  const topo = crossTopology();
  const scriptedLane = topo.lanes[0]!;
  const sim = new VehicleSim(topo, buildSignalSystem(topo), {
    seed: 11,
    vehicles: [
      { lane: scriptedLane.id, s: 4, holdUntil: 1e9 },
      { lane: topo.lanes[2]!.id, s: 4, holdUntil: 1e9 },
    ],
    targetVehicles: 5,
  });
  step(sim, 10);
  assert.ok(sim.vehiclesView().length >= 3);
  sim.setTargetVehicles(0);
  step(sim, 1);
  assert.equal(sim.vehiclesView().length, 2, 'both scripted cars stay — caps cannot kill the scenario');
});

test('PR09: raising the target clears the retirement marks — nothing is culled', () => {
  const topo = crossTopology();
  const sim = new VehicleSim(topo, buildSignalSystem(topo), { seed: 13, targetVehicles: 6 });
  step(sim, 12);
  const grown = sim.vehiclesView().length;
  assert.ok(grown >= 3);
  sim.setTargetVehicles(2);
  sim.setTargetVehicles(6); // reverse before the next spawner pass
  step(sim, 1);
  assert.ok(sim.vehiclesView().length >= grown, `fleet kept (${sim.vehiclesView().length} >= ${grown})`);
});

test('PR09: setTargetPeds retires ambient peds only — scripted slice survives', () => {
  const topo = crossTopology();
  const band = topo.walks.find((w) => w.nodeA !== w.nodeB)!;
  const sim = new PedSim(topo, buildSignalSystem(topo), {
    seed: 9,
    peds: [{ walk: band.id, s: 3, plan: 'wander' }],
    targetPeds: 5,
  });
  step(sim, 15); // ped spawn cadence is 0.8 s
  const grown = sim.pedestriansView().length;
  assert.ok(grown >= 2, `ambient crowd grew (${grown})`);

  sim.setTargetPeds(1);
  step(sim, 1);
  const left = sim.pedestriansView();
  assert.equal(left.length, 1, 'the scripted ped is the only survivor');
  assert.equal(left[0]!.id, 1);
});

test('PR09: the host applies both caps through one call', () => {
  const topo = crossTopology();
  const host = new LivingCityHost({
    topology: topo,
    signals: buildSignalSystem(topo),
    seed: 5,
    vehicles: [{ lane: topo.lanes[0]!.id, s: 4, holdUntil: 1e9 }],
    peds: { peds: [{ walk: topo.walks.find((w) => w.nodeA !== w.nodeB)!.id, s: 3 }], targetPeds: 5 },
    targetVehicles: 5,
    now: (() => { let t = 0; return () => (t += 4); })(),
  });
  step(host, 12);
  assert.ok(host.stats().pedestrians >= 2);
  host.setPopulationCaps({ vehicles: 1, peds: 1 });
  step(host, 2);
  assert.equal(host.stats().vehicles, 1, 'vehicle cap applied');
  assert.equal(host.stats().pedestrians, 1, 'ped cap applied');
});
