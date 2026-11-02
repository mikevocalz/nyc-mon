// The gen pednet seam (Phase 3 slice 3): gate stubs re-key to a record
// junction node when a band end is in reach, loops stay isolated, and the
// append keeps the topology's sorted-by-id / stats invariants — run against a
// hand-built topology, then once against the real bundled tile (parsed from
// disk like topology.test.ts: bundled-topology.ts imports the tile JSON, which
// node --test cannot load — same city-data.ts split). EXPO_PUBLIC_WORLD_GEN
// stays unset here, so the real-tile check proves the flag-off path emits no
// gen ids; the flag-on shape runs through appendGenWalks directly, the same
// expression bundled-topology.ts evaluates.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseCityDataset } from '../../city-dataset.ts';
import { buildLaneTopology, type LaneTopology, type TopologyNode, type WalkEdge } from '../../living-city/topology.ts';
import { createWalkQueries } from '../walkability.ts';
import { EXPERIMENTAL_WORLD_GEN } from './flag.ts';
import { appendGenWalks, genWalkEdgesFor, stitchGenWalks } from './pednet.ts';
import type { GenWalkEdge } from './places.ts';

const recordWalk = (id: string, nodeA: string, nodeB: string, points: readonly number[]): WalkEdge => ({
  id,
  roadId: `road:${id}`,
  nodeA,
  nodeB,
  side: 'left',
  points: [...points],
  widthMeters: 4,
});

const node = (id: string, x: number, z: number): TopologyNode => ({
  id,
  kind: 'junction',
  x,
  z,
  longitude: 0,
  latitude: 0,
  names: [],
  legs: [],
  roads: [],
  members: [],
});

const genGate = (id: string, points: readonly number[]): GenWalkEdge => ({
  id,
  roadId: `gen:${id}`,
  nodeA: `node:gen:${id}:a`,
  nodeB: `node:gen:${id}:b`,
  side: 'left',
  points: [...points],
  widthMeters: 2,
  lot: 0,
  kind: 'gate',
});

const genLoop = (id: string, points: readonly number[]): GenWalkEdge => ({
  id,
  roadId: `gen:${id}`,
  nodeA: `node:gen:${id}:loop`,
  nodeB: `node:gen:${id}:loop`,
  side: 'left',
  points: [...points],
  widthMeters: 1.6,
  lot: 0,
  kind: 'edge',
});

/** A one-junction topology: two record walks meeting at 'node:r1' (junction box at ~96..100, ~95..105). */
const topoOf = (): LaneTopology => {
  const n = node('node:r1', 100, 100);
  const walks = [
    recordWalk('walk:r1:l', 'node:r1', 'node:r2', [96, 95, 40, 95]),
    recordWalk('walk:r3:r', 'node:r3', 'node:r1', [40, 105, 96, 105]),
  ];
  return {
    datasetId: 'test',
    datasetVersion: 3,
    nodes: [n],
    segments: [],
    lanes: [],
    walks,
    xwalks: [],
    connectors: [],
    nodeById: new Map([[n.id, n]]),
    laneById: new Map(),
    lanesFrom: new Map(),
    lanesTo: new Map(),
    stats: {
      nodes: { junction: 1, link: 0, deadEnd: 0, boundary: 0 },
      segments: 0,
      laneEdges: 0,
      walkEdges: walks.length,
      connectors: 0,
      roadsOneway: 0,
      roadsTwoWay: 0,
      recorded: { speed: 0, lanes: 0, oneway: 0 },
      inferred: { speed: 0, lanes: 0, oneway: 0, xwalk: 0, connector: 0 },
      xwalks: { osm: 0, synthetic: 0 },
    },
  };
};

test('a gate end inside the attach radius takes the junction node; outside, it keeps its gen ids', () => {
  const topo = topoOf();
  // Gate end at (99, 96) sits ~4.1 m from the record band end (96, 95): inside 12 m.
  const near = genGate('walk:gen:0_0:1:gate', [99, 96, 60, 70]);
  const stitched = stitchGenWalks(topo, [near]);
  assert.equal(stitched[0]!.nodeA, 'node:r1', 'the near end attached to the junction');
  assert.equal(stitched[0]!.nodeB, 'node:gen:walk:gen:0_0:1:gate:b', 'the far end stays a gen node');
  // The other fields survive the re-key.
  assert.equal(stitched[0]!.id, near.id);
  assert.equal(stitched[0]!.kind, 'gate');

  const far = genGate('walk:gen:1_1:2:gate', [200, 200, 220, 200]);
  const isolated = stitchGenWalks(topo, [far]);
  assert.equal(isolated[0]!.nodeA, 'node:gen:walk:gen:1_1:2:gate:a');
  assert.equal(isolated[0]!.nodeB, 'node:gen:walk:gen:1_1:2:gate:b');
});

test('loops never re-key: a closed circulate stub has no ends to attach', () => {
  const topo = topoOf();
  const loop = genLoop('walk:gen:0_0:0:loop', [96, 96, 98, 96, 98, 98, 96, 98, 96, 96]);
  const stitched = stitchGenWalks(topo, [loop]);
  assert.equal(stitched[0]!.nodeA, 'node:gen:walk:gen:0_0:0:loop:loop');
  assert.equal(stitched[0]!.nodeA, stitched[0]!.nodeB, 'the loop still closes on its own node');
});

test('appendGenWalks: additive, sorted by id, stats.walkEdges counts the append', () => {
  const topo = topoOf();
  const gen = [genLoop('walk:gen:0_0:0:loop', [0, 0, 4, 0, 4, 4, 0, 4, 0, 0]), genGate('walk:gen:0_0:1:gate', [10, 10, 30, 10])];
  const appended = appendGenWalks(topo, gen);
  assert.equal(appended.walks.length, topo.walks.length + 2);
  assert.equal(appended.stats.walkEdges, topo.walks.length + 2);
  for (let i = 1; i < appended.walks.length; i++) assert.ok(appended.walks[i]!.id > appended.walks[i - 1]!.id, 'walks sorted by id');
  // The record collections are the same objects — nothing else moved.
  assert.equal(appended.nodes, topo.nodes);
  assert.equal(appended.xwalks, topo.xwalks);
  // An empty append returns the topology itself.
  assert.equal(appendGenWalks(topo, []), topo);
});

test('the tile enumerator emits stubs through genWalkEdgesFor', () => {
  const dataset = {
    buildings: [],
    areas: [{ kind: 'park' as const, ring: [8, 8, 120, 8, 120, 120, 8, 120] }],
    roads: [],
    extentMeters: 128,
  };
  const edges = genWalkEdgesFor(dataset, () => 0);
  assert.ok(edges.some((e) => e.kind === 'gate' && e.id.startsWith('walk:gen:')), 'the open lot emits a gate stub');
});

test('the real tile: flag off the topology is record-only; the flag-on append stitches gen walks in', () => {
  assert.equal(EXPERIMENTAL_WORLD_GEN, false);
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const topo = buildLaneTopology(dataset);
  assert.ok(topo.walks.every((w) => !w.id.startsWith('walk:gen:')), 'no gen edge exists flag off');
  assert.equal(topo.stats.walkEdges, topo.walks.length);

  // The flag-on path, evaluated the way bundled-topology.ts does: gen stubs over the tile's own
  // ground query, stitched then appended.
  const gen = genWalkEdgesFor(dataset, createWalkQueries(dataset).groundHeight);
  assert.ok(gen.length > 0, 'the tile emits gen walk stubs');
  const appended = appendGenWalks(topo, gen);
  assert.ok(appended.walks.some((w) => w.id.startsWith('walk:gen:')), 'gen edges land in walks');
  assert.equal(appended.stats.walkEdges, appended.walks.length);
  for (let i = 1; i < appended.walks.length; i++) assert.ok(appended.walks[i]!.id > appended.walks[i - 1]!.id, 'sorted');
  // Loops keep closing on their own node; gates either re-key to a record junction or stay gen.
  for (const w of appended.walks) {
    if (!w.id.startsWith('walk:gen:')) continue;
    assert.ok(w.nodeA.length > 0 && w.nodeB.length > 0);
  }
});
