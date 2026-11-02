import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseCityDataset, type CityDatasetV3, type CityRoad } from '../city-dataset.ts';
import {
  NYC_MIN_WALK_SECONDS,
  NYC_PED_SPEED_MPS,
  SignalController,
  buildSignalSystem,
  type SignalOptions,
  type SignalState,
} from './signal-controller.ts';
import { buildLaneTopology, type LaneTopology } from './topology.ts';

// --- Fixture: a signalized four-way ----------------------------------------------

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

/** EW × NS signalized junction, four OSM crossing ways, 25 mph everywhere. */
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

function controller(opts: SignalOptions = {}): { topo: LaneTopology; ctl: SignalController } {
  const topo = crossTopology();
  const node = topo.nodes.find((n) => n.kind === 'junction')!;
  return { topo, ctl: new SignalController(topo, node.id, opts) };
}

const XW = (ctl: SignalController, suffix: string) => ctl.matrix.xwalks.find((x) => x.id.endsWith(suffix))!.id;
const CONN = (s: string) => `conn:lane:${s}`;

function advance(ctl: SignalController, seconds: number, dt = 0.05): void {
  for (let t = 0; t < seconds; t += dt) ctl.step(dt);
}

/** Step until the state predicate holds or the budget runs out; returns the state. */
function until(ctl: SignalController, pred: (s: SignalState) => boolean, budget = 120): SignalState {
  for (let t = 0; t < budget; t += 0.05) {
    const s = ctl.state();
    if (pred(s)) return s;
    ctl.step(0.05);
  }
  throw new Error(`state never reached within ${budget}s`);
}

// --- Phase plan + timing ----------------------------------------------------------

test('phase plan: legs pair into two axes; every connector and crosswalk is assigned', () => {
  const { ctl } = controller();
  assert.equal(ctl.plan.groups.length, 2);
  assert.equal(new Set(ctl.plan.groups.flatMap((g) => [...g.legs])).size, 4, 'all four legs grouped');
  const grouped = ctl.plan.groups.flatMap((g) => [...g.connectors]).sort();
  assert.deepEqual(grouped, ctl.matrix.connectors.map((c) => c.id).sort(), 'all 12 connectors grouped');
  const served = ctl.plan.groups.flatMap((g) => [...g.xwalks]).sort();
  assert.deepEqual(served, ctl.matrix.xwalks.map((x) => x.id).sort(), 'all four crosswalks served');
  // The cycle is green+amber+all-red per group.
  const expected = ctl.plan.groups.reduce((s, g) => s + g.greenSeconds + g.amberSeconds + g.allRedSeconds + g.lpiSeconds, 0);
  assert.ok(Math.abs(ctl.plan.cycleSeconds - expected) < 1e-9);
});

test('phase timing: amber/all-red derive from approach speed + crossing width, not constants', () => {
  const { ctl } = controller();
  const v = 25 * 0.44704; // recorded tile speed -> m/s
  const g = ctl.plan.groups[0]!;
  // Amber: reaction + v/2a, floored at 3 s (FHWA change interval).
  assert.ok(Math.abs(g.amberSeconds - Math.max(3, 1 + v / (2 * 3.05))) < 1e-9);
  assert.equal(g.amberSeconds, 3);
  // All-red: (crossed width + vehicle length) / v, floored at 1 s.
  const allRed = Math.max(1, (g.clearanceMeters + 6.1) / v);
  assert.ok(Math.abs(g.allRedSeconds - allRed) < 1e-9);
  assert.equal(g.clearanceMeters, 12, 'crossing the 12 m perpendicular street');
  // Green stretches so WALK + ped clearance fits inside lpi+green+amber+all-red (MUTCD §4I.06).
  const clearance = 16 / NYC_PED_SPEED_MPS;
  assert.ok(Math.abs(g.greenSeconds - (NYC_MIN_WALK_SECONDS + clearance - g.amberSeconds - g.allRedSeconds)) < 1e-9);
  assert.ok(g.greenSeconds >= 10, 'respects the minimum green');
  // A faster street lengthens both clearances.
  const topo = crossTopology();
  for (const l of topo.lanes) l.speedMph = 45;
  const fast = new SignalController(topo, topo.nodes.find((n) => n.kind === 'junction')!.id, {});
  const gf = fast.plan.groups[0]!;
  assert.ok(gf.amberSeconds > g.amberSeconds, 'amber grows with speed');
  assert.ok(gf.allRedSeconds < g.allRedSeconds || gf.allRedSeconds === 1, 'all-red shrinks with speed');
});

test('ped aspects: WALK >= 7 s then flashing DON\'T WALK for leg length / 1.07 m/s', () => {
  const { ctl } = controller();
  const cw = ctl.plan.pedWindows[0]!;
  assert.equal(cw.walkEnd - cw.start, 7);
  assert.ok(Math.abs(cw.clearanceSeconds - 16 / 1.07) < 1e-9);
  const x = cw.xwalk;
  // WALK at window start, FDW at walkEnd+ε, DWLK after flashEnd.
  advance(ctl, cw.start + 0.05);
  assert.equal(ctl.state().pedAspects[x], 'W');
  advance(ctl, 7);
  assert.equal(ctl.state().pedAspects[x], 'F');
  advance(ctl, cw.clearanceSeconds);
  assert.equal(ctl.state().pedAspects[x], 'D');
});

test('ped clearance always closes before conflicting vehicle movements are released', () => {
  const { ctl } = controller();
  // For every group: pedStart + WALK + clearance <= end of that group's all-red.
  for (const g of ctl.plan.groups) {
    const green = ctl.plan.intervals.find((i) => i.kind === 'VEHICLE_GREEN' && i.group === g.index)!;
    const redClear = ctl.plan.intervals.find((i) => i.kind === 'RED_CLEARANCE' && i.group === g.index)!;
    const groupEnd = redClear.start + redClear.duration;
    const pedStart = green.start - g.lpiSeconds;
    for (const x of g.xwalks) {
      const clear = ctl.plan.pedClearanceSeconds[x]!;
      assert.ok(pedStart + 7 + clear <= groupEnd + 1e-9, `${x} clearance overruns the buffer`);
    }
  }
});

test('LPI: peds get WALK while the parallel approach still holds red', () => {
  const { ctl } = controller({ lpiSeconds: 5 });
  const g = ctl.plan.groups[0]!;
  assert.equal(g.lpiSeconds, 5);
  const lpi = ctl.plan.intervals.find((i) => i.kind === 'LEADING_PEDESTRIAN_INTERVAL' && i.group === g.index)!;
  // Mid-LPI: served crosswalks walk, every vehicle aspect is red.
  advance(ctl, lpi.start + 2.5);
  const s = ctl.state();
  assert.equal(s.phase, 'LEADING_PEDESTRIAN_INTERVAL');
  for (const x of g.xwalks) assert.equal(s.pedAspects[x], 'W');
  for (const c of g.connectors) assert.equal(s.vehicleAspects[c], 'R');
  // The vehicle green starts exactly lpi seconds after the ped window opens.
  const green = ctl.plan.intervals.find((i) => i.kind === 'VEHICLE_GREEN' && i.group === g.index)!;
  assert.equal(green.start - lpi.start, 5);
  // ...and the green still covers the full ped clearance (it was shortened by lpi).
  assert.ok(g.lpiSeconds + g.greenSeconds + g.amberSeconds + g.allRedSeconds >= 7 + ctl.plan.pedClearanceSeconds[g.xwalks[0]!]!);
});

test('exclusive ped phase: ALL_PEDESTRIAN_PHASE walks every crosswalk while all vehicles hold red', () => {
  const { ctl } = controller({ exclusivePedPhase: true });
  const excl = ctl.plan.intervals.find((i) => i.kind === 'ALL_PEDESTRIAN_PHASE')!;
  assert.ok(excl.duration >= 7 + 16 / 1.07 - 1e-9, 'exclusive phase covers WALK + longest clearance');
  // During vehicle green no ped has WALK.
  const s = until(ctl, (st) => st.phase === 'VEHICLE_GREEN');
  for (const a of Object.values(s.pedAspects)) assert.equal(a, 'D');
  // During the exclusive phase: every crosswalk W/F, every connector R.
  const s2 = until(ctl, (st) => st.phase === 'ALL_PEDESTRIAN_PHASE');
  assert.equal(Object.values(s2.pedAspects).filter((a) => a === 'W').length, 4);
  for (const a of Object.values(s2.vehicleAspects)) assert.equal(a, 'R');
  const s3 = until(ctl, (st) => st.phase === 'ALL_PEDESTRIAN_PHASE' && st.phaseElapsed > 7.5);
  assert.equal(Object.values(s3.pedAspects).filter((a) => a === 'F').length, 4);
});

// --- Grants -----------------------------------------------------------------------

test('protected conflicts: no two conflicting claims are ever held simultaneously', () => {
  const { ctl } = controller();
  // Demand every connector and every crosswalk forever; invariant each step.
  const entities = [...ctl.matrix.connectors.map((c) => `veh:${c.id}`), ...ctl.matrix.xwalks.map((x) => `ped:${x.id}`)];
  for (let t = 0; t < 200; t += 0.05) {
    entities.forEach((e, i) => {
      const element = e.startsWith('veh:') ? ctl.matrix.connectors[i]!.id : ctl.matrix.xwalks[i - ctl.matrix.connectors.length]!.id;
      ctl.requestGrant(e, element);
    });
    ctl.step(0.05);
    const held = ctl.solver.claimsView().filter((v) => v.held);
    for (let i = 0; i < held.length; i++)
      for (let j = i + 1; j < held.length; j++)
        assert.equal(ctl.conflicts(held[i]!.element, held[j]!.element), false, `${held[i]!.element} vs ${held[j]!.element} both held at t=${t}`);
  }
});

test('conflicting movements never share green: only one phase group is green at a time', () => {
  const { ctl } = controller();
  for (let t = 0; t < ctl.plan.cycleSeconds; t += 0.25) {
    const s = ctl.state();
    const groups = new Set(
      Object.entries(s.vehicleAspects)
        .filter(([, a]) => a !== 'R')
        .map(([id]) => ctl.plan.groups.findIndex((g) => g.connectors.includes(id))),
    );
    assert.ok(groups.size <= 1, `non-red connectors span groups ${[...groups]} at t=${s.tCycle}`);
    ctl.step(0.25);
  }
});

test('a turning driver on green must yield to a pedestrian holding the crosswalk', () => {
  const { ctl } = controller();
  // South-leg crosswalk conflicts with the W-approach right turn onto ns-s.
  const cwS = XW(ctl, ':cw-s');
  const wRight = CONN('ew-w:f:0>lane:ns-s:f:0');
  // Wait for the phase where the W approach is green and cw-s has WALK
  // (cw-s is served parallel to the EW axis = the group containing ew legs).
  const s = until(ctl, (st) => st.vehicleAspects[wRight] === 'G' && st.pedAspects[cwS] === 'W');
  assert.ok(s.phase === 'VEHICLE_GREEN');
  assert.equal(ctl.requestGrant('ped-1', cwS), 'granted');
  assert.equal(ctl.requestGrant('car-1', wRight), 'must-yield');
  // A non-conflicting movement through the same green is unaffected.
  const wThrough = CONN('ew-w:f:0>lane:ew-e:f:0');
  assert.equal(ctl.requestGrant('car-2', wThrough), 'granted');
  // Ped clears -> the turner may go.
  ctl.release('ped-1');
  assert.equal(ctl.requestGrant('car-1', wRight), 'granted');
});

test('NYC right-on-red: denied by default, honoured as a sign record, always yielding', () => {
  const wRight = CONN('ew-w:f:0>lane:ns-s:f:0');
  const nThrough = CONN('ns-n:f:0>lane:ns-s:f:0');
  // -- default: the red right-turner waits behind the stop line --------------
  {
    const { ctl } = controller();
    until(ctl, (st) => st.vehicleAspects[wRight] === 'R' && st.vehicleAspects[nThrough] === 'G');
    assert.equal(ctl.requestGrant('ns-1', nThrough), 'granted');
    assert.equal(ctl.requestGrant('rtor', wRight), 'queued');
    // Still queued an entire NS phase later — there is no turn on red in NYC.
    advance(ctl, 20);
    assert.equal(ctl.requestGrant('rtor', wRight), 'queued');
  }
  // -- affirmative sign record: the same connector becomes a yield-claim -----
  {
    const { ctl } = controller({ rightOnRedPermitted: true });
    until(ctl, (st) => st.vehicleAspects[wRight] === 'R' && st.vehicleAspects[nThrough] === 'G');
    assert.equal(ctl.requestGrant('ns-1', nThrough), 'granted');
    assert.equal(ctl.requestGrant('rtor', wRight), 'must-yield'); // sign says go, law says yield
    // Peds hold fast at the kerb too — DON'T WALK never grants entry.
    const cwS = XW(ctl, ':cw-s');
    assert.equal(ctl.requestGrant('ped-9', cwS), 'queued');
    ctl.release('ns-1');
    assert.equal(ctl.requestGrant('rtor', wRight), 'granted');
  }
  // -- per-connector sign list: only listed connectors get the exception -----
  {
    const eRight = CONN('ew-e:b:0>lane:ns-n:b:0');
    const { ctl } = controller({ rightOnRedPermitted: [eRight] });
    until(ctl, (st) => st.vehicleAspects[wRight] === 'R' && st.vehicleAspects[eRight] === 'R');
    assert.equal(ctl.requestGrant('r1', wRight), 'queued'); // unsigned: still NYC rule
    assert.equal(ctl.requestGrant('r2', eRight), 'granted'); // signed: stops then goes
  }
});

test('left-on-red is off by default too (sign-record slot exists for completeness)', () => {
  const wLeft = CONN('ew-w:f:0>lane:ns-n:b:0');
  const { ctl } = controller();
  until(ctl, (st) => st.vehicleAspects[wLeft] === 'R');
  assert.equal(ctl.requestGrant('ltor', wLeft), 'queued');
  const { ctl: permitted } = controller({ leftOnRedPermitted: true });
  until(permitted, (st) => st.vehicleAspects[wLeft] === 'R');
  assert.equal(permitted.requestGrant('ltor', wLeft), 'granted');
});

test('dark signal: every approach falls to the all-way-stop protocol', () => {
  const { ctl } = controller({ dark: true });
  const s = ctl.state();
  assert.equal(s.phase, 'DARK');
  assert.ok(s.dark);
  for (const a of Object.values(s.vehicleAspects)) assert.equal(a, 'R');
  for (const a of Object.values(s.pedAspects)) assert.equal(a, 'D');
  const wThrough = CONN('ew-w:f:0>lane:ew-e:f:0');
  const nThrough = CONN('ns-n:f:0>lane:ns-s:f:0');
  // First come, first served across conflicting movements.
  assert.equal(ctl.requestGrant('first', wThrough), 'granted');
  assert.equal(ctl.requestGrant('second', nThrough), 'must-yield');
  // Pedestrians keep priority even in the dark: no held claim conflicts the
  // south crosswalk yet, so the walker goes — and the waiting NS through now
  // yields to the walker as well.
  const cwS = XW(ctl, ':cw-s');
  assert.equal(ctl.requestGrant('ped', cwS), 'granted');
  ctl.release('first');
  ctl.step(0.05);
  assert.equal(ctl.requestGrant('second', nThrough), 'must-yield'); // the ped holds its conflict
  ctl.release('ped');
  ctl.step(0.05);
  assert.equal(ctl.requestGrant('second', nThrough), 'granted');
  // Restore: back to the normal phase machine.
  ctl.setDark(false);
  assert.equal(ctl.state().dark, false);
  assert.notEqual(ctl.state().phase, 'DARK');
});

test('median u-turn candidates are pruned unless explicitly permitted', () => {
  // The fixture has no uturns; use the real ACP junction which has 26.
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const topo = buildLaneTopology(dataset);
  const acp = 'node:s19169.s19170.s19212.s19213.s19399.s19400.s19401';
  const ctl = new SignalController(topo, acp, {});
  const uturns = ctl.matrix.connectors.filter((c) => c.turn === 'uturn');
  assert.ok(uturns.length > 0, 'ACP produces uturn candidates');
  for (let t = 0; t < ctl.plan.cycleSeconds; t += 0.5) {
    for (const u of uturns) assert.equal(ctl.state().vehicleAspects[u.id], 'R', `${u.id} must stay red`);
    ctl.step(0.5);
  }
  const open = new SignalController(topo, acp, { permitUTurns: true });
  let sawGreen = false;
  for (let t = 0; t < open.plan.cycleSeconds; t += 0.5) {
    if (Object.entries(open.state().vehicleAspects).some(([id, a]) => a === 'G' && uturns.some((u) => u.id === id))) sawGreen = true;
    open.step(0.5);
  }
  assert.ok(sawGreen, 'permitUTurns releases the candidates');
});

// --- Timestep + determinism --------------------------------------------------------

test('timestep-agnostic: identical absolute times give identical aspects at any dt', () => {
  const { ctl: a } = controller({ lpiSeconds: 4 });
  const { ctl: b } = controller({ lpiSeconds: 4 });
  const semantic = (s: SignalState) => ({ phase: s.phase, group: s.group, v: s.vehicleAspects, p: s.pedAspects, dark: s.dark });
  let ta = 0;
  let tb = 0;
  for (const target of [0, 3.7, 8.25, 21.5, 40.0, 60.05]) {
    while (ta < target - 1e-9) {
      const d = Math.min(0.05, target - ta);
      a.step(d);
      ta += d;
    }
    while (tb < target - 1e-9) {
      const d = Math.min(0.5, target - tb);
      b.step(d);
      tb += d;
    }
    assert.deepEqual(semantic(a.state()), semantic(b.state()), `states diverge at t=${target}`);
  }
});

test('determinism: two identical request streams produce identical grants', () => {
  const run = () => {
    const { ctl } = controller();
    const log: string[] = [];
    const actors = ['a', 'b', 'c', 'd', 'e'];
    for (let t = 0; t < 120; t += 0.1) {
      actors.forEach((id, i) => {
        const element = ctl.matrix.elements[(i * 3 + Math.floor(t)) % ctl.matrix.elements.length]!;
        log.push(`${ctl.requestGrant(`${id}@${Math.floor(t / 10)}`, element)}`);
      });
      ctl.step(0.1);
    }
    return JSON.stringify({ log, claims: ctl.solver.claimsView(), state: ctl.state() });
  };
  assert.equal(run(), run());
});

// --- SignalSystem + real tile ------------------------------------------------------

test('system: state(), requestGrant() and uncontrolled nodes', () => {
  const topo = crossTopology();
  const sys = buildSignalSystem(topo, {});
  const junction = topo.nodes.find((n) => n.kind === 'junction')!;
  const signal = `signal:${junction.id}`;
  const s = sys.state(signal);
  assert.ok(s && s.simulated === true);
  assert.equal(s!.node, junction.id);
  // Bare node ids work too.
  assert.equal(sys.state(junction.id)!.signal, signal);
  // Dead-end nodes are uncontrolled: synthesized UNSIGNALIZED state, free grants.
  const dead = topo.nodes.find((n) => n.kind === 'deadEnd')!;
  assert.equal(sys.state(dead.id)!.phase, 'UNSIGNALIZED');
  const link = topo.connectors.find((c) => c.node === dead.id)!;
  assert.equal(sys.requestGrant('car', link.id), 'granted');
});

test('real tile smoke: controllers run on the three verified 125th Street junctions', () => {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const topo = buildLaneTopology(dataset);
  const nodes = [
    'node:s19402.s19403.s19682.s19683', // W 125 St & St Nicholas Av
    'node:s19169.s19170.s19212.s19213.s19399.s19400.s19401', // Adam Clayton Powell Jr Blvd
    'node:s19345.s19346.s19381.s19382.s19400.s19418.s19419', // Lenox Av / Malcolm X Blvd
  ];
  const sys = buildSignalSystem(topo, { nodes });
  assert.equal(sys.nodes.size, 3);
  for (const [nodeId, ctl] of sys.nodes) {
    assert.equal(ctl.plan.groups.length, 2, `${nodeId} should phase as two axes`);
    // A full cycle: at least one GREEN interval per group, all four crossings served.
    assert.ok(ctl.plan.groups.every((g) => g.xwalks.length > 0), `${nodeId} serves its crosswalks`);
    assert.ok(ctl.plan.cycleSeconds > 20);
    for (let t = 0; t < ctl.plan.cycleSeconds; t += 0.5) {
      const s = ctl.state();
      // invariant: held claims never conflict
      const held = ctl.solver.claimsView().filter((v) => v.held);
      for (let i = 0; i < held.length; i++)
        for (let j = i + 1; j < held.length; j++)
          assert.equal(ctl.conflicts(held[i]!.element, held[j]!.element), false);
      // every known element has an aspect
      for (const c of ctl.matrix.connectors) assert.ok(c.id in s.vehicleAspects);
      for (const x of ctl.matrix.xwalks) assert.ok(x.id in s.pedAspects);
      ctl.step(0.5);
    }
    // grants route through the system facade
    const conn = ctl.matrix.connectors.find((c) => c.turn === 'through')!;
    const answer = sys.requestGrant('veh-1', conn.id);
    assert.ok(answer === 'granted' || answer === 'queued' || answer === 'must-yield');
  }
  // Whole-tile construction is cheap enough to do at load time.
  const full = buildSignalSystem(topo, {});
  assert.ok(full.nodes.size > 100, `signalized ${full.nodes.size} junctions`);
  full.step(0.05);
  // NB: bundled-signals.ts (the lazy seam over city-data.ts) can't load under
  // node --test — the tile JSON import needs an import attribute; covered by
  // the parse+build path here instead, same as bundled-topology.ts in PR02.
});
