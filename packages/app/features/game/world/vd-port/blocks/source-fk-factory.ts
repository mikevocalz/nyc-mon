// Pilot-cell bindings captured from Valdrada @2724c79; source shader SHA includes expanded hooks/defines.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { kitWindowGlassNodes, fkNightEmission, fkLevelEmission, fkAtlasSample, fkSoftMap,
  type SourceGlassFrame, type SourceGlassEnvironment } from './glass-material.ts';
import { createSourceStandardMaterial, type SourceRenderState } from './source-standard.ts';
import { createSourceLightingModel, sourceLightCapture } from './source-lighting.ts';
import { sourceDiffuseTrim } from './source-light-trim.ts';
import type { SourceParameterBinding, SourceTextureBinding } from './source-bindings.ts';

import { classifyPilotFk, type PilotFkSource } from './source-fk-programs.ts';
export { classifyPilotFk, PILOT_FK_PROGRAMS, SOURCE_FK_EXTRA_PROGRAMS, SOURCE_KIT_GLASS_EXTRA, pilotFkParameterSchema, type PilotFkSource } from './source-fk-programs.ts';
type Common = Parameters<typeof createSourceLightingModel>[1];
export interface PilotFkMaterialInput {
  name: string; source: PilotFkSource; state: SourceRenderState;
  material: SourceParameterBinding; variant: SourceParameterBinding; textures: SourceTextureBinding;
  rawUv: Node<'vec2'>; rawColor: Node<'vec3'>; frame: SourceGlassFrame; environment: SourceGlassEnvironment;
  /** Required authored common bindings for non-glass; glass deliberately does not use these wrappers. */
  common?: Pick<Common, 'trim' | 'cityAo' | 'cityReflection'>;
}

/** Returns the actual shared template material. Every missing table/map or unported program fails before publication. */
export function createPilotFkMaterial(THREE: Three, input: PilotFkMaterialInput) {
  const program = classifyPilotFk(input.source), T = THREE.TSL, m = input.material;
  const roles = new Set(input.source.mapRoles);
  if (roles.size !== input.source.mapRoles.length) throw new Error('Duplicate authored map role');
  // Actual pilot8 programs only have an optional diffuse map. Never approximate a new normal/PBR/alpha role.
  for (const role of roles) if (role !== 'map') throw new Error(`Unported pilot FK map role ${role}`);
  if (input.source.hasAlphaTest) throw new Error('Pilot FK alpha-test program was not captured');
  const diffuse = m.vec3('diffuse');
  let opacity = m.scalar('opacity');
  const roughness = m.scalar('roughness'), metalness = m.scalar('metalness');
  let emission = m.vec3('emissive').mul(m.scalar('emissiveIntensity'));
  const capture = sourceLightCapture(THREE);
  if (program.startsWith('kitwinglass3|')) {
    if (roles.size) throw new Error('Authored kit glass has no source maps');
    if (!input.source.vertexColors || input.state.premultipliedAlpha || input.state.blending !== THREE.CustomBlending ||
      input.state.blendSrc !== THREE.OneFactor || input.state.blendDst !== THREE.OneMinusSrcAlphaFactor || !input.state.transparent || input.state.depthWrite) {
      throw new Error('Kit glass source semantic/blend contract mismatch');
    }
    const [, f0, reflectedRoughness, dirt] = program.split('|').map((value,i)=>i===0?NaN:Number(value));
    const glass = kitWindowGlassNodes(THREE, { ...input.frame, environment: input.environment, tint: diffuse,
      character: input.rawColor, opacity, f0: T.float(f0!), roughness: T.float(reflectedRoughness!), dirt: T.float(dirt!) });
    return createSourceStandardMaterial(THREE, { name: input.name, state: input.state,
      envMapIntensityNode: m.scalar('envMapIntensity'), lightingModel: () => createSourceLightingModel(THREE, { capture }),
      surface: { color: glass.color, opacity: glass.opacity, emission, roughness, metalness, alphaTest: T.float(0), hasAlphaTest: false,
        beforeFog: rgba => glass.output({ ...capture, outgoing: rgba.rgb, emission }) },
    });
  }
  const common = input.common;
  if (!common?.trim || !common.cityAo || !common.cityReflection) throw new Error('Missing authored FK city lighting bindings');
  const plain = program.endsWith('|fkplain|pbcity');
  if (common.cityReflection.pbrCity !== program.endsWith('|pbcity')) throw new Error('FK city-reflection program mismatch');
  let color = input.source.vertexColors ? diffuse.mul(input.rawColor) : diffuse;
  if (roles.has('map')) {
    const uv = input.textures.uv('map', input.rawUv);
    const sample = program.includes('|fklva')
      ? fkAtlasSample(THREE, uv, input.variant.vec3('fkTr'), T.float(8), (mapped, dx, dy) => input.textures.sample('map', mapped, {dx,dy}))
      : input.textures.sample('map', uv);
    if (program.includes('|fksoft0.2')) color = fkSoftMap(THREE, color, sample.rgb, T.float(0.2));
    else { color = color.mul(sample.rgb); opacity = opacity.mul(sample.a); }
  }
  if (plain) color = color.mul(input.variant.vec3('fkTr'));
  color = color.mul(sourceDiffuseTrim(THREE, common.trim));
  const level = /\|fklva?([0-9.]+),([0-9.]+)$/.exec(program);
  if (level) emission = emission.add(fkLevelEmission(THREE, color, input.variant.vec3('fkTr').x, T.float(Number(level[1])), T.float(Number(level[2])), input.environment.night));
  if (program.includes('|fkselfU')) { const lv = m.vec2('fkLv'); emission = emission.add(color.mul(T.mix(lv.x, lv.y, input.environment.night))); }
  if (program.endsWith('|fknight1')) emission = fkNightEmission(THREE, emission, input.environment.night, T.float(1));
  let interior: Common['interior'];
  if (program.includes('|fkin0.6,0.85')) interior = { indirect: T.float(0.6), direct: T.float(0.85) };
  else if (program.includes('|fkin0.28,0.6')) interior = { indirect: T.float(0.28), direct: T.float(0.6) };
  else if (program.includes('|fkin0.3,0.7')) interior = { indirect: T.float(0.3), direct: T.float(0.7) };
  else if (program.includes('|fkin0.45,0.8')) interior = { indirect: T.float(0.45), direct: T.float(0.8) };
  else if (program.includes('|fkin1,1')) interior = { indirect: T.float(1), direct: T.float(1) };
  else if (program.includes('|fkin0.3,0.6')) interior = { indirect: T.float(0.3), direct: T.float(0.6) };
  return createSourceStandardMaterial(THREE, { name: input.name, state: input.state,
    envMapIntensityNode: m.scalar('envMapIntensity'),
    lightingModel: () => createSourceLightingModel(THREE, { ...common, interior,
      environmentShare: program.includes('|fkenvU') ? m.scalar('fkEnvK') : undefined }),
    surface: { color, opacity, emission, roughness, metalness, alphaTest: T.float(0), hasAlphaTest: false },
  });
}
