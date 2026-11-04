import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { AFFINE } from './write.mjs';
import { encodeSurfaceCell } from './surface-codec.mjs';
import { transformSurfaceNormal } from './surface-layout.mjs';

/**
 * Partition and weld only exact channel matches, keeping every material,
 * constant-variant, UV and normal seam. No simplification crosses a surface.
 * `withSourceFrame` allocates a compact variant row carrying source base Y.
 */
export function partitionSurfaceCells(structures, { withSourceFrame, affine = AFFINE, curb = 0.14 }) {
  const cells = new Map();
  const linear = [affine.sx, 0, 0, 0, 0, 1, 0, 0, 0, 0, affine.sz, 0, 0, 0, 0, 1];
  for (const structure of structures) {
    const input = structure.surface;
    if (!input || input.indices.length % 3 || input.families.length !== input.vertices.length) throw new Error(`VDN3 ${structure.id}: incomplete harvested surfaces`);
    const frameRows = new Map();
    const transformed = input.vertices.map(vertex => ({ ...vertex,
      position: [vertex.position[0] * affine.sx + affine.ox, vertex.position[1] - structure.base + curb, vertex.position[2] * affine.sz + affine.oz],
      normal: transformSurfaceNormal(vertex.normal, linear),
      // Keep source weather coordinates unchanged: the shader reconstructs
      // Valdrada pattern position through this exact source-frame variant.
      variant: (() => {
        if (!frameRows.has(vertex.variant)) frameRows.set(vertex.variant, withSourceFrame(vertex.variant, { baseY: structure.base, curb, affine }));
        return frameRows.get(vertex.variant);
      })(),
    }));
    for (let at = 0; at < input.indices.length; at += 3) {
      const ids = input.indices.slice(at, at + 3), vertices = ids.map(index => transformed[index]);
      if (vertices.some(v => !v)) throw new Error(`VDN3 ${structure.id}: invalid triangle index`);
      const family = input.families[ids[0]];
      if (!Number.isInteger(family) || family < 0 || ids.some(id => input.families[id] !== family)) throw new Error(`VDN3 ${structure.id}: mixed family triangle`);
      if (vertices.some(v => v.material !== vertices[0].material || v.variant !== vertices[0].variant)) throw new Error(`VDN3 ${structure.id}: mixed material/variant triangle`);
      const cx = Math.floor(vertices.reduce((n, v) => n + v.position[0], 0) / 3 / 128);
      const cz = Math.floor(vertices.reduce((n, v) => n + v.position[2], 0) / 3 / 128);
      const key = `${cx}_${cz}-f${family}`;
      let cell = cells.get(key);
      if (!cell) {
        cell = { key, cx, cz, family, vertices: [], indices: [], bounds: [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], materials: new Set(), variants: new Set(), structures: new Set(), weld: new Map() };
        cells.set(key, cell);
      }
      cell.structures.add(structure.id);
      for (const vertex of vertices) {
        const weldKey = JSON.stringify([vertex.position, vertex.color, vertex.uv, vertex.normal, vertex.material, vertex.variant, vertex.grime, vertex.weather, vertex.flags]);
        let index = cell.weld.get(weldKey);
        if (index === undefined) { index = cell.vertices.length; cell.weld.set(weldKey, index); cell.vertices.push(vertex); }
        cell.indices.push(index); cell.materials.add(vertex.material); cell.variants.add(vertex.variant);
        for (let c = 0; c < 3; c++) { cell.bounds[c] = Math.min(cell.bounds[c], vertex.position[c]); cell.bounds[c + 3] = Math.max(cell.bounds[c + 3], vertex.position[c]); }
      }
    }
  }
  return [...cells.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Write explicit VDN3 family files after the registry and texture graph have passed coverage checks. */
export async function writeSurfacePacks({ structures, registry, encoder, outDir, buildParameters, affine = AFFINE }) {
  const cells = partitionSurfaceCells(structures, { withSourceFrame: (variant, frame) => registry.withSourceFrame(variant, frame), affine });
  const remap = registry.retainVariants(cells.flatMap(cell => cell.vertices.map(vertex => vertex.variant)));
  for (const cell of cells) {
    for (const vertex of cell.vertices) vertex.variant = remap.get(vertex.variant);
    cell.variants = new Set(cell.vertices.map(vertex => vertex.variant));
  }
  if (!buildParameters) throw new Error('Runtime surface parameter payload required before publication');
  registry.parameters = buildParameters(registry);
  const snapshot = registry.finalize();
  if (!snapshot.coverage?.complete || snapshot.coverage.unsupported?.length) throw new Error('VDN3 registry has unsupported source material coverage');
  await mkdir(outDir, { recursive: true });
  const manifest = [];
  for (const cell of cells) {
    const encoded = await encodeSurfaceCell({ ...cell, registry: snapshot, encoder });
    const textureRefs = [...new Set([...cell.materials].flatMap(id => registry.textureRefs(id)))].sort((a,b)=>a-b);
    await writeFile(join(outDir, `${cell.key}.bin`), encoded.bytes);
    manifest.push({ key: cell.key, cx: cell.cx, cz: cell.cz, family: cell.family, vertices: cell.vertices.length,
      wide: encoded.index.BYTES_PER_ELEMENT === 4,
      sha256: createHash('sha256').update(encoded.bytes).digest('hex'),
      triangles: cell.indices.length / 3, bounds: cell.bounds, bytes: cell.vertices.length * 76 + encoded.index.byteLength,
      fileBytes: encoded.bytes.byteLength, surface: { sha256: snapshot.sha256, materialCount: snapshot.materialCount, variantCount: snapshot.variantCount },
      materials: [...cell.materials].sort((a, b) => a - b), variants: [...cell.variants].sort((a, b) => a - b), structures: [...cell.structures].sort(), textures: textureRefs });
  }
  return { registry: snapshot, cells: manifest, audit: { sourceStructureOmittedZeroAreaTriangles:
    structures.map(structure => ({ id: structure.id, triangles: structure.surface.omittedZeroAreaTriangles ?? 0 })),
    sourceStructureNormalRepairs: structures.map(structure => ({ id: structure.id, repairs: structure.surface.normalRepairs ?? [] })),
    sourceStructureShadowPolicy: structures.map(structure => ({ id: structure.id, meshes: structure.surface.shadowAudit ?? [] })) } };
}
