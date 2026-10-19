// Triangles the GPU draws for a scene graph: per visible mesh, index count
// (or vertex count) / 3, clipped by the geometry's draw range, times the
// instance count for instanced meshes. The Surface Duo measurement
// (2026-10-16) used the same rule; the budget test pins it at the spawn.
interface MeshLike {
  visible: boolean;
  children: readonly MeshLike[];
  isMesh?: boolean;
  isInstancedMesh?: boolean;
  count?: number;
  geometry?: {
    index: { count: number } | null;
    getAttribute(name: string): { count: number } | undefined;
    drawRange: { start: number; count: number };
    instanceCount?: number;
  };
}

export interface MeshTriangles { name: string; triangles: number }

export function visibleTriangles(root: MeshLike): { total: number; meshes: MeshTriangles[] } {
  const meshes: MeshTriangles[] = [];
  const walk = (node: MeshLike & { name?: string }) => {
    if (!node.visible) return;
    if (node.isMesh && node.geometry) {
      const g = node.geometry;
      const elements = g.index ? g.index.count : (g.getAttribute('position')?.count ?? 0);
      const start = Math.max(0, g.drawRange.start);
      const count = Math.max(0, Math.min(elements - start, g.drawRange.count));
      const instances = node.isInstancedMesh ? (node.count ?? 0) : 1;
      meshes.push({ name: node.name ?? '', triangles: Math.floor(count / 3) * instances });
    }
    for (const child of node.children) walk(child);
  };
  walk(root);
  return { total: meshes.reduce((sum, m) => sum + m.triangles, 0), meshes };
}
