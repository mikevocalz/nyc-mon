// The gen lane's places tests (Phase 3 slice 2): determinism, the collider
// prisms' AABB sanity, the habitat mapping's coverage of the atlas's wire
// vocabulary, the walk stubs' shape, and the flag-off contract — all pure, no
// three, no streamer mocks. What is NOT covered: a spawn table or a ped sim
// actually consuming the records (the runtime rings that read kind-4/kind-2
// packs do not exist yet — the seam here is record-shape parity, verified
// against the decoded interfaces).
import assert from 'node:assert/strict';
import test from 'node:test';
import { CELL, cellKey, cellNum } from '../cells/cell-rules.ts';
import { pointInPrism } from '../vd-port/systems/colliders.ts';
import { SPAWN_HABITAT } from '../vd-port/systems/spawns.ts';
import type { WalkEdge } from '../../living-city/topology.ts';
import {
  GEN_USES, buildGenIndex, genSpecForCell,
  type GenDataset, type GenLotSpec, type GenSpec,
} from './spec.ts';
import {
  GEN_ROOFTOP_MIN_M, GEN_USE_HABITAT, createGenBlocked, createGenBlockedFor,
  genCellPlaces, genPlacesForTile, genPoiLabelsFor,
} from './places.ts';
import { EXPERIMENTAL_WORLD_GEN } from './flag.ts';

const flat = (pts: readonly (readonly [number, number])[]) => pts.flat();

const emptyBlock = (): GenDataset => ({ buildings: [], areas: [], roads: [] });

const schoolBlock = (): GenDataset => ({
  buildings: [],
  areas: [{ kind: 'school', ring: flat([[8, 8], [120, 8], [120, 120], [8, 120]]) }],
  roads: [],
});

/** A spec by hand, for use- and floor-exact cases the seeded roll may not produce. */
const spec = (cx: number, cz: number, lots: readonly GenLotSpec[]): GenSpec => ({
  cx, cz, key: cellKey(cx, cz), num: cellNum(cx, cz), seed: 0, source: 'records', lots,
});

const lot = (over: Partial<GenLotSpec>): GenLotSpec => ({
  use: 'home',
  rect: [20, 20, 40, 40],
  floors: 4,
  floorHeightMeters: 3.4,
  class: 'brick',
  styleId: 0,
  salt: 0.5,
  salt2: 0.5,
  ...over,
});

test('places derive deterministically from a spec', () => {
  const index = buildGenIndex(schoolBlock());
  const a = genCellPlaces(genSpecForCell(0, 0, { index }), () => 0);
  const b = genCellPlaces(genSpecForCell(0, 0, { index }), () => 0);
  assert.deepEqual(a, b);
  // and through the tile enumerator
  const t1 = genPlacesForTile({ ...emptyBlock(), extentMeters: CELL }, () => 0);
  const t2 = genPlacesForTile({ ...emptyBlock(), extentMeters: CELL }, () => 0);
  assert.deepEqual(t1, t2);
});

test('collider prisms: inside the cell box, positive volume, off the keep-outs', () => {
  // a record building and a road through cell (0,0); gen lots must keep clear
  const dataset: GenDataset = {
    buildings: [{ ring: flat([[-8, -8], [40, -8], [40, 40], [-8, 40]]) }],
    areas: [],
    roads: [{ widthMeters: 12, sidewalkMeters: 4, points: flat([[100, -16], [100, 144]]) }],
  };
  const places = genCellPlaces(genSpecForCell(0, 0, { index: buildGenIndex(dataset), fillShare: 1 }), () => 0);
  assert.ok(places.prisms.length > 0, 'expected gen buildings');
  for (const p of places.prisms) {
    // inside the cell box
    assert.ok(p.minX >= 0 && p.maxX <= CELL && p.minZ >= 0 && p.maxZ <= CELL, `prism ${p.srcId} escapes the cell`);
    // positive volume
    assert.ok(p.y1 > p.y0, `prism ${p.srcId} has no height`);
    assert.ok(p.maxX > p.minX && p.maxZ > p.minZ, `prism ${p.srcId} has no footprint`);
    // the record building's rect ring: the inflated-lot rule keeps a 1 m clear band
    assert.ok(
      p.maxX < -9 || p.minX > 41 || p.maxZ < -9 || p.minZ > 41,
      `prism ${p.srcId} overlaps the record footprint`,
    );
    // the road corridor at x = 100 (carriageway/2 + sidewalk + 4 m margin = 14)
    const corridor = 12 / 2 + 4 + 4;
    assert.ok(p.maxX + corridor <= 100 || p.minX - corridor >= 100, `prism ${p.srcId} inside the road corridor`);
    // gen ids take the top bit — disjoint from the record packing (< 2^27)
    assert.ok(p.srcId >= 0x80000000, `srcId ${p.srcId} inside the record range`);
    // ground-level stand test: the prism answers pointInPrism like a record one
    const [mx, mz] = [(p.minX + p.maxX) / 2, (p.minZ + p.maxZ) / 2];
    assert.ok(pointInPrism(mx, mz, p), 'centre outside its own prism');
  }
  // srcIds unique within the cell
  assert.equal(new Set(places.prisms.map((p) => p.srcId)).size, places.prisms.length);
});

test('every gen use maps to a legal habitat id', () => {
  for (const use of GEN_USES) {
    assert.ok(SPAWN_HABITAT.includes(GEN_USE_HABITAT[use]), `${use} -> ${GEN_USE_HABITAT[use]} not in the wire vocabulary`);
  }
});

test('spawn anchors: school is a community hub, open ground a plaza, tall lots rooftop', () => {
  // a marked school earns the civic record's habitat
  const school = genCellPlaces(genSpecForCell(0, 0, { index: buildGenIndex(schoolBlock()) }), () => 0);
  const hub = school.spawnAnchors.find((a) => a.habitat === 'community_hub');
  assert.ok(hub, 'no community_hub anchor on a school lot');
  assert.ok(school.habitats.includes('community_hub'));

  // a marked park earns the open-ground habitat
  const parkSet = genCellPlaces(
    genSpecForCell(0, 0, {
      index: buildGenIndex({ buildings: [], areas: [{ kind: 'park', ring: flat([[8, 8], [120, 8], [120, 120], [8, 120]]) }], roads: [] }),
    }),
    () => 0,
  );
  assert.ok(parkSet.spawnAnchors.some((a) => a.habitat === 'plaza'), 'no plaza anchor on a park lot');

  // the rooftop rule is the record rule: 20 m up, on the roof
  const tall = spec(0, 0, [
    lot({ use: 'office', floors: 8 }), // 27.2 m: over the bar
    lot({ use: 'home', floors: 5 }), // 17 m: under it
  ]);
  assert.ok(8 * 3.4 >= GEN_ROOFTOP_MIN_M && 5 * 3.4 < GEN_ROOFTOP_MIN_M, 'test heights bracket the rooftop bar');
  const anchors = genCellPlaces(tall, () => 2).spawnAnchors;
  const roof = anchors.find((a) => a.habitat === 'rooftop');
  assert.ok(roof, 'a 27 m office earns no rooftop anchor');
  assert.equal(roof.y, 2 + 8 * 3.4);
  assert.ok(!anchors.some((a) => a.y === 2 + 5 * 3.4), 'a 17 m home must not earn a rooftop anchor');

  // water is open ground but not a spawning place
  const water = spec(0, 0, [lot({ use: 'park', area: 'water', floors: 0 })]);
  assert.equal(genCellPlaces(water, () => 0).spawnAnchors.length, 0);
  assert.equal(genCellPlaces(water, () => 0).habitats.length, 0);
});

test('POI anchors: cell-local f32x3, containment radius, descriptor names', () => {
  const places = genCellPlaces(genSpecForCell(0, 0, { index: buildGenIndex(schoolBlock()) }), () => 0);
  const school = places.anchors.find((a) => a.use === 'school');
  assert.ok(school, 'no school anchor');
  assert.ok(school.position instanceof Float32Array);
  assert.equal(school.position.length, 3);
  // cell-local about the cell centre, inside the cell box
  assert.ok(Math.abs(school.position[0]!) <= CELL / 2 && Math.abs(school.position[2]!) <= CELL / 2);
  assert.equal(school.position[1], 0);
  // the radius stays on the lot: 0.7-cover box in a 112 m square
  assert.ok(school.radiusM > 0 && school.radiusM <= CELL / 2);
  assert.equal(school.name, 'School');
  // and the label channel sees it
  const label = places.poi.find((l) => l.text === 'School');
  assert.ok(label, 'school anchor missing from the poi labels');
  assert.ok(label.y > 0, 'the label floats over the massing');

  // interior offices anchor but carry no invented name
  const office = spec(0, 0, [lot({ use: 'office', floors: 8, rect: [30, 30, 60, 50] })]);
  const a = genCellPlaces(office, () => 0).anchors;
  assert.equal(a.length, 1);
  assert.equal(a[0]!.name, undefined);
  assert.equal(a[0]!.radiusM, 10);
  assert.equal(places.anchors.every((x) => GEN_USES.includes(x.use)), true);

  // home and mixed lots are infill: no POI anchor, no label
  const homes = genCellPlaces(spec(0, 0, [lot({ use: 'home' }), lot({ use: 'mixed' })]), () => 0);
  assert.equal(homes.anchors.length, 0);
  assert.equal(homes.poi.length, 0);
});

test('walk stubs: a loop around each building, a gate through each open lot', () => {
  const building = spec(0, 0, [lot({ use: 'home', rect: [20, 20, 50, 40] }), lot({ use: 'park', floors: 0, rect: [60, 60, 110, 90] })]);
  const { walks } = genCellPlaces(building, () => 0);
  assert.equal(walks.length, 2);
  // the shapes satisfy the LaneTopology WalkEdge contract
  const asTopology: readonly WalkEdge[] = walks;
  assert.equal(asTopology.length, 2);

  const loop = walks.find((w) => w.kind === 'edge')!;
  assert.ok(loop, 'no perimeter edge for the building lot');
  assert.equal(loop.points.length, 10); // four corners, closed
  assert.equal(loop.points[0], loop.points[8]);
  assert.equal(loop.points[1], loop.points[9]);
  assert.equal(loop.nodeA, loop.nodeB, 'a loop closes on its own node');
  assert.match(loop.id, /^walk:gen:/);
  // every corner stands off the footprint
  for (let i = 0; i + 1 < loop.points.length; i += 2) {
    const [x, z] = [loop.points[i]!, loop.points[i + 1]!];
    assert.ok(x <= 20 - 1 || x >= 50 + 1 || z <= 20 - 1 || z >= 40 + 1, `loop point ${x},${z} inside the footprint`);
  }

  const gate = walks.find((w) => w.kind === 'gate')!;
  assert.ok(gate, 'no gate path for the open lot');
  assert.notEqual(gate.nodeA, gate.nodeB);
  // a two-point path through the lot along its longer axis (50 x 30 -> x axis)
  assert.equal(gate.points.length, 4);
  assert.ok(gate.points[0]! >= 60 && gate.points[2]! <= 110);
  assert.equal(gate.points[1], 75); // the z centreline
  assert.ok(gate.widthMeters > 0);
});

test('the blocked layer blocks inside gen prisms and not beside them', () => {
  const building = spec(0, 0, [lot({ use: 'home', rect: [20, 20, 50, 40] })]);
  const blocked = createGenBlocked([genCellPlaces(building, () => 0)]);
  assert.ok(blocked(35, 30), 'the lot centre must be blocked');
  assert.ok(blocked(20.5, 30), 'the body rim reaches past the wall');
  assert.ok(!blocked(19.2, 30), 'a body clears the wall + body radius');
  assert.ok(!blocked(35, 60), 'away from the lot is free');
  assert.ok(!blocked(Number.NaN, 30), 'non-finite is never blocked');
  // a prism across a cell seam: rim points see it from either side
  const seam = spec(0, 0, [lot({ use: 'office', floors: 8, rect: [CELL - 6, 20, CELL - 1, 40] })]);
  const blockedSeam = createGenBlocked([genCellPlaces(seam, () => 0)]);
  assert.ok(blockedSeam(CELL - 3, 30), 'a prism hugging the seam blocks on its own cell');
  // places with no prisms block nothing — the flag-off equivalent
  const open = spec(0, 0, [lot({ use: 'park', floors: 0, rect: [10, 10, 60, 60] })]);
  const blockedOpen = createGenBlocked([genCellPlaces(open, () => 0)]);
  assert.ok(!blockedOpen(35, 30), 'open ground blocks nothing');
});

test('the tile helpers compose: places, blocked index and poi labels', () => {
  const dataset = { ...schoolBlock(), extentMeters: CELL };
  const places = genPlacesForTile(dataset, () => 0);
  assert.ok(places.length > 0);
  for (const cell of places) {
    assert.equal(cell.num, cellNum(cell.cx, cell.cz));
    assert.ok(cell.anchors.length + cell.prisms.length + cell.walks.length > 0);
  }
  const blocked = createGenBlockedFor(dataset, () => 0);
  const school = places.flatMap((c) => c.prisms).find((p) => p.style === 8);
  assert.ok(school, 'no school prism on the tile');
  assert.ok(blocked((school.minX + school.maxX) / 2, (school.minZ + school.maxZ) / 2), 'inside the school block is blocked');
  const labels = genPoiLabelsFor(dataset, () => 0);
  assert.ok(labels.some((l) => l.text === 'School'));
  assert.equal(new Set(labels.map((l) => l.key)).size, labels.length, 'poi keys must be unique');
});

test('the lane flag is opt-in: off, no gen consumer is built', () => {
  // The test run never sets EXPO_PUBLIC_WORLD_GEN — the flag parses falsy.
  assert.equal(EXPERIMENTAL_WORLD_GEN, false);
  // The same expression the wiring sites evaluate: flag off, no index exists.
  const dataset = { ...emptyBlock(), extentMeters: CELL };
  const blocked = EXPERIMENTAL_WORLD_GEN ? createGenBlockedFor(dataset, () => 0) : null;
  assert.equal(blocked, null);
  const poi = EXPERIMENTAL_WORLD_GEN ? genPoiLabelsFor(dataset, () => 0) : [];
  assert.equal(poi.length, 0);
});
