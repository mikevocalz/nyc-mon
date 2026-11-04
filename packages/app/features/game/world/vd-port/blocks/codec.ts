// The vd-port block packs (tooling/city/vd-port/write.mjs) to vertex arrays, decoded with the meshopt reference decoder
// (meshopt.ts). Scene metres throughout.
import { CELL, cellNum, type CellAttribute, type CellLocalPositionFrame, type CellPackage } from '../../cells/cell-rules.ts';
import { decodeVertexBuffer, decodeIndexBufferSteps, decodeVertexBufferSteps } from './meshopt.ts';

export type BlockCoordinateFrame = 'absolute' | 'cell-local';

function cellLocalPositionFrame(cx: number, cz: number): CellLocalPositionFrame {
  return Object.freeze({ kind: 'cell-local', origin: Object.freeze([cx * CELL + CELL / 2, 0, cz * CELL + CELL / 2] as const) });
}

export const VDN3_HEADER_BYTES = 64;
export const VDN3_VERTEX_STRIDE = 52;
/** Layout 1: source-linear RGB half floats, not legacy baked sRGB albedo. */
export const VDN3_LAYOUT = 1;
export const VDN3_FLAGS = { uv: 1, normal: 2, color: 4, grime: 8, weather: 16, weather4: 32 } as const;

/** Identity and bounds of the exact material/variant registry paired with a cell. */
export interface NearSurfaceRegistry {
  readonly sha256: string;
  readonly materialCount: number;
  readonly variantCount: number;
}

/** Scene-owned material resources gate attachment; eviction releases only this package's page lease. */
export interface NearCellResources {
  /** Last acquisition failure, when this producer provides detailed errors. */
  readonly error?: unknown;
  ready(): boolean;
  prefetch(): Promise<boolean>;
  /** Idempotently release this package's request/lease; the scene bank owns the underlying pages and registry. */
  release?(): void;
}

export interface NearCellInfo {
  /** VDN3 source family; each file is compacted to this render-state family. */
  readonly family?: number;
  readonly surface?: NearSurfaceRegistry;
  readonly key: string;
  readonly cx: number;
  readonly cz: number;
  readonly vertices: number;
  readonly triangles: number;
  readonly wide: boolean;
  readonly bounds: readonly number[];
  readonly bytes: number;
  /** False when the cell only streams through the cell source (a ring cell past the home square). */
  readonly bundled?: boolean;
}

/** Exact GPU attribute bytes (legacy 28B/vertex, source-faithful VDN3 76B/vertex), plus indices. */
export const nearCellBytes = (info: NearCellInfo) => info.vertices * (info.surface ? 76 : 28) + info.triangles * 3 * (info.wide ? 4 : 2);

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

export interface NearSurfaceArrays {
  readonly registry: NearSurfaceRegistry;
  readonly uv: Float32Array;
  readonly normal: Float32Array;
  /** [material ID, variant row, raw source grime, isShell=0]. IDs are exact floats. */
  readonly surface: Float32Array;
  readonly weather: Float32Array;
  readonly flags: Uint16Array;
}

export interface NearArrays {
  readonly surface?: NearSurfaceArrays;
  readonly positionFrame?: CellLocalPositionFrame;
  /** float32x3, scene metres. */
  position: Float32Array;
  /** Legacy RGBA8 baked sRGB albedo/day share; VDN3 Float32 RGB source factor with no material premultiplication. */
  color: Uint8Array | Float32Array;
  /** VDN1/2 RGBA8 emission; VDN3 has no vertex emission attribute and returns an empty array. */
  emissive: Uint8Array;
  index: Uint16Array | Uint32Array;
}

const NEAR_Q = 128;

/** Decode one finite IEEE-754 binary16 value without relying on Hermes Float16 APIs. */
export function decodeSurfaceHalf(bits: number): number {
  const sign = bits & 0x8000 ? -1 : 1;
  const exponent = (bits >>> 10) & 31, fraction = bits & 1023;
  if (exponent === 31) throw new Error('VDN3: non-finite half value');
  return exponent === 0 ? sign * fraction * 2 ** -24 : sign * (1 + fraction / 1024) * 2 ** (exponent - 15);
}

function readSurfaceRegistry(d: DataView, expected?: NearSurfaceRegistry): NearSurfaceRegistry {
  if (!expected || !/^[a-f0-9]{64}$/.test(expected.sha256)) throw new Error('VDN3: matching surface registry is required');
  if (d.getUint16(20, true) !== VDN3_LAYOUT || d.getUint16(22, true) !== VDN3_VERTEX_STRIDE) throw new Error('VDN3: unsupported source attribute layout');
  const sha256 = Array.from({ length: 32 }, (_, i) => d.getUint8(24 + i).toString(16).padStart(2, '0')).join('');
  const materialCount = d.getUint32(56, true), variantCount = d.getUint32(60, true);
  if (sha256 !== expected.sha256 || materialCount !== expected.materialCount || variantCount !== expected.variantCount) throw new Error('VDN3: surface registry identity mismatch');
  if (materialCount < 1 || materialCount > 65536 || variantCount < 1 || variantCount > 2 ** 24) throw new Error('VDN3: invalid registry bounds');
  return { sha256, materialCount, variantCount };
}

/** VDN1/2 retain their exact historical streams. VDN3 requires the paired registry before allocating vertex arrays. */
export function decodeNearCell(file: Uint8Array, cx: number, cz: number, coordinateFrame: BlockCoordinateFrame = 'absolute', registry?: NearSurfaceRegistry): NearArrays {
  const steps = decodeNearCellSteps(file, cx, cz, coordinateFrame, registry);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

/** Meshopt blocks, attribute conversion and triangle validation each retain cooperative checkpoints. */
export function* decodeNearCellSteps(file: Uint8Array, cx: number, cz: number, coordinateFrame: BlockCoordinateFrame = 'absolute', expected?: NearSurfaceRegistry): Generator<void, NearArrays, void> {
  if (file.length < 16 || file[0] !== 0x56 || file[1] !== 0x44 || file[2] !== 0x4e || ![0x31, 0x32, 0x33].includes(file[3]!)) throw new Error('not a VDN1/VDN2/VDN3 near cell');
  const v3 = file[3] === 0x33, v2 = file[3] === 0x32;
  const head = v3 ? VDN3_HEADER_BYTES : v2 ? 20 : 16;
  if (file.length < head) throw new Error('vd-port: truncated near header');
  if (!v3 && expected) throw new Error('vd-port: legacy cell cannot use a VDN3 registry');
  const dv = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const registry = v3 ? readSurfaceRegistry(dv, expected) : null;
  const n = dv.getUint32(4, true), count = dv.getUint32(8, true), word = dv.getUint32(12, true);
  const yOrigin = v2 || v3 ? dv.getFloat32(16, true) : 0;
  const wide = (word & 0x80000000) !== 0, evLen = word & 0x7fffffff;
  const stride = v3 ? VDN3_VERTEX_STRIDE : 16;
  if (!Number.isFinite(yOrigin) || count % 3 !== 0 || head + evLen >= file.length) throw new Error('vd-port: invalid near cell lengths/origin');
  const vb = new Uint8Array(n * stride);
  yield* decodeVertexBufferSteps(vb, n, stride, file.subarray(head, head + evLen));
  yield;
  const index = wide ? new Uint32Array(count) : new Uint16Array(count);
  yield* decodeIndexBufferSteps(index, count, file.subarray(head + evLen));
  yield;
  const ox = coordinateFrame === 'cell-local' ? 0 : cx * CELL + CELL / 2;
  const oz = coordinateFrame === 'cell-local' ? 0 : cz * CELL + CELL / 2;
  const position = new Float32Array(n * 3);
  const color = v3 ? new Float32Array(n * 3) : new Uint8Array(n * 4);
  const emissive = new Uint8Array(v3 ? 0 : n * 4);
  const surface: NearSurfaceArrays | undefined = registry ? {
    registry, uv: new Float32Array(n * 2), normal: new Float32Array(n * 3),
    surface: new Float32Array(n * 4), weather: new Float32Array(n * 4), flags: new Uint16Array(n),
  } : undefined;
  const v = new DataView(vb.buffer);
  for (let i = 0; i < n; i++) {
    if (i > 0 && i % 256 === 0) yield;
    const at = i * stride;
    position[i * 3] = v.getInt16(at, true) / NEAR_Q + ox;
    position[i * 3 + 1] = v.getInt16(at + 2, true) / NEAR_Q + yOrigin;
    position[i * 3 + 2] = v.getInt16(at + 4, true) / NEAR_Q + oz;
    if (!surface) {
      color.set(vb.subarray(at + 8, at + 12), i * 4);
      emissive.set(vb.subarray(at + 12, at + 16), i * 4);
      continue;
    }
    for (let c = 0; c < 3; c++) color[i * 3 + c] = decodeSurfaceHalf(v.getUint16(at + 8 + c * 2, true));
    const flags = v.getUint16(at + 14, true);
    if (flags & ~63 || ((flags & VDN3_FLAGS.weather4) && !(flags & VDN3_FLAGS.weather))) throw new Error('VDN3: invalid source presence flags');
    surface.flags[i] = flags;
    for (let c = 0; c < 2; c++) {
      const value = v.getFloat32(at + 16 + c * 4, true);
      if (!Number.isFinite(value)) throw new Error('VDN3: non-finite source UV');
      surface.uv[i * 2 + c] = value;
    }
    if (flags & VDN3_FLAGS.normal) {
      let x = Math.max(-1, v.getInt16(at + 24, true) / 32767), y = Math.max(-1, v.getInt16(at + 26, true) / 32767);
      const z = 1 - Math.abs(x) - Math.abs(y);
      if (z < 0) { const oldX = x; x = (1 - Math.abs(y)) * (oldX >= 0 ? 1 : -1); y = (1 - Math.abs(oldX)) * (y >= 0 ? 1 : -1); }
      const length = Math.hypot(x, y, z);
      surface.normal[i * 3] = x / length; surface.normal[i * 3 + 1] = y / length; surface.normal[i * 3 + 2] = z / length;
    }
    const material = v.getUint16(at + 28, true), variant = v.getUint32(at + 32, true);
    if (material >= surface.registry.materialCount || variant >= surface.registry.variantCount || variant >= 2 ** 24) throw new Error('VDN3: material/variant ID out of registry bounds');
    surface.surface[i * 4] = material; surface.surface[i * 4 + 1] = variant;
    surface.surface[i * 4 + 2] = decodeSurfaceHalf(v.getUint16(at + 30, true));
    for (let c = 0; c < 4; c++) {
      const value = v.getFloat32(at + 36 + c * 4, true);
      if (!Number.isFinite(value)) throw new Error('VDN3: non-finite source weather');
      surface.weather[i * 4 + c] = value;
    }
  }
  if (surface) for (let i = 0; i < index.length; i += 3) {
    if (i > 0 && i % 768 === 0) yield;
    const a = index[i]!, b = index[i + 1]!, c = index[i + 2]!;
    if (a >= n || b >= n || c >= n) throw new Error('VDN3: index out of vertex bounds');
    for (let field = 0; field < 2; field++) if (surface.surface[a * 4 + field] !== surface.surface[b * 4 + field] || surface.surface[a * 4 + field] !== surface.surface[c * 4 + field]) throw new Error('VDN3: material/variant IDs must be constant per triangle');
  }
  return { position, color, emissive, index, ...(surface ? { surface } : {}), ...(coordinateFrame === 'cell-local' ? { positionFrame: cellLocalPositionFrame(cx, cz) } : {}) };
}

const legacyUvs = new WeakMap<NearArrays, Float32Array>();
/** Material-aware VDN3 layout uses six native float/unorm buffers; legacy layout and color encoding stay unchanged. */
export function nearCellAttributes(a: NearArrays): Readonly<Record<string, CellAttribute>> {
  if (a.surface) return {
    position: { array: a.position, itemSize: 3, normalized: false }, color: { array: a.color, itemSize: 3, normalized: false },
    uv: { array: a.surface.uv, itemSize: 2, normalized: false }, normal: { array: a.surface.normal, itemSize: 3, normalized: false },
    aVdSurface: { array: a.surface.surface, itemSize: 4, normalized: false }, aVdWeather: { array: a.surface.weather, itemSize: 4, normalized: false },
  };
  let uv = legacyUvs.get(a);
  if (!uv) { uv = new Float32Array(a.position.length / 3 * 2); legacyUvs.set(a, uv); }
  return {
    position: { array: a.position, itemSize: 3, normalized: false }, color: { array: a.color, itemSize: 4, normalized: true },
    emissive: { array: a.emissive, itemSize: 4, normalized: true }, uv: { array: uv, itemSize: 2, normalized: false },
  };
}

export interface ShellArrays {
  readonly positionFrame?: CellLocalPositionFrame;
  position: Float32Array;
  /** RGBA8: sRGB albedo, the building's lit share in alpha. */
  color: Uint8Array;
  /** The FW14 window grid uv (Valdrada's frame). */
  uv: Float32Array;
}

/** One shell cell out of shell.bin: per-face vertices, int16x4 at 1/8 m about the cell centre, RGBA8, int16x2 uv / 1024. */
export function decodeShellCell(all: Uint8Array, info: ShellCellInfo, coordinateFrame: BlockCoordinateFrame = 'absolute'): ShellArrays {
  const n = info.vertices;
  const vb = new Uint8Array(n * 16);
  decodeVertexBuffer(vb, n, 16, all.subarray(info.offset, info.offset + info.length));
  const ox = coordinateFrame === 'cell-local' ? 0 : info.cx * CELL + CELL / 2;
  const oz = coordinateFrame === 'cell-local' ? 0 : info.cz * CELL + CELL / 2;
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
  return coordinateFrame === 'cell-local'
    ? { position, color, uv, positionFrame: cellLocalPositionFrame(info.cx, info.cz) }
    : { position, color, uv };
}

/**
 * A near cell as a streamer package that decodes when the streamer first builds it and drops its arrays on eviction.
 * `bytes` is the GPU upload: float32x3 + RGBA8 + RGBA8 per vertex, and the index.
 */
export function lazyNearPackage(info: NearCellInfo, file: () => Uint8Array, coordinateFrame: BlockCoordinateFrame = 'absolute', resources?: NearCellResources): CellPackage {
  const decoder = nearCellPreparation(file, info.cx, info.cz, coordinateFrame, info.surface);
  const get = () => {
    if (resources && !resources.ready()) throw new Error(`vd-port: near cell ${info.key} material resources are not ready`);
    return decoder.get();
  };
  const b = info.bounds;
  return {
    cx: info.cx, cz: info.cz, num: cellNum(info.cx, info.cz), size: CELL,
    ...(coordinateFrame === 'cell-local' ? { positionFrame: cellLocalPositionFrame(info.cx, info.cz) } : {}),
    get attributes(): Readonly<Record<string, CellAttribute>> {
      return nearCellAttributes(get());
    },
    get index() { return get().index; },
    vertexCount: info.vertices,
    triangles: info.triangles,
    bounds: Float64Array.from([b[0]!, b[1]!, b[2]!, b[3]!, b[4]!, b[5]!]),
    bytes: nearCellBytes(info),
    prepare: (deadline, now) => (!resources || resources.ready()) && decoder.prepare(deadline, now),
    ...(resources ? { ready: () => resources.ready(), prefetch: (wanted = true) => {
      if (!wanted) { resources.release?.(); return; }
      return resources.prefetch();
    } } : {}),
    release: decoder.release,
    releaseResources: () => resources?.release?.(),
  };
}


/** A released partial decode is discarded; a later request starts from verified bytes again. */
export function nearCellPreparation(file: () => Uint8Array, cx: number, cz: number, coordinateFrame: BlockCoordinateFrame, registry?: NearSurfaceRegistry) {
  let arrays: NearArrays | null = null;
  let steps: Generator<void, NearArrays, void> | null = null;
  const prepare = (deadline: number, now: () => number): boolean => {
    if (arrays) return true;
    if (now() >= deadline) return false;
    steps ??= decodeNearCellSteps(file(), cx, cz, coordinateFrame, registry);
    try {
      do {
        const step = steps.next();
        if (step.done) { arrays = step.value; steps = null; return true; }
      } while (now() < deadline);
      return false;
    } catch (error) {
      const failed = steps;
      steps = null;
      failed?.return(undefined as never);
      throw error;
    }
  };
  return {
    prepare,
    get() { prepare(Infinity, () => 0); return arrays!; },
    release() { steps?.return(undefined as never); steps = null; arrays = null; },
  };
}
