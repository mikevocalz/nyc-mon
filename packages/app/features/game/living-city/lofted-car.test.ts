// N5 (slop-grade-city §9): every Slop body builds closed lofts, triangle counts per kind are pinned, the taxi's sign
// follows the kind, and the declared registry bounds are the built meshes' extents. Pure geometry: no three import.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BODY_SPECS,
  BUS_PARTS,
  BUS_SPEC,
  CAR_PARTS,
  bodySpecForKind,
  box,
  buildBodyLoft,
  buildBusGeometryData,
  buildCarGeometryData,
  buildCarProxyGeometryData,
  buildVehicleGeometryData,
  loft,
  roundedBox,
  triangulateContour,
  type LoftedVehicleKind,
  type Part,
  type V3,
  type VehicleMeshData,
} from './lofted-car.ts';
import { LOFTED_VEHICLE_ASSETS } from './seed-assets.ts';

/** Welds coincident vertices, then counts how many triangles share each edge and sums the signed volume. */
function closure(positions: ArrayLike<number>, indices: ArrayLike<number>): { openEdges: number; volume: number } {
  const ids = new Map<string, number>();
  const weld: number[] = [];
  for (let i = 0; i < positions.length / 3; i++) {
    const key = `${Math.round(positions[i * 3]! * 1e5)},${Math.round(positions[i * 3 + 1]! * 1e5)},${Math.round(positions[i * 3 + 2]! * 1e5)}`;
    if (!ids.has(key)) ids.set(key, ids.size);
    weld.push(ids.get(key)!);
  }
  const edges = new Map<string, number>();
  let volume = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const v = [indices[t]!, indices[t + 1]!, indices[t + 2]!];
    const [a, b, c] = v.map((i) => [positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!]);
    volume += (a![0]! * (b![1]! * c![2]! - b![2]! * c![1]!) - a![1]! * (b![0]! * c![2]! - b![2]! * c![0]!) + a![2]! * (b![0]! * c![1]! - b![1]! * c![0]!)) / 6;
    const w = v.map((i) => weld[i]!);
    if (w[0] === w[1] || w[1] === w[2] || w[0] === w[2]) continue;
    for (const [p, q] of [[w[0]!, w[1]!], [w[1]!, w[2]!], [w[2]!, w[0]!]] as const) {
      const key = p < q ? `${p}-${q}` : `${q}-${p}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  return { openEdges: [...edges.values()].filter((n) => n !== 2).length, volume };
}

const partClosure = (p: Part) => closure(p.positions, p.indices);

function extents(data: VehicleMeshData): { min: V3; max: V3 } {
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < data.positions.length; i++) {
    min[i % 3] = Math.min(min[i % 3]!, data.positions[i]!);
    max[i % 3] = Math.max(max[i % 3]!, data.positions[i]!);
  }
  return { min, max };
}

test('every BODY_SPECS kind and the bus build a closed, outward body loft at both detail levels', () => {
  for (const name of ['sedan', 'suv', 'taxi'] as const) {
    const spec = BODY_SPECS[name];
    for (const detail of [1, 0]) {
      const { openEdges, volume } = partClosure(buildBodyLoft(spec, detail, detail ? spec.cabin : undefined));
      assert.equal(openEdges, 0, `${name} detail ${detail}: every edge shared by two triangles`);
      assert.ok(volume > 3.5 && volume < 6, `${name} detail ${detail}: positive volume ${volume.toFixed(3)} m³ (normals face out)`);
    }
  }
  const bus = partClosure(buildBodyLoft(BUS_SPEC, 1));
  assert.equal(bus.openEdges, 0, 'bus body is closed');
  assert.ok(bus.volume > 60 && bus.volume < 90, `bus volume ${bus.volume.toFixed(2)} m³`);
});

test('the closed trim parts are closed too: rounded boxes, boxes and capped lofts', () => {
  for (const part of [roundedBox(0.1, 0.06, 0.085, 0.035, 0.014), roundedBox(1.24, 0.12, 0.24, 0.07, 0.03), box(0.12, 0.035, 0.06)]) {
    const { openEdges, volume } = partClosure(part);
    assert.equal(openEdges, 0);
    assert.ok(volume > 0, 'outward');
  }
  const unitBox = partClosure(box(1, 1, 1));
  assert.ok(Math.abs(unitBox.volume - 1) < 1e-9, 'a unit box encloses 1 m³ with every face outward');
  // A capped square tube along +z, sections counter-clockwise from the end: the LoftGeometry winding contract.
  const square = (z: number): V3[] => [[-1, -1, z], [1, -1, z], [1, 1, z], [-1, 1, z]].reverse() as V3[];
  const tube = partClosure(loft([square(1), square(0)], { capStart: true, capEnd: true }));
  assert.equal(tube.openEdges, 0);
  assert.ok(Math.abs(tube.volume - 4) < 1e-9, `2 x 2 x 1 tube, got ${tube.volume}`);
});

test('triangulateContour fans a simple polygon into n - 2 counter-clockwise triangles', () => {
  const l: [number, number][] = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]];
  const faces = triangulateContour(l);
  assert.equal(faces.length, l.length - 2);
  let area = 0;
  for (const [a, b, c] of faces) {
    const [ax, ay] = l[a]!;
    const [bx, by] = l[b]!;
    const [cx, cy] = l[c]!;
    const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    assert.ok(cross > 0, 'counter-clockwise');
    area += cross / 2;
  }
  assert.ok(Math.abs(area - 3) < 1e-12, 'the fan covers the L exactly');
});

// Pinned triangle and vertex counts. A change here is a deliberate geometry change: update the pin and the draw
// budget note in vehicle-physical-constants.ts LOFTED_NEAR_VEHICLES together.
const PINNED: Record<LoftedVehicleKind, { triangles: number; vertices: number }> = {
  sedan: { triangles: 4152, vertices: 2761 },
  taxi: { triangles: 4240, vertices: 2849 },
  van: { triangles: 4284, vertices: 2857 },
  bus: { triangles: 4036, vertices: 2562 },
};
const PINNED_PROXY = { sedan: 494, suv: 494, taxi: 506 } as const;

test('triangle and vertex counts per kind are pinned', () => {
  for (const kind of ['sedan', 'taxi', 'van', 'bus'] as const) {
    const data = buildVehicleGeometryData(kind);
    assert.equal(data.triangles, PINNED[kind].triangles, `${kind} triangles`);
    assert.equal(data.vertexCount, PINNED[kind].vertices, `${kind} vertices`);
  }
  for (const name of ['sedan', 'suv', 'taxi'] as const) {
    assert.equal(buildCarProxyGeometryData(BODY_SPECS[name]).triangles, PINNED_PROXY[name], `${name} proxy triangles`);
  }
});

test('mesh data is self-consistent: attribute lengths, index range, unit normals, ground pivot', () => {
  for (const kind of ['sedan', 'taxi', 'van', 'bus'] as const) {
    const d = buildVehicleGeometryData(kind);
    assert.equal(d.positions.length, d.vertexCount * 3);
    assert.equal(d.normals.length, d.vertexCount * 3);
    assert.equal(d.uvs.length, d.vertexCount * 2);
    assert.equal(d.partIds.length, d.vertexCount);
    assert.equal(d.indices.length, d.triangles * 3);
    let maxIndex = 0;
    for (const i of d.indices) maxIndex = Math.max(maxIndex, i);
    assert.ok(maxIndex < d.vertexCount, `${kind}: indices in range`);
    for (let i = 0; i < d.normals.length; i += 3) {
      const l = Math.hypot(d.normals[i]!, d.normals[i + 1]!, d.normals[i + 2]!);
      assert.ok(Math.abs(l - 1) < 1e-3, `${kind}: normal ${i / 3} has length ${l}`);
    }
    for (const v of d.positions) assert.ok(Number.isFinite(v), `${kind}: finite positions`);
    const { min } = extents(d);
    assert.ok(Math.abs(min[1]) < 1e-6, `${kind}: tyres sit on y = 0, got ${min[1]}`);
  }
});

test('the taxi sign gates on the taxi kind: only the taxi body carries SIGN parts', () => {
  assert.equal(bodySpecForKind('taxi').sign, true);
  assert.equal(bodySpecForKind('sedan').sign, false);
  assert.equal(bodySpecForKind('van').sign, false);
  const hasPart = (d: VehicleMeshData, id: number) => d.partIds.some((p) => p === id);
  assert.ok(hasPart(buildCarGeometryData(BODY_SPECS.taxi), CAR_PARTS.SIGN));
  assert.ok(!hasPart(buildCarGeometryData(BODY_SPECS.sedan), CAR_PARTS.SIGN));
  assert.ok(!hasPart(buildCarGeometryData(BODY_SPECS.suv), CAR_PARTS.SIGN));
  // Taxi and sedan share one body; the sign and its mount are the whole difference.
  assert.equal(buildCarGeometryData(BODY_SPECS.taxi).triangles - buildCarGeometryData(BODY_SPECS.sedan).triangles, 88);
});

test('every car carries body, glass, tyres, alloys, trim and mirrors; the bus body, trim and roof pods', () => {
  for (const name of ['sedan', 'suv', 'taxi'] as const) {
    const ids = new Set(buildCarGeometryData(BODY_SPECS[name]).partIds);
    for (const id of [CAR_PARTS.BODY, CAR_PARTS.WINDOW, CAR_PARTS.TYRE, CAR_PARTS.ALLOY, CAR_PARTS.TRIM, CAR_PARTS.MIRROR]) {
      assert.ok(ids.has(id), `${name} has part ${id}`);
    }
  }
  const busIds = new Set(buildBusGeometryData().partIds);
  assert.deepEqual([...busIds].sort(), [BUS_PARTS.BODY, BUS_PARTS.TRIM, BUS_PARTS.POD].sort());
  // Wheel-less cars keep their arch liners.
  const bare = new Set(buildCarGeometryData(BODY_SPECS.sedan, false).partIds);
  assert.ok(!bare.has(CAR_PARTS.TYRE) && bare.has(CAR_PARTS.TRIM));
});

test('declared registry bounds are the built meshes\' extents to 1 cm, forward +Z', () => {
  for (const entry of LOFTED_VEHICLE_ASSETS) {
    const kind = entry.params!.vehicleKind as LoftedVehicleKind;
    const { min, max } = extents(buildVehicleGeometryData(kind));
    const b = entry.bounds!;
    assert.ok(Math.abs(max[2] - min[2] - b.lengthM) < 0.01, `${kind} length ${max[2] - min[2]} vs ${b.lengthM}`);
    assert.ok(Math.abs(max[0] - min[0] - b.widthM) < 0.01, `${kind} width ${max[0] - min[0]} vs ${b.widthM}`);
    assert.ok(Math.abs(max[1] - min[1] - b.heightM) < 0.01, `${kind} height ${max[1] - min[1]} vs ${b.heightM}`);
    assert.ok(max[2] > -min[2] - 0.2, `${kind}: the nose (+Z) is the long end or level`);
  }
});

test('geometry builds are deterministic and leave the specs untouched', () => {
  const before = JSON.stringify(BODY_SPECS);
  const a = buildCarGeometryData(BODY_SPECS.sedan);
  const b = buildCarGeometryData(BODY_SPECS.sedan);
  assert.deepEqual(a.positions, b.positions);
  assert.deepEqual(a.indices, b.indices);
  assert.equal(JSON.stringify(BODY_SPECS), before, 'no memo is written onto the shared spec objects');
});
