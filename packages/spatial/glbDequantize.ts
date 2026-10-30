// Viro (virocore's GLTF loader, native and the viro-web wasm) cannot draw
// KHR_mesh_quantization meshes. It binds every non-float vertex attribute as an
// unnormalized unsigned integer (VROGeometrySubstrateOpenGL::configureVertexDescriptor
// marks only colours normalized; parseVertexFormat maps all 2-byte types to
// GL_UNSIGNED_SHORT; createVAO then uses glVertexAttribIPointer), so a signed
// normalized int16 POSITION never reaches the shader as metres and the model is
// invisible. three.js reads the same files correctly, and the game ships them
// quantized to keep downloads small, so the fix lives here: before Viro sees a
// quantized GLB, its quantized accessors are rewritten as float32. The node
// transforms that carry the quantization scale are left as they are, which is
// exactly what a GPU does with a normalized attribute.

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_BIN = 0x004e4942; // 'BIN\0'
const FLOAT = 5126;
const QUANTIZATION = 'KHR_mesh_quantization';

type Accessor = {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  normalized?: boolean;
  count: number;
  type: string;
  min?: number[];
  max?: number[];
  sparse?: {
    count: number;
    indices: { bufferView: number; byteOffset?: number; componentType: number };
    values: { bufferView: number; byteOffset?: number };
  };
};
type BufferView = { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number; target?: number };
type Gltf = {
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  accessors?: Accessor[];
  bufferViews?: BufferView[];
  buffers?: { byteLength: number; uri?: string }[];
  meshes?: { primitives?: { attributes?: Record<string, number>; targets?: Record<string, number>[] }[] }[];
  animations?: { samplers?: { output: number }[] }[];
};

const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const BYTES: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

/** The float a GPU would read for one stored component (glTF 2.0 §3.11, normalized integers). */
export function decodeComponent(value: number, componentType: number, normalized: boolean): number {
  if (!normalized) return value;
  switch (componentType) {
    case 5120: return Math.max(value / 127, -1);
    case 5121: return value / 255;
    case 5122: return Math.max(value / 32767, -1);
    case 5123: return value / 65535;
    default: return value;
  }
}

function readComponent(view: DataView, offset: number, componentType: number): number {
  switch (componentType) {
    case 5120: return view.getInt8(offset);
    case 5121: return view.getUint8(offset);
    case 5122: return view.getInt16(offset, true);
    case 5123: return view.getUint16(offset, true);
    case 5125: return view.getUint32(offset, true);
    default: return view.getFloat32(offset, true);
  }
}

type Chunks = { json: Gltf; bin: Uint8Array | null };

function readChunks(glb: Uint8Array): Chunks | null {
  if (glb.byteLength < 20) return null;
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC || view.getUint32(4, true) !== 2) return null;
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== CHUNK_JSON || 20 + jsonLength > glb.byteLength) return null;
  const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLength))) as Gltf;
  let bin: Uint8Array | null = null;
  const binStart = 20 + jsonLength;
  if (binStart + 8 <= glb.byteLength && view.getUint32(binStart + 4, true) === CHUNK_BIN) {
    bin = glb.subarray(binStart + 8, binStart + 8 + view.getUint32(binStart, true));
  }
  return { json, bin };
}

/** True when Viro would draw this GLB blank: it declares KHR_mesh_quantization. */
export function isQuantizedGlb(glb: Uint8Array): boolean {
  try {
    return readChunks(glb)?.json.extensionsUsed?.includes(QUANTIZATION) ?? false;
  } catch {
    return false;
  }
}

/** Accessors Viro reads as float vertex or animation data. Indices and JOINTS_n stay integers. */
function floatAccessors(json: Gltf): Set<number> {
  const out = new Set<number>();
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      for (const [name, index] of Object.entries(primitive.attributes ?? {})) if (!name.startsWith('JOINTS_')) out.add(index);
      for (const target of primitive.targets ?? []) for (const index of Object.values(target)) out.add(index);
    }
  }
  for (const animation of json.animations ?? []) for (const sampler of animation.samplers ?? []) out.add(sampler.output);
  return out;
}

/** The accessor's values as float32, dense, with any sparse substitution applied. */
function decodeAccessor(json: Gltf, bin: Uint8Array, accessor: Accessor): Float32Array {
  const components = COMPONENTS[accessor.type] ?? 1;
  const out = new Float32Array(accessor.count * components);
  const binView = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const size = BYTES[accessor.componentType] ?? 4;
  const normalized = accessor.normalized === true;
  if (accessor.bufferView !== undefined) {
    const bufferView = json.bufferViews![accessor.bufferView]!;
    const stride = bufferView.byteStride || size * components;
    const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    for (let element = 0; element < accessor.count; element++) {
      for (let component = 0; component < components; component++) {
        const raw = readComponent(binView, start + element * stride + component * size, accessor.componentType);
        out[element * components + component] = decodeComponent(raw, accessor.componentType, normalized);
      }
    }
  }
  const sparse = accessor.sparse;
  if (sparse) {
    const indexView = json.bufferViews![sparse.indices.bufferView]!;
    const valueView = json.bufferViews![sparse.values.bufferView]!;
    const indexStart = (indexView.byteOffset ?? 0) + (sparse.indices.byteOffset ?? 0);
    const valueStart = (valueView.byteOffset ?? 0) + (sparse.values.byteOffset ?? 0);
    const indexSize = BYTES[sparse.indices.componentType] ?? 4;
    for (let n = 0; n < sparse.count; n++) {
      const element = readComponent(binView, indexStart + n * indexSize, sparse.indices.componentType);
      if (element >= accessor.count) throw new Error('This GLB has an accessor Viro cannot read.');
      for (let component = 0; component < components; component++) {
        const raw = readComponent(binView, valueStart + (n * components + component) * size, accessor.componentType);
        out[element * components + component] = decodeComponent(raw, accessor.componentType, normalized);
      }
    }
  }
  return out;
}

const pad4 = (n: number) => (n + 3) & ~3;

/** Float data the preview will build for one file; far above any real Mon (lil-ratti needs ~40 MB). */
export const MAX_DEQUANTIZED_BYTES = 256 * 1024 * 1024;

const isIndex = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** Throws unless every read `decodeAccessor` will make lies inside the BIN chunk. */
function checkAccessor(json: Gltf, bin: Uint8Array, accessor: Accessor) {
  const components = COMPONENTS[accessor.type];
  const size = BYTES[accessor.componentType];
  if (!components || !size || !isIndex(accessor.count) || !isIndex(accessor.byteOffset ?? 0)) throw new Error('This GLB has an accessor Viro cannot read.');
  const span = (viewIndex: unknown, offset: unknown, count: number, elementBytes: number, stride?: unknown) => {
    const view = isIndex(viewIndex) ? json.bufferViews?.[viewIndex] : undefined;
    if (!view || view.buffer !== 0 || !isIndex(view.byteOffset ?? 0) || !isIndex(offset ?? 0) || !isIndex(stride ?? 0)) throw new Error('This GLB has an accessor Viro cannot read.');
    const step = (stride as number | undefined) || elementBytes;
    if (step < elementBytes) throw new Error('This GLB has an accessor Viro cannot read.');
    const end = (view.byteOffset ?? 0) + ((offset as number | undefined) ?? 0) + (count > 0 ? (count - 1) * step + elementBytes : 0);
    if (end > bin.byteLength) throw new Error('This GLB points past its own data.');
  };
  if (accessor.bufferView !== undefined) {
    span(accessor.bufferView, accessor.byteOffset, accessor.count, size * components, json.bufferViews?.[accessor.bufferView]?.byteStride);
  }
  const sparse = accessor.sparse;
  if (sparse) {
    const indexSize = BYTES[sparse.indices.componentType];
    if (!indexSize || !isIndex(sparse.count) || sparse.count > accessor.count) throw new Error('This GLB has an accessor Viro cannot read.');
    span(sparse.indices.bufferView, sparse.indices.byteOffset, sparse.count, indexSize);
    span(sparse.values.bufferView, sparse.values.byteOffset, sparse.count, size * components);
  }
}

/**
 * A copy of `glb` with every quantized vertex, morph target and animation
 * accessor stored as float32, and KHR_mesh_quantization dropped. Returns the
 * input unchanged when it is not quantized.
 */
export function dequantizeGlb(glb: Uint8Array): Uint8Array {
  const chunks = readChunks(glb);
  if (!chunks?.bin || !chunks.json.extensionsUsed?.includes(QUANTIZATION)) return glb;
  const { json, bin } = chunks;
  const accessors = json.accessors ?? [];
  json.bufferViews ??= [];

  const appended: Float32Array[] = [];
  let tail = pad4(bin.byteLength);
  for (const index of floatAccessors(json)) {
    const accessor = accessors[index];
    if (!accessor || (accessor.componentType === FLOAT && !accessor.sparse)) continue;
    checkAccessor(json, bin, accessor);
    const bytes = accessor.count * (COMPONENTS[accessor.type] ?? 1) * 4;
    if (tail + bytes > MAX_DEQUANTIZED_BYTES) throw new Error('This GLB is too large to preview.');
    const floats = decodeAccessor(json, bin, accessor);
    json.bufferViews.push({ buffer: 0, byteOffset: tail, byteLength: floats.byteLength });
    const normalized = accessor.normalized === true;
    const componentType = accessor.componentType;
    accessor.bufferView = json.bufferViews.length - 1;
    accessor.byteOffset = 0;
    accessor.componentType = FLOAT;
    delete accessor.normalized;
    delete accessor.sparse;
    if (accessor.min) accessor.min = accessor.min.map((v) => decodeComponent(v, componentType, normalized));
    if (accessor.max) accessor.max = accessor.max.map((v) => decodeComponent(v, componentType, normalized));
    appended.push(floats);
    tail += floats.byteLength; // float32 data keeps 4-byte alignment
  }

  const drop = (list?: string[]) => list?.filter((name) => name !== QUANTIZATION);
  json.extensionsUsed = drop(json.extensionsUsed);
  json.extensionsRequired = drop(json.extensionsRequired);
  if (!json.extensionsUsed?.length) delete json.extensionsUsed;
  if (!json.extensionsRequired?.length) delete json.extensionsRequired;
  json.buffers![0]!.byteLength = tail;

  // Pad the encoded bytes, not the string: a non-ASCII name is more than one byte.
  const encoded = new TextEncoder().encode(JSON.stringify(json));
  const jsonBytes = new Uint8Array(pad4(encoded.byteLength)).fill(0x20);
  jsonBytes.set(encoded);
  const total = 12 + 8 + jsonBytes.byteLength + 8 + tail;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.byteLength, true);
  view.setUint32(16, CHUNK_JSON, true);
  out.set(jsonBytes, 20);
  const binHeader = 20 + jsonBytes.byteLength;
  view.setUint32(binHeader, tail, true);
  view.setUint32(binHeader + 4, CHUNK_BIN, true);
  out.set(bin, binHeader + 8);
  let offset = binHeader + 8 + pad4(bin.byteLength);
  for (const floats of appended) {
    out.set(new Uint8Array(floats.buffer, floats.byteOffset, floats.byteLength), offset);
    offset += floats.byteLength;
  }
  return out;
}
