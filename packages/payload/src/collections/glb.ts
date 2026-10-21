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
  accessors?: { bufferView?: number; sparse?: unknown; min?: number[]; max?: number[] }[];
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

  // ponytail: ignores node transforms, so a model scaled at its root node reads
  // at its mesh size. Walk the node tree if that ever misleads the framing.
  let minY = Infinity;
  let maxY = -Infinity;
  for (const mesh of meshes) {
    for (const primitive of Array.isArray(mesh?.primitives) ? mesh.primitives : []) {
      const accessor = primitive.attributes?.POSITION === undefined ? undefined : json.accessors?.[primitive.attributes.POSITION];
      if (accessor?.min?.[1] !== undefined && accessor.max?.[1] !== undefined) {
        minY = Math.min(minY, accessor.min[1]);
        maxY = Math.max(maxY, accessor.max[1]);
      }
    }
  }
  return { animationClips, morphTargets, heightMeters: Number.isFinite(maxY - minY) ? Math.round((maxY - minY) * 1000) / 1000 : null };
}
