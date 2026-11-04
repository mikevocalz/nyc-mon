import { SurfaceRegistry, canonicalSurfaceJSON } from './surface-registry.mjs';
import { AFFINE } from './write.mjs';
import { authoredSurfaceUniforms } from './surface-uniforms.mjs';

function cellSurfaces(surfaces, cell, affine) {
  if (!cell) return surfaces;
  return surfaces.flatMap(structure => {
    const vertices = [], indices = [], families = [];
    for (let at = 0; at < structure.surface.indices.length; at += 3) {
      const ids = structure.surface.indices.slice(at, at + 3);
      const triangle = ids.map(id => structure.surface.vertices[id]);
      const x = triangle.reduce((sum, vertex) => sum + vertex.position[0] * affine.sx + affine.ox, 0) / 3;
      const z = triangle.reduce((sum, vertex) => sum + vertex.position[2] * affine.sz + affine.oz, 0) / 3;
      if (Math.floor(x / 128) !== cell.cx || Math.floor(z / 128) !== cell.cz) continue;
      for (let corner = 0; corner < 3; corner++) { indices.push(vertices.length); vertices.push(triangle[corner]); families.push(structure.surface.families[ids[corner]]); }
    }
    return vertices.length ? [{ ...structure, surface: { ...structure.surface, vertices, indices, families } }] : [];
  });
}

/** Normalize one live capture without interpreting any authored shader family. */
export function capturedTextureTable(capture) {
  const payloads = new Map();
  for (const tile of capture.tiles) for (const texture of tile.textures) {
    if (!/^[a-f0-9]{64}$/.test(texture.sha256 ?? '')) throw new Error('Captured texture lacks strong identity');
    const key = canonicalSurfaceJSON({ sha256: texture.sha256, format: texture.format, type: texture.type, width: texture.width, height: texture.height, mipLevels: texture.mipLevels });
    if (!payloads.has(key)) payloads.set(key, { sha256: texture.sha256, format: texture.format, type: texture.type, width: texture.width, height: texture.height,
      compressed: texture.compressed, mipLevels: texture.mipLevels, sourceBytes: texture.sourceBytes });
  }
  const sorted = [...payloads].sort(([a], [b]) => a.localeCompare(b));
  const textureIds = new Map(sorted.map(([key], id) => [key, id]));
  const textures = sorted.map(([, value], id) => ({ id, ...value }));
  return { textures, textureIds };
}

export function registryFromCapture(capture, { identifyFamily, provenanceFiles = [], cell, affine = AFFINE, semanticTextures = [], resolveTextureBinding, metadataOnly = false }) {
  if (capture.tiles.some(tile => tile.surfaceErrors?.length)) throw new Error('Captured source geometry has unsupported surface channels; inspect surfaceErrors');
  const { textures: capturedTextures, textureIds } = capturedTextureTable(capture);
  const textures = [...capturedTextures, ...semanticTextures];
  const registry = new SurfaceRegistry({ source: { revision: capture.sourcePin, bakeThree: capture.bakeThree,bakeEarcut:capture.bakeEarcut,bakeDependencies:capture.bakeDependencies,
    captureTiles: capture.tiles.map(tile => tile.key), missingRegionStructures: capture.missingStructures,
    selection: cell ? { kind: 'complete-cell', cx: cell.cx, cz: cell.cz } : { kind: 'captured-structures' } }, identifyFamily, textures, provenanceFiles });
  const structures = [];
  const capturedMaterialUses = new Map();
  for (const tile of capture.tiles) {
    const sourceTextures = new Map(tile.textures.map(texture => [texture.uuid, texture]));
    const binding = uuid => {
      const texture = sourceTextures.get(uuid);
      if (!texture) throw new Error(`Missing captured texture ${uuid}`);
      const { uuid: _uuid, name: _name, source: _source, ...state } = texture;
      const key = canonicalSurfaceJSON({ sha256: texture.sha256, format: texture.format, type: texture.type, width: texture.width, height: texture.height, mipLevels: texture.mipLevels });
      return { texture: textureIds.get(key), ...state };
    };
    const selectedSurfaces = cellSurfaces(tile.surfaces ?? [], cell, affine);
    const usedMaterials = new Set(selectedSurfaces.flatMap(structure => structure.surface.vertices.map(vertex => vertex.material)));
    const materials = tile.materials.map((material, sourceIndex) => {
      if (!metadataOnly && tile.surfaces?.length && !usedMaterials.has(sourceIndex)) return undefined;
      const { uuid, shader, maps, key, ...props } = material;
      const textureBindings = Object.fromEntries(Object.entries(maps).filter(([, value]) => value).map(([role, value]) => {
        const initialBinding = binding(value);
        const resolved = resolveTextureBinding ? resolveTextureBinding({ material, role, uniform: null, initialBinding }) : initialBinding;
        if (!resolved || !registry.textureById.has(resolved.texture)) throw new Error(`Unresolved authored texture binding ${role}`);
        return [role, resolved];
      }));
      for (const [name, value] of Object.entries(shader?.uniforms ?? {})) {
        const uniformTexture = value?.texture ?? value?.initial?.texture;
        if (uniformTexture) {
          const initialBinding = binding(uniformTexture);
          const semantic = !!value?.dynamic || (material.pbr?.set && ['pbAlb','pbNrm','pbOrm'].includes(name));
          if (semantic && !resolveTextureBinding) throw new Error(`Authored semantic texture ${name} requires an actual resource binding`);
          const resolved = resolveTextureBinding ? resolveTextureBinding({ material, role: name, uniform: value, initialBinding }) : initialBinding;
          if (!resolved || !registry.textureById.has(resolved.texture)) throw new Error(`Unresolved authored texture binding ${name}`);
          textureBindings[`uniform:${name}`] = resolved;
        }
      }
      const uniforms = Object.fromEntries(Object.entries(authoredSurfaceUniforms(material)).map(([name, value]) => {
        const texture = textureBindings[`uniform:${name}`]?.texture;
        if (value?.texture) return [name, { ...value, texture, auditInitialTexture: binding(value.texture).texture }];
        if (value?.initial?.texture) return [name, { ...value, initial: { ...value.initial, texture: binding(value.initial.texture).texture }, binding: { texture } }];
        return [name, value];
      }));
      return { uuid, ...props, source: { shaderSha256: shader?.sha256, shaderHash: shader?.hash, shaderHashBasis: shader?.sha256Basis ?? 'post-hook-standard-template-and-defines-v1', key },
        shader: { ...shader, uniforms }, state: Object.fromEntries(['side','transparent','opacity','alphaTest','alphaHash','alphaToCoverage','premultipliedAlpha','colorWrite','depthTest','depthWrite','blending','blendSrc','blendDst','blendSrcAlpha','blendDstAlpha','blendEquation','blendEquationAlpha','polygonOffset','polygonOffsetFactor','polygonOffsetUnits','fog','toneMapped','wireframe','shadowSide','flatShading'].filter(name => material[name] !== undefined).map(name => [name, material[name]])),
        textureBindings, textures: [...new Set(Object.values(textureBindings).map(value => value.texture))].sort((a, b) => a - b) };
    });
    const materialUses = new Map();
    const materialUse = (index, draw) => {
      const { renderOrder, castShadow, receiveShadow } = draw;
      if (!Number.isFinite(renderOrder)) throw new Error('Source mesh renderOrder was not captured');
      if (typeof castShadow !== 'boolean' || typeof receiveShadow !== 'boolean') throw new Error('Source mesh shadow ownership was not captured');
      const descriptor = materials[index];
      if (!descriptor) throw new Error('Captured geometry references missing material');
      const key = `${index}:${renderOrder}:${castShadow}:${receiveShadow}`;
      if (!materialUses.has(key)) {
        const uuid = `${descriptor.uuid}@${renderOrder}:${castShadow}:${receiveShadow}`;
        materialUses.set(key, { ...registry.registerMaterial({ ...descriptor, uuid, renderOrder, castShadow, receiveShadow }), uuid });
        capturedMaterialUses.set(`${tile.key}:${key}`,materialUses.get(key));
      }
      return materialUses.get(key);
    };
    if(metadataOnly){
      const indexByUuid=new Map(tile.materials.map((material,index)=>[material.uuid,index]));
      for(const mesh of tile.meshes)for(const uuid of mesh.materials){
        const index=indexByUuid.get(uuid);if(index===undefined)throw new Error('Metadata mesh references uncaptured material');
        materialUse(index,{renderOrder:mesh.renderOrder,castShadow:mesh.shadowPolicy?.castShadow??mesh.castShadow,receiveShadow:mesh.shadowPolicy?.receiveShadow??mesh.receiveShadow});
      }
      for(const audit of tile.geometryAudits)for(const variant of audit.variants){
        for(const index of variant.materials)for(const[key,material]of materialUses)if(key.startsWith(`${index}:`)){
          registry.variant(material.material,variant.fields,{...variant.frame,...audit.sceneFrame,sourceYOffset:audit.sceneFrame.baseY-audit.sceneFrame.curb});
        }
      }
    }else if (!tile.surfaces?.length) materials.forEach((descriptor,index) => { if (descriptor) materialUse(index, { renderOrder: 0, castShadow: true, receiveShadow: true }); });
    const variants = new Map();
    for (const structure of metadataOnly?[]:selectedSurfaces) {
      const vertices = structure.surface.vertices.map(vertex => {
        const material = materialUse(vertex.material, vertex);
        const original = tile.surfaceVariants[vertex.variant];
        if (!original) throw new Error('Captured geometry references missing variant');
        const attributes = { ...original.fields };
        for (const [name, mask] of [['uv',1],['normal',2],['color',4],['aGrime',8],['aWeather',16]]) if (vertex.flags & mask) attributes[name] = true;
        registry.material({ uuid: material.uuid }, { attributes });
        const useKey = `${vertex.variant}:${material.material}`;
        if (!variants.has(useKey)) {
          variants.set(useKey, registry.variant(material.material, original.fields, original.frame));
        }
        return { ...vertex, material: material.material, variant: variants.get(useKey) };
      });
      structures.push({ ...structure, surface: { ...structure.surface, vertices, families: structure.surface.vertices.map(vertex => materialUse(vertex.material, vertex).family) } });
    }
  }
  return { registry, structures, capturedMaterialUses };
}
