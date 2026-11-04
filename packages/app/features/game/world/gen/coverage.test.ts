// The gen lane's coverage tests (Phase 3 slice 4): the dataset-free district profile, the
// deferred package contract and the records path's byte-identity with the pre-slice-4 spec.
// All pure — the layer's three.js chain never loads (genCellPackages is imported but its
// three-dependent buildGen is never called).
import assert from 'node:assert/strict';
import test from 'node:test';
import { performance } from 'node:perf_hooks';
import { CELL, cellNum } from '../cells/cell-rules.ts';
import {
  GEN_DISTRICTS, GEN_LOT_SLOTS, buildGenIndex, genDistrictForCell, genSpecForCell,
  type GenDataset,
} from './spec.ts';
import { genCellPackageDeferred, genCellPackages, genRecordCellAt, GEN_EXTENT_CELLS } from './layer.ts';
import { genCellPlaces } from './places.ts';
import { emitGenCell, genCellBoxes } from './buildings.ts';

const emptyDataset = (): GenDataset => ({ buildings: [], areas: [], roads: [] });
const emptyIndex = () => buildGenIndex(emptyDataset());
const flat = (pts: readonly (readonly [number, number])[]) => pts.flat();

/** A records square of ±128 m: cells -1..0 are 'covered', everything else is district ground. */
const EXTENT = CELL;
const outParams = () => ({ index: emptyIndex(), recordsExtentMeters: EXTENT });

test('an uncovered cell specs deterministically from its key alone, tagged district', () => {
  const a = genSpecForCell(7, 7, outParams());
  const b = genSpecForCell(7, 7, outParams());
  assert.deepEqual(a, b);
  assert.equal(a.source, 'district');
  assert.ok(a.lots.length > 0, 'a district cell fills');
  // the anchor contract: at least one massing lot no matter the rolls
  assert.ok(a.lots.some((l) => l.floors > 0), 'the anchor slot builds');
  for (const lot of a.lots) {
    assert.ok(lot.rect[0]! >= 7 * CELL && lot.rect[2]! <= 8 * CELL, 'lot inside the cell in x');
    assert.ok(lot.rect[1]! >= 7 * CELL && lot.rect[3]! <= 8 * CELL, 'lot inside the cell in z');
  }
  // and the districts themselves are key-deterministic
  assert.deepEqual(genDistrictForCell(7, 7), genDistrictForCell(7, 7));
});

test('the district profile grades downtown core over mid over edge over open', () => {
  // a southerly cell ~8 km from the tile centre: the Manhattan spine's office band
  const core = genDistrictForCell(0, 62);
  assert.equal(core.name, 'core');
  const mid = genDistrictForCell(7, 7);
  assert.equal(mid.name, 'mid');
  const edge = genDistrictForCell(-40, -40);
  assert.equal(edge.name, 'edge');
  const open = genDistrictForCell(0, 160);
  assert.equal(open.name, 'open');
  assert.ok(GEN_DISTRICTS.core.fill > GEN_DISTRICTS.mid.fill);
  assert.ok(GEN_DISTRICTS.mid.fill > GEN_DISTRICTS.edge.fill);
  assert.ok(GEN_DISTRICTS.edge.fill > GEN_DISTRICTS.open.fill);
  // density lands in the specs: the core cell raises more buildings than the edge cell
  const built = (cx: number, cz: number) => genSpecForCell(cx, cz, outParams()).lots.filter((l) => l.floors > 0).length;
  assert.ok(built(0, 62) > built(-40, -40), 'core out-builds edge');
  assert.ok(built(7, 7) > built(0, 160), 'mid out-builds open');
  // the mix differs too: core rolls offices, edge stays residential
  const uses = (cx: number, cz: number) => new Set(genSpecForCell(cx, cz, outParams()).lots.map((l) => l.use));
  assert.ok(uses(0, 62).has('office'), 'the core builds offices');
});

test('covered cells are byte-identical with and without the records extent', () => {
  // a cell the index knows: areas + interior fill, unchanged by the new param
  const dataset: GenDataset = {
    buildings: [{ ring: flat([[8, 8], [60, 8], [60, 60], [8, 60]]) }],
    areas: [{ kind: 'school', ring: flat([[70, 70], [120, 70], [120, 120], [70, 120]]) }],
    roads: [{ widthMeters: 12, sidewalkMeters: 4, points: flat([[64, -16], [64, 144]]) }],
  };
  const index = buildGenIndex(dataset);
  const inside = (x: number, z: number) => Math.abs(x) <= EXTENT && Math.abs(z) <= EXTENT;
  const withExtent = genSpecForCell(0, 0, { index, inside, recordsExtentMeters: EXTENT });
  const without = genSpecForCell(0, 0, { index, inside });
  assert.deepEqual(withExtent, without);
  assert.equal(withExtent.source, 'records');
  // a bucket-less cell INSIDE the square keeps the records path too — the interior fill
  // its neighbours got, not a district profile
  const inner = genSpecForCell(0, 0, { index: emptyIndex(), inside, recordsExtentMeters: EXTENT });
  const innerNoExtent = genSpecForCell(0, 0, { index: emptyIndex(), inside });
  assert.equal(inner.source, 'records');
  assert.deepEqual(inner, innerNoExtent);
});

test('maximum-density district specs remain bounded to one lot per grid slot', () => {
  let worst = 0;
  for (const [cx, cz] of [[0, 62], [7, 7], [-40, -40], [0, 160], [30, 60]] as const) {
    const t0 = performance.now();
    const spec = genSpecForCell(cx, cz, { ...outParams(), fillShare: 1 });
    worst = Math.max(worst, performance.now() - t0);
    assert.equal(spec.lots.length, GEN_LOT_SLOTS ** 2, `${spec.key}: the maximum-density grid fills exactly once`);
    const slots = spec.lots.map(lot => {
      const x = (lot.rect[0]! + lot.rect[2]!) / 2 - cx * CELL;
      const z = (lot.rect[1]! + lot.rect[3]!) / 2 - cz * CELL;
      return `${Math.floor(x / (CELL / GEN_LOT_SLOTS))},${Math.floor(z / (CELL / GEN_LOT_SLOTS))}`;
    });
    assert.equal(new Set(slots).size, GEN_LOT_SLOTS ** 2, `${spec.key}: every grid slot is unique`);
  }
  // A concurrent CI worker can be descheduled during one tiny call. Keep the fixed-work
  // contract deterministic; the 2 ms streaming target needs a controlled benchmark.
  console.info(`[gen] max-density district spec diagnostic: ${worst.toFixed(3)} ms wall time`);
});

test('places, prisms and walks emit for district cells', () => {
  const spec = genSpecForCell(0, 62, outParams());
  const places = genCellPlaces(spec, () => 0);
  assert.equal(places.key, spec.key);
  assert.ok(places.prisms.length > 0, 'a core cell carries collider prisms');
  assert.ok(places.walks.length > 0, 'walk stubs emit');
  assert.ok(places.walks.some((w) => w.kind === 'edge'), 'building lots get perimeter loops');
  assert.ok(places.spawnAnchors.length > 0, 'a core cell earns spawn anchors');
  // a park-rolled district cell: open ground still emits its gate stub
  const open = genCellPlaces(genSpecForCell(0, 160, outParams()), () => 0);
  assert.ok(open.prisms.length >= 1, 'even the open district keeps its anchor prism');
});

test('deferred packages register O(1), prefetch on approach, suppress when empty', async () => {
  const dataset = { ...emptyDataset(), extentMeters: EXTENT };
  const t0 = performance.now();
  const packages = genCellPackages(dataset, () => 0, () => true);
  const registerMs = performance.now() - t0;
  assert.equal(packages.length, (2 * GEN_EXTENT_CELLS) ** 2, 'the full extent registers');
  // 4096 lazy packages, no spec work: registration is object creation, not generation
  assert.ok(registerMs < 250, `registering ${packages.length} cells took ${registerMs.toFixed(1)} ms`);

  const index = emptyIndex();
  const pkg = genCellPackageDeferred(7, 7, () => genSpecForCell(7, 7, { index, recordsExtentMeters: EXTENT }), () => 0);
  assert.equal(pkg.ready?.(), false);
  assert.equal(pkg.num, cellNum(7, 7));
  // the conservative bound covers the cell before any spec exists
  assert.ok(pkg.bounds[0]! <= 7 * CELL && pkg.bounds[3]! >= 8 * CELL);
  assert.ok(pkg.bounds[2]! <= 7 * CELL && pkg.bounds[5]! >= 8 * CELL);
  const landed = await pkg.prefetch?.();
  assert.equal(landed, true);
  assert.equal(pkg.ready?.(), true);
  assert.ok((pkg.triangles ?? 0) > 0);
  // byte-identical through the lazy path: emit twice, same arrays
  const spec = genSpecForCell(7, 7, { index, recordsExtentMeters: EXTENT });
  const a = emitGenCell(spec, genCellBoxes(spec, () => 0));
  assert.deepEqual(pkg.attributes.position!.array, a.position);
  assert.deepEqual(pkg.index, a.index);
  pkg.release?.();
  assert.equal(pkg.ready?.(), false);
  // and a re-prefetch re-emits the identical bytes — evict-and-regenerate holds
  await pkg.prefetch?.();
  assert.equal(pkg.ready?.(), true);
  assert.deepEqual(pkg.attributes.position!.array, a.position);

  // a records cell that rolls no massing suppresses instead of building an empty mesh
  const dead = genCellPackageDeferred(0, 0, () => genSpecForCell(0, 0, { index, inside: () => false }), () => 0);
  const deadLanded = await dead.prefetch?.();
  assert.equal(deadLanded, false);
  assert.equal(dead.ready?.(), false);
  assert.equal(dead.suppressed?.(), true);
});

test('record-covered cells outside the square are never registered', () => {
  // genRecordCellAt: inside the square never suppressed (infill is the job there); outside it,
  // only manifest-covered cells are — a synthetic extent puts every manifest cell 'outside'
  assert.equal(genRecordCellAt(0, 0, CELL), false, 'inside the square is infill ground');
  const dataset = { ...emptyDataset(), extentMeters: EXTENT };
  const all = genCellPackages(dataset, () => 0, () => true, { extentCells: 4 });
  const kept = genCellPackages(dataset, () => 0, () => true, { extentCells: 4, recordCell: (cx, cz) => genRecordCellAt(cx, cz, EXTENT) });
  assert.ok(kept.length <= all.length);
  for (const pkg of kept) assert.equal(genRecordCellAt(pkg.cx, pkg.cz, EXTENT), false, `${pkg.cx},${pkg.cz} should have been skipped`);
});
