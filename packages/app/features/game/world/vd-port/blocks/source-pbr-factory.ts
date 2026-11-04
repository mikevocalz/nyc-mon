import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { createPbrMaterial, type PbrDescriptor } from '../furniture/pbr-material.ts';
import type { SourcePageImage } from './source-page-loader.ts';
import type { SourceParameterBinding, SourceTextureBinding } from './source-bindings.ts';
import type { SourceRenderState } from './source-standard.ts';
import type { SourceLightTrim } from './source-light-trim.ts';
import { sourceCityAoFactors, type SourceCityAoInputs } from './source-city-ao.ts';
import { sourceCityReflection } from './source-city-reflection.ts';
import { classifyPilotPbr, classifySourcePbr, PBR_PARAMETER_FIELDS } from './source-pbr-programs.ts';
import { fkSkyMetalNodes, type SourceGlassFrame, type SourceGlassEnvironment } from './glass-material.ts';
export { classifyPilotPbr, classifySourcePbr, PILOT_PBR_PROGRAMS, SOURCE_PBR_PROGRAMS, PBR_PARAMETER_FIELDS } from './source-pbr-programs.ts';

export interface SourcePbrMaterialInput {
  source: { key: string; shaderHash: string; shaderSha256: string; mapRoles: readonly string[] };
  descriptor: PbrDescriptor;
  state: SourceRenderState;
  material: SourceParameterBinding;
  variant: SourceParameterBinding;
  textures: SourceTextureBinding;
  arrays: { albedo: SourcePageImage; orm: SourcePageImage };
  /** Exact source diffuse/vertex/instance product; kit glass uses a different RGB-data contract. */
  diffuseFactor: Node<'vec3'>;
  patternPosition: Node<'vec3'>;
  patternNormal: Node<'vec3'>;
  weather: Node<'vec4'>;
  grime: Node<'float'>;
  trim: SourceLightTrim;
  cityAo: SourceCityAoInputs;
  cs34: Node<'vec4'>;
  cs34Col: Node<'vec4'>;
  frame?: SourceGlassFrame;
  geometricNormal?: Node<'vec3'>;
  environment?: SourceGlassEnvironment;
}

export function createSourcePbrMaterial(THREE: Three, input: SourcePbrMaterialInput) {
  const features = classifySourcePbr(input.source);
  return createClassifiedPbrBase(THREE, input, features);
}

/** Composite source factories (e.g. the verified monument shader) classify their complete program before using this base. */
export function createClassifiedPbrBase(THREE: Three, input: SourcePbrMaterialInput,
  features: Pick<ReturnType<typeof classifySourcePbr>, 'sharedTint' | 'skyMetal' | 'environmentShare'>) {
  if (input.source.mapRoles.length) throw new Error('Authored PBR source has unsupported additional material maps');
  if (features.skyMetal && (!input.frame || !input.geometricNormal || !input.environment)) throw new Error('Authored SkyMetal requires its original geometric frame and ENV');
  const p = input.material, T = THREE.TSL;
  const parameters: Record<string, Node> = {};
  for (const field of PBR_PARAMETER_FIELDS) {
    if (field.name.endsWith('Enabled')) continue;
    parameters[field.name] = field.size === 1 ? p.scalar(field.name) : field.size === 2 ? p.vec2(field.name) : field.size === 3 ? p.vec3(field.name) : p.vec4(field.name);
  }
  parameters.pbRatio = features.sharedTint ? p.vec3('pbRatio').mul(input.variant.vec3('fkTr')) : p.vec3('pbRatio');
  const ground = T.select(input.cityAo.rect.z.greaterThan(0), input.cityAo.sample.y.mul(127.5), 0);
  const material = createPbrMaterial(THREE, input.descriptor, {
    ...input.arrays, physical: true, night: input.trim.night, setLayout: { layer: 0, b: 'alpha' },
    parameterNodes: parameters, groundY: ground, environmentIntensityNode: p.scalar('envMapIntensity'),
    patternPosition: input.patternPosition, patternNormal: input.patternNormal, sourceLightTrim: input.trim,
    diffuseFactorNode: input.diffuseFactor,
    attributeNodes: { weather: input.weather, grime: input.grime, weatherEnabled: p.scalar('weatherEnabled'), grimeEnabled: p.scalar('grimeEnabled'), dirtEnabled: p.scalar('dirtEnabled') },
    sourceSample: ({ uv, dx, dy }) => ({
      albedo: input.textures.sample('pbAlb', uv, { dx, dy }),
      orm: input.textures.sample('pbOrm', uv, { dx, dy }),
      normal: input.textures.sample('pbNrm', uv, { dx, dy }).xyz,
    }),
  });
  Object.assign(material, input.state);
  material.opacityNode = p.scalar('opacity');
  const baseEmission = p.vec3('emissive').mul(p.scalar('emissiveIntensity'));
  material.emissiveNode = baseEmission;
  if (features.skyMetal) {
    const tint = features.sharedTint ? p.vec3('uSmTn').mul(input.variant.vec3('fkTr')) : p.vec3('uSmTn');
    const sky = fkSkyMetalNodes(THREE, { ...input.frame!, normal: input.geometricNormal! }, input.environment!, tint, p.vec4('uSmP'), material.roughnessNode as Node<'float'>);
    const view = T.normalize(input.frame!.cameraPosition.sub(input.frame!.position));
    const facing = T.select(T.dot(input.geometricNormal!, view).lessThan(0), input.geometricNormal!.negate(), input.geometricNormal!);
    const reflected = T.reflect(view.negate(), facing);
    const ray = T.normalize(T.mix(reflected, T.normalize(T.vec3(reflected.x, reflected.y.mul(0.42), reflected.z)), p.vec4('uSmP').y));
    const base = T.mix(p.scalar('pbBaseY'), input.weather.y, p.scalar('weatherEnabled'));
    const gy = T.select(p.scalar('street').lessThan(0.5).and(base.lessThan(-9000)), ground, base);
    const horizon = T.float(0.55).mul(T.float(1).sub(T.smoothstep(2, 32, input.patternPosition.y.sub(gy))));
    const share = T.smoothstep(horizon.sub(0.14), horizon.add(0.14), ray.y);
    const gray = T.vec3(T.dot(sky.emission, T.vec3(0.2126, 0.7152, 0.0722))).mul(T.vec3(0.95, 1, 1.08));
    const canyon = T.mix(gray.mul(0.55), T.mix(sky.emission, gray, 0.35), share);
    material.emissiveNode = baseEmission.add(T.mix(sky.emission, canyon, p.scalar('city')));
    material.roughnessNode = sky.roughness;
  }
  const ao = sourceCityAoFactors(THREE, input.cityAo);
  const setupLighting = material.setupLightingModel;
  material.setupLightingModel = function (...args) {
    const model = setupLighting.apply(this, args)!;
    const indirect = model.indirect, ambientOcclusion = model.ambientOcclusion;
    model.indirect = function (builder) {
      const context = builder.context as { radiance: Node<'vec3'>; iblIrradiance: Node<'vec3'> };
      const edited = sourceCityReflection(THREE, { height: ao.height, ...context, cs34: input.cs34, cs34Col: input.cs34Col, pbrCity: p.scalar('city') });
      context.radiance.assign(edited.radiance); context.iblIrradiance.assign(edited.iblIrradiance);
      indirect.call(this, builder);
    };
    model.ambientOcclusion = function (builder) {
      ambientOcclusion.call(this, builder);
      const context = builder.context as { reflectedLight: { indirectDiffuse: Node<'vec3'>; indirectSpecular: Node<'vec3'> } };
      if (features.environmentShare) context.reflectedLight.indirectSpecular.mulAssign(p.scalar('fkEnvK'));
      context.reflectedLight.indirectDiffuse.mulAssign(ao.diffuse);
      context.reflectedLight.indirectSpecular.mulAssign(ao.specular);
    };
    return model;
  };
  return material;
}

export function createPilotPbrMaterial(THREE: Three, input: SourcePbrMaterialInput) {
  classifyPilotPbr(input.source);
  return createSourcePbrMaterial(THREE, input);
}
