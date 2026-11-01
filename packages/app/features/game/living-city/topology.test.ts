import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseCityDataset, type CityDatasetV3, type CityRoad } from '../city-dataset.ts';
import { buildLaneTopology, CARRIAGEWAY_CLASSES, NODE_MERGE_METRES, type LaneTopology } from './topology.ts';

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

function bundled(): LaneTopology {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  return buildLaneTopology(dataset);
}

// --- Small fixture behaviour --------------------------------------------------

test('two-way roads emit one directed edge per direction, one-way roads one direction only', () => {
  const topo = buildLaneTopology(tile([
    road('a', 'residential', [0, 0, 100, 0], 10, { lanes: 2 }), // two-way by default
    road('b', 'residential', [100, 0, 200, 0], 10, { lanes: 2, oneway: 1 }),
    road('c', 'residential', [200, 0, 300, 0], 10, { lanes: 2, oneway: -1 }),
    road('d', 'residential', [50, -100, 50, -8], 10, { lanes: 2 }), // joins nothing
  ]));
  const byRoad = (id: string) => topo.lanes.filter((l) => l.roadId === id);
  assert.deepEqual(byRoad('a').map((l) => l.dir).sort(), ['backward', 'forward']);
  assert.deepEqual(byRoad('b').map((l) => l.dir), ['forward', 'forward']);
  assert.deepEqual(byRoad('c').map((l) => l.dir), ['backward', 'backward']);
  // Lanes on a two-way piece sit on opposite halves of the carriageway.
  const fa = byRoad('a').find((l) => l.dir === 'forward')!;
  const ba = byRoad('a').find((l) => l.dir === 'backward')!;
  assert.ok(fa.lateral < 0 && ba.lateral < 0, 'each direction keeps right of its own travel');
  // Backward travel flips the polyline: the two directions occupy opposite sides.
  assert.ok(Math.abs(fa.points[1]! - 0) < 6 && Math.sign(fa.points[1]!) !== Math.sign(ba.points[1]!), 'opposite sides of the centreline');
  // A backward edge runs node(end1) -> node(end0).
  assert.equal(ba.to, fa.from);
});

test('absent ow/sp/l are inferred with rule names, never silent', () => {
  const topo = buildLaneTopology(tile([
    road('a', 'primary', [0, 0, 100, 0], 18), // no l, ow, sp: arterial -> 2/direction, two-way, 25
    road('b', 'residential', [0, 40, 100, 40], 10, { speedMph: 15 }), // no l/ow: local -> 1/direction; sp recorded
  ]));
  const a = topo.lanes.filter((l) => l.roadId === 'a');
  assert.equal(a.length, 4, 'arterial infers 2 lanes per direction');
  for (const l of a) {
    assert.equal(l.onewayInferred, 'oneway-two-way-default');
    assert.equal(l.speedInferred, 'speed-nyc-25');
    assert.equal(l.lanesInferred, 'lanes-arterial-default');
    assert.equal(l.speedMph, 25);
  }
  const b = topo.lanes.filter((l) => l.roadId === 'b');
  assert.equal(b.length, 2, 'local infers 1 lane per direction');
  for (const l of b) {
    assert.equal(l.lanesInferred, 'lanes-local-default');
    assert.equal(l.speedInferred, undefined, 'recorded sp has no inference flag');
    assert.equal(l.speedMph, 15);
  }
});

test('a junction on the fixture yields legs, synthetic crosswalks and connectors', () => {
  // An east-west two-way meeting a north-south one-way at (100,0).
  const topo = buildLaneTopology(tile([
    road('a', 'residential', [0, 0, 100, 0], 10, { lanes: 2 }),
    road('b', 'residential', [100, 0, 200, 0], 10, { lanes: 2 }),
    road('c', 'residential', [100, -80, 100, 0], 10, { lanes: 1, oneway: 1 }),
    road('x', 'crossing', [94, -3, 106, -3], 3), // a real crossing way north of the junction
  ]));
  const node = topo.nodes.find((n) => n.kind === 'junction')!;
  assert.ok(node, 'three road ends meeting is a junction');
  assert.equal(node.legs.length, 3);
  // The OSM crossing binds as a leg; the two uncovered legs fall back.
  const atNode = topo.xwalks.filter((x) => x.node === node.id);
  assert.equal(atNode.filter((x) => x.backing === 'osm-crossing').length, 1);
  assert.equal(atNode.filter((x) => x.backing === 'corner-fallback').length, 2);
  for (const x of atNode) assert.ok(x.inferred.startsWith('xwalk-'));
  // Connectors: no reversals onto the same way inside a junction.
  const conns = topo.connectors.filter((c) => c.node === node.id);
  assert.ok(conns.length > 0);
  for (const c of conns) {
    const inLane = topo.laneById.get(c.in)!;
    const outLane = topo.laneById.get(c.out)!;
    assert.notEqual(inLane.roadId, outLane.roadId, 'no U-turn inside a junction');
    assert.equal(c.inferred, 'connector-angle-legal');
  }
});

// --- The real tile ------------------------------------------------------------

// Verified anchors for three named intersections (docs/living-city/pr02-topology.md
// records the sources): IND 125 St station at St Nicholas Av, the IRT 125 St
// station at Lenox/Malcolm X, and the ACP/125th junction corners.
const ANCHORS: { names: [string, string]; lat: number; lon: number; toleranceM: number }[] = [
  { names: ['ST NICHOLAS AVE', 'W 125 ST'], lat: 40.810756, lon: -73.952665, toleranceM: 40 },
  { names: ['ADAM CLAYTON POWELL JR BLVD', 'W 125 ST'], lat: 40.80895, lon: -73.9483, toleranceM: 60 },
  { names: ['LENOX AVE', 'W 125 ST'], lat: 40.8077, lon: -73.9455, toleranceM: 40 },
];

test('the graph builds over the real Harlem tile with three verified 125th Street intersections', () => {
  const topo = bundled();
  assert.ok(topo.stats.nodes.junction > 100, `${topo.stats.nodes.junction} junctions`);
  assert.ok(topo.lanes.length > 800 && topo.xwalks.length > 400);
  for (const anchor of ANCHORS) {
    const node = topo.nodes.find((n) => anchor.names.every((name) => n.names.includes(name)));
    assert.ok(node, `missing ${anchor.names.join(' & ')}`);
    assert.equal(node.kind, 'junction');
    assert.equal(node.legs.length, 4, `${anchor.names.join(' & ')} is a four-way`);
    // Geography: the node centroid unprojects to within tolerance of the published anchor.
    const dLat = (node.latitude - anchor.lat) * 111_195;
    const dLon = (node.longitude - anchor.lon) * 111_195 * Math.cos((anchor.lat * Math.PI) / 180);
    const dist = Math.hypot(dLat, dLon);
    assert.ok(dist < anchor.toleranceM, `${anchor.names.join(' & ')} off by ${dist.toFixed(0)} m`);
  }
});

test('ids are byte-stable across two builds and prefixed by kind', () => {
  const a = bundled();
  const b = bundled();
  for (const key of ['nodes', 'segments', 'lanes', 'walks', 'xwalks', 'connectors'] as const) {
    assert.equal(JSON.stringify(a[key]), JSON.stringify(b[key]), `${key} changed between builds`);
  }
  for (const n of a.nodes) assert.ok(n.id.startsWith('node:'));
  for (const s of a.segments) assert.ok(s.id.startsWith('seg:'));
  for (const l of a.lanes) assert.ok(l.id.startsWith('lane:'));
  for (const w of a.walks) assert.ok(w.id.startsWith('walk:'));
  for (const x of a.xwalks) assert.ok(x.id.startsWith('xwalk:'));
  for (const c of a.connectors) assert.ok(c.id.startsWith('conn:'));
  // Lane and xwalk ids derive from CSCL sids and node ids.
  assert.ok(a.lanes.some((l) => l.id === 'lane:cscl:19401:f:0'), 'lane id carries the road id');
  const acp = a.nodes.find((n) => n.names.includes('ADAM CLAYTON POWELL JR BLVD') && n.names.includes('W 125 ST'))!;
  assert.ok(acp.id.includes('s19401'), 'node id carries member sids');
  assert.ok(a.xwalks.some((x) => x.node === acp.id), 'xwalk ids carry the node id');
});

test('no dangling lane ends: every lane lands on a node; interior stubs are named dead ends', () => {
  const topo = bundled();
  for (const lane of topo.lanes) {
    assert.ok(topo.nodeById.has(lane.from), `${lane.id} dangles at its start`);
    assert.ok(topo.nodeById.has(lane.to), `${lane.id} dangles at its end`);
  }
  // The only interior termini are real CSCL dead ends — a handful, each a
  // lone endpoint; everything else at the fringe is a clipped tile edge.
  const deadEnds = topo.nodes.filter((n) => n.kind === 'deadEnd');
  assert.ok(deadEnds.length <= 8, `${deadEnds.length} interior dead ends`);
  for (const n of deadEnds) {
    assert.equal(n.members.length, 1, 'a dead end is a single road end');
    assert.ok(Math.hypot(n.x, n.z) <= 850, 'dead ends sit inside the tile');
  }
  // Boundary nodes absorb every clipped stub: a lone end past the tile extent.
  for (const n of topo.nodes.filter((n) => n.kind === 'boundary')) {
    assert.equal(n.members.length, 1);
    assert.ok(Math.hypot(n.x, n.z) > 850, `boundary node inside the tile: ${n.id}`);
  }
});

test('inferred flags stay honest on the real tile: CSCL fields are recorded, derivations are flagged', () => {
  const topo = bundled();
  // Every carriageway on this tile carries l/sp/sid; ow is absent on two-way streets.
  assert.equal(topo.stats.recorded.lanes, 563);
  assert.equal(topo.stats.recorded.speed, 563);
  assert.equal(topo.stats.inferred.lanes, 0);
  assert.equal(topo.stats.inferred.speed, 0);
  assert.ok(topo.stats.inferred.oneway > 100, 'two-way roads carry the oneway inference');
  assert.ok(topo.stats.recorded.oneway > 100);
  // Crosswalks are all derived: the binding is ours even where an OSM way backs the centreline.
  for (const x of topo.xwalks) assert.ok(x.inferred === 'xwalk-osm-crossing' || x.inferred === 'xwalk-corner-fallback');
  // OSM crossing ways anchor the hero junctions.
  const acp = topo.nodes.find((n) => n.names.includes('ADAM CLAYTON POWELL JR BLVD') && n.names.includes('W 125 ST'))!;
  const acpX = topo.xwalks.filter((x) => x.node === acp.id);
  assert.equal(acpX.filter((x) => x.backing === 'osm-crossing').length, 4, 'ACP/125th has four real zebra legs');
});

test('saved locations are preserved: the sidecar does not touch the dataset identity', () => {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const topo = buildLaneTopology(dataset);
  assert.equal(topo.datasetId, dataset.id);
  assert.equal(topo.datasetVersion, dataset.version);
  assert.equal(dataset.id, 'harlem-apollo-20261017');
  assert.deepEqual([...dataset.origin], [-73.94975, 40.81005]);
});

test('merge radius and class set are the documented constants', () => {
  assert.equal(NODE_MERGE_METRES, 20);
  assert.ok(CARRIAGEWAY_CLASSES.has('residential') && !CARRIAGEWAY_CLASSES.has('crossing') && !CARRIAGEWAY_CLASSES.has('sidewalk'));
});

test('every lane centre sits inside its carriageway, one-way pieces included', () => {
  const topology = bundled();
  const widthOf = new Map(topology.segments.map((s) => [s.roadId, s.widthMeters]));
  const outside = topology.lanes.filter((lane) => {
    const width = widthOf.get(lane.roadId);
    return width !== undefined && Math.abs(lane.lateral) > width / 2 - lane.widthMeters / 2 + 1e-6;
  });
  assert.equal(topology.lanes.some((lane) => lane.oneway !== 0), true);
  assert.deepEqual(outside.map((lane) => lane.id), []);
});
