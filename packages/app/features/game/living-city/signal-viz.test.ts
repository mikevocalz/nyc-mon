import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseCityDataset, type CityDatasetV3, type CityRoad } from '../city-dataset.ts';
import { createStreetClearance } from '../world/walkability.ts';
import { CityClock, packEnvSection, readEnvSection } from './clock.ts';
import { PSNAP_HEADER, PSNAP_STRIDE } from './ped-sim.ts';
import { buildSignalSystem, type SignalSystem } from './signal-controller.ts';
import {
  PED_ASPECT_CODE,
  SSIG_HEADER,
  SSIG_SCHEME,
  SSIG_STRIDE,
  VEHICLE_ASPECT_CODE,
  envSectionOffset,
  fdwBlink,
  pedBoxPlacements,
  pedLensKeys,
  signalAspectAt,
  signalHeadPlacements,
  signalRoster,
  signalSectionCount,
  signalSectionOffset,
  packSignalSection,
  vehicleLensKeys,
} from './signal-viz.ts';
import { buildLaneTopology, type LaneTopology } from './topology.ts';
import { VSNAP_HEADER, VSNAP_STRIDE } from './vehicle-sim.ts';

// --- Fixture: the same signalized four-way the sim tests use ----------------------

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

function rig(): { topo: LaneTopology; signals: SignalSystem } {
  const topo = crossTopology();
  return { topo, signals: buildSignalSystem(topo) };
}

const V_FROM_CODE = ['R', 'Y', 'G'] as const;
const P_FROM_CODE = ['D', 'F', 'W'] as const;

/**
 * THE honesty test: decode the packed signal section and reproduce
 * `SignalSystem.state` element for element — what the renderer will draw
 * is byte-identical to what the solver/AI acted on, because both read the
 * same packed array.
 */
test('packed signal section decodes to the exact controller state', () => {
  const { signals } = rig();
  const roster = signalRoster(signals);
  assert.ok(roster.length > 0, 'the four-way contributes connectors and crosswalks');
  const check = (label: string) => {
    const section = packSignalSection(signals, roster);
    const snap = new Array<number>(VSNAP_HEADER + PSNAP_HEADER).fill(0);
    snap[4] = VSNAP_STRIDE; // vehicle stride field
    snap[VSNAP_HEADER + 1] = PSNAP_STRIDE;
    snap.push(...section);
    // Simulate the full world snapshot's offsets: vehicles section then an
    // empty ped header then the signal section.
    const off = signalSectionOffset(snap);
    assert.equal(snap[off + 2], SSIG_SCHEME);
    const perNode = new Map<string, NonNullable<ReturnType<SignalSystem['state']>>>();
    for (let i = 0; i < roster.length; i++) {
      const entry = roster[i]!;
      if (!perNode.has(entry.node)) perNode.set(entry.node, signals.state(entry.node)!);
      const state = perNode.get(entry.node)!;
      const code = snap[off + SSIG_HEADER + i * SSIG_STRIDE]!;
      if (entry.kind === 'connector') {
        assert.equal(V_FROM_CODE[code], state.vehicleAspects[entry.element], `${label}: ${entry.element}`);
      } else {
        assert.equal(P_FROM_CODE[code], state.pedAspects[entry.element], `${label}: ${entry.element}`);
      }
    }
  };
  check('t=0');
  for (let s = 0; s < 24 * 30; s++) signals.step(1 / 24); // roll ~30 s through several phase changes
  check('t=30s');
  for (let s = 0; s < 24 * 40; s++) signals.step(1 / 24);
  check('t=70s');
});

test('the roster is deterministic across rebuilds (index → element binds both runtimes)', () => {
  const a = signalRoster(rig().signals);
  const b = signalRoster(rig().signals);
  assert.deepEqual(a, b);
  // Every connector and crosswalk appears exactly once.
  const ids = new Set(a.map((e) => e.element));
  assert.equal(ids.size, a.length);
});

// --- Layout / offset chain ---------------------------------------------------------

test('section offsets: ped → signal → env, and old snapshots read as absent', () => {
  const { signals } = rig();
  const roster = signalRoster(signals);
  const section = packSignalSection(signals, roster);
  // A world snapshot: vehicle header + 2 vehicle records + ped header + 3 peds + signal + env.
  const veh = new Array(VSNAP_HEADER + 2 * VSNAP_STRIDE).fill(0);
  veh[4] = VSNAP_STRIDE;
  veh[3] = 2;
  const peds = new Array(PSNAP_HEADER + 3 * PSNAP_STRIDE).fill(0);
  peds[0] = 3;
  peds[1] = PSNAP_STRIDE;
  const clock = new CityClock({ startHour: 20.0 }).state();
  const env = packEnvSection(clock, 7.25);
  const snap = [...veh, ...peds, ...section, ...env];
  const sigOff = signalSectionOffset(snap);
  assert.equal(sigOff, VSNAP_HEADER + 2 * VSNAP_STRIDE + PSNAP_HEADER + 3 * PSNAP_STRIDE);
  assert.equal(signalSectionCount(snap), roster.length);
  const envOff = envSectionOffset(snap);
  assert.equal(envOff, sigOff + SSIG_HEADER + roster.length * SSIG_STRIDE);
  const decoded = readEnvSection(snap, envOff, 0);
  assert.equal(decoded.hour, clock.hour);
  assert.equal(decoded.simTime, 7.25);
  // An old-format (vehicle-only) buffer: signal section absent, env default.
  const old = [1, 0, 0, 0, VSNAP_STRIDE, 0, 0, 0];
  assert.equal(signalSectionCount(old), 0);
  assert.equal(signalAspectAt(old, 0), -1);
  assert.equal(readEnvSection(old, envSectionOffset(old), 3).hour, 12);
});

// --- Placements ---------------------------------------------------------------------

test('signal heads: one per approach leg of each signalized junction, bound to a real connector', () => {
  const { topo, signals } = rig();
  const heads = signalHeadPlacements(topo, signals);
  assert.ok(heads.length >= 4, 'the four-way mounts a head per approach');
  const connectorIds = new Set(topo.connectors.map((c) => c.id));
  const nodeIds = new Set(signals.nodes.keys());
  for (const h of heads) {
    assert.ok(nodeIds.has(h.node));
    assert.ok(connectorIds.has(h.element), `head binds to an existing connector (${h.element})`);
    assert.ok(Number.isFinite(h.x) && Number.isFinite(h.z) && Number.isFinite(h.yaw));
    const node = topo.nodeById.get(h.node)!;
    const d = Math.hypot(h.x - node.x, h.z - node.z);
    assert.ok(d > 1 && d < 40, `head sits in the kerb band near the box (d=${d.toFixed(1)})`);
  }
  // No two heads share a mounting point.
  const spots = new Set(heads.map((h) => `${h.x.toFixed(2)},${h.z.toFixed(2)}`));
  assert.equal(spots.size, heads.length);
});

test('ped boxes: two per signalized crosswalk, bound to the xwalk element', () => {
  const { topo, signals } = rig();
  const boxes = pedBoxPlacements(topo, signals);
  const xwalkIds = new Set<string>();
  for (const [nodeId, controller] of signals.nodes) {
    for (const x of controller.matrix.xwalks) {
      assert.equal(x.node, nodeId);
      xwalkIds.add(x.id);
    }
  }
  assert.equal(boxes.length, xwalkIds.size * 2, 'every xwalk end gets a serving box');
  for (const b of boxes) assert.ok(xwalkIds.has(b.element));
});

// The pole-in-the-street regression: on the real tile the geometric
// candidates mostly landed inside a carriageway or crossing strip. With
// the world's clearance index passed, every surviving base is standable.
test('heads and ped boxes respect street clearance: no pole stands in the street (real tile)', () => {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const clearance = createStreetClearance(dataset);
  const topo = buildLaneTopology(dataset);
  const signals = buildSignalSystem(topo);
  const heads = signalHeadPlacements(topo, signals, clearance);
  const boxes = pedBoxPlacements(topo, signals, clearance);
  assert.ok(heads.length > 0 && boxes.length > 0, 'clearance pruning keeps a working set');
  for (const h of heads) assert.ok(clearance.standable(h.x, h.z), `head standable at ${h.x},${h.z}`);
  for (const b of boxes) assert.ok(clearance.standable(b.x, b.z), `ped box standable at ${b.x},${b.z}`);
});

// --- Lens state mapping --------------------------------------------------------------

test('vehicle lens mapping: exactly one lamp lit per aspect', () => {
  assert.deepEqual(vehicleLensKeys(VEHICLE_ASPECT_CODE.R), ['red', 'off', 'off']);
  assert.deepEqual(vehicleLensKeys(VEHICLE_ASPECT_CODE.Y), ['off', 'amber', 'off']);
  assert.deepEqual(vehicleLensKeys(VEHICLE_ASPECT_CODE.G), ['off', 'off', 'green']);
  assert.deepEqual(vehicleLensKeys(-1), ['red', 'off', 'off'], 'absent data reads as the safe state');
});

test('ped lens mapping: WALK walker, steady hand on DONT WALK, hand flashes on FDW', () => {
  assert.deepEqual(pedLensKeys(PED_ASPECT_CODE.W, 0), ['off', 'walk']);
  assert.deepEqual(pedLensKeys(PED_ASPECT_CODE.D, 0), ['hand', 'off']);
  // FDW gates the hand lens on the sim clock: the blink parity decides.
  const on = pedLensKeys(PED_ASPECT_CODE.F, 0.1);
  assert.equal(on[0], fdwBlink(0.1) ? 'hand' : 'off');
  assert.equal(on[1], 'off');
  // The blink is deterministic on simTime and actually flips inside a cycle.
  const parities = new Set<number>();
  for (let t = 0; t < 2; t += 0.05) parities.add(fdwBlink(t) ? 1 : 0);
  assert.equal(parities.size, 2, 'the FDW blink flips within two sim seconds');
});

test('mountOnMasts: one pole per corner — heads and boxes share the sign pole or the first head’s mast', async () => {
  const { mountOnMasts, MAST_SHARE_METRES } = await import('./signal-viz.ts');
  const head = (x: number, z: number, leg: number) => ({ node: 'n', element: `e${leg}`, leg, x, z, yaw: 0 });
  const box = (x: number, z: number) => ({ node: 'n', element: 'x', servingEnd: 0 as const, x, z, yaw: 0 });
  const { heads, boxes } = mountOnMasts(
    [head(1, 1, 0), head(2, 2, 1), head(40, 40, 2), head(41, 39, 3)],
    [box(0.5, 0.5), box(100, 100)],
    [{ x: 0, z: 0 }],
  );
  // The first two heads mount on the sign pole at the origin.
  assert.deepEqual([heads[0]!.x, heads[0]!.z, heads[1]!.x, heads[1]!.z], [0, 0, 0, 0]);
  // Far heads found one mast and the next shares it.
  assert.deepEqual([heads[2]!.x, heads[2]!.z, heads[3]!.x, heads[3]!.z], [40, 40, 40, 40]);
  assert.deepEqual([boxes[0]!.x, boxes[0]!.z], [0, 0]);
  // A box with no mast within reach keeps its own post.
  assert.deepEqual([boxes[1]!.x, boxes[1]!.z], [100, 100]);
  assert.ok(MAST_SHARE_METRES >= 4 && MAST_SHARE_METRES <= 8);
});
