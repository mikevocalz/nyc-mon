// The preview frames a model by how much room it needs while it turns. That
// takes the model's vertices in its bind pose around the origin it spins
// about. glb.ts stores a height at upload, but it reads a skinned mesh through
// its node transform, which glTF says a skinned mesh ignores (Squeaklet is
// 0.68 m tall in its bind pose, glb.ts says 0.619), so the preview reads the
// points itself from the bytes it already fetched.

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_BIN = 0x004e4942; // 'BIN\0'
const FLOAT = 5126;

type Node = { mesh?: number; skin?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] };
type Accessor = { bufferView?: number; byteOffset?: number; componentType?: number; normalized?: boolean; count?: number; type?: string; min?: number[]; max?: number[] };
type Gltf = {
  nodes?: Node[];
  meshes?: { primitives?: { attributes?: { POSITION?: number } }[] }[];
  skins?: { joints?: number[]; inverseBindMatrices?: number }[];
  accessors?: Accessor[];
  bufferViews?: { byteOffset?: number; byteLength?: number; byteStride?: number }[];
  scenes?: { nodes?: number[] }[];
  scene?: number;
};

/** Bind-pose vertex positions in metres, before the placement scale, as x, y, z triples. */
export type ModelPoints = Float32Array;

type Mat4 = number[];
const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// Column-major, as glTF stores it.
function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r]! += a[k * 4 + r]! * b[c * 4 + k]!;
  return out;
}

function localMatrix(node: Node): Mat4 {
  if (node.matrix?.length === 16) return node.matrix;
  const [tx = 0, ty = 0, tz = 0] = node.translation ?? [];
  const [x = 0, y = 0, z = 0, w = 1] = node.rotation ?? [];
  const [sx = 1, sy = 1, sz = 1] = node.scale ?? [];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

// KHR_mesh_quantization stores POSITION min/max as normalized integers.
const NORMALIZED_MAX: Record<number, number> = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
const decode = (value: number, accessor: Accessor) => {
  const max = accessor.normalized && accessor.componentType ? NORMALIZED_MAX[accessor.componentType] : undefined;
  return max ? Math.max(value / max, -1) : value;
};

function readChunks(glb: Uint8Array): { json: Gltf; bin: DataView | null } | null {
  if (glb.byteLength < 20) return null;
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) return null;
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== CHUNK_JSON || 20 + jsonLength > glb.byteLength) return null;
  const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLength))) as Gltf;
  const binStart = 20 + jsonLength;
  let bin: DataView | null = null;
  if (binStart + 8 <= glb.byteLength && view.getUint32(binStart + 4, true) === CHUNK_BIN) {
    const length = Math.min(view.getUint32(binStart, true), glb.byteLength - binStart - 8);
    bin = new DataView(glb.buffer, glb.byteOffset + binStart + 8, length);
  }
  return { json, bin };
}

/** The skin's first inverse bind matrix, or null when it cannot be read. */
function inverseBind(json: Gltf, bin: DataView | null, skinIndex: number): Mat4 | null {
  const accessor = json.accessors?.[json.skins?.[skinIndex]?.inverseBindMatrices ?? -1];
  if (!accessor || accessor.componentType !== FLOAT || accessor.type !== 'MAT4' || !bin) return null;
  const view = json.bufferViews?.[accessor.bufferView ?? -1];
  if (!view) return null;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  if (start + 64 > bin.byteLength) return null;
  return Array.from({ length: 16 }, (_, i) => bin.getFloat32(start + i * 4, true));
}

/** The accessor's float32 vec3 values, or null when they are not stored that way or overrun the BIN chunk. */
function floatVec3(json: Gltf, bin: DataView | null, accessor: Accessor): Float32Array | null {
  if (!bin || accessor.componentType !== FLOAT || accessor.type !== 'VEC3' || !accessor.count) return null;
  const view = json.bufferViews?.[accessor.bufferView ?? -1];
  if (!view) return null;
  const stride = view.byteStride || 12;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  if (stride < 12 || start + (accessor.count - 1) * stride + 12 > bin.byteLength) return null;
  const out = new Float32Array(accessor.count * 3);
  for (let i = 0; i < accessor.count; i++) {
    for (let c = 0; c < 3; c++) out[i * 3 + c] = bin.getFloat32(start + i * stride + c * 4, true);
  }
  return out;
}

/**
 * Bind-pose vertex positions of every mesh in the default scene. A skinned mesh
 * is placed by its first joint (joint world matrix times that joint's inverse
 * bind matrix), which in the bind pose is where every joint puts it; its own
 * node transform is ignored, as glTF requires. A primitive whose positions are
 * not float32 (pass the Viro-readable copy to get them) adds the eight corners
 * of its accessor box instead. Morph targets and animation are not applied.
 * Null when nothing is readable.
 */
export function readModelPoints(glb: Uint8Array): ModelPoints | null {
  let chunks: ReturnType<typeof readChunks>;
  try {
    chunks = readChunks(glb);
  } catch {
    return null;
  }
  if (!chunks) return null;
  const { json, bin } = chunks;
  const nodes = json.nodes ?? [];

  // World matrix of every node reachable from the scene.
  const world = new Map<number, Mat4>();
  const walk = (index: number, parent: Mat4, depth: number) => {
    const node = nodes[index];
    if (!node || depth > 64 || world.has(index)) return;
    const matrix = multiply(parent, localMatrix(node));
    world.set(index, matrix);
    for (const child of node.children ?? []) walk(child, matrix, depth + 1);
  };
  const roots = json.scenes?.[json.scene ?? 0]?.nodes ?? nodes.map((_, i) => i).filter((i) => !nodes.some((n) => n.children?.includes(i)));
  for (const root of roots) walk(root, IDENTITY, 0);

  const parts: Float32Array[] = [];
  for (const [index, nodeWorld] of world) {
    const node = nodes[index]!;
    const mesh = node.mesh === undefined ? undefined : json.meshes?.[node.mesh];
    if (!mesh) continue;
    let m = nodeWorld;
    if (node.skin !== undefined) {
      const joint = json.skins?.[node.skin]?.joints?.[0];
      const jointWorld = joint === undefined ? undefined : world.get(joint);
      const ibm = inverseBind(json, bin, node.skin);
      if (jointWorld && ibm) m = multiply(jointWorld, ibm);
    }
    for (const primitive of mesh.primitives ?? []) {
      const accessor = json.accessors?.[primitive.attributes?.POSITION ?? -1];
      if (!accessor) continue;
      let local = floatVec3(json, bin, accessor);
      if (!local) {
        if (accessor.min?.length !== 3 || accessor.max?.length !== 3) continue;
        const lo = accessor.min.map((v) => decode(v, accessor));
        const hi = accessor.max.map((v) => decode(v, accessor));
        local = new Float32Array(24);
        let k = 0;
        for (const cx of [lo[0]!, hi[0]!]) for (const cy of [lo[1]!, hi[1]!]) for (const cz of [lo[2]!, hi[2]!]) local.set([cx, cy, cz], (k++) * 3);
      }
      const placed = new Float32Array(local.length);
      for (let i = 0; i < local.length; i += 3) {
        const x = local[i]!;
        const y = local[i + 1]!;
        const z = local[i + 2]!;
        placed[i] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
        placed[i + 1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
        placed[i + 2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
      }
      parts.push(placed);
    }
  }
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  if (total === 0) return null;
  const out = new Float32Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
