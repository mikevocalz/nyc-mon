import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { classifyCustomBuildingSource, type SourceCustomBuildingIdentity } from './source-custom-building-programs.ts';
import { customWallColorNode, customBuildingEmissionNode, customSelfLitEmissionNode, customMonumentRadianceNode } from './custom-building-material.ts';
import { createSourceStandardMaterial, type SourceRenderState } from './source-standard.ts';
import { createSourceLightingModel, sourceLightCapture } from './source-lighting.ts';
import { sourceDiffuseTrim } from './source-light-trim.ts';
import { sourceTangentNormal } from './source-normal-map.ts';
import { pbrGlassNodes, type SourceGlassFrame, type SourceGlassEnvironment } from './glass-material.ts';
import type { SourceParameterBinding, SourceTextureBinding } from './source-bindings.ts';

type Common = Parameters<typeof createSourceLightingModel>[1];
export function createSourceCustomBuildingMaterial(THREE: Three, input: {
  name: string; source: SourceCustomBuildingIdentity; state: SourceRenderState;
  material: SourceParameterBinding; textures: SourceTextureBinding; rawUv: Node<'vec2'>; rawColor: Node<'vec3'>;
  sourceWorld: Node<'vec3'>; night: Node<'float'>;
  common?: Pick<Common, 'trim' | 'cityAo' | 'cityReflection'>;
  glass?: { frame: SourceGlassFrame; environment: SourceGlassEnvironment; geometricNormal: Node<'vec3'>; groundHeight: Node<'float'> };

}) {
  const program = classifyCustomBuildingSource(input.source), T = THREE.TSL, m = input.material;
  let color = m.vec3('diffuse'), opacity = m.scalar('opacity');
  let emission = m.vec3('emissive').mul(m.scalar('emissiveIntensity'));
  const roughness = m.scalar('roughness'), metalness = m.scalar('metalness');
  if (program === 'tower-glass') {
    if (!input.glass || input.source.mapRoles.length || input.state.transparent || !input.state.depthWrite) throw new Error('Missing or mismatched authored tower glass bindings');
    const capture = sourceLightCapture(THREE), g = input.glass;
    emission = customBuildingEmissionNode(THREE, 'tower-glass', emission, input.night);
    const glass = pbrGlassNodes(THREE, { ...g.frame, environment: g.environment, geometricNormal: g.geometricNormal,
      groundHeight: g.groundHeight, tint: color, tintRatio: T.vec3(1), bodyOverride: T.vec4(-1), opacity,
      opaque: true, street: true, room: false, tintAttributes: false,
      parameters: { f0: m.scalar('pgF0'), roughness: m.scalar('pgRough'), dirt: m.scalar('pgDirt'), streetWidth: m.scalar('pgStW'),
        body: m.vec3('pgBody'), room: m.vec4('pgRm'), blinds: m.scalar('pgBl'), transmission: m.scalar('pgTr'), seed: m.scalar('pgSd'),
        sheers: m.scalar('pgShr'), glow: m.scalar('pgGlow'), storeyLocked: m.scalar('pgSlk'), litShare: m.scalar('pgLit'), origin: m.vec3('pgOrg') },
    });
    return createSourceStandardMaterial(THREE, { name: input.name, state: input.state,
      envMapIntensityNode: m.scalar('envMapIntensity'), lightingModel: () => createSourceLightingModel(THREE, { capture }),
      surface: { color: glass.color, opacity: glass.opacity, emission, roughness, metalness,
        alphaTest: m.scalar('alphaTest'), hasAlphaTest: false, beforeFog: rgba => glass.output({ ...capture, outgoing: rgba.rgb, emission }) },
    });
  }
  if (input.source.vertexColors) color = color.mul(input.rawColor);
  let normal: Node<'vec3'> | undefined, mappedRoughness = roughness;
  for (const role of input.source.mapRoles) {
    const uv = input.textures.uv(role, input.rawUv), sample = input.textures.sample(role, uv);
    if (role === 'map') { color = color.mul(sample.rgb); opacity = opacity.mul(sample.a); }
    else if (role === 'emissiveMap') emission = emission.mul(sample.rgb);
    else if (role === 'roughnessMap') mappedRoughness = mappedRoughness.mul(sample.g);
    else if (role === 'normalMap') normal = sourceTangentNormal(THREE, { uv, sample: sample.rgb, scale: m.vec2('normalScale'), side: input.state.side, flatShading: input.state.flatShading === true });
    else throw new Error(`Unported custom building map: ${role}`);
  }
  const trim = input.common?.trim;
  if (!trim) throw new Error('Missing custom-building light trim');
  if (program === 'wall-weathered' || program === 'wall-clean' || program === 'calibrated-wall') color = customWallColorNode(THREE, {
    color, world: input.sourceWorld, night: input.night, weathered: program === 'wall-weathered',
  });
  color = color.mul(sourceDiffuseTrim(THREE, trim));
  if (program === 'self-lit') emission = customSelfLitEmissionNode(THREE, emission, color, m.vec2('sourceDayNight'), input.night);
  else if (program === 'plaza-night-lit') emission = emission.mul(input.night);
  else if (program === 'victoria' || program === 'lattice' || program === 'night-lit') emission = customBuildingEmissionNode(THREE, program, emission, input.night);
  const cityAo = input.source.key.includes('|cityao') ? input.common?.cityAo : undefined;
  const monument = program === 'monument-reflection';
  const cityReflection = input.source.key.includes('|cs34') || monument ? input.common?.cityReflection : undefined;
  if (input.source.key.includes('|cityao') && !cityAo) throw new Error('Missing authored custom building city AO');
  if (input.source.key.includes('|cs34') && !cityReflection) throw new Error('Missing authored custom building city reflection');
  if (monument && !cityReflection) throw new Error('Missing monument source city-reflection binding');
  const reflected = T.reflect(T.positionViewDirection.negate(), T.normalView);
  const reflectedWorldY = T.normalize(T.vec4(reflected,0).mul(T.cameraViewMatrix).xyz).y;
  return createSourceStandardMaterial(THREE, { name: input.name, state: input.state,
    envMapIntensityNode: m.scalar('envMapIntensity'), lightingModel: () => createSourceLightingModel(THREE, { trim, cityAo,
      cityReflection: monument ? {...cityReflection!,pbrCity:true,cs34:T.vec4(0)} : cityReflection,
      radianceEdit: monument ? radiance => customMonumentRadianceNode(THREE,radiance,reflectedWorldY) : undefined }),
    surface: { color, opacity, emission, roughness: mappedRoughness, metalness, normal,
      alphaTest: m.scalar('alphaTest'), hasAlphaTest: input.source.hasAlphaTest },
  });
}
