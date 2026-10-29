// The pooled instancer's culling, after Valdrada client/src/city/instancer.js (v4 "culled instancing"): only instances
// whose bounding sphere meets the padded camera frustum are copied into a pool's draw buffer, low roof clutter is
// skipped from below the roof plane past 25 m (ROOF_LOW), and a pool with a coarse level draws it past its distance.
//
// Valdrada tests every instance's sphere on a desktop CPU. Hermes on the iPad cannot walk 120k spheres per camera move,
// so the instances are sorted into 64 m cells once at load and a cell is tested as a box first: a cell wholly inside the
// frustum is copied as one contiguous range, a cell wholly outside is skipped, and only a straddling cell (or one where
// the roof rule or the LOD distance cuts through it) is walked per instance with Valdrada's own sphere test. The result
// is the same set of instances.
import { INSTANCE_FLOATS } from './pool-data.ts';

/** instancer.js PAD_MAIN: metres added to every sphere against the view frustum. */
export const PAD_MAIN = 4;
/** instancer.js ROOF_BELOW / ROOF_DIST2: a camera this far under a low roof item, and this far off horizontally, skips it. */
export const ROOF_BELOW = 1.5;
export const ROOF_DIST = 25;
export const CELL = 64;

export interface Cell {
  /** Instance range [i0, i1) in the sorted record. */
  i0: number;
  i1: number;
  /** Box of every instance's sphere: x0, y0, z0, x1, y1, z1. */
  box: Float32Array;
  /** Lowest instance foot (y) in the cell, for the roof rule. */
  minY: number;
}

export interface CellIndex {
  record: Float32Array;
  /** Absolute CPU positions, sorted in the same order as `record`. */
  positions: Float64Array;
  count: number;
  cells: Cell[];
  /** Geometry radius at scale 1 round the instance origin. */
  radius: number;
}

/** Sorts a pool's instance records by 64 m cell and boxes each cell (one pass at load). */
export function indexCells(record: Float32Array, count: number, radius: number, positions?: Float64Array): CellIndex {
  const F = INSTANCE_FLOATS;
  const order = Array.from({ length: count }, (_, i) => i);
  const source = positions ?? new Float64Array(count * 3);
  if (!positions) for (let i = 0; i < count; i++) { source[i * 3] = record[i * F]!; source[i * 3 + 1] = record[i * F + 1]!; source[i * 3 + 2] = record[i * F + 2]!; }
  const key = (i: number) => {
    const cx = Math.floor(source[i * 3]! / CELL), cz = Math.floor(source[i * 3 + 2]! / CELL);
    return cx * 4096 + cz;
  };
  const keys = order.map(key);
  order.sort((a, b) => keys[a]! - keys[b]! || a - b);
  const sorted = new Float32Array(count * F);
  const sortedPositions = new Float64Array(count * 3);
  order.forEach((src, dst) => {
    sorted.set(record.subarray(src * F, src * F + F), dst * F);
    sortedPositions.set(source.subarray(src * 3, src * 3 + 3), dst * 3);
  });
  const cells: Cell[] = [];
  for (let i = 0; i < count;) {
    const k = keys[order[i]!]!;
    let j = i;
    const box = new Float32Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    let minY = Infinity;
    while (j < count && keys[order[j]!] === k) {
      const o = j * F;
      const r = radius * sorted[o + 7]!;
      const x = sortedPositions[j * 3]!, y = sortedPositions[j * 3 + 1]!, z = sortedPositions[j * 3 + 2]!;
      box[0] = Math.min(box[0]!, x - r); box[3] = Math.max(box[3]!, x + r);
      box[1] = Math.min(box[1]!, y - r); box[4] = Math.max(box[4]!, y + r);
      box[2] = Math.min(box[2]!, z - r); box[5] = Math.max(box[5]!, z + r);
      minY = Math.min(minY, y);
      j++;
    }
    cells.push({ i0: i, i1: j, box, minY });
    i = j;
  }
  return { record: sorted, positions: sortedPositions, count, cells, radius };
}

/** A camera for culling: frustum planes (6 x nx, ny, nz, d, normals inward) and its position. */
export interface CullView {
  planes: Float32Array;
  x: number;
  y: number;
  z: number;
}

/** -1 outside, 0 straddling, 1 inside, for a box against the planes with `pad` metres of slack. */
export function boxVsFrustum(planes: Float32Array, b: Float32Array, pad: number, ox = 0, oz = 0): -1 | 0 | 1 {
  let all = true;
  for (let p = 0; p < 6; p++) {
    const nx = planes[p * 4]!, ny = planes[p * 4 + 1]!, nz = planes[p * 4 + 2]!, d = planes[p * 4 + 3]! + pad;
    const px = (nx >= 0 ? b[3]! : b[0]!) - ox, py = ny >= 0 ? b[4]! : b[1]!, pz = (nz >= 0 ? b[5]! : b[2]!) - oz;
    if (nx * px + ny * py + nz * pz + d < 0) return -1;
    const qx = (nx >= 0 ? b[0]! : b[3]!) - ox, qy = ny >= 0 ? b[1]! : b[4]!, qz = (nz >= 0 ? b[2]! : b[5]!) - oz;
    if (nx * qx + ny * qy + nz * qz + d < 0) all = false;
  }
  return all ? 1 : 0;
}

function sphereIn(planes: Float32Array, x: number, y: number, z: number, r: number): boolean {
  for (let p = 0; p < 6; p++) {
    if (planes[p * 4]! * x + planes[p * 4 + 1]! * y + planes[p * 4 + 2]! * z + planes[p * 4 + 3]! < -r) return false;
  }
  return true;
}

const hDist2ToBox = (x: number, z: number, b: Float32Array, ox = 0, oz = 0) => {
  const dx = Math.max(b[0]! - ox - x, 0, x - (b[3]! - ox));
  const dz = Math.max(b[2]! - oz - z, 0, z - (b[5]! - oz));
  return dx * dx + dz * dz;
};

export interface CullOptions {
  pad: number;
  roofLow: boolean;
  /** Horizontal distance past which an instance draws the coarse level, or Infinity. */
  lodDistance: number;
}

/**
 * Copies the visible instances of `index` into `near` (and, past lodDistance, `far`), returns the two counts.
 * `near`/`far` must hold index.count records.
 */
export function cullPool(index: CellIndex, view: CullView, o: CullOptions, near: Float32Array, far: Float32Array | null, originX = 0, originZ = 0): [number, number] {
  const F = INSTANCE_FLOATS;
  const src = index.record;
  const pos = index.positions;
  const write = (dst: Float32Array, slot: number, i: number) => {
    const s = i * F, d = slot * F;
    for (let j = 3; j < F; j++) dst[d + j] = src[s + j]!;
    dst[d] = pos[i * 3]! - originX;
    dst[d + 1] = pos[i * 3 + 1]!;
    dst[d + 2] = pos[i * 3 + 2]! - originZ;
  };
  const lod2 = o.lodDistance * o.lodDistance;
  let n = 0, f = 0;
  for (const c of index.cells) {
    const vis = boxVsFrustum(view.planes, c.box, o.pad, originX, originZ);
    if (vis < 0) continue;
    const h2 = hDist2ToBox(view.x, view.z, c.box, originX, originZ);
    // the roof rule decides the whole cell when the camera is below every foot in it and the cell is out of reach
    if (o.roofLow && view.y < c.minY - ROOF_BELOW && h2 > ROOF_DIST * ROOF_DIST) continue;
    const roofCuts = o.roofLow && view.y < c.box[4]! - ROOF_BELOW;
    const lodCuts = far !== null && Number.isFinite(o.lodDistance) && (h2 <= lod2) !== (farthestH2(view, c.box, originX, originZ) <= lod2);
    if (vis === 1 && !roofCuts && !lodCuts) {
      if (far !== null && Number.isFinite(o.lodDistance) && h2 > lod2) { for (let i = c.i0; i < c.i1; i++) write(far, f++, i); }
      else { for (let i = c.i0; i < c.i1; i++) write(near, n++, i); }
      continue;
    }
    for (let i = c.i0; i < c.i1; i++) {
      const s = i * F;
      const x = pos[i * 3]! - originX, y = pos[i * 3 + 1]!, z = pos[i * 3 + 2]! - originZ;
      if (vis === 0 && !sphereIn(view.planes, x, y, z, index.radius * src[s + 7]! + o.pad)) continue;
      const dx = x - view.x, dz = z - view.z, d2 = dx * dx + dz * dz;
      if (o.roofLow && view.y < y - ROOF_BELOW && d2 > ROOF_DIST * ROOF_DIST) continue;
      if (far !== null && d2 > lod2) { write(far, f++, i); }
      else { write(near, n++, i); }
    }
  }
  return [n, f];
}

function farthestH2(view: CullView, b: Float32Array, ox = 0, oz = 0): number {
  const dx = Math.max(Math.abs(b[0]! - ox - view.x), Math.abs(b[3]! - ox - view.x));
  const dz = Math.max(Math.abs(b[2]! - oz - view.z), Math.abs(b[5]! - oz - view.z));
  return dx * dx + dz * dz;
}
