// A conservative, reproducible dependency ceiling from actual committed cell
// structure ranges and the source census. Exact triangle-cell refs supersede it
// when present in the census; this tool never calls a ceiling an exact set.
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { SURFACE_CAPTURE, SURFACE_WORKSPACE } from './surface-paths.mjs';
import { VD_BLOCKS } from '../../../packages/app/features/game/world/vd-port/blocks/data/manifest.ts';
const input = process.argv[2] ?? SURFACE_CAPTURE;
const output = process.argv[3] ?? join(SURFACE_WORKSPACE,'source-dependencies.json');
const inputBytes=await readFile(input);
const census = JSON.parse(input.endsWith('.gz')?gunzipSync(inputBytes):inputBytes);
const partial = !!census.missingStructures?.length;
if (!census.complete || (partial && !process.argv.includes('--allow-partial'))) throw new Error('Complete 175-structure census required; --allow-partial only emits a labeled diagnostic');
const identity = texture => `${texture.sha256}:${texture.format}:${texture.type}:${texture.width}x${texture.height}`;
const exactCells = new Map();
const hasExactCells = census.tiles.every(tile => tile.meshes.every(mesh => Array.isArray(mesh.cellRefs)));
const textures = new Map(), byStructure = new Map(), pbrByStructure = new Map(), materialByStructure = new Map();
const mipBytes = texture => {
  const components = new Map([[1023, 4], [1028, 1], [1030, 2]]).get(texture.format);
  if (!components || texture.type !== 1009) throw new Error(`Unmeasured texture format/type ${texture.format}/${texture.type}`);
  const mipFilter = ![1003, 1006].includes(texture.minFilter);
  const count = texture.mipmaps > 0 ? texture.mipmaps : (texture.generateMipmaps ?? mipFilter) ? 1 + Math.floor(Math.log2(Math.max(texture.width, texture.height))) : 1;
  let bytes = 0;
  for (let i = 0; i < count; i++) bytes += Math.max(1, texture.width >> i) * Math.max(1, texture.height >> i) * components;
  return { baseBytes: texture.width * texture.height * components, mipBytes: bytes, mipLevels: count };
};
for (const tile of census.tiles) {
  const textureByUUID = new Map(tile.textures.map(t => [t.uuid, t]));
  const materials = new Map(tile.materials.map(m => [m.uuid, m]));
  const references = object => {
    if (!object || typeof object !== 'object') return [];
    if (typeof object.texture === 'string' && textureByUUID.has(object.texture)) return [object.texture];
    return Object.values(object).flatMap(value => typeof value === 'string' && textureByUUID.has(value) ? [value] : references(value));
  };
  for (const mesh of tile.meshes) {
    if (!byStructure.has(mesh.structure)) { byStructure.set(mesh.structure, new Set()); pbrByStructure.set(mesh.structure, new Set()); materialByStructure.set(mesh.structure, new Set()); }
    for (const reference of mesh.cellRefs ?? []) {
      let cell = exactCells.get(reference.key);
      if (!cell) { cell = { key: reference.key, cx: reference.cx, cz: reference.cz, structures: new Set(), textures: new Set(), shaderHashes: new Set(), pbrSets: new Set(), triangles: 0 }; exactCells.set(reference.key, cell); }
      cell.structures.add(mesh.structure); cell.triangles += reference.triangles;
    }
    for (const uuid of mesh.materials) {
      const material = materials.get(uuid);
      materialByStructure.get(mesh.structure).add(material.shader?.hash ?? material.key);
      const activeCells = (mesh.cellRefs ?? []).filter(reference => reference.materials.includes(uuid)).map(reference => exactCells.get(reference.key));
      for (const cell of activeCells) {
        cell.shaderHashes.add(material.shader?.hash ?? material.key);
        if (material.pbr?.set) cell.pbrSets.add(material.pbr.set);
      }
      if (material.pbr?.set) pbrByStructure.get(mesh.structure).add(material.pbr.set);
      for (const textureUUID of new Set(references({ maps: material.maps, uniforms: material.shader?.uniforms, userData: material.userData }))) {
        const texture = textureByUUID.get(textureUUID);
        if (!texture.sha256) throw new Error(`Missing authored texture payload ${textureUUID}`);
        const key = identity(texture);
        textures.set(key, { ...texture, ...mipBytes(texture), id: key });
        byStructure.get(mesh.structure).add(key);
        for (const cell of activeCells) cell.textures.add(key);
      }
    }
  }
}
const conservativeCells = VD_BLOCKS.near.map(cell => {
  const structures = [...new Set(cell.ranges.map(range => range[0]))];
  const refs = [...new Set(structures.flatMap(id => [...(byStructure.get(id) ?? [])]))].sort();
  return { key: cell.key, cx: cell.cx, cz: cell.cz, structures, textures: refs,
    shaderHashes: [...new Set(structures.flatMap(id => [...(materialByStructure.get(id) ?? [])]))].sort(),
    pbrSets: [...new Set(structures.flatMap(id => [...(pbrByStructure.get(id) ?? [])]))].sort(),
    baseBytes: refs.reduce((n, id) => n + textures.get(id).baseBytes, 0), mipBytes: refs.reduce((n, id) => n + textures.get(id).mipBytes, 0) };
});
const cells = hasExactCells ? [...exactCells.values()].map(cell => ({ ...cell, structures: [...cell.structures].sort(), textures: [...cell.textures].sort(), shaderHashes: [...cell.shaderHashes].sort(), pbrSets: [...cell.pbrSets].sort(),
  baseBytes: [...cell.textures].reduce((n, id) => n + textures.get(id).baseBytes, 0), mipBytes: [...cell.textures].reduce((n, id) => n + textures.get(id).mipBytes, 0) })) : conservativeCells;
const union = cells => [...new Set(cells.flatMap(c => c.textures))];
const spawn = cells.find(c => c.cx === -1 && c.cz === 0);
const neighbours = cells.filter(c => Math.abs(c.cx + 1) <= 1 && Math.abs(c.cz) <= 1);
const spawnRefs = union(neighbours);
const report = { version: 1, kind: hasExactCells ? 'exact visible source triangle-cell material dependencies' : 'structure-overlap upper bound, not exact triangle-cell dependencies', sourcePin: census.sourcePin,
  coverage: { completeRegion: !partial, missingStructures: census.missingStructures ?? [] },
  mipRule: 'Explicit source mip count, otherwise captured generateMipmaps (legacy census falls back to source min-filter); exact logical texel storage, excluding platform allocation alignment',
  excludes: ['Real PBR KTX sets: initial source placeholders are not their payload', 'Dynamic global resources such as cityAO must be added from semantic ENV bindings'],
  textures: [...textures.values()], cells,
  summary: { uniqueTextures: textures.size, maxCell: [...cells].sort((a, b) => b.mipBytes - a.mipBytes)[0],
    spawnCell: spawn, spawnNeighbourKeys: neighbours.map(c => c.key), spawnNeighbourTextures: spawnRefs.length,
    spawnNeighbourBaseBytes: spawnRefs.reduce((n, id) => n + textures.get(id).baseBytes, 0), spawnNeighbourMipBytes: spawnRefs.reduce((n, id) => n + textures.get(id).mipBytes, 0) } };
await writeFile(output, JSON.stringify(report));
console.log(JSON.stringify({ output, uniqueTextures: textures.size, maxCell: report.summary.maxCell.key,
  maxCellMipMiB: report.summary.maxCell.mipBytes / 2 ** 20, spawnCellMipMiB: spawn?.mipBytes / 2 ** 20,
  spawnNeighbourMipMiB: report.summary.spawnNeighbourMipBytes / 2 ** 20 }));
