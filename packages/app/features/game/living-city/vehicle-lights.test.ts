import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CityDatasetV3, CityRoad } from '../city-dataset.ts';
import { buildSignalSystem, type SignalSystem } from './signal-controller.ts';
import { buildLaneTopology, type LaneTopology } from './topology.ts';
import {
  LIGHT_SLOTS_PER_VEHICLE,
  VLIGHT,
  indicatorBlink,
  vehicleLightKeys,
} from './vehicle-actor.ts';
import {
  SIM_DT,
  VFLAG,
  VSNAP_HEADER,
  VSNAP_STRIDE,
  VehicleSim,
  packVehicleSnapshot,
} from './vehicle-sim.ts';

// --- Fixture: the signalized four-way (same tile as the sim tests) --------------------

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

function rig(seed = 5): { topo: LaneTopology; signals: SignalSystem; sim: VehicleSim } {
  const topo = crossTopology();
  const signals = buildSignalSystem(topo);
  return { topo, signals, sim: new VehicleSim(topo, signals, { seed }) };
}

const flagsOf = (snap: readonly number[], i = 0) => snap[VSNAP_HEADER + i * VSNAP_STRIDE + 9] ?? 0;

const run = (sim: VehicleSim, ticks: number) => {
  for (let i = 0; i < ticks; i++) sim.step(SIM_DT);
};

// --- The env → headlight bit ----------------------------------------------------------

test('headlight bit: the world env stamps VFLAG.headlights, never behaviour', () => {
  const { topo, sim } = rig();
  const lane = topo.lanes.find((l) => !l.internal && l.lengthMeters >= 40)!;
  sim.spawn({ lane: lane.id, s: 4 });
  sim.setEnvironment({ headlights: false, rain: 0 });
  run(sim, 4);
  const day = packVehicleSnapshot(1, sim);
  assert.equal(flagsOf(day) & VFLAG.headlights, 0, 'day flags carry no headlight bit');
  sim.setEnvironment({ headlights: true, rain: 0 });
  run(sim, 4);
  const night = packVehicleSnapshot(2, sim);
  assert.notEqual(flagsOf(night) & VFLAG.headlights, 0, 'night flags carry the headlight bit');
  // The env touches the flag byte only — same tick stream, same motion.
  sim.setEnvironment({ headlights: false, rain: 0 });
  run(sim, 4);
  const again = packVehicleSnapshot(3, sim);
  assert.equal(flagsOf(again) & VFLAG.headlights, 0);
});

// --- Brake bit on deceleration ---------------------------------------------------------

test('brake bit: a vehicle braking for a held red stamps VFLAG.braking', () => {
  const { topo, signals, sim } = rig();
  const node = topo.nodes.find((n) => n.kind === 'junction')!;
  // Find an approach whose through connector currently reads red.
  let approach = null;
  for (let tick = 0; tick < 24 * 40 && !approach; tick++) {
    for (const lane of topo.lanesTo.get(node.id) ?? []) {
      const conn = topo.connectors.find((c) => c.in === lane.id && c.turn === 'through');
      if (conn && signals.state(node.id)?.vehicleAspects[conn.id] === 'R') {
        approach = { lane, conn };
        break;
      }
    }
    if (!approach) signals.step(1 / 24);
  }
  assert.ok(approach, 'one approach is held red inside a cycle');
  const lane = approach!.lane;
  sim.spawn({ lane: lane.id, s: Math.max(2, lane.lengthMeters - 24) });
  // It must brake to the stop line and then sit — the flag shows on the packed byte.
  let sawBraking = false;
  for (let i = 0; i < 240; i++) {
    sim.step(SIM_DT);
    const snap = packVehicleSnapshot(i, sim);
    if (snap.length > VSNAP_HEADER && (flagsOf(snap) & VFLAG.braking) !== 0) sawBraking = true;
    if (sawBraking && i > 40) break;
  }
  assert.ok(sawBraking, 'a held approach brakes somewhere in the window');
});

// --- Turn-signal bits on turn intent ------------------------------------------------------

test('turn bits: a committed left stamps blinkLeft, a right stamps blinkRight', () => {
  const { topo, sim } = rig();
  const node = topo.nodes.find((n) => n.kind === 'junction')!;
  const inbound = (topo.lanesTo.get(node.id) ?? []).filter((l) => !l.internal);
  const leftConn = topo.connectors.find((c) => c.turn === 'left' && inbound.some((l) => l.id === c.in));
  const rightConn = topo.connectors.find((c) => c.turn === 'right' && inbound.some((l) => l.id === c.in));
  assert.ok(leftConn && rightConn, 'the four-way offers a left and a right');
  sim.spawn({ lane: leftConn!.in, s: 2, route: [leftConn!.out] });
  sim.spawn({ lane: rightConn!.in, s: 2, route: [rightConn!.out] });
  let sawLeft = false;
  let sawRight = false;
  for (let i = 0; i < 300 && !(sawLeft && sawRight); i++) {
    sim.step(SIM_DT);
    const snap = packVehicleSnapshot(i, sim);
    const count = snap[3] ?? 0;
    for (let k = 0; k < count; k++) {
      const f = flagsOf(snap, k);
      if ((f & VFLAG.blinkLeft) !== 0) sawLeft = true;
      if ((f & VFLAG.blinkRight) !== 0) sawRight = true;
    }
  }
  assert.ok(sawLeft, 'the left-bound vehicle signals left on the packed byte');
  assert.ok(sawRight, 'the right-bound vehicle signals right on the packed byte');
});

// --- The colour mapping ---------------------------------------------------------------

test('vehicleLightKeys: the flag byte picks the lamp colours, indicators gate on the blink parity', () => {
  const off = vehicleLightKeys(0, true);
  assert.ok(off.every((k) => k === 'off'), 'day, free-flowing: every quad dark');
  const night = vehicleLightKeys(VFLAG.headlights, true);
  assert.equal(night[VLIGHT.headL], 'head');
  assert.equal(night[VLIGHT.headR], 'head');
  assert.equal(night[VLIGHT.tailL], 'tail', 'taillights ride the headlight bit');
  const braking = vehicleLightKeys(VFLAG.headlights | VFLAG.braking, true);
  assert.equal(braking[VLIGHT.tailL], 'brake', 'braking overrides the dim tail');
  const leftOn = vehicleLightKeys(VFLAG.blinkLeft, true);
  assert.equal(leftOn[VLIGHT.indFL], 'amber');
  assert.equal(leftOn[VLIGHT.indRL], 'amber');
  assert.equal(leftOn[VLIGHT.indFR], 'off');
  const leftOff = vehicleLightKeys(VFLAG.blinkLeft, false);
  assert.equal(leftOff[VLIGHT.indFL], 'off', 'the blink parity gates the flash');
  const rightOn = vehicleLightKeys(VFLAG.blinkRight, true);
  assert.equal(rightOn[VLIGHT.indFR], 'amber');
  assert.equal(rightOn[VLIGHT.indRR], 'amber');
  // Eight slots, all covered.
  assert.equal(vehicleLightKeys(0, true).length, LIGHT_SLOTS_PER_VEHICLE);
});

test('indicatorBlink: deterministic on simTime and actually flashes', () => {
  const parities = new Set<number>();
  for (let t = 0; t < 2; t += 0.05) parities.add(indicatorBlink(t) ? 1 : 0);
  assert.equal(parities.size, 2, 'the indicator parity flips within two sim seconds');
  assert.equal(indicatorBlink(1.2), indicatorBlink(1.2), 'pure on the sim clock');
});
