// Reads what the console needs from a GLB upload: the container check (an
// upload is a trust boundary), the animation clip names, the morph target names
// and the model's height. Same container rules as tooling/assets/validate-glb.mjs.

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
/** Each clip and morph target becomes a database row; a real Mon has a handful. */
const MAX_CLIPS = 200;
const MAX_MORPH_TARGETS = 500;
const MAX_NAME = 128;

export type GlbFacts = {
  animationClips: string[];
  morphTargets: string[];
  /** POSITION accessor extent on Y, in glTF metres. */
  heightMeters: number | null;
};

type GltfJson = {
  asset?: { version?: string };
  animations?: { name?: string; samplers?: { interpolation?: string }[] }[];
  meshes?: { extras?: { targetNames?: unknown }; primitives?: { attributes?: { POSITION?: number } }[] }[];
  accessors?: { bufferView?: number; sparse?: unknown; min?: number[]; max?: number[]; normalized?: boolean; componentType?: number }[];
  nodes?: { mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }[];
  scenes?: { nodes?: number[] }[];
  scene?: number;
};

type Mat4 = number[];
const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// Column-major, as glTF stores it.
const multiply = (a: Mat4, b: Mat4): Mat4 => {
  const out = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] = (out[c * 4 + r] ?? 0) + (a[k * 4 + r] ?? 0) * (b[c * 4 + k] ?? 0);
  return out;
};

const localMatrix = (node: NonNullable<GltfJson['nodes']>[number]): Mat4 => {
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
};

// KHR_mesh_quantization stores POSITION as normalized integers; min/max are in that integer space.
const NORMALIZED_MAX: Record<number, number> = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
const dequantize = (value: number, accessor: { normalized?: boolean; componentType?: number }) => {
  const max = accessor.normalized && accessor.componentType ? NORMALIZED_MAX[accessor.componentType] : undefined;
  return max ? Math.max(value / max, -1) : value;
};

/** Throws with a plain-language reason when `buf` is not a glTF 2.0 binary. */
export function readGlb(buf: Uint8Array): GlbFacts {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.byteLength < 20) throw new Error('This file is too small to be a GLB model.');
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('This file is not a GLB model. Export it from Blender as glTF Binary (.glb).');
  if (view.getUint32(4, true) !== 2) throw new Error('This GLB is not glTF 2.0. Re-export it as glTF 2.0.');
  if (view.getUint32(8, true) !== buf.byteLength) throw new Error('This GLB is cut short or padded. Export it again.');
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== CHUNK_JSON || 20 + jsonLength > buf.byteLength) throw new Error('This GLB has no readable glTF header.');
  let json: GltfJson;
  try {
    json = JSON.parse(new TextDecoder().decode(buf.subarray(20, 20 + jsonLength))) as GltfJson;
  } catch {
    throw new Error('This GLB has no readable glTF header.');
  }

  const animations = Array.isArray(json.animations) ? json.animations : [];
  const meshes = Array.isArray(json.meshes) ? json.meshes : [];
  const animationClips = animations.map((clip, index) => (typeof clip?.name === 'string' && clip.name ? clip.name : `animation_${index}`).slice(0, MAX_NAME));
  const morphTargets = [...new Set(meshes.flatMap((mesh) =>
    Array.isArray(mesh?.extras?.targetNames) ? mesh.extras.targetNames.filter((name): name is string => typeof name === 'string').map((name) => name.slice(0, MAX_NAME)) : []))];
  if (animationClips.length > MAX_CLIPS) throw new Error(`This GLB has ${animationClips.length} animation clips. Keep it to ${MAX_CLIPS} or fewer.`);
  // Viro's loader is stricter than the glTF spec on these two; both fail the
  // load in the viewer and in the game, so catch them at upload.
  if (Array.isArray(json.accessors) && json.accessors.some((accessor) => accessor?.bufferView === undefined && accessor?.sparse === undefined)) {
    throw new Error('This GLB has empty accessors that Viro cannot load. Re-export it from Blender as glTF Binary.');
  }
  if (animations.some((clip) => Array.isArray(clip?.samplers) && clip.samplers.some((sampler) => typeof sampler?.interpolation !== 'string'))) {
    throw new Error('An animation in this GLB has no interpolation mode, which Viro cannot load. Re-export it from Blender as glTF Binary.');
  }
  if (morphTargets.length > MAX_MORPH_TARGETS) throw new Error(`This GLB has ${morphTargets.length} morph targets. Keep it to ${MAX_MORPH_TARGETS} or fewer.`);

  // World-space Y extent: each mesh's dequantized POSITION box, through its node's world matrix.
  let minY = Infinity;
  let maxY = -Infinity;
  const nodes = Array.isArray(json.nodes) ? [...json.nodes] : [];
  const visit = (index: number, parent: Mat4, depth: number) => {
    const node = nodes[index];
    if (!node || depth > 64) return;
    const world = multiply(parent, localMatrix(node));
    const mesh = node.mesh === undefined ? undefined : meshes[node.mesh];
    for (const primitive of Array.isArray(mesh?.primitives) ? mesh.primitives : []) {
      const accessor = primitive.attributes?.POSITION === undefined ? undefined : json.accessors?.[primitive.attributes.POSITION];
      if (accessor?.min?.length !== 3 || accessor.max?.length !== 3) continue;
      const [x0 = 0, y0 = 0, z0 = 0] = accessor.min.map((v) => dequantize(v, accessor));
      const [x1 = 0, y1 = 0, z1 = 0] = accessor.max.map((v) => dequantize(v, accessor));
      const [, m1 = 0, , , , m5 = 0, , , , m9 = 0, , , , m13 = 0] = world;
      for (const cx of [x0, x1]) for (const cy of [y0, y1]) for (const cz of [z0, z1]) {
        const y = m1 * cx + m5 * cy + m9 * cz + m13;
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    for (const child of node.children ?? []) visit(child, world, depth + 1);
  };
  if (nodes.length === 0) {
    // No node tree: read every mesh at its own size.
    nodes.push(...meshes.map((_, mesh) => ({ mesh })));
  }
  const roots = json.scenes?.[json.scene ?? 0]?.nodes ?? nodes.map((_, i) => i).filter((i) => !nodes.some((n) => n.children?.includes(i)));
  for (const root of roots) visit(root, IDENTITY, 0);
  return { animationClips, morphTargets, heightMeters: Number.isFinite(maxY - minY) ? Math.round((maxY - minY) * 1000) / 1000 : null };
}
