// The vd lane's baked cars (vd-cars.ts, from tooling/city/bake-cars.mjs):
// decodes one Valdrada body (LOD1, decimated) into plain arrays and THREE geometry.
//
// Two consumers, two frames:
// - the moving fleet (living-city/vehicle-actor.ts) draws the body as baked,
//   +Z forward, with `partId` (lofted-car.ts CAR_PARTS ids) and the colour;
// - the parked cars (street-props.ts) run length along local +x, so
//   `vdParkedCarGeometry` turns the body +90 degrees about Y (+Z to +x) and
//   adds the attributes every VertexBuffer geometry carries (uv,
//   aRoughMetal, aOcclusion, aFacade), so materials.cars and the flagged
//   car-materials.ts body read it unchanged.
//
// Distance LOD: each body also carries `mid` and `far` index lists, meshopt
// decimations of the same vertices (bake-cars.mjs), so a car seen from 100 m
// is the same Valdrada body with fewer triangles. The *LodGeometries helpers
// return one geometry per level sharing one set of vertex attributes, so the
// levels upload the vertices once and differ only by index buffer.
//
// Colour is display-space sRGB 0..1, the space the city's vertex colours are
// in. Body paint is the street-props marker: colour -1, which the cars
// material swaps for the instance tone and the fleet material for paintColor.
import type { Three } from '@acme/ui/three';
import { decodeBase64 } from './foliage-decode.ts';
import { SURFACES } from './surfaces.ts';
import { VD_CAR_PAINT_BIT, VD_CARS } from './vd-cars.ts';

export type VdCarId = (typeof VD_CARS)[number]['id'];
export const VD_CAR_IDS = VD_CARS.map((c) => c.id) as readonly VdCarId[];
/** The baked bus (Valdrada's MTA New Flyer XD40). */
export const VD_BUS_ID = 'mtaxd40' as const satisfies VdCarId;

/** Detail levels: the full baked body, then the two coarser ones. */
export const VD_LODS = ['near', 'mid', 'far'] as const;
export type VdLod = (typeof VD_LODS)[number];

/** Part ids, the same numbers as living-city/lofted-car.ts CAR_PARTS (kept here so the parked path never loads that module). */
export const VD_CAR_PARTS = { BODY: 0, WINDOW: 1, TYRE: 2, ALLOY: 3, TRIM: 4, MIRROR: 5, SIGN: 6, FRONT: 7, REAR: 8 } as const;

export interface VdCarData {
  readonly id: VdCarId;
  /** Valdrada extras.size: width (x), height (y), length (z), metres. */
  readonly size: readonly [number, number, number];
  readonly wheelbase: number;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  /** Display sRGB 0..1; -1 on body paint. */
  readonly colors: Float32Array;
  readonly partIds: Float32Array;
  readonly indices: Uint16Array;
  readonly triangles: number;
  /** Index list per detail level (`near` is `indices`). */
  readonly lodIndices: Readonly<Record<VdLod, Uint16Array>>;
}

const cache = new Map<VdCarId, VdCarData>();

/** One baked body as arrays, decoded once and shared. */
export function decodeVdCar(id: VdCarId): VdCarData {
  const hit = cache.get(id);
  if (hit) return hit;
  const car = VD_CARS.find((c) => c.id === id);
  if (!car) throw new Error(`vd-car-mesh: no baked car ${id}`);
  const n = car.vertices;
  const qb = decodeBase64(car.position);
  const q = new Int16Array(qb.buffer, qb.byteOffset, n * 3);
  const nb = decodeBase64(car.normal);
  const n8 = new Int8Array(nb.buffer, nb.byteOffset, n * 3);
  const c8 = decodeBase64(car.color);
  const p8 = decodeBase64(car.part);
  const ib = decodeBase64(car.index);
  const [lo, hi] = car.box;
  const positions = new Float32Array(n * 3);
  const normals = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const partIds = new Float32Array(n);
  for (let i = 0; i < n * 3; i++) {
    const c = i % 3;
    positions[i] = lo[c]! + ((q[i]! + 32768) / 65535) * (hi[c]! - lo[c]!);
    normals[i] = n8[i]! / 127;
  }
  for (let v = 0; v < n; v++) {
    const part = p8[v]!;
    const paint = (part & VD_CAR_PAINT_BIT) !== 0;
    partIds[v] = part & 0x7f;
    for (let c = 0; c < 3; c++) colors[v * 3 + c] = paint ? -1 : c8[v * 3 + c]! / 255;
  }
  // Copy out so the index buffer is 2-byte aligned whatever offset the base64 decode landed on.
  const indexList = (b64: string, triangles: number) => {
    const out = new Uint16Array(triangles * 3);
    new Uint8Array(out.buffer).set(decodeBase64(b64).subarray(0, out.byteLength));
    return out;
  };
  const indices = new Uint16Array(car.triangles * 3);
  new Uint8Array(indices.buffer).set(ib.subarray(0, indices.byteLength));
  const data: VdCarData = {
    id: car.id, size: car.size as unknown as [number, number, number], wheelbase: car.wheelbase,
    positions, normals, colors, partIds, indices, triangles: car.triangles,
    lodIndices: {
      near: indices,
      mid: indexList(car.lods.mid.index, car.lods.mid.triangles),
      far: indexList(car.lods.far.index, car.lods.far.triangles),
    },
  };
  cache.set(id, data);
  return data;
}

// The geometry type InstancedMesh takes (vd-trees-mesh.ts uses the same alias).
type Geometry = InstanceType<Three['InstancedMesh']>['geometry'];

type Attribute = InstanceType<Three['BufferAttribute']>;

/** One geometry per detail level over one shared attribute set; each level only swaps the index. */
function lodGeometries(THREE: Three, d: VdCarData, attributes: Readonly<Record<string, Attribute>>): Record<VdLod, Geometry> {
  const out = {} as Record<VdLod, Geometry>;
  for (const lod of VD_LODS) {
    const g: Geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(attributes)) g.setAttribute(name, attribute);
    g.setIndex(new THREE.BufferAttribute(d.lodIndices[lod], 1));
    g.computeBoundingSphere();
    out[lod] = g;
  }
  return out;
}

/** The body as baked (+Z forward), one geometry per detail level: position, normal, color, partId, index. The fleet adds its instance attributes. */
export function vdCarLodGeometries(THREE: Three, id: VdCarId): Record<VdLod, Geometry> {
  const d = decodeVdCar(id);
  return lodGeometries(THREE, d, {
    position: new THREE.BufferAttribute(d.positions, 3),
    normal: new THREE.BufferAttribute(d.normals, 3),
    color: new THREE.BufferAttribute(d.colors, 3),
    partId: new THREE.BufferAttribute(d.partIds, 1),
  });
}

/** The full-detail body as baked (+Z forward). */
export function vdCarGeometry(THREE: Three, id: VdCarId): Geometry {
  return vdCarLodGeometries(THREE, id).near;
}

/** Roughness / metalness per part, from the same SURFACES stamps the box car uses. */
function roughMetal(part: number): readonly [number, number] {
  switch (part) {
    case VD_CAR_PARTS.BODY: return SURFACES.carPaint;
    case VD_CAR_PARTS.WINDOW: return SURFACES.carGlass;
    case VD_CAR_PARTS.TYRE: return SURFACES.tyre;
    case VD_CAR_PARTS.ALLOY: return [0.3, 0.85];
    case VD_CAR_PARTS.FRONT:
    case VD_CAR_PARTS.REAR:
    case VD_CAR_PARTS.SIGN: return [0.12, 0];
    default: return [0.6, 0.2];
  }
}

/**
 * The body for street-props.ts: turned +90 degrees about Y so it runs along +x (front at +x, the box car's frame),
 * with the VertexBuffer attribute set (uv 0, aRoughMetal per part, aOcclusion 1, aFacade none) beside color and
 * partId, one geometry per detail level. Fresh arrays: the rotation does not touch the shared decode.
 */
export function vdParkedCarLodGeometries(THREE: Three, id: VdCarId): Record<VdLod, Geometry> {
  const d = decodeVdCar(id);
  const n = d.partIds.length;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const rm = new Float32Array(n * 2);
  const fac = new Float32Array(n * 2);
  for (let v = 0; v < n; v++) {
    // rotateY(+90deg): x' = z, z' = -x.
    pos[v * 3] = d.positions[v * 3 + 2]!; pos[v * 3 + 1] = d.positions[v * 3 + 1]!; pos[v * 3 + 2] = -d.positions[v * 3]!;
    nor[v * 3] = d.normals[v * 3 + 2]!; nor[v * 3 + 1] = d.normals[v * 3 + 1]!; nor[v * 3 + 2] = -d.normals[v * 3]!;
    const [r, m] = roughMetal(d.partIds[v]!);
    rm[v * 2] = r; rm[v * 2 + 1] = m;
    fac[v * 2] = -1;
  }
  return lodGeometries(THREE, d, {
    position: new THREE.BufferAttribute(pos, 3),
    normal: new THREE.BufferAttribute(nor, 3),
    color: new THREE.BufferAttribute(d.colors, 3),
    uv: new THREE.BufferAttribute(new Float32Array(n * 2), 2),
    aRoughMetal: new THREE.BufferAttribute(rm, 2),
    aOcclusion: new THREE.BufferAttribute(new Float32Array(n).fill(1), 1),
    aFacade: new THREE.BufferAttribute(fac, 2),
    partId: new THREE.BufferAttribute(d.partIds, 1),
  });
}

/** The full-detail parked body (see vdParkedCarLodGeometries). */
export function vdParkedCarGeometry(THREE: Three, id: VdCarId): Geometry {
  return vdParkedCarLodGeometries(THREE, id).near;
}

/** Deterministic 0..1 hash of an integer (vehicle id, parked slot index). */
export function vdCarHash(i: number): number {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
