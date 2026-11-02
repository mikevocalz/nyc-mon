// Buses ride the bus routes. The tile carries no route records; topology.ts
// marks every primary-road lane `busRoute` (the avenues and crosstown streets
// the MTA's local routes use in this part of Manhattan), and with `busTarget`
// set the vehicle sim keeps that many buses on them: they spawn on a route
// lane and turn onto route lanes where the junction offers one.
//
// Before (2026-10-28, default seed, 10 min at the Apollo spawn): a bus was
// drawn 856 vehicle-seconds, 62 of them within 150 m of the camera and 6-14 %
// of the time on a primary road; on seed 1 none came within 150 m in ten
// minutes. Buses spawned as a 10 % share on any lane at least 130 m out.
// After: 1,195 bus-seconds, all on a route, 187 within 150 m (seed 1: 270).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { INITIAL_CITY_CAMERA } from '../city-camera.ts';
import { parseCityDataset } from '../city-dataset.ts';
import { LIVING_CITY_CAPS } from '../perf/tier.ts';
import { buildSignalSystem } from './signal-controller.ts';
import { LivingCityHost } from './sim-host.ts';
import { buildLaneTopology } from './topology.ts';
import { livingCityVerticalSlice } from './vertical-slice.ts';

const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
const topology = buildLaneTopology(dataset);
const signals = buildSignalSystem(topology);

test('primary-road lanes, and only those, are bus routes', () => {
  const classOf = new Map(dataset.roads.map((r) => [r.id, r.class]));
  let routes = 0;
  for (const lane of topology.lanes) {
    assert.equal(lane.busRoute === true, classOf.get(lane.roadId) === 'primary', lane.id);
    if (lane.busRoute) routes++;
  }
  assert.ok(routes > 100, `${routes} route lanes`);
});

test('with busTarget the sim keeps its buses on the routes and brings them past the camera', () => {
  const focus = { x: INITIAL_CITY_CAMERA.x, z: INITIAL_CITY_CAMERA.z };
  const laneOf = new Map(topology.lanes.map((l) => [l.id, l]));
  for (const seed of [0x1c2026, 1]) {
    const host = new LivingCityHost({
      topology, signals, seed, targetVehicles: LIVING_CITY_CAPS.high.vehicles, busTarget: LIVING_CITY_CAPS.high.buses,
      vehicles: livingCityVerticalSlice(topology)?.spawns ?? [], now: () => 0, schedule: () => 0, cancel: () => {},
    });
    let busSeconds = 0; let onRoute = 0; let near = 0; let peak = 0;
    for (let t = 0; t < 6000; t++) {
      host.sim.setFocus(focus.x, focus.z);
      host.step(0.1);
      if (t % 10 !== 0) continue;
      let buses = 0;
      for (const v of host.sim.vehiclesView()) {
        if (v.kind !== 'bus') continue;
        buses++;
        busSeconds++;
        if (laneOf.get(v.element)?.busRoute) onRoute++;
        else if (v.element.startsWith('lane:') === false) onRoute++; // inside a junction between two route lanes
        if (Math.hypot(v.x - focus.x, v.z - focus.z) < 150) near++;
      }
      peak = Math.max(peak, buses);
    }
    assert.ok(peak >= 1 && peak <= LIVING_CITY_CAPS.high.buses, `seed ${seed}: peak buses ${peak}`);
    assert.ok(busSeconds > 900, `seed ${seed}: ${busSeconds} bus-seconds in 10 min`);
    assert.ok(onRoute / busSeconds > 0.9, `seed ${seed}: ${((onRoute / busSeconds) * 100).toFixed(0)} % of bus time on a route`);
    assert.ok(near > 120, `seed ${seed}: ${near} bus-seconds within 150 m of the camera`);
  }
});
