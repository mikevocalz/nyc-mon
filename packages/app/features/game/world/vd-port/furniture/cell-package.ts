// The structure cell packages (tooling/city/vd-port/bake-structures.mjs): the manifest's types, the binary decoders, and
// the CPU posing that turns a cell's placements into one merged geometry per material slot, the way Valdrada's pk and lk
// parts merge their posed models per material key per cell (props.js L428-L448, life.js L117-L134).
//
// Prototype blocks, each padded to 4 bytes, in this order:
//   position  u16 x 3 over the prototype's box
//   normal    i8 x 2, octahedral
//   uv        u16 x 2 over the prototype's uv range       (when `uv`)
//   color     u8 x 4, sRGB-encoded linear rgb + 255        (when `color`)
//   extras    f16 x size per named attribute, in order     (vk's aRv vec4, aJ vec2)
//   index     u16, or u32 when `wide`
// A placement: u32 prototype, u32 level (0 near, 1 far), f32 x 12 (a 3 x 4 row-major matrix into scene metres).

/** A material descriptor, by family: 'std' (std-material.ts), 'pbr' (pbr-material.ts), 'vk*' (vk-materials.ts). */
export interface SlotDesc {
  family: string;
  name?: string;
  [k: string]: unknown;
}

export interface ProtoMeta {
  slot: number;
  castShadow: boolean;
  vertices: number;
  indices: number;
  box: readonly number[];
  uv: readonly number[] | null;
  color: boolean;
  extras: readonly (readonly [string, number])[];
  wide: boolean;
  /** '' for the shared prototype file, else the cell key whose file holds it. */
  file: string;
  offset: number;
  bytes: number;
}

export interface CellMeta {
  key: string;
  bounds: readonly number[];
  placements: number;
  placementsOffset: number;
  bytes: number;
  /** Vertices of the posed near and far levels. */
  near: number;
  far: number;
}

export interface StructureManifest {
  cell: number;
  /** pk's lamp spots (props.js L417-L420), six numbers each as data/lamps.ts. */
  lamps: readonly number[];
  nearM: number;
  placementBytes: number;
  sign: { width: number; height: number; rects: Readonly<Record<string, readonly number[]>> };
  anchors: Readonly<Record<string, unknown>>;
  slots: readonly SlotDesc[];
  protos: readonly (ProtoMeta | null)[];
  cells: readonly CellMeta[];
}

export interface Proto {
  meta: ProtoMeta;
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array | null;
  color: Float32Array | null;
  extras: Record<string, Float32Array>;
  index: Uint16Array | Uint32Array;
}

const pad = (n: number) => (n + 3) & ~3;

function half(h: number): number {
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, m = h & 1023;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}
const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const SRGB = Float32Array.from({ length: 256 }, (_, i) => srgbToLinear(i / 255));

/** Decodes one prototype from the file (shared or cell) that holds it. */
export function decodeProto(buffer: ArrayBuffer, meta: ProtoMeta): Proto {
  const n = meta.vertices;
  let o = meta.offset;
  const view = new DataView(buffer);
  const [x0, y0, z0, x1, y1, z1] = meta.box as [number, number, number, number, number, number];
  const position = new Float32Array(n * 3);
  const k = 1 / 65535;
  for (let i = 0; i < n; i++) {
    position[i * 3] = x0 + view.getUint16(o + i * 6, true) * k * (x1 - x0);
    position[i * 3 + 1] = y0 + view.getUint16(o + i * 6 + 2, true) * k * (y1 - y0);
    position[i * 3 + 2] = z0 + view.getUint16(o + i * 6 + 4, true) * k * (z1 - z0);
  }
  o += pad(n * 6);
  const normal = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let x = view.getInt8(o + i * 2) / 127, y = view.getInt8(o + i * 2 + 1) / 127;
    const z = 1 - Math.abs(x) - Math.abs(y);
    if (z < 0) { const ox = x; x = (1 - Math.abs(y)) * (ox >= 0 ? 1 : -1); y = (1 - Math.abs(ox)) * (y >= 0 ? 1 : -1); }
    const l = Math.hypot(x, y, z) || 1;   // an octahedral code is never the zero vector; the guard costs nothing
    normal[i * 3] = x / l; normal[i * 3 + 1] = y / l; normal[i * 3 + 2] = z / l;
  }
  o += pad(n * 2);
  let uv: Float32Array | null = null;
  if (meta.uv) {
    const [u0, v0, u1, v1] = meta.uv as [number, number, number, number];
    uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      uv[i * 2] = u0 + view.getUint16(o + i * 4, true) * k * (u1 - u0);
      uv[i * 2 + 1] = v0 + view.getUint16(o + i * 4 + 2, true) * k * (v1 - v0);
    }
    o += pad(n * 4);
  }
  let color: Float32Array | null = null;
  if (meta.color) {
    color = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) color[i * 3 + c] = SRGB[view.getUint8(o + i * 4 + c)]!;
    o += pad(n * 4);
  }
  const extras: Record<string, Float32Array> = {};
  for (const [name, size] of meta.extras) {
    const a = new Float32Array(n * size);
    for (let i = 0; i < n * size; i++) a[i] = half(view.getUint16(o + i * 2, true));
    extras[name] = a;
    o += pad(n * size * 2);
  }
  const index = meta.wide ? new Uint32Array(meta.indices) : new Uint16Array(meta.indices);
  for (let i = 0; i < meta.indices; i++) index[i] = meta.wide ? view.getUint32(o + i * 4, true) : view.getUint16(o + i * 2, true);
  return { meta, position, normal, uv, color, extras, index };
}

export interface Placement { proto: number; lod: number; m: Float32Array }

export function decodePlacements(buffer: ArrayBuffer, cell: CellMeta, bytesEach: number): Placement[] {
  const view = new DataView(buffer);
  const out: Placement[] = [];
  for (let i = 0; i < cell.placements; i++) {
    const o = cell.placementsOffset + i * bytesEach;
    const m = new Float32Array(12);
    for (let k = 0; k < 12; k++) m[k] = view.getFloat32(o + 8 + k * 4, true);
    out.push({ proto: view.getUint32(o, true), lod: view.getUint32(o + 4, true), m });
  }
  return out;
}

/** One material slot's merged geometry of a cell level. */
export interface SlotBatch {
  slot: number;
  castShadow: boolean;
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array | null;
  color: Float32Array | null;
  extras: Record<string, Float32Array>;
  index: Uint32Array;
  vertices: number;
}

/**
 * Poses every placement of `lod` and merges them per slot (props.js `posed`: compose, applyMatrix4, mergeGeometries).
 * The normal is transformed by the matrix's upper 3 x 3 and renormalised: the only non-rigid part of a placement is the
 * vd-port transform's 0.15 % x/z scale, so this equals the inverse-transpose to within it.
 */
export function poseCell(placements: readonly Placement[], lod: number, proto: (id: number) => Proto): SlotBatch[] {
  const bySlot = new Map<number, Placement[]>();
  for (const p of placements) {
    if (p.lod !== lod) continue;
    const s = proto(p.proto).meta.slot;
    let l = bySlot.get(s);
    if (!l) bySlot.set(s, (l = []));
    l.push(p);
  }
  const out: SlotBatch[] = [];
  for (const [slot, list] of bySlot) {
    let nv = 0, ni = 0, hasUv = false, hasColor = false, cast = false;
    const extraSizes = new Map<string, number>();
    for (const p of list) {
      const pr = proto(p.proto);
      nv += pr.meta.vertices; ni += pr.meta.indices;
      hasUv ||= pr.uv !== null; hasColor ||= pr.color !== null; cast ||= pr.meta.castShadow;
      for (const [n, s] of pr.meta.extras) extraSizes.set(n, s);
    }
    const position = new Float32Array(nv * 3), normal = new Float32Array(nv * 3);
    const uv = hasUv ? new Float32Array(nv * 2) : null;
    const color = hasColor ? new Float32Array(nv * 3).fill(1) : null;
    const extras: Record<string, Float32Array> = {};
    for (const [n, s] of extraSizes) extras[n] = new Float32Array(nv * s);
    const index = new Uint32Array(ni);
    let v = 0, ix = 0;
    for (const p of list) {
      const pr = proto(p.proto), m = p.m, n = pr.meta.vertices;
      for (let i = 0; i < n; i++) {
        const x = pr.position[i * 3]!, y = pr.position[i * 3 + 1]!, z = pr.position[i * 3 + 2]!;
        const o = (v + i) * 3;
        position[o] = m[0]! * x + m[1]! * y + m[2]! * z + m[3]!;
        position[o + 1] = m[4]! * x + m[5]! * y + m[6]! * z + m[7]!;
        position[o + 2] = m[8]! * x + m[9]! * y + m[10]! * z + m[11]!;
        const a = pr.normal[i * 3]!, b = pr.normal[i * 3 + 1]!, c = pr.normal[i * 3 + 2]!;
        const nx = m[0]! * a + m[1]! * b + m[2]! * c, ny = m[4]! * a + m[5]! * b + m[6]! * c, nz = m[8]! * a + m[9]! * b + m[10]! * c;
        const l = Math.hypot(nx, ny, nz) || 1;
        normal[o] = nx / l; normal[o + 1] = ny / l; normal[o + 2] = nz / l;
      }
      if (uv && pr.uv) uv.set(pr.uv, v * 2);
      if (color && pr.color) color.set(pr.color, v * 3);
      for (const [name, a] of Object.entries(pr.extras)) extras[name]!.set(a, v * (extraSizes.get(name) ?? 1));
      for (let i = 0; i < pr.meta.indices; i++) index[ix + i] = pr.index[i]! + v;
      v += n; ix += pr.meta.indices;
    }
    out.push({ slot, castShadow: cast, position, normal, uv, color, extras, index, vertices: nv });
  }
  return out;
}
