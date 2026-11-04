import type { TriangleCollisionData } from './triangle-collision.ts';

/** NVB1 stores the existing tree without quantizing, welding, or changing triangle IDs. */
export const COLLISION_BVH_HEADER_BYTES = 64;
export const COLLISION_BVH_LAYOUT = 1;
export const COLLISION_BVH_LEAF_TRIANGLES = 12;
const littleEndian = new Uint32Array(new Uint8Array([1, 0, 0, 0]).buffer)[0] === 1;
const fail = (message: string): never => { throw new Error(`Collision BVH: ${message}`); };
const u32 = (value: number, name: string) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) fail(`invalid ${name}`);
  return value;
};

/** Offline writer; the caller supplies the original shell cell's triangle count. */
export function encodeTriangleCollisionData(data: TriangleCollisionData, originalTriangles: number): Uint8Array {
  if (!littleEndian) fail('only little-endian asset production is supported');
  const triangles = u32(data.triangles, 'triangle count'), nodes = data.nodes.length / 4;
  u32(originalTriangles, 'source triangle count'); u32(nodes, 'node count');
  if (originalTriangles < triangles || data.positions.length !== triangles * 9 || data.originals.length !== triangles ||
    data.order.length !== triangles || data.boxes.length !== nodes * 6 || (triangles === 0) !== (nodes === 0)) fail('array layout mismatch');
  const arrays = [data.positions, data.originals, data.order, data.boxes, data.nodes];
  const bytes = u32(COLLISION_BVH_HEADER_BYTES + arrays.reduce((sum, array) => sum + array.byteLength, 0), 'payload bytes');
  const output = new Uint8Array(bytes), view = new DataView(output.buffer);
  output.set([78, 86, 66, 49]);
  view.setUint16(4, COLLISION_BVH_LAYOUT, true); view.setUint16(6, COLLISION_BVH_HEADER_BYTES, true);
  view.setUint32(8, triangles, true); view.setUint32(12, nodes, true); view.setUint32(16, originalTriangles, true);
  arrays.forEach((array, index) => view.setUint32(24 + index * 4, array.byteLength, true));
  view.setUint32(44, bytes, true); view.setUint32(48, COLLISION_BVH_LEAF_TRIANGLES, true); view.setUint32(52, 1, true);
  let offset = COLLISION_BVH_HEADER_BYTES;
  for (const array of arrays) {
    output.set(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), offset); offset += array.byteLength;
  }
  return output;
}

/**
 * Decode an authenticated payload into scene-owned array views. Authentication
 * belongs to the enclosing immutable pack loader; this performs layout checks,
 * not another triangle scan or spatial-tree construction during START.
 */
export function decodeTriangleCollisionData(payload: Uint8Array, originalTriangles: number): TriangleCollisionData {
  if (!littleEndian) fail('only little-endian asset decoding is supported');
  if (payload.byteLength < COLLISION_BVH_HEADER_BYTES || payload.byteOffset % 4) fail('unaligned or truncated header');
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  if (payload[0] !== 78 || payload[1] !== 86 || payload[2] !== 66 || payload[3] !== 49 ||
    view.getUint16(4, true) !== COLLISION_BVH_LAYOUT || view.getUint16(6, true) !== COLLISION_BVH_HEADER_BYTES) fail('unsupported layout');
  const triangles = view.getUint32(8, true), nodes = view.getUint32(12, true);
  if (view.getUint32(16, true) !== originalTriangles || originalTriangles < triangles ||
    (triangles === 0) !== (nodes === 0) || nodes > Math.max(0, triangles * 2 - 1) ||
    view.getUint32(20, true) !== 0 || view.getUint32(48, true) !== COLLISION_BVH_LEAF_TRIANGLES ||
    view.getUint32(52, true) !== 1 || view.getUint32(56, true) !== 0 || view.getUint32(60, true) !== 0) fail('source/tree contract mismatch');
  const sizes = [triangles * 9 * 4, triangles * 4, triangles * 4, nodes * 6 * 4, nodes * 4 * 4];
  const length = COLLISION_BVH_HEADER_BYTES + sizes.reduce((sum, bytes) => sum + bytes, 0);
  if (!Number.isSafeInteger(length) || length !== payload.byteLength || view.getUint32(44, true) !== length ||
    sizes.some((bytes, index) => view.getUint32(24 + index * 4, true) !== bytes)) fail('payload byte count mismatch');
  let offset = payload.byteOffset + COLLISION_BVH_HEADER_BYTES;
  const positions = new Float32Array(payload.buffer, offset, triangles * 9); offset += sizes[0]!;
  const originals = new Uint32Array(payload.buffer, offset, triangles); offset += sizes[1]!;
  const order = new Uint32Array(payload.buffer, offset, triangles); offset += sizes[2]!;
  const boxes = new Float32Array(payload.buffer, offset, nodes * 6); offset += sizes[3]!;
  const tree = new Int32Array(payload.buffer, offset, nodes * 4);
  return { positions, originals, order, boxes, nodes: tree, triangles };
}
