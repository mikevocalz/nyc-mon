// Cell rules, after Valdrada's client/src/cells/cellRules.js and
// docs/specs/cell-package.md §1: the tile is cut into CELL x CELL metre
// cells on the ground plane, cell (cx, cz) covering x in [cx*CELL, (cx+1)*CELL)
// and z in [cz*CELL, (cz+1)*CELL) (x east, z south, the tile's local metres).
// A triangle goes to the cell of its plan centroid: the mean of its three
// vertices, keeping (x, z) (cellRules.js triXZ). Degenerate triangles, all
// three vertices equal, belong nowhere and are dropped.
//
// The city's merged meshes are baked in world space with identity transforms
// (city-mesh.ts sets matrixAutoUpdate false and never moves them), so a
// vertex position is its world position and no matrix is applied here.
//
// splitByCell is the bake step (Valdrada's bakeLib): one pass over a merged
// geometry, one package per non-empty cell holding that cell's triangles in
// the source's own attribute layout. A package's arrays are the CPU copy the
// streamer builds its GPU geometry from and rebuilds from after an eviction.
import type { Three } from '@acme/ui/three';

/** Cell edge, metres (cellRules.js CELL). */
export const CELL = 128;

export function cellOf(x: number, z: number): [number, number] {
  return [Math.floor(x / CELL), Math.floor(z / CELL)];
}

/** Valdrada's numeric cell key (cellLoader.js readyNum): one number per cell for |cx|, |cz| < 32768. */
export function cellNum(cx: number, cz: number): number {
  return (cx + 32768) * 65536 + (cz + 32768);
}

export function cellFromNum(num: number): [number, number] {
  return [Math.floor(num / 65536) - 32768, (num % 65536) - 32768];
}

/** The string key, "cx_cz" (cellRules.js). */
export function cellKey(cx: number, cz: number): string {
  return `${cx}_${cz}`;
}

export interface CellAttribute {
  readonly array: Float32Array | Uint16Array | Uint32Array | Int16Array | Uint8Array | Int8Array | Int32Array | Float64Array;
  readonly itemSize: number;
  readonly normalized: boolean;
}

/** One cell's share of a merged mesh: non-indexed triangles in the source's attribute layout. */
export interface CellPackage {
  /** Chunk coordinates, in units of the chunk size the package was cut at. */
  readonly cx: number;
  readonly cz: number;
  readonly num: number;
  /** Chunk edge, metres. */
  readonly size: number;
  readonly attributes: Readonly<Record<string, CellAttribute>>;
  readonly vertexCount: number;
  /** World-space bounds of the cell's triangles: min x, y, z, max x, y, z. */
  readonly bounds: Float64Array;
  /** Vertex bytes the package uploads (index bytes included when it has an index). */
  readonly bytes: number;
  /**
   * An indexed package's triangles (`index` holds them; the attributes then hold welded vertices). Absent: non-indexed,
   * vertexCount / 3 triangles. A package built elsewhere (world/vd-port) may decode its arrays on first read of
   * `attributes` and `index`, and drop them again in `release`, which the streamer calls on eviction.
   */
  readonly index?: Uint16Array | Uint32Array | null;
  readonly triangles?: number;
  release?(): void;
  /**
   * A package whose bytes arrive asynchronously (a Metro asset fetched on demand: world/vd-port/furniture): `ready` is
   * false until they are in, and the streamer calls `prefetch` for it inside its layer's reach plus a one-chunk ring and
   * builds it once `ready`. Absent: always ready.
   */
  ready?(): boolean;
  prefetch?(): void;
  /**
   * True while a finer package of the same ground is in (a far level under its near level, world/vd-port/furniture):
   * the streamer treats it as unwanted, so it leaves as any other cell does and gives its budget back.
   */
  suppressed?(): boolean;
  /**
   * Packages that draw one thing together (a cell level's material slots, world/vd-port/furniture) share a group key:
   * the first of them builds only if all of them fit the budget, so a budget never leaves a level half drawn.
   */
  readonly group?: object;
}

type Geometry = InstanceType<Three['BufferGeometry']>;
type Attribute = InstanceType<Three['BufferAttribute']>;

type ArrayCtor = new (length: number) => CellAttribute['array'];

/**
 * Whether splitByCell can cut `geometry`: plain (not interleaved) attributes, a position, at least one triangle, no
 * morph targets and no groups (a multi-material mesh keeps its draw ranges whole).
 */
export function splittable(geometry: Geometry): boolean {
  const position = geometry.getAttribute('position') as Attribute | undefined;
  if (!position || position.count < 3) return false;
  if (geometry.groups.length > 0 || Object.keys(geometry.morphAttributes).length > 0) return false;
  for (const a of Object.values(geometry.attributes)) {
    const attr = a as Attribute & { isInterleavedBufferAttribute?: boolean };
    if (attr.isInterleavedBufferAttribute === true || !ArrayBuffer.isView(attr.array)) return false;
  }
  return true;
}

/**
 * Cuts a merged triangle geometry into per-cell packages by plan centroid. `size` is the chunk edge: CELL for the
 * L0 cells, or Valdrada's coarser chunk sizes CELL * 2^n (cell-package.md §12) for layers that stream as a whole
 * block; package (cx, cz) are then in units of `size`. Indexed sources come out non-indexed
 * (each cell gets its own vertices). `drawRange` is ignored: the whole geometry is cut.
 */
export function splitByCell(geometry: Geometry, size: number = CELL): CellPackage[] {
  const position = geometry.getAttribute('position') as Attribute;
  const p = position.array as ArrayLike<number>;
  const index = geometry.index ? (geometry.index.array as ArrayLike<number>) : null;
  const triangles = Math.floor((index ? index.length : position.count) / 3);
  const vertexAt = index ? (i: number) => index[i]! : (i: number) => i;
  // Pass 1: the cell of every triangle, and the triangle count per cell.
  const cellOfTri = new Float64Array(triangles);
  const counts = new Map<number, number>();
  for (let t = 0; t < triangles; t++) {
    const a = vertexAt(t * 3) * 3, b = vertexAt(t * 3 + 1) * 3, c = vertexAt(t * 3 + 2) * 3;
    if (p[a] === p[b] && p[a] === p[c] && p[a + 1] === p[b + 1] && p[a + 1] === p[c + 1] && p[a + 2] === p[b + 2] && p[a + 2] === p[c + 2]) {
      cellOfTri[t] = -1;
      continue;
    }
    const x = (p[a]! + p[b]! + p[c]!) / 3;
    const z = (p[a + 2]! + p[b + 2]! + p[c + 2]!) / 3;
    const num = cellNum(Math.floor(x / size), Math.floor(z / size));
    cellOfTri[t] = num;
    counts.set(num, (counts.get(num) ?? 0) + 1);
  }
  // Pass 2: allocate each cell's arrays, then copy triangle by triangle.
  const names = Object.keys(geometry.attributes);
  const sources = names.map((n) => geometry.getAttribute(n) as Attribute);
  type Out = { arrays: CellAttribute['array'][]; written: number; bounds: Float64Array };
  const outs = new Map<number, Out>();
  for (const [num, n] of counts) {
    outs.set(num, {
      arrays: sources.map((s) => new (s.array.constructor as ArrayCtor)(n * 3 * s.itemSize)),
      written: 0,
      bounds: new Float64Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]),
    });
  }
  // The bake emits a building's or a road's triangles one after another, so a cell's triangles come in runs: each run
  // is one typed-array copy per attribute (non-indexed sources) instead of a copy per vertex and component.
  const grow = (b: Float64Array, v: number) => {
    const x = p[v * 3]!, y = p[v * 3 + 1]!, z = p[v * 3 + 2]!;
    if (x < b[0]!) b[0] = x; if (y < b[1]!) b[1] = y; if (z < b[2]!) b[2] = z;
    if (x > b[3]!) b[3] = x; if (y > b[4]!) b[4] = y; if (z > b[5]!) b[5] = z;
  };
  let t = 0;
  while (t < triangles) {
    const num = cellOfTri[t]!;
    let end = t + 1;
    while (end < triangles && cellOfTri[end] === num) end++;
    if (num >= 0) {
      const out = outs.get(num)!;
      const verts = (end - t) * 3;
      if (!index) {
        for (let s = 0; s < sources.length; s++) {
          const item = sources[s]!.itemSize;
          const src = sources[s]!.array as CellAttribute['array'];
          (out.arrays[s]! as Float32Array).set((src as Float32Array).subarray(t * 3 * item, end * 3 * item), out.written * item);
        }
        for (let v = t * 3; v < end * 3; v++) grow(out.bounds, v);
      } else {
        for (let k = t * 3; k < end * 3; k++) {
          const v = vertexAt(k);
          const w = out.written + (k - t * 3);
          for (let s = 0; s < sources.length; s++) {
            const item = sources[s]!.itemSize;
            const src = sources[s]!.array as ArrayLike<number>;
            const dst = out.arrays[s]!;
            for (let j = 0; j < item; j++) dst[w * item + j] = src[v * item + j]!;
          }
          grow(out.bounds, v);
        }
      }
      out.written += verts;
    }
    t = end;
  }
  const packages: CellPackage[] = [];
  for (const [num, out] of outs) {
    const [cx, cz] = cellFromNum(num);
    const attributes: Record<string, CellAttribute> = {};
    let bytes = 0;
    names.forEach((name, s) => {
      attributes[name] = { array: out.arrays[s]!, itemSize: sources[s]!.itemSize, normalized: sources[s]!.normalized };
      bytes += out.arrays[s]!.byteLength;
    });
    packages.push({ cx, cz, num, size, attributes, vertexCount: out.written, bounds: out.bounds, bytes });
  }
  packages.sort((a, b) => a.num - b.num);
  return packages;
}

/** Euclidean distance from a point to a package's box (Valdrada stream.mjs boxDist). */
export function boxDistance(bounds: Float64Array, x: number, y: number, z: number): number {
  const dx = Math.max(bounds[0]! - x, 0, x - bounds[3]!);
  const dy = Math.max(bounds[1]! - y, 0, y - bounds[4]!);
  const dz = Math.max(bounds[2]! - z, 0, z - bounds[5]!);
  return Math.hypot(dx, dy, dz);
}
