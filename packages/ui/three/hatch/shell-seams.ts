import type * as THREE from 'three';

/**
 * Smooths the outer shell's normals across the cuts between hatch pieces.
 *
 * tooling/blender/hatching/fracture.py cuts each egg into a cup and five cap
 * pieces, then gives every piece its own thickness (a solidify with rim
 * faces). Blender smooths each piece's boundary normals together with its own
 * rim, so along every cut the outer surface's normal leans out sideways, and
 * the two pieces meeting at a cut lean opposite ways: 147 to 175 degrees
 * apart on the shipped GLBs. The pieces sit flush at rest (the hatch clip's
 * frame 0 is the node rest), but the light breaks along every cut and the
 * whole egg reads as cracked in MONS, M08, M10, M11 and the hub, where the
 * egg never hatches.
 *
 * For every outer-surface vertex that lies on a cut (coincident, within
 * `tolerance` metres in the scene's rest pose, with an outer vertex of
 * another piece), the normal becomes the area-weighted average of the outer
 * faces round it on all of those pieces: the normal the uncut shell had.
 * Inner and rim primitives (`*_ShellInner`, `*_ShellEdge`) are left alone, so
 * a shard's broken edge still shows during the hatch, and the interior of
 * each piece keeps its authored normals.
 *
 * Mutates the parse's geometry, so run it once per parse, before cloning.
 * `root` must be at its rest pose. Returns how many vertices changed.
 */
export function weldShellSeamNormals(root: THREE.Object3D, pieceNames: readonly string[], tolerance = 2e-5): number {
  const pieces = new Set(pieceNames);
  root.updateMatrixWorld(true);

  interface Outer {
    readonly mesh: THREE.Mesh;
    readonly piece: string;
    readonly world: Float64Array;
  }
  const outers: Outer[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material) || /_Shell(Inner|Edge)$/.test(mesh.material.name)) return;
    let piece: THREE.Object3D | null = mesh;
    while (piece && !pieces.has(piece.name)) piece = piece.parent;
    if (!piece) return;
    const position = mesh.geometry.getAttribute('position');
    if (!position || !mesh.geometry.getAttribute('normal')) return;
    const e = mesh.matrixWorld.elements;
    const world = new Float64Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      world[i * 3] = e[0]! * x + e[4]! * y + e[8]! * z + e[12]!;
      world[i * 3 + 1] = e[1]! * x + e[5]! * y + e[9]! * z + e[13]!;
      world[i * 3 + 2] = e[2]! * x + e[6]! * y + e[10]! * z + e[14]!;
    }
    outers.push({ mesh, piece: piece.name, world });
  });
  if (outers.length < 2) return 0;

  // Group coincident vertices. A spatial hash with cells one tolerance wide;
  // a vertex joins the first group within tolerance in its 27 neighbouring cells.
  interface Group {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly members: { outer: number; index: number }[];
    readonly pieces: Set<string>;
    readonly normal: [number, number, number];
  }
  const cells = new Map<string, Group[]>();
  const groupOf: Group[][] = outers.map((o) => new Array<Group>(o.world.length / 3));
  const tol2 = tolerance * tolerance;
  outers.forEach((outer, o) => {
    const w = outer.world;
    for (let i = 0; i < w.length / 3; i++) {
      const x = w[i * 3]!;
      const y = w[i * 3 + 1]!;
      const z = w[i * 3 + 2]!;
      const cx = Math.round(x / tolerance);
      const cy = Math.round(y / tolerance);
      const cz = Math.round(z / tolerance);
      let found: Group | undefined;
      for (let dx = -1; dx <= 1 && !found; dx++) {
        for (let dy = -1; dy <= 1 && !found; dy++) {
          for (let dz = -1; dz <= 1 && !found; dz++) {
            for (const g of cells.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
              if ((g.x - x) ** 2 + (g.y - y) ** 2 + (g.z - z) ** 2 <= tol2) {
                found = g;
                break;
              }
            }
          }
        }
      }
      if (!found) {
        found = { x, y, z, members: [], pieces: new Set(), normal: [0, 0, 0] };
        const key = `${cx},${cy},${cz}`;
        const bucket = cells.get(key);
        if (bucket) bucket.push(found);
        else cells.set(key, [found]);
      }
      found.members.push({ outer: o, index: i });
      found.pieces.add(outer.piece);
      groupOf[o]![i] = found;
    }
  });

  // Area-weighted face normals in world space, summed into each corner's group.
  outers.forEach((outer, o) => {
    const w = outer.world;
    const index = outer.mesh.geometry.getIndex();
    const count = index ? index.count : w.length / 3;
    for (let t = 0; t + 2 < count; t += 3) {
      const a = index ? index.getX(t) : t;
      const b = index ? index.getX(t + 1) : t + 1;
      const c = index ? index.getX(t + 2) : t + 2;
      const ux = w[b * 3]! - w[a * 3]!;
      const uy = w[b * 3 + 1]! - w[a * 3 + 1]!;
      const uz = w[b * 3 + 2]! - w[a * 3 + 2]!;
      const vx = w[c * 3]! - w[a * 3]!;
      const vy = w[c * 3 + 1]! - w[a * 3 + 1]!;
      const vz = w[c * 3 + 2]! - w[a * 3 + 2]!;
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      for (const corner of [a, b, c]) {
        const g = groupOf[o]![corner]!;
        if (g.pieces.size < 2) continue;
        g.normal[0] += nx;
        g.normal[1] += ny;
        g.normal[2] += nz;
      }
    }
  });

  // Write each seam group's normal back into every member, in its mesh's local space.
  // World normal = N·local with N the inverse transpose of the upper 3×3 (M), so local = Mᵀ·world.
  let changed = 0;
  const touched = new Set<THREE.BufferAttribute | THREE.InterleavedBufferAttribute>();
  for (const bucket of cells.values()) {
    for (const g of bucket) {
      if (g.pieces.size < 2) continue;
      const [wx, wy, wz] = g.normal;
      if (Math.hypot(wx, wy, wz) === 0) continue;
      for (const { outer, index } of g.members) {
        const e = outers[outer]!.mesh.matrixWorld.elements;
        const lx = e[0]! * wx + e[1]! * wy + e[2]! * wz;
        const ly = e[4]! * wx + e[5]! * wy + e[6]! * wz;
        const lz = e[8]! * wx + e[9]! * wy + e[10]! * wz;
        const length = Math.hypot(lx, ly, lz);
        const normal = outers[outer]!.mesh.geometry.getAttribute('normal');
        normal.setXYZ(index, lx / length, ly / length, lz / length);
        touched.add(normal);
        changed += 1;
      }
    }
  }
  for (const attribute of touched) attribute.needsUpdate = true;
  return changed;
}
