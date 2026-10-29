// The baked Valdrada cars (vd-cars.ts) decode back to the GLB's measured
// bodies: extras.size within 2 cm, the LOD2 triangle counts, every part class
// the materials key off, and the +Z-forward frame (head lamps at +z, tail
// lamps at -z; the parked geometry turns them to +x / -x), plus the bus and
// the decimated distance levels.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { CAR_PARTS } from '../living-city/lofted-car.ts';
import {
  decodeVdCar, VD_BUS_ID, VD_CAR_IDS, VD_CAR_PARTS, VD_LODS, vdCarGeometry, vdCarLodGeometries, vdParkedCarGeometry, vdParkedCarLodGeometries,
} from './vd-car-mesh.ts';

/**
 * Valdrada fleet24 v0.4.0 root extras.size and LOD2 triangles, read from the GLBs at bake time. extras.size is the
 * LOD0 body; LOD2's decimation trims a few ends, measured in the GLB's own LOD2 node (width, length shortfall, m):
 * those are `lod2`, and the check holds the bake to them within 2 cm. Every other axis must match extras within 2 cm.
 */
const GLB = {
  lincoln: { size: [2.227, 1.553, 4.892], tris: 3834, lod2: [0, 0] },
  suv: { size: [2.435, 2.059, 5.591], tris: 3722, lod2: [-0.021, -0.039] },
  van: { size: [2.321, 2.726, 5.915], tris: 3286, lod2: [0, -0.032] },
  taxinv200: { size: [2.034, 2.329, 4.729], tris: 4947, lod2: [0, -0.155] },
  mercedes: { size: [2.002, 1.452, 4.674], tris: 3348, lod2: [-0.02, -0.026] },
  charger: { size: [2.097, 1.54, 5.006], tris: 3704, lod2: [0, 0] },
  // The XD40's extras width counts its mirrors (3.23 m); LOD2 has none, so the body is the published 102 in (2.59 m).
  mtaxd40: { size: [3.23, 3.2, 12.5], tris: 4390, lod2: [-0.64, -0.144] },
} as const;
/** The bus's LOD2 tyres sit 2.3 cm short of the ground; every car stands within 2 cm. */
const GROUND_TOLERANCE = (id: string) => (id === VD_BUS_ID ? 0.03 : 0.02);

const bounds = (p: Float32Array) => {
  const lo = [Infinity, Infinity, Infinity]; const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i++) { lo[i % 3] = Math.min(lo[i % 3]!, p[i]!); hi[i % 3] = Math.max(hi[i % 3]!, p[i]!); }
  return { lo, hi, size: hi.map((h, k) => h - lo[k]!) };
};

test('part ids match the lofted CAR_PARTS numbering', () => {
  assert.deepEqual(VD_CAR_PARTS, CAR_PARTS);
});

test('every baked car matches its GLB size within 2 cm and its LOD2 triangle count', () => {
  assert.deepEqual([...VD_CAR_IDS].sort(), Object.keys(GLB).sort());
  for (const id of VD_CAR_IDS) {
    const d = decodeVdCar(id);
    const ref = GLB[id];
    assert.equal(d.triangles, ref.tris, `${id} triangles`);
    assert.equal(d.indices.length, ref.tris * 3);
    const { size, lo } = bounds(d.positions);
    // Width and length are the body's own; height may sit under the roof extras (the cab's roof sign sits above it).
    for (const [k, short] of [[0, ref.lod2[0]], [2, ref.lod2[1]]] as const) {
      assert.ok(Math.abs(size[k]! - (ref.size[k]! + short)) < 0.02, `${id} axis ${k}: ${size[k]!.toFixed(3)} vs ${ref.size[k]} ${short}`);
    }
    assert.ok(size[1]! <= ref.size[1]! + 0.02 && size[1]! > ref.size[1]! * 0.8, `${id} height ${size[1]!.toFixed(3)}`);
    assert.ok(Math.abs(lo[1]!) < GROUND_TOLERANCE(id), `${id} stands on the ground (${lo[1]!.toFixed(3)})`);
    const nv = d.partIds.length;
    for (let i = 0; i < d.indices.length; i++) assert.ok(d.indices[i]! < nv);
  }
});

test('every car carries paint, glass, wheels, trim and both lamp ends; paint is the -1 marker', () => {
  for (const id of VD_CAR_IDS) {
    const d = decodeVdCar(id);
    const seen = new Set(d.partIds);
    // The XD40's LOD2 glazing is painted into its livery texture, so the bus has no WINDOW part.
    const parts = id === VD_BUS_ID
      ? [VD_CAR_PARTS.BODY, VD_CAR_PARTS.TRIM, VD_CAR_PARTS.FRONT, VD_CAR_PARTS.REAR]
      : [VD_CAR_PARTS.BODY, VD_CAR_PARTS.WINDOW, VD_CAR_PARTS.TRIM, VD_CAR_PARTS.FRONT, VD_CAR_PARTS.REAR];
    for (const p of parts) {
      assert.ok(seen.has(p), `${id} has part ${p}`);
    }
    assert.ok(seen.has(VD_CAR_PARTS.TYRE) || seen.has(VD_CAR_PARTS.ALLOY), `${id} has wheels`);
    let paint = 0;
    for (let v = 0; v < d.partIds.length; v++) {
      const c = d.colors[v * 3]!;
      if (c < 0) { paint++; assert.equal(d.partIds[v], VD_CAR_PARTS.BODY, `${id}: paint is body`); } else assert.ok(c <= 1);
    }
    // The TLC cab and the MTA bus wear baked liveries; every CARLA body takes the instance paint.
    if (id === 'taxinv200' || id === VD_BUS_ID) assert.equal(paint, 0); else assert.ok(paint > 300, `${id} paint verts ${paint}`);
  }
});

test('+Z is forward: head lamps sit at the front end, tail lamps at the back', () => {
  for (const id of VD_CAR_IDS) {
    const d = decodeVdCar(id);
    let front = 0; let rear = 0; let nf = 0; let nr = 0;
    for (let v = 0; v < d.partIds.length; v++) {
      if (d.partIds[v] === VD_CAR_PARTS.FRONT) { front += d.positions[v * 3 + 2]!; nf++; }
      if (d.partIds[v] === VD_CAR_PARTS.REAR) { rear += d.positions[v * 3 + 2]!; nr++; }
    }
    assert.ok(front / nf > d.size[2] * 0.3, `${id} head lamps forward (${(front / nf).toFixed(2)})`);
    assert.ok(rear / nr < -d.size[2] * 0.3, `${id} tail lamps aft (${(rear / nr).toFixed(2)})`);
  }
});

test('geometry: fleet body keeps +Z, the parked body runs along +x with the VertexBuffer attribute set', () => {
  const fleet = vdCarGeometry(THREE as never, 'lincoln');
  for (const a of ['position', 'normal', 'color', 'partId']) assert.ok(fleet.getAttribute(a), a);
  assert.ok(Math.abs(bounds((fleet.getAttribute('position') as THREE.BufferAttribute).array as Float32Array).size[2]! - 4.892) < 0.02);
  const parked = vdParkedCarGeometry(THREE as never, 'lincoln');
  for (const a of ['position', 'normal', 'color', 'uv', 'aRoughMetal', 'aOcclusion', 'aFacade', 'partId']) assert.ok(parked.getAttribute(a), a);
  const p = (parked.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
  const part = (parked.getAttribute('partId') as THREE.BufferAttribute).array as Float32Array;
  assert.ok(Math.abs(bounds(p).size[0]! - 4.892) < 0.02, 'length along x');
  let fx = 0; let n = 0;
  for (let v = 0; v < part.length; v++) if (part[v] === VD_CAR_PARTS.FRONT) { fx += p[v * 3]!; n++; }
  assert.ok(fx / n > 2, 'head lamps at +x, the box car front');
  fleet.dispose();
  parked.dispose();
});

test('distance levels: mid and far are decimations of the same body over the same vertices', () => {
  for (const id of VD_CAR_IDS) {
    const d = decodeVdCar(id);
    const nv = d.partIds.length;
    assert.equal(d.lodIndices.near, d.indices);
    const mid = d.lodIndices.mid.length / 3;
    const far = d.lodIndices.far.length / 3;
    assert.ok(mid >= d.triangles / 12 && mid <= d.triangles / 2.5, `${id} mid ${mid} of ${d.triangles}`);
    assert.ok(far >= 60 && far < mid && far <= d.triangles / 10, `${id} far ${far}`);
    for (const lod of ['mid', 'far'] as const) {
      const idx = d.lodIndices[lod];
      for (let i = 0; i < idx.length; i++) assert.ok(idx[i]! < nv, `${id} ${lod} index in range`);
      // Still the whole car: the decimation spans the body's length and stands on its wheels.
      let lo = Infinity; let hi = -Infinity; let floor = Infinity;
      for (let i = 0; i < idx.length; i++) {
        const v = idx[i]!;
        lo = Math.min(lo, d.positions[v * 3 + 2]!); hi = Math.max(hi, d.positions[v * 3 + 2]!); floor = Math.min(floor, d.positions[v * 3 + 1]!);
      }
      const { size } = bounds(d.positions);
      // Prune may drop a bumper speck at `far`; the body still spans most of its length.
      assert.ok(hi - lo > size[2]! * (lod === 'mid' ? 0.9 : 0.8), `${id} ${lod} keeps its length (${(hi - lo).toFixed(2)})`);
      assert.ok(floor < 0.15, `${id} ${lod} keeps its wheels on the ground (${floor.toFixed(3)})`);
    }
  }
});

test('the level geometries share one vertex attribute set and differ only by index', () => {
  for (const make of [vdCarLodGeometries, vdParkedCarLodGeometries]) {
    const g = make(THREE as never, 'charger');
    for (const name of Object.keys(g.near.attributes)) {
      for (const lod of VD_LODS) assert.equal(g[lod].getAttribute(name), g.near.getAttribute(name), `${name} shared by ${lod}`);
    }
    assert.notEqual(g.mid.index, g.near.index);
    assert.ok(g.far.index!.count < g.mid.index!.count && g.mid.index!.count < g.near.index!.count);
    for (const lod of VD_LODS) g[lod].dispose();
  }
});
