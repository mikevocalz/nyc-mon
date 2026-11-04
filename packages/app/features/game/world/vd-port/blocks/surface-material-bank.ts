import { sourceCollisionPolicy } from './source-collision-policy.ts';
import type { Node } from 'three/webgpu';
import type { Three } from '@acme/ui/three';
import { worldPatternPosition, renderOriginNode } from '../../render-space.ts';
import { createMaterialPageBank } from './material-pages.ts';
import { createSurfaceParameters } from './surface-parameters.ts';
import { sourcePageId, type SourcePageManifest, type SourcePageTexture, type createSourcePageLoader } from './source-page-loader.ts';
import { verifySurfaceRegistry, type SurfaceRegistry, type SurfaceTextureRef } from './surface-registry.ts';
import { sourceTextureBinding, type SourceSampler } from './source-textures.ts';
import { sourceVegetationFrameNodes, sourcePatternFrameNodes } from './source-frame.ts';
import { sourceEnvironmentNodes } from './source-environment.ts';
import { createSourcePbrMaterial, classifySourcePbr } from './source-pbr-factory.ts';
import { createPilotFkMaterial, classifyPilotFk } from './source-fk-factory.ts';
import { createSourceSignMaterial, classifySourceSignMaterial } from './source-sign-factory.ts';
import { createSourcePbrGlassMaterial, classifySourcePbrGlass } from './source-glass-factory.ts';
import { createSourceStandardFamily, classifySourceStandard } from './source-standard-family.ts';
import { createSourceApolloMaterial } from './source-apollo-factory.ts';
import { classifyApolloSource } from './source-apollo-programs.ts';
import { createSourceCustomBuildingMaterial } from './source-custom-building-factory.ts';
import { classifyCustomBuildingSource } from './source-custom-building-programs.ts';
import { createSourceVegetationMaterial } from './source-vegetation-factory.ts';
import { classifyVegetationSource } from './source-vegetation-programs.ts';
import type { SourceGlassEnvironment } from './glass-material.ts';
import type { NearCellInfo } from './codec.ts';

export interface SurfaceVegetationDynamics { windTime: Node<'float'>; windAmplitude: Node<'float'>; snow: Node<'float'>; fadeFrame: Node<'float'>; renderTargetHeight: Node<'float'> }
type SurfaceCell = NearCellInfo & { textures: readonly number[] };

/** One renderer/scene owns the tables, shared materials and bounded original texture pages. */
export async function createSurfaceMaterialBank(THREE: Three, options: {
  registry: SurfaceRegistry;
  expectedSha256: string;
  manifest: SourcePageManifest & { cityAORect: readonly number[] };
  namespace: string;
  loader: ReturnType<typeof createSourcePageLoader>;
  /** Combined page and parameter-table GPU bytes; caller must account separately for scene targets/shadows. */
  limitBytes: number;
  /** Source ENV bindings in scene axes. The helper's zenith parameter is authored ENV.skyAmbient/uZenC. */
  environment: SourceGlassEnvironment;
  vegetation?: SurfaceVegetationDynamics;
  signal?: AbortSignal;
  sha256Hex?: (bytes: Uint8Array) => Promise<string>;
}) {
  const registry = options.registry;
  const requireActive = () => { if (options.signal?.aborted) { const error = new Error('Authored material bank preparation aborted'); error.name = 'AbortError'; throw error; } };
  requireActive();
  await verifySurfaceRegistry(registry, options.expectedSha256, options.sha256Hex);
  requireActive();
  const pageSpecs = new Map(options.manifest.pages.map((page) => [page.id, page]));
  const textures = new Map(registry.textures.map((texture) => [texture.id, texture]));
  const families = new Map(registry.families.map((family) => [family.id, family]));
  for (const family of registry.families) {
    if (!Number.isFinite(family.staticFlags.renderOrder) || !['source-pbr','source-fk','source-sign','source-glass','source-standard','source-apollo','source-custom-building','source-vegetation'].includes(family.name)) throw new Error('Unbound authored family or missing source render order');
  }
  const references = new Map<number, Map<number, SurfaceTextureRef[]>>();
  for (const material of registry.materials) {
    const family = families.get(material.family);
    if (!family) throw new Error('Source material has an unknown family');
    const mapRoles = Object.keys(material.textureBindings).filter((name) => !name.startsWith('uniform:')).sort();
    const identity = { ...material.source, type: material.type, vertexColors: material.vertexColors,
      hasAlphaTest: family.staticFlags.hasAlphaTest, mapRoles, attributeRoles: material.shader?.attrs ?? [], normalMapType: material.normalMapType };
    if (family.name === 'source-pbr') { classifySourcePbr(identity); if (!material.pbr || mapRoles.length) throw new Error('Unbound PBR descriptor or additional source maps'); }
    else if (family.name === 'source-fk') classifyPilotFk(identity);
    else if (family.name === 'source-sign') classifySourceSignMaterial(identity);
    else if (family.name === 'source-glass') classifySourcePbrGlass(identity);
    else if (family.name === 'source-standard') classifySourceStandard(identity);
    else if (family.name === 'source-apollo') classifyApolloSource(identity);
    else if (family.name === 'source-custom-building') classifyCustomBuildingSource(identity);
    else if (family.name === 'source-vegetation') { classifyVegetationSource(identity); if (!options.vegetation) throw new Error('Missing explicit authored vegetation dynamic bindings'); }
    let byTexture = references.get(material.family);
    if (!byTexture) { byTexture = new Map(); references.set(material.family, byTexture); }
    for (const binding of Object.values(material.textureBindings)) {
      const payload = textures.get(binding.texture);
      if (!payload || payload.sha256 !== binding.sha256) throw new Error('Authored binding does not match its texture payload');
      const list = byTexture.get(binding.texture) ?? [];
      list.push(binding); byTexture.set(binding.texture, list);
    }
  }
  const parameters = createSurfaceParameters(THREE, registry.parameters);
  const cached = new Map<number, { material: InstanceType<Three['MeshStandardNodeMaterial']> | InstanceType<Three['MeshBasicNodeMaterial']>; samplers: ReturnType<typeof sourceTextureBinding>; roles: ReadonlyMap<string, number> }>();
  let disposed = false;
  try {
    if (!Number.isSafeInteger(options.limitBytes) || options.limitBytes <= parameters.bytes) throw new Error('Authored material budget cannot hold its parameter tables');
    const pages = createMaterialPageBank<SourcePageTexture>({ limitBytes: options.limitBytes - parameters.bytes,
      pages: options.loader.specs, load: options.loader.load });
    const T = THREE.TSL, sourceEnv = sourceEnvironmentNodes(THREE, options.environment.night);
    const globalMaterial = T.varying(T.attribute('aVdSurface', 'vec4').x).setInterpolation('flat');
    const globalVariant = T.varying(T.attribute('aVdSurface', 'vec4').y).setInterpolation('flat');
    const variant = parameters.variant(globalVariant), frame = parameters.frame(variant.scalar('frameRow'));
    const absolute = worldPatternPosition(THREE), normal = T.normalWorldGeometry;
    const sourceFrame = sourcePatternFrameNodes(THREE, { position: absolute, normal,
      baseY: frame.scalar('baseY'), curb: frame.scalar('curb'), affine: frame.vec4('affine') });
    const sourceCamera = sourcePatternFrameNodes(THREE, { position: T.cameraPosition.add(renderOriginNode(THREE)), normal,
      baseY: frame.scalar('baseY'), curb: frame.scalar('curb'), affine: frame.vec4('affine') }).position;
    const affine = frame.vec4('affine');
    const environment = { ...options.environment,
      sunDirection: T.normalize(options.environment.sunDirection.div(T.vec3(affine.x, 1, affine.y))) };
    const aoRef = registry.textures.find((texture) => texture.semantic === 'env:cityAO');
    if (options.manifest.cityAORect.length !== 4 || !options.manifest.cityAORect.every(Number.isFinite)) throw new Error('Missing authored city-AO binding');
    const rect = T.vec4(...options.manifest.cityAORect as [number, number, number, number]);
    function pageId(page: number): string {
      const spec = pageSpecs.get(page);
      if (!spec) throw new Error(`Missing authored page ${page}`);
      return sourcePageId(options.namespace, spec);
    }
    function texturePage(texture: SurfaceTextureRef): number {
      const id = texture.id;
      if (texture.page === undefined) throw new Error(`Unresolved authored texture ${id}`);
      const page = pageSpecs.get(texture.page);
      if (!page || page.layers !== 1 || (texture.layer ?? 0) !== 0 || page.sha256 !== texture.sha256 || page.width !== texture.width || page.height !== texture.height || page.format !== texture.format || page.type !== texture.type) throw new Error(`Authored texture ${id} page identity mismatch`);
      for (const key of ['colorSpace', 'wrapS', 'wrapT', 'flipY', 'premultiplyAlpha', 'minFilter', 'magFilter', 'anisotropy', 'generateMipmaps'] as const) {
        if (texture[key] !== undefined && texture[key] !== page.sampler[key]) throw new Error(`Authored texture ${id} sampler mismatch: ${key}`);
      }
      return texture.page;
    }
    function validateCell(info: SurfaceCell) {
      if (!info.surface || info.surface.sha256 !== registry.sha256 || info.surface.materialCount !== registry.materialCount || info.surface.variantCount !== registry.variantCount || info.family === undefined || !families.has(info.family)) throw new Error(`Cell ${info.key} does not match its authored registry`);
    }
    function required(cells: readonly SurfaceCell[]) {
      for (const cell of cells) validateCell(cell);
      return [...new Set(cells.flatMap((cell) => cell.textures.flatMap((id) => {
        const refs = references.get(cell.family!)?.get(id);
        if (!refs?.length) throw new Error(`Cell ${cell.key} has an unbound authored texture ${id}`);
        return refs.map((ref) => pageId(texturePage(ref)));
      })))];
    }
    type Lease = ReturnType<typeof pages.lease>;
    function rebind(family: number, lease: Lease) {
      const existing = cached.get(family);
      if (!existing) return;
      for (const [role, page] of existing.roles) existing.samplers.rebind(role, lease.get(pageId(page)).texture);
    }
    function material(familyId: number, lease: Lease) {
      if (disposed || !lease.ready()) throw new Error('Authored material requested before its complete page cohort');
      const existing = cached.get(familyId);
      if (existing) { rebind(familyId, lease); return existing.material; }
      const family = families.get(familyId);
      if (!family || !Number.isFinite(family.staticFlags.renderOrder)) throw new Error('Unbound authored family or missing source render order');
      const members = registry.materials.filter((item) => item.family === familyId), first = members[0];
      if (!first) throw new Error('Authored family has no source descriptors');
      const p = parameters.material(familyId, globalMaterial);
      const roles = new Map(family.staticFlags.texturePages.map((binding) => [binding.role.replace(/^uniform:/,''), binding.page]));
      const isGlass = first.source.key.startsWith('kitwinglass3|') || family.name === 'source-glass';
      const needsAo = (family.name === 'source-fk' && !isGlass) || family.name === 'source-pbr' || family.name === 'source-vegetation' || family.name === 'source-glass' || first.source.key.includes('|cityao') || first.source.key.includes('|pbcity') || first.source.key.startsWith('b3tg|');
      if (needsAo) { if (!aoRef) throw new Error('Missing authored city-AO binding'); roles.set('cityAO',texturePage(aoRef)); }
      const samplers: Record<string, SourceSampler> = {};
      for (const [role, page] of roles) {
        const texture = lease.get(pageId(page)).texture;
        const originalRole = family.staticFlags.texturePages.find(binding=>binding.role.replace(/^uniform:/,'')===role)?.role ?? role;
        samplers[role] = role === 'cityAO' || role === 'vgNrm' ? { texture } : { texture, layer: p.scalar(`${originalRole}Layer`),
          matrix: [p.vec3(`${originalRole}Uv0`), p.vec3(`${originalRole}Uv1`), p.vec3(`${originalRole}Uv2`)] };
      }
      const bindings = sourceTextureBinding(THREE, samplers);
      const mapRoles = (item: typeof first) => Object.keys(item.textureBindings).filter((name) => !name.startsWith('uniform:')).sort();
      const identity = (item: typeof first) => ({ ...item.source, type: item.type, vertexColors: item.vertexColors,
        hasAlphaTest: family.staticFlags.hasAlphaTest, mapRoles: mapRoles(item), attributeRoles: item.shader?.attrs ?? [], normalMapType:item.normalMapType });
      const trim = { night: sourceEnv.night, st34: sourceEnv.st34, scale: T.vec3(1) };
      const sourceIdentity = identity(first);
      const mapRef = first.textureBindings.map;
      const signIdentity = { ...sourceIdentity, mapFormat:mapRef?.format,mapColorSpace:mapRef?.colorSpace };
      const sample4 = needsAo ? bindings.sample('cityAO',sourceFrame.position.xz.sub(rect.xy).mul(rect.zw)) : T.vec4(0);
      const cityAo = {position:sourceFrame.position,normal:sourceFrame.normal,sample:sample4.rg,rect,amount:sourceEnv.cityAOAmt,lb14Gao:sourceEnv.lb14Gao,night:sourceEnv.night};
      const height = T.select(rect.z.greaterThan(0),sourceFrame.position.y.sub(sample4.g.mul(127.5)),sourceFrame.position.y);
      const common = {trim,cityAo,cityReflection:{height,cs34:sourceEnv.cs34,cs34Col:sourceEnv.cs34Col,pbrCity:first.source.key.endsWith('|pbcity')}};
      const glassFrame = {...sourceFrame,cameraPosition:sourceCamera};
      const viewGeometric = T.normalize(T.cross(T.dFdx(T.positionView),T.dFdy(T.positionView)));
      const worldGeometric = T.normalize(T.vec4(viewGeometric,0).mul(T.cameraViewMatrix).xyz);
      const geometricNormal = sourcePatternFrameNodes(THREE,{position:absolute,normal:worldGeometric,baseY:frame.scalar('baseY'),curb:frame.scalar('curb'),affine:frame.vec4('affine')}).normal;
      let result: InstanceType<Three['MeshStandardNodeMaterial']> | InstanceType<Three['MeshBasicNodeMaterial']>;
      if (family.name === 'source-pbr') {
        for (const member of members) classifySourcePbr({...identity(member)});
        if (!first.pbr) throw new Error('Authored PBR descriptor is missing');
        const sample = bindings.sample('cityAO', sourceFrame.position.xz.sub(rect.xy).mul(rect.zw)).rg;
        result = createSourcePbrMaterial(THREE, { source: identity(first), descriptor: first.pbr, state: family.state,
          material: p, variant, textures: bindings,
          arrays: { albedo: samplers.pbAlb!.texture, orm: samplers.pbOrm!.texture },
          diffuseFactor: p.vec3('diffuse').mul(family.staticFlags.vertexColors ? T.attribute('color', 'vec3') : T.vec3(1)).mul(variant.vec3('instanceColor')),
          patternPosition: sourceFrame.position, patternNormal: sourceFrame.normal,
          weather: T.varying(T.attribute('aVdWeather', 'vec4')).setInterpolation('flat'), grime: T.attribute('aVdSurface', 'vec4').z,
          trim, frame:glassFrame,geometricNormal,environment, cs34: sourceEnv.cs34, cs34Col: sourceEnv.cs34Col,
          cityAo: { position: sourceFrame.position, normal: sourceFrame.normal, sample, rect, amount: sourceEnv.cityAOAmt, lb14Gao: sourceEnv.lb14Gao, night: sourceEnv.night } });
      } else if (family.name === 'source-fk') {
        for (const member of members) classifyPilotFk(identity(member));
        const sample = isGlass ? undefined : bindings.sample('cityAO', sourceFrame.position.xz.sub(rect.xy).mul(rect.zw)).rg;
        const height = sample ? sourceFrame.position.y.sub(sample.y.mul(127.5)) : sourceFrame.position.y;
        result = createPilotFkMaterial(THREE, { name: `vd:surface-family-${familyId}`, source: identity(first), state: family.state,
          material: p, variant, textures: bindings, rawUv: T.uv(), rawColor: T.attribute('color', 'vec3'),
          frame: { ...sourceFrame, cameraPosition: sourceCamera }, environment,
          common: isGlass ? undefined : { trim,
            cityAo: { position: sourceFrame.position, normal: sourceFrame.normal, sample: sample!, rect, amount: sourceEnv.cityAOAmt, lb14Gao: sourceEnv.lb14Gao, night: sourceEnv.night },
            cityReflection: { height, cs34: sourceEnv.cs34, cs34Col: sourceEnv.cs34Col, pbrCity: first.source.key.endsWith('|pbcity') } } });
      } else if (family.name === 'source-sign') {
        for (const member of members) classifySourceSignMaterial({...identity(member),mapFormat:member.textureBindings.map?.format,mapColorSpace:member.textureBindings.map?.colorSpace});
        result=createSourceSignMaterial(THREE,{name:`vd:surface-family-${familyId}`,source:signIdentity,state:family.state,material:p,variant,textures:bindings,rawUv:T.uv(),rawColor:T.attribute('color','vec3'),trim});
      } else if (family.name === 'source-glass') {
        result=createSourcePbrGlassMaterial(THREE,{name:`vd:surface-family-${familyId}`,source:sourceIdentity,state:family.state,material:p,variant,frame:glassFrame,geometricNormal,environment,ground:{sample:sample4,rect}});
      } else if (family.name === 'source-standard') {
        result=createSourceStandardFamily(THREE,{name:`vd:surface-family-${familyId}`,source:sourceIdentity,state:family.state,material:p,textures:bindings,rawUv:T.uv(),rawColor:T.attribute('color','vec3'),common});
      } else if (family.name === 'source-apollo') {
        result=createSourceApolloMaterial(THREE,{name:`vd:surface-family-${familyId}`,source:sourceIdentity,state:family.state,material:p,textures:bindings,rawUv:T.uv(),night:sourceEnv.night,trim});
      } else if (family.name === 'source-custom-building') {
        result=createSourceCustomBuildingMaterial(THREE,{name:`vd:surface-family-${familyId}`,source:sourceIdentity,state:family.state,material:p,textures:bindings,rawUv:T.uv(),rawColor:T.attribute('color','vec3'),sourceWorld:sourceFrame.position,night:sourceEnv.night,common,
          glass:{frame:glassFrame,geometricNormal,environment,groundHeight:T.select(rect.z.greaterThan(0),sample4.g.mul(127.5),0)}});
      } else if (family.name === 'source-vegetation') {
        if(!options.vegetation)throw new Error('Missing explicit authored vegetation dynamic bindings');
        const vegetationFrame=sourceVegetationFrameNodes(THREE,{position:absolute,normal,frame});
        result=createSourceVegetationMaterial(THREE,{name:`vd:surface-family-${familyId}`,source:sourceIdentity,state:family.state,material:p,variant,textures:bindings,rawUv:T.uv(),rawColor:T.attribute('color','vec3'),geometricNormalView:T.normalViewGeometry,
          frame:vegetationFrame,dynamics:{...options.vegetation,sourceCamera:sourceCamera.xz,bottomLeftScreenPixels:T.vec2(T.screenCoordinate.x,options.vegetation.renderTargetHeight.sub(T.screenCoordinate.y))},trim:{...trim,scale:T.vec3(2.6)},cityAo,cityReflection:{...common.cityReflection,pbrCity:false}});
      } else throw new Error(`Unbound authored family ${family.name}`);
      cached.set(familyId, { material: result, samplers: bindings, roles });
      return result;
    }
    const onAbort: () => void = () => result.dispose();
    const result = {
      parameterBytes: parameters.bytes,
      pageRequirements(cells: readonly SurfaceCell[]) {
        return required(cells).map(id=>{const spec=options.loader.specs.find(page=>page.id===id);if(!spec)throw new Error(`Missing authored page cost ${id}`);return spec;});
      },
      get bytes() { return disposed ? 0 : parameters.bytes + pages.bytes; },
      lease(cells: readonly SurfaceCell[]) { if (disposed) throw new Error('Authored material bank is disposed'); return pages.lease(required(cells)); },
      material,
      resources(info: SurfaceCell, cohort: readonly SurfaceCell[]) {
        if (disposed) throw new Error('Authored material bank is disposed');
        validateCell(info);
        const lease = pages.lease(required(cohort));
        return { ready: lease.ready, release: lease.release, get error() { return lease.error; }, async prefetch() {
          const ready = await lease.prefetch();
          if (ready) rebind(info.family!, lease);
          return ready;
        } };
      },
      collisionPolicy(familyId: number) {
        const family=families.get(familyId);
        const members=registry.materials.filter(material=>material.family===familyId);
        if(!family || !members.length)throw new Error('Unknown authored collision family');
        const policies=members.map(material=>sourceCollisionPolicy(family,material));
        if(policies.some(policy=>policy.camera!==policies[0]!.camera || policy.body!==policies[0]!.body))throw new Error('Authored family mixes incompatible collision roles');
        return policies[0]!;
      },
      renderOrder(family: number) {
        const value = families.get(family)?.staticFlags.renderOrder;
        if (!Number.isFinite(value)) throw new Error('Missing authored mesh render order');
        return value!;
      },
      shadowFlags(family: number) {
        const flags = families.get(family)?.staticFlags;
        if (typeof flags?.castShadow !== 'boolean' || typeof flags.receiveShadow !== 'boolean') throw new Error('Missing resolved source shadow ownership');
        return { cast: flags.castShadow, receive: flags.receiveShadow };
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        options.signal?.removeEventListener('abort', onAbort);
        for (const entry of cached.values()) entry.material.dispose();
        cached.clear(); pages.dispose(); parameters.dispose();
      },
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });
    return result;
  } catch (error) {
    for (const entry of cached.values()) entry.material.dispose();
    parameters.dispose();
    throw error;
  }
}
