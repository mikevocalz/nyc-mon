// The upload rules for a Mon model file, shared by the console's drop zone
// (checked before any byte leaves the browser) and the collection hook (the
// trust boundary, which also parses the whole file with readGlb).

/** Bunny and the viewer both load the whole file; keep Mons phone-sized. */
export const MON_MODEL_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Vercel rejects a function request body over 4.5 MB with a 413 before Payload
 * runs. Files up to this size go up in one multipart request; larger ones go
 * up in raw chunks of this size through the staged upload endpoints.
 */
export const MON_MODEL_CHUNK_BYTES = 4 * 1024 * 1024;

/** How many chunks a file of `size` bytes takes. */
export const chunkCount = (size: number) => Math.max(1, Math.ceil(size / MON_MODEL_CHUNK_BYTES));

/** The exact byte length chunk `index` must have for a file of `size` bytes. */
export const chunkLength = (size: number, index: number) =>
  Math.min(MON_MODEL_CHUNK_BYTES, size - index * MON_MODEL_CHUNK_BYTES);

const GLB_MAGIC = 0x46546c67; // 'glTF'

export type MonModelFileProblem = 'type' | 'empty' | 'size' | 'header' | 'version' | 'length';

export type MonModelFileCheck = { ok: true } | { ok: false; problem: MonModelFileProblem };

/** Name and size rules: a `.glb` file with bytes, at most 25 MB. */
export function checkMonModelFile(file: { name: string; size: number }): MonModelFileCheck {
  if (!file.name.toLowerCase().endsWith('.glb')) return { ok: false, problem: 'type' };
  if (file.size <= 0) return { ok: false, problem: 'empty' };
  if (file.size > MON_MODEL_MAX_BYTES) return { ok: false, problem: 'size' };
  return { ok: true };
}

/**
 * The 12-byte GLB header: glTF magic, version 2, and a declared length equal
 * to the file's size. Catches a renamed .gltf, .fbx or truncated export
 * without reading the whole file.
 */
export function checkGlbHeader(head: Uint8Array, fileSize: number): MonModelFileCheck {
  if (head.byteLength < 12) return { ok: false, problem: 'header' };
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) return { ok: false, problem: 'header' };
  if (view.getUint32(4, true) !== 2) return { ok: false, problem: 'version' };
  if (view.getUint32(8, true) !== fileSize) return { ok: false, problem: 'length' };
  return { ok: true };
}

/** Shown under the drop zone; the hook's own messages say the same things. */
export const MON_MODEL_FILE_MESSAGES: Record<MonModelFileProblem, string> = {
  type: 'Only .glb files work here. Export from Blender as glTF Binary.',
  empty: 'This file is empty. Export the model again.',
  size: 'This model is over 25 MB. Reduce textures or polygons and export again.',
  header: 'This file is not a GLB model. Export it from Blender as glTF Binary (.glb).',
  version: 'This GLB is not glTF 2.0. Re-export it as glTF 2.0.',
  length: 'This GLB is cut short or padded. Export it again.',
};
