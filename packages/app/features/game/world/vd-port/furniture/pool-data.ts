// The wire format of the baked furniture data (assets/pools.bin and data/pools.ts, written by
// tooling/city/vd-port/bake-furniture.mjs) and its decoders. Plain typed-array work, no three: the pool instancer and the
// tests both read through here. A block is [byte offset, byte length] into assets/pools.bin.

export type Block = readonly [offset: number, length: number];
const bytesAt = (buf: ArrayBuffer, b: Block) => new Uint8Array(buf, b[0], b[1]);

/** One pool's geometry, city/furnitureKit.js buildFurnitureGeos() packed. */
export interface PackedGeometry {
  vertices: number;
  triangles: number;
  /** Bounding radius round the instance origin (|sphere centre| + radius, instancer.js IC26), metres at scale 1. */
  radius: number;
  /** f32 xyz. */ position: Block;
  /** i8 xyz, x127. */ normal: Block;
  /** u16 linear rgb, x65535. */ color: Block;
  /** f32 uv. */ uv: Block;
  /** u32 triangle list. */ index: Block;
}

/** The material a pool draws with (instancer.js L433-439). */
export type PoolMaterialKind = 'base' | 'lens' | 'glow' | 'tex' | 'glowTex';

export interface PackedPool {
  name: string;
  material: PoolMaterialKind;
  /** Casts into the shadow map (instancer.js: every pool but the glow pools and NO_SHADOW). */
  shadow: boolean;
  /** Low roof clutter (instancer.js ROOF_LOW): hidden from below the roof plane past 25 m. */
  roofLow: boolean;
  count: number;
  /** INSTANCE_BYTES per instance, see decodeInstances. */
  data: Block;
}

export const INSTANCE_BYTES = 24;

/** A decoded instance list: the GPU record per instance (INSTANCE_FLOATS floats) plus its foot, for culling. */
export interface Instances {
  count: number;
  /** x, y, z, yaw, sx, sy, sz, maxScale, r, g, b, lamp per instance (the three vec4 attributes, in order). `lamp` is
   *  the signal lamp code (signal-clock.ts): 0 none, 1-3 vehicle R/A/G, 4 pedestrian hand, 5 walking man, +8 serves E-W. */
  record: Float32Array;
}
export const INSTANCE_FLOATS = 12;

/**
 * Decodes a pool's instances. `groundY` is added to every instance whose flag says its height is over the ground
 * (street pieces); roof pieces carry their final height.
 */
export function decodeInstances(buf: ArrayBuffer, pool: PackedPool, groundY: (x: number, z: number) => number): Instances {
  const bytes = bytesAt(buf, pool.data);
  if (bytes.byteLength !== pool.count * INSTANCE_BYTES) throw new Error(`vd furniture ${pool.name}: ${bytes.byteLength} bytes for ${pool.count} instances`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const record = new Float32Array(pool.count * INSTANCE_FLOATS);
  const TURN = (2 * Math.PI) / 65536;
  for (let i = 0; i < pool.count; i++) {
    const o = i * INSTANCE_BYTES;
    const r = i * INSTANCE_FLOATS;
    const x = view.getFloat32(o, true);
    const z = view.getFloat32(o + 8, true);
    let y = view.getFloat32(o + 4, true);
    const flags = view.getUint8(o + 23);
    if (flags & 1) y += groundY(x, z);
    const sx = view.getUint16(o + 14, true) / 4096;
    const sy = view.getUint16(o + 16, true) / 4096;
    const sz = view.getUint16(o + 18, true) / 4096;
    record[r] = x; record[r + 1] = y; record[r + 2] = z; record[r + 3] = view.getUint16(o + 12, true) * TURN;
    record[r + 4] = sx; record[r + 5] = sy; record[r + 6] = sz; record[r + 7] = Math.max(sx, sy, sz);
    record[r + 8] = (view.getUint8(o + 20) / 255) * 2;
    record[r + 9] = (view.getUint8(o + 21) / 255) * 2;
    record[r + 10] = (view.getUint8(o + 22) / 255) * 2;
    record[r + 11] = flags >> 1;
  }
  return { count: pool.count, record };
}

export interface DecodedGeometry {
  position: Float32Array;
  normal: Float32Array;
  color: Float32Array;
  uv: Float32Array;
  index: Uint32Array;
  radius: number;
}

export function decodeGeometry(buf: ArrayBuffer, g: PackedGeometry): DecodedGeometry {
  const bytes = (b: Block) => bytesAt(buf, b);
  const pos = bytes(g.position);
  const nrm = bytes(g.normal);
  const col = bytes(g.color);
  const uv = bytes(g.uv);
  const idx = bytes(g.index);
  const f32 = (b: Uint8Array) => new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const normal = new Float32Array(g.vertices * 3);
  const n8 = new Int8Array(nrm.buffer, nrm.byteOffset, nrm.byteLength);
  for (let i = 0; i < normal.length; i++) normal[i] = n8[i]! / 127;
  const color = new Float32Array(g.vertices * 3);
  const c16 = new DataView(col.buffer, col.byteOffset, col.byteLength);
  for (let i = 0; i < color.length; i++) color[i] = c16.getUint16(i * 2, true) / 65535;
  return {
    position: f32(pos), normal, color, uv: f32(uv),
    index: new Uint32Array(idx.buffer.slice(idx.byteOffset, idx.byteOffset + idx.byteLength)),
    radius: g.radius,
  };
}

/** The panel atlas: RLE [u16 run][r g b a] to RGBA8, rows bottom-up as baked. */
export function decodeAtlas(atlas: { width: number; height: number }, rle: ArrayBuffer): Uint8Array {
  const src = new Uint8Array(rle);
  const out = new Uint8Array(atlas.width * atlas.height * 4);
  let o = 0;
  for (let i = 0; i + 6 <= src.length; i += 6) {
    const run = src[i]! | (src[i + 1]! << 8);
    for (let k = 0; k < run; k++) { out[o++] = src[i + 2]!; out[o++] = src[i + 3]!; out[o++] = src[i + 4]!; out[o++] = src[i + 5]!; }
  }
  if (o !== out.length) throw new Error(`vd panel atlas: ${o} of ${out.length} bytes`);
  return out;
}
