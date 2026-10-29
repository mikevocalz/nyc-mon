// The vd-port block packs (tooling/city/vd-port/write.mjs) to vertex arrays, decoded with the meshopt reference decoder
// (meshopt.ts). Scene metres throughout.
import { CELL, cellNum, type CellAttribute, type CellPackage } from '../../cells/cell-rules.ts';
import { decodeIndexBuffer, decodeVertexBuffer } from './meshopt.ts';

export interface NearCellInfo {
  readonly key: string;
  readonly cx: number;
  readonly cz: number;
  readonly vertices: number;
  readonly triangles: number;
  readonly wide: boolean;
  readonly bounds: readonly number[];
  readonly bytes: number;
}

export interface ShellCellInfo {
  readonly key: string;
  readonly cx: number;
  readonly cz: number;
  readonly vertices: number;
  readonly triangles: number;
  readonly offset: number;
  readonly length: number;
  readonly bounds: readonly number[];
}

export interface NearArrays {
  /** float32x3, scene metres. */
  position: Float32Array;
  /** RGBA8: sRGB albedo; alpha the emission's day share (lo / 4). */
  color: Uint8Array;
  /** RGBA8: emission (linear / 4, sRGB coded); alpha its night share (hi / 4). */
  emissive: Uint8Array;
  index: Uint16Array | Uint32Array;
}

const NEAR_Q = 128;

/** A near cell file: 'VDN1', vertex count, index count, encoded vertex length (bit 31: 32-bit indices), the two streams. */
export function decodeNearCell(file: Uint8Array, cx: number, cz: number): NearArrays {
  if (file[0] !== 0x56 || file[1] !== 0x44 || file[2] !== 0x4e || file[3] !== 0x31) throw new Error('not a VDN1 near cell');
  const dv = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const n = dv.getUint32(4, true), count = dv.getUint32(8, true), word = dv.getUint32(12, true);
  const wide = (word & 0x80000000) !== 0, evLen = word & 0x7fffffff;
  const vb = new Uint8Array(n * 16);
  decodeVertexBuffer(vb, n, 16, file.subarray(16, 16 + evLen));
  const index = wide ? new Uint32Array(count) : new Uint16Array(count);
  decodeIndexBuffer(index, count, file.subarray(16 + evLen));
  const ox = cx * CELL + CELL / 2, oz = cz * CELL + CELL / 2;
  const position = new Float32Array(n * 3), color = new Uint8Array(n * 4), emissive = new Uint8Array(n * 4);
  const v = new DataView(vb.buffer);
  for (let i = 0; i < n; i++) {
    position[i * 3] = v.getInt16(i * 16, true) / NEAR_Q + ox;
    position[i * 3 + 1] = v.getInt16(i * 16 + 2, true) / NEAR_Q;
    position[i * 3 + 2] = v.getInt16(i * 16 + 4, true) / NEAR_Q + oz;
    color.set(vb.subarray(i * 16 + 8, i * 16 + 12), i * 4);
    emissive.set(vb.subarray(i * 16 + 12, i * 16 + 16), i * 4);
  }
  return { position, color, emissive, index };
}

export interface ShellArrays {
  position: Float32Array;
  /** RGBA8: sRGB albedo, the building's lit share in alpha. */
  color: Uint8Array;
  /** The FW14 window grid uv (Valdrada's frame). */
  uv: Float32Array;
}

/** One shell cell out of shell.bin: per-face vertices, int16x4 at 1/8 m about the cell centre, RGBA8, int16x2 uv / 1024. */
export function decodeShellCell(all: Uint8Array, info: ShellCellInfo): ShellArrays {
  const n = info.vertices;
  const vb = new Uint8Array(n * 16);
  decodeVertexBuffer(vb, n, 16, all.subarray(info.offset, info.offset + info.length));
  const ox = info.cx * CELL + CELL / 2, oz = info.cz * CELL + CELL / 2;
  const position = new Float32Array(n * 3), color = new Uint8Array(n * 4), uv = new Float32Array(n * 2);
  const v = new DataView(vb.buffer);
  for (let i = 0; i < n; i++) {
    position[i * 3] = v.getInt16(i * 16, true) / 8 + ox;
    position[i * 3 + 1] = v.getInt16(i * 16 + 2, true) / 8;
    position[i * 3 + 2] = v.getInt16(i * 16 + 4, true) / 8 + oz;
    color.set(vb.subarray(i * 16 + 8, i * 16 + 12), i * 4);
    uv[i * 2] = v.getInt16(i * 16 + 12, true) / 1024;
    uv[i * 2 + 1] = v.getInt16(i * 16 + 14, true) / 1024;
  }
  return { position, color, uv };
}

/**
 * A near cell as a streamer package that decodes when the streamer first builds it and drops its arrays on eviction.
 * `bytes` is the GPU upload: float32x3 + RGBA8 + RGBA8 per vertex, and the index.
 */
export function lazyNearPackage(info: NearCellInfo, file: () => Uint8Array): CellPackage {
  let arrays: NearArrays | null = null;
  const get = () => (arrays ??= decodeNearCell(file(), info.cx, info.cz));
  const b = info.bounds;
  return {
    cx: info.cx, cz: info.cz, num: cellNum(info.cx, info.cz), size: CELL,
    get attributes(): Readonly<Record<string, CellAttribute>> {
      const a = get();
      return {
        position: { array: a.position, itemSize: 3, normalized: false },
        color: { array: a.color, itemSize: 4, normalized: true },
        emissive: { array: a.emissive, itemSize: 4, normalized: true },
      };
    },
    get index() { return get().index; },
    vertexCount: info.vertices,
    triangles: info.triangles,
    bounds: Float64Array.from([b[0]!, b[1]!, b[2]!, b[3]!, b[4]!, b[5]!]),
    bytes: info.bytes,
    release() { arrays = null; },
  };
}
