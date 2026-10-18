import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseCityDataset, type CityDatasetV3, type CityRoad } from '../city-dataset.ts';
import { buildSignalSystem, type SignalSystem } from './signal-controller.ts';
import { buildLaneTopology, type LaneConnector, type LaneTopology } from './topology.ts';
import {
  PED_KINDS,
  PFLAG,
  PSNAP,
  PSNAP_HEADER,
  PSNAP_STRIDE,
  PedSim,
  emptyPedSection,
  interpolatePedPose,
  packActorSnapshot,
  packPedSection,
  pedSectionOffset,
  pedSnapshotCount,
  type PedView,
} from './ped-sim.ts';
import {
  SIM_DT,
  VSNAP_HEADER,
  VSNAP_STRIDE,
  VehicleSim,
  packVehicleSnapshot,
  vehicleSnapshotCount,
} from './vehicle-sim.ts';
import { livingCityPedSlice } from './vertical-slice.ts';

// --- Fixtures -------------------------------------------------------------------------

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

/** The same signalized four-way the vehicle tests use — crossing legs become xwalks. */
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

function realTile(): { topo: LaneTopology; signals: SignalSystem } {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const topo = buildLaneTopology(dataset);
  return { topo, signals: buildSignalSystem(topo) };
}

const run = (sim: PedSim, seconds: number, each?: (tick: number) => void) => {
  const ticks = Math.round(seconds / SIM_DT);
  for (let i = 0; i < ticks; i++) {
    sim.step(SIM_DT);
    each?.(i);
  }
};

/** Minimum pairwise pedestrian distance over a step call. */
function minPair(rows: readonly PedView[]): number {
  let m = Infinity;
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      m = Math.min(m, Math.hypot(rows[i]!.x - rows[j]!.x, rows[i]!.z - rows[j]!.z));
    }
  }
  return m;
}

/** Count state transitions into/out of 'cross' and into 'wait' over the run. */
function transitionTracker() {
  const prev = new Map<number, string>();
  const counts = { entries: 0, completions: 0, waitEntries: 0 };
  return {
    counts,
    observe(rows: readonly PedView[]) {
      for (const p of rows) {
        const was = prev.get(p.id);
        if (was !== p.state) {
          if (p.state === 'cross') counts.entries++;
          if (was === 'cross' && p.state !== 'cross') counts.completions++;
          if (p.state === 'wait') counts.waitEntries++;
          prev.set(p.id, p.state);
        }
      }
    },
  };
}

// --- The PR06 headline: six peds on opposite kerbs of a real ACP zebra --------------------

test('ped slice: six spawns on two kerbs of one real OSM zebra at 125th & ACP', () => {
  const { topo } = realTile();
  const slice = livingCityPedSlice(topo);
  assert.ok(slice, 'the bundled tile has the ACP junction');
  assert.equal(slice!.spawns.length, 6);
  const xwalk = topo.xwalks.find((x) => x.id === slice!.xwalk)!;
  assert.ok(xwalk, 'slice xwalk exists');
  assert.equal(xwalk.node, slice!.nodeId);
  assert.equal(xwalk.backing, 'osm-crossing', 'a real OSM zebra leg, not a synthetic fallback');
  const sides = new Set(slice!.spawns.map((s) => s.side));
  assert.deepEqual([...sides].sort(), ['a', 'b'], 'three per side');
  assert.equal(slice!.spawns.filter((s) => s.side === 'a').length, 3);
  const bands = new Set(slice!.spawns.map((s) => s.walk));
  assert.equal(bands.size, 2, 'the two opposing kerb bands');
  for (const s of slice!.spawns) {
    assert.equal(s.plan, 'loop');
    assert.equal(s.xwalk, slice!.xwalk);
    assert.ok(s.walk.startsWith('walk:'), `spawn on a walk band: ${s.walk}`);
  }
});

test('six-ped slice: wait on the kerb, enter on WALK, finish, wait again — without collisions or stalls', () => {
  const { topo, signals } = realTile();
  const slice = livingCityPedSlice(topo)!;
  const sim = new PedSim(topo, signals, { seed: 7, peds: slice.spawns, advanceSignals: true });
  const tracker = transitionTracker();
  let minDist = Infinity;
  let longestCross = 0;
  const crossSince = new Map<number, number>();
  const entryAspects: string[] = [];
  const waitsAfterFirstCross = new Set<number>();
  const crossed = new Set<number>();
  run(sim, 300, (tick) => {
    const rows = sim.pedestriansView();
    const st = signals.state(slice.nodeId);
    for (const p of rows) {
      const since = crossSince.get(p.id);
      if (p.state === 'cross') {
        if (since === undefined) {
          crossSince.set(p.id, tick);
          // WALK-gating: the tick a ped steps onto the zebra its aspect is W.
          entryAspects.push(st?.pedAspects[slice.xwalk] ?? '?');
        } else {
          longestCross = Math.max(longestCross, (tick - since) * SIM_DT);
        }
      } else {
        crossSince.delete(p.id);
      }
      if (p.state === 'wait' && crossed.has(p.id)) waitsAfterFirstCross.add(p.id);
      if (p.state === 'cross') crossed.add(p.id);
    }
    tracker.observe(rows);
    minDist = Math.min(minDist, minPair(rows));
  });
  assert.ok(tracker.counts.entries >= 6, `all six entered the zebra (${tracker.counts.entries} entries)`);
  assert.ok(tracker.counts.completions >= 6, `all six finished at least one crossing (${tracker.counts.completions})`);
  assert.ok(waitsAfterFirstCross.size >= 6, `every ped queued at a kerb again after crossing (${waitsAfterFirstCross.size})`);
  assert.ok(tracker.counts.entries >= 10, 'the ping-pong loop repeats across signal cycles');
  assert.ok(entryAspects.length > 0 && entryAspects.every((a) => a === 'W'), `entries only on WALK (saw ${entryAspects.join(',')})`);
  assert.ok(minDist >= 0.28, `pairwise separation held (min ${minDist.toFixed(3)} m)`);
  assert.ok(longestCross < 60, `no crossing stalled on the zebra (longest ${longestCross.toFixed(1)} s)`);
});

test('six-ped slice survives seed changes: every seed cycles without merging peds', () => {
  const { topo, signals } = realTile();
  const slice = livingCityPedSlice(topo)!;
  for (const seed of [1, 13, 42]) {
    const sim = new PedSim(topo, signals, { seed, peds: slice.spawns, advanceSignals: true });
    const tracker = transitionTracker();
    let minDist = Infinity;
    run(sim, 300, () => {
      const rows = sim.pedestriansView();
      tracker.observe(rows);
      minDist = Math.min(minDist, minPair(rows));
    });
    assert.ok(tracker.counts.completions >= 6, `seed ${seed}: all six completed (${tracker.counts.completions})`);
    assert.ok(minDist >= 0.28, `seed ${seed}: min pair distance ${minDist.toFixed(3)}`);
  }
});

// --- WALK-gating and claims --------------------------------------------------------------

test('kerb claims: a held ped claim keeps conflicting traffic out, and releases when the ped clears', () => {
  const { topo, signals } = realTile();
  const slice = livingCityPedSlice(topo)!;
  const sim = new PedSim(topo, signals, { seed: 5, peds: slice.spawns, advanceSignals: true });
  const controller = signals.controllerForElement(slice.xwalk)!;
  assert.ok(controller, 'the slice xwalk is signalized');
  let sawHeldClaimWhileCrossing = 0;
  let crossingWithoutClaim = 0;
  let claimsSeen = 0;
  run(sim, 240, () => {
    const rows = sim.pedestriansView();
    const holders = controller.solver.holdersOf(slice.xwalk);
    if (holders.length > 0) claimsSeen++;
    for (const p of rows) {
      if (p.state === 'cross') {
        if (holders.some((e) => e === `ped:${p.id}`)) sawHeldClaimWhileCrossing++;
        else crossingWithoutClaim++;
      }
    }
  });
  assert.ok(claimsSeen > 0, 'ped claims were held at some point in the run');
  assert.ok(sawHeldClaimWhileCrossing > 0, 'crossing peds hold their claim on the zebra');
  assert.equal(crossingWithoutClaim, 0, 'a mid-zebra ped never lost its claim (FDW keeps it)');
});

test('WALK-gating on the synthetic cross: no ped steps off the kerb while the aspect is not W', () => {
  const topo = crossTopology();
  const signals = buildSignalSystem(topo);
  const node = topo.nodes.find((n) => n.kind === 'junction')!;
  const xwalk = topo.xwalks.find((x) => x.node === node.id && x.walks[0] !== null && x.walks[1] !== null);
  assert.ok(xwalk, 'fixture has a two-kerbed crosswalk');
  const sim = new PedSim(topo, signals, {
    seed: 3,
    advanceSignals: true,
    peds: [
      { kind: 'adult', walk: xwalk!.walks[0]!, s: 6, plan: 'loop', xwalk: xwalk!.id },
      { kind: 'kid', walk: xwalk!.walks[1]!, s: 6, plan: 'loop', xwalk: xwalk!.id },
    ],
  });
  const tracker = transitionTracker();
  const entryAspects: string[] = [];
  const prev = new Map<number, string>();
  run(sim, 200, () => {
    const rows = sim.pedestriansView();
    const st = signals.state(node.id);
    for (const p of rows) {
      const was = prev.get(p.id);
      if (p.state === 'cross' && was !== 'cross') entryAspects.push(st?.pedAspects[xwalk!.id] ?? '?');
      prev.set(p.id, p.state);
    }
    tracker.observe(rows);
  });
  assert.ok(tracker.counts.entries >= 2, 'both loop peds crossed at least once');
  assert.ok(entryAspects.every((a) => a === 'W'), `all entries were on WALK (${entryAspects.join(',')})`);
});

// --- Vehicle yield: a held ped claim blocks a conflicting connector ------------------------

test('vehicle yield: a conflicting connector cannot be entered while a ped claim is held', () => {
  const topo = crossTopology();
  const signals = buildSignalSystem(topo);
  const node = topo.nodes.find((n) => n.kind === 'junction')!;
  // The signal-controller tests pin cw-s ↔ the W-approach right turn onto ns-s.
  const cwS = topo.xwalks.find((x) => x.id.endsWith('cw-s') || x.id.includes('cw-s'));
  assert.ok(cwS, 'south crosswalk exists');
  const wApproach = (topo.lanesTo.get(node.id) ?? []).find((l) => l.roadId === 'ew-w')!;
  const right = topo.connectors.find((c: LaneConnector) => c.in === wApproach.id && c.turn === 'right');
  assert.ok(right, 'the W approach has a right-turn connector');
  assert.ok(signals.conflicts(right!.id, cwS!.id), 'right turn conflicts with the south crosswalk');
  const veh = new VehicleSim(topo, signals, { seed: 9, vehicles: [{ kind: 'sedan', lane: wApproach.id, s: wApproach.lengthMeters - 30, route: [right!.out] }] });
  const peds = new PedSim(topo, signals, {
    seed: 2,
    peds: cwS!.walks[0] && cwS!.walks[1]
      ? [{ kind: 'adult', walk: cwS!.walks[0]!, s: 4, plan: 'loop', xwalk: cwS!.id }]
      : [],
  });
  const controller = signals.controllerForElement(cwS!.id)!;
  let enteredWhileHeld = 0;
  let heldTicks = 0;
  let entered = 0;
  const ticks = Math.round(280 / SIM_DT);
  for (let i = 0; i < ticks; i++) {
    veh.step(SIM_DT);
    peds.step(SIM_DT);
    // Only HELD claims block a conflicting movement — queued requests are
    // demand, not occupancy, and a queued ped behind a held car correctly
    // lets the car finish its turn first.
    const held = controller.solver.holdersOf(cwS!.id).length > 0;
    if (held) heldTicks++;
    const v = veh.vehicleView(1);
    if (v && v.element === right!.id) {
      entered++;
      if (held) enteredWhileHeld++;
    }
  }
  assert.ok(heldTicks > 0, 'the looping ped held its crosswalk claim at times');
  assert.equal(enteredWhileHeld, 0, 'the turning vehicle was never inside the conflicting connector while a ped claim was held');
  assert.ok(entered > 0, 'the vehicle did complete the turn when the zebra was clear');
});

// --- Corner links, obstacles, determinism --------------------------------------------------

test('wander peds use corner links between different streets and never appear on carriageway', () => {
  const topo = crossTopology();
  const signals = buildSignalSystem(topo);
  // A long straight band to stroll on: ew-w's south sidewalk.
  const band = topo.walks.find((w) => w.roadId === 'ew-w');
  assert.ok(band, 'fixture has a walk band');
  const sim = new PedSim(topo, signals, {
    seed: 11,
    advanceSignals: true,
    peds: [
      { kind: 'adult', walk: band!.id, s: 2, dir: 1, plan: 'wander' },
      { kind: 'adult', walk: band!.id, s: 4, dir: 1, plan: 'wander' },
    ],
  });
  let sawCorner = 0;
  const cornerIds = new Set<string>();
  run(sim, 120, () => {
    for (const p of sim.pedestriansView()) {
      assert.ok(
        p.element.startsWith('walk:') || p.element.startsWith('xwalk:') || p.element.startsWith('corner:'),
        `ped ${p.id} on a walkable element (${p.element})`,
      );
      if (p.element.startsWith('corner:')) {
        sawCorner++;
        cornerIds.add(p.element);
      }
    }
  });
  // Corner hops are weight-3 favourites at band ends — a 120 s wander must take some.
  assert.ok(sawCorner > 0, 'peds hopped corners while wandering');
});

test('obstacle on the corridor: a ped steers around it and keeps walking', () => {
  const topo = crossTopology();
  const signals = buildSignalSystem(topo);
  const band = topo.walks.find((w) => w.roadId === 'ew-w')!;
  // The ped hugs keep-right (~+lat, toward the street side). Put a hydrant
  // on that lateral line 8 m ahead of the spawn: on ew-w's south-walking
  // band (+x travel) +lat is +z, so the obstacle sits ~0.7 m toward the
  // kerb from the axis at z=-7.5.
  const ox = -30;
  const oz = band.points[1]! + 0.7;
  const sim = new PedSim(topo, signals, {
    seed: 1,
    peds: [{ kind: 'adult', walk: band.id, s: 2, dir: 1, plan: 'wander' }],
    obstacles: [ox, oz],
  });
  let obstructed = 0;
  let passedObstacle = false;
  run(sim, 60, () => {
    for (const p of sim.pedestriansView()) {
      if (p.flags & PFLAG.obstructed) obstructed++;
      if (p.element === band.id && p.s > 40) passedObstacle = true;
    }
  });
  assert.ok(obstructed > 0, 'the obstacle registered on the corridor (obstructed flag)');
  assert.ok(passedObstacle, 'the ped steered around and passed the obstacle');
});

// --- Determinism ----------------------------------------------------------------------------

test('seeded determinism: identical seeds pack identical ped sections', () => {
  const { topo } = realTile();
  const slice = livingCityPedSlice(topo)!;
  const mk = () => new PedSim(topo, buildSignalSystem(topo), { seed: 42, peds: slice.spawns, advanceSignals: true });
  const a = mk();
  const b = mk();
  run(a, 60);
  run(b, 60);
  assert.deepEqual(packPedSection(a), packPedSection(b), 'same seed → byte-identical crowd state');
  const c = new PedSim(topo, buildSignalSystem(topo), { seed: 43, peds: slice.spawns, advanceSignals: true });
  run(c, 60);
  assert.notDeepEqual(packPedSection(c), packPedSection(a), 'a different seed diverges');
});

// --- Snapshot codec --------------------------------------------------------------------------

test('ped section codec: header, stride, count, offsets and fresh array identity', () => {
  const topo = crossTopology();
  const signals = buildSignalSystem(topo);
  const band = topo.walks[0]!;
  const sim = new PedSim(topo, signals, { seed: 1, peds: [{ kind: 'kid', walk: band.id, s: 2 }] });
  sim.step(SIM_DT);
  const section = packPedSection(sim);
  assert.equal(section[PSNAP.count], 1);
  assert.equal(section[PSNAP.stride], PSNAP_STRIDE);
  assert.equal(section.length, PSNAP_HEADER + PSNAP_STRIDE);
  assert.equal(section[PSNAP_HEADER + 1], PED_KINDS.indexOf('kid'), 'kind index in the record');
  assert.ok(section[PSNAP.spawnTotal]! >= 1, 'spawnTotal flows through the header');
  const again = packPedSection(sim);
  assert.notEqual(section, again, 'every pack is a fresh array (Synchronizable rule)');
  assert.deepEqual(emptyPedSection(), [0, PSNAP_STRIDE, 0, 0]);
});

test('combined snapshot: untouched vehicle bytes + appended ped section', () => {
  const { topo, signals } = realTile();
  const slice = livingCityPedSlice(topo)!;
  const veh = new VehicleSim(topo, signals, { seed: 5, vehicles: [] });
  const peds = new PedSim(topo, signals, { seed: 5, peds: slice.spawns });
  veh.step(SIM_DT);
  peds.step(SIM_DT);
  const vehOnly = packVehicleSnapshot(9, veh);
  const combined = packActorSnapshot(9, veh, peds);
  const vehCount = vehicleSnapshotCount(vehOnly);
  // Vehicle section is byte-identical — older readers never see the tail.
  assert.deepEqual(combined.slice(0, VSNAP_HEADER + vehCount * VSNAP_STRIDE), vehOnly);
  const off = pedSectionOffset(combined);
  assert.equal(off, VSNAP_HEADER + vehCount * VSNAP_STRIDE);
  assert.equal(pedSnapshotCount(combined), 6);
  assert.equal(combined.length, off + PSNAP_HEADER + 6 * PSNAP_STRIDE);
  // A vehicle-only snapshot still parses: the ped section offset lands at the end.
  assert.equal(pedSnapshotCount(vehOnly), 0);
});

test('interpolatePedPose lerps position and takes the shortest yaw arc', () => {
  // Vehicle header (8, count 0) + ped header (4) + one record (12).
  const snap = [
    9, VSNAP_STRIDE, 1 / 24, 0, VSNAP_STRIDE, 5, 0, 0, // vehicle header with count=0
    1, PSNAP_STRIDE, 0, 0, // ped section header
    7, 0, 10, 20, 0, 14, 24, Math.PI / 2, 6, 0, 3, 0, // one ped record
  ];
  const out = { x: 0, z: 0, yaw: 0 };
  interpolatePedPose(snap, 0, 0, out);
  assert.deepEqual(out, { x: 10, z: 20, yaw: 0 }, 'alpha 0 shows the previous pose');
  interpolatePedPose(snap, 0, 1, out);
  assert.deepEqual(out, { x: 14, z: 24, yaw: Math.PI / 2 }, 'alpha 1 shows the current pose');
  interpolatePedPose(snap, 0, 0.5, out);
  assert.deepEqual(out, { x: 12, z: 22, yaw: Math.PI / 4 });
  const wrap = [...snap];
  wrap[pedSectionOffset(snap) + PSNAP_HEADER + 4] = 3.0;
  wrap[pedSectionOffset(snap) + PSNAP_HEADER + 7] = -3.0;
  interpolatePedPose(wrap, 0, 0.5, out);
  assert.ok(Math.abs(out.yaw) > Math.PI - 0.2, `yaw ${out.yaw} wraps past π`);
});

// --- Ambient population & lifecycle ---------------------------------------------------------

test('ambient spawner fills the crowd target and despawn respects focus distance', () => {
  const { topo, signals } = realTile();
  const sim = new PedSim(topo, signals, {
    seed: 4,
    targetPeds: 8,
    spawnMinDistance: 0,
    despawnDistance: 5000, // the whole tile stays live — this test is about filling, not culling
    advanceSignals: true,
  });
  sim.setFocus(0, 0);
  run(sim, 30);
  assert.ok(sim.metrics.pedestrians >= 6, `ambient crowd grew toward target (${sim.metrics.pedestrians})`);
  assert.ok(sim.metrics.pedestrians <= 8, 'never exceeds the target');
  assert.ok(sim.metrics.spawnTotal >= sim.metrics.pedestrians);
  const rows = sim.pedestriansView();
  assert.ok(rows.every((p) => p.element.startsWith('walk:') || p.element.startsWith('xwalk:') || p.element.startsWith('corner:')));
  // The other half of the lifecycle: peds beyond despawnDistance are culled.
  const far = new PedSim(topo, buildSignalSystem(topo), { seed: 4, targetPeds: 4, spawnMinDistance: 0, despawnDistance: 50 });
  far.setFocus(5000, 5000); // kilometres from every band — everything spawned is out of focus range
  run(far, 10);
  assert.ok(far.metrics.despawnTotal > 0, `out-of-focus peds despawn (${far.metrics.despawnTotal})`);
});

// --- Performance smoke (reported, generous bound) --------------------------------------------

test('tick cost: six-ped slice and a ~200-ped tile crowd stay well inside the frame budget', () => {
  const { topo } = realTile();
  const slice = livingCityPedSlice(topo)!;
  const time = (sim: PedSim, ticks: number): number => {
    // Warm up, then measure.
    run(sim, 5);
    const t0 = performance.now();
    run(sim, ticks);
    return (performance.now() - t0) / ticks;
  };
  const sliceMs = time(new PedSim(topo, buildSignalSystem(topo), { seed: 7, peds: slice.spawns, advanceSignals: true }), 480);
  const crowdMs = time(
    new PedSim(topo, buildSignalSystem(topo), { seed: 7, targetPeds: 200, spawnMinDistance: 0, advanceSignals: true }),
    480,
  );
  console.log(`  ped tick cost: slice(6)=${sliceMs.toFixed(3)} ms, crowd(200)=${crowdMs.toFixed(3)} ms`);
  assert.ok(sliceMs < 4, `six-ped slice tick ${sliceMs.toFixed(3)} ms`);
  assert.ok(crowdMs < 15, `200-ped tick ${crowdMs.toFixed(3)} ms`);
});
