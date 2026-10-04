/**
 * The terrain's blocks as one indexed mesh, built once per grid.
 *
 * Every block is a unit box (x and z in -0.5..0.5, y in 0..1) with its cell
 * in `aCell` (column, row). The vertex shader places it, scrolls it and sets
 * its height, so nothing here changes per frame. Bottom and back faces are
 * left out: the camera looks down the rows from the near end and never sees
 * them. UVs run across each face, and `v` runs up the walls, which the
 * window pattern counts floors on.
 */
export interface BlockArrays {
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  cell: Float32Array;
  index: Uint32Array;
  vertexCount: number;
}

// Faces: corners as [x, y, z, u, v], normal. Wound counter-clockwise from outside.
const FACES: { normal: [number, number, number]; corners: [number, number, number, number, number][] }[] = [
  // roof
  { normal: [0, 1, 0], corners: [[-0.5, 1, 0.5, 0, 1], [0.5, 1, 0.5, 1, 1], [0.5, 1, -0.5, 1, 0], [-0.5, 1, -0.5, 0, 0]] },
  // front (+z, toward the camera)
  { normal: [0, 0, 1], corners: [[-0.5, 0, 0.5, 0, 0], [0.5, 0, 0.5, 1, 0], [0.5, 1, 0.5, 1, 1], [-0.5, 1, 0.5, 0, 1]] },
  // right (+x)
  { normal: [1, 0, 0], corners: [[0.5, 0, 0.5, 0, 0], [0.5, 0, -0.5, 1, 0], [0.5, 1, -0.5, 1, 1], [0.5, 1, 0.5, 0, 1]] },
  // left (-x)
  { normal: [-1, 0, 0], corners: [[-0.5, 0, -0.5, 0, 0], [-0.5, 0, 0.5, 1, 0], [-0.5, 1, 0.5, 1, 1], [-0.5, 1, -0.5, 0, 1]] },
];

export const VERTICES_PER_BLOCK = FACES.length * 4;
export const INDICES_PER_BLOCK = FACES.length * 6;

export function buildBlockArrays(cols: number, rows: number): BlockArrays {
  const blocks = cols * rows;
  const vertexCount = blocks * VERTICES_PER_BLOCK;
  const position = new Float32Array(vertexCount * 3);
  const normal = new Float32Array(vertexCount * 3);
  const uv = new Float32Array(vertexCount * 2);
  const cell = new Float32Array(vertexCount * 2);
  const index = new Uint32Array(blocks * INDICES_PER_BLOCK);
  let v = 0;
  let i = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      for (const face of FACES) {
        const first = v;
        for (const [x, y, z, u, w] of face.corners) {
          position.set([x, y, z], v * 3);
          normal.set(face.normal, v * 3);
          uv.set([u, w], v * 2);
          cell.set([col, row], v * 2);
          v++;
        }
        index.set([first, first + 1, first + 2, first, first + 2, first + 3], i);
        i += 6;
      }
    }
  }
  return { position, normal, uv, cell, index, vertexCount };
}
