import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { classifyVegetationSource, type SourceVegetationIdentity } from './source-vegetation-programs.ts';
import { createSourceStandardMaterial, type SourceRenderState } from './source-standard.ts';
import { createSourceLightingModel } from './source-lighting.ts';
import { applySourceSpecularTrim, type SourceLightTrim } from './source-light-trim.ts';
import type { SourceCityAoInputs } from './source-city-ao.ts';
import type { SourceParameterBinding, SourceTextureBinding } from './source-bindings.ts';
import { applyVegetationSpecular, vegetationColorNode, vegetationFadeMask, vegetationNormalNode, vegetationSnowNodes, vegetationTranslucencyNode, vegetationWindDelta } from './vegetation-material.ts';

type F = Node<'float'>;
type V2 = Node<'vec2'>;
type V3 = Node<'vec3'>;
type V4 = Node<'vec4'>;

/** Original frames and render-target pixels are explicit: baked scene coordinates cannot substitute for leaf-local wind. */
export interface SourceVegetationInput {
  name: string; source: SourceVegetationIdentity; state: SourceRenderState;
  material: SourceParameterBinding; variant: SourceParameterBinding; textures: SourceTextureBinding;
  rawColor: V3; rawUv: V2;
  /** Interpolated geometry view normal BEFORE front/back face adjustment. */
  geometricNormalView: V3;
  frame: { localPosition: V3; objectNormal: V3; instanceTranslation: V2; instanced: F; sourceOrigin: V2; sceneWindDelta(delta: V3): V3 };
  dynamics: { windTime: F; windAmplitude: F; snow: F; fadeFrame: F; sourceCamera: V2; bottomLeftScreenPixels: V2 };
  trim: SourceLightTrim; cityAo: SourceCityAoInputs;
  cityReflection: { height: F; cs34: V4; cs34Col: V4; pbrCity: boolean };
}

export function createSourceVegetationMaterial(THREE: Three, input: SourceVegetationInput) {
  const level = classifyVegetationSource(input.source), T = THREE.TSL, m = input.material;
  if (input.state.flatShading || input.state.side !== THREE.DoubleSide || input.state.transparent || !input.state.depthWrite || input.state.premultipliedAlpha || input.state.blending !== THREE.NormalBlending) throw new Error('Uncaptured authored leaf render state');
  const mapUv = input.textures.uv('map', input.rawUv);
  const map = input.textures.sample('map', mapUv), relief = input.textures.sample('vgNrm', mapUv);
  const tint = input.rawColor.mul(input.variant.vec3('instanceColor'));
  // VG replaces color_fragment before LT runs; the source's later diffuse LT replacement therefore does not execute.
  const color = vegetationColorNode(THREE, m.vec3('diffuse').mul(map.rgb), tint);
  // normal_fragment_begin flips first, snow reads that normal, then VG undoes the double-sided flip.
  const initialNormalView = input.geometricNormalView.mul(T.faceDirection);
  const capped = vegetationSnowNodes(THREE, color, m.scalar('roughness'), initialNormalView, input.dynamics.snow);
  const leafNormal = initialNormalView.mul(T.faceDirection);
  const normal = vegetationNormalNode(THREE, leafNormal, T.positionView, mapUv, relief, m.vec4('vg37K').x);
  const material = createSourceStandardMaterial(THREE, {name:input.name,state:input.state,
    envMapIntensityNode:m.scalar('envMapIntensity'),
    lightingModel: () => {
      const model = createSourceLightingModel(THREE, {cityAo:input.cityAo,cityReflection:input.cityReflection});
      const start = model.start, direct = model.direct;
      model.start = function(builder) {
        applySourceSpecularTrim(THREE,input.trim); applyVegetationSpecular(THREE); start.call(this,builder);
      };
      model.direct = function(data,builder) {
        direct.call(this,data,builder);
        const light = data as unknown as {lightNode?: {light?: {isDirectionalLight?:boolean}};lightColor:V3;lightDirection:V3;reflectedLight:{directDiffuse:V3}};
        if (light.lightNode?.light?.isDirectionalLight) light.reflectedLight.directDiffuse.addAssign(
          vegetationTranslucencyNode(THREE,light.lightColor,light.lightDirection,T.positionViewDirection,T.diffuseColor.rgb,m.vec4('vg37K').y,relief.a));
      };
      return model;
    },
    surface:{color:capped.color,opacity:m.scalar('opacity').mul(map.a),emission:m.vec3('emissive').mul(m.scalar('emissiveIntensity')),
      roughness:capped.roughness,metalness:m.scalar('metalness'),normal,alphaTest:m.scalar('alphaTest'),hasAlphaTest:true},
  });
  material.positionNode = T.positionLocal.add(input.frame.sceneWindDelta(vegetationWindDelta(THREE,{
    ...input.frame,time:input.dynamics.windTime,amplitude:input.dynamics.windAmplitude,
  })));
  material.maskNode = vegetationFadeMask(THREE,{origin:input.frame.sourceOrigin,camera:input.dynamics.sourceCamera,
    ranges:m.vec4('uR14'),enabled:m.scalar('uOn14'),frame:input.dynamics.fadeFrame,screenPosition:input.dynamics.bottomLeftScreenPixels,level});
  return material;
}
