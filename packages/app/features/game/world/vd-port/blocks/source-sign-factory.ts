// Source SG face programs, settled Valdrada @2724c79 capture; no map-only approximation.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { signFaceNodes, signEaseOutput, signDustNodes, signGlowNodes, signShadeOutput, signHaloOutput } from './sign-material.ts';
import { installSourceOutputHook } from './source-output.ts';
import { createSourceStandardMaterial, type SourceRenderState } from './source-standard.ts';
import { createSourceLightingModel } from './source-lighting.ts';
import { sourceDiffuseTrim, type SourceLightTrim } from './source-light-trim.ts';
import type { SourceParameterBinding, SourceTextureBinding } from './source-bindings.ts';

import { classifySourceSignMaterial, type SourceSignFaceIdentity } from './source-sign-programs.ts';
export { classifySourceSignFace, classifySourceSignMaterial, SOURCE_SIGN_FACE_PROGRAMS, SOURCE_SIGN_GLOW_VC, SOURCE_SIGN_EXTRA_PROGRAMS, sourceSignParameterSchema, type SourceSignFaceIdentity } from './source-sign-programs.ts';
export interface SourceSignFaceInput {
  name: string; source: SourceSignFaceIdentity; state: SourceRenderState;
  material: SourceParameterBinding; variant: SourceParameterBinding; textures: SourceTextureBinding;
  rawUv: Node<'vec2'>; rawColor: Node<'vec3'>; trim: SourceLightTrim;
}
/** Real table-driven material factory. SG has LT/ST34 only: do not add unrelated city-AO/reflection wrappers. */
export function createSourceSignMaterial(THREE: Three, input: SourceSignFaceInput) {
  const { program, mask, decal } = classifySourceSignMaterial(input.source), m = input.material, v = input.variant, T = THREE.TSL;
  if (program === 'ar33sgS3' || program === 'ar33sgH') {
    const shade = program === 'ar33sgS3', state = input.state;
    if (!state.transparent || state.depthWrite || state.premultipliedAlpha || !state.polygonOffset || state.polygonOffsetFactor !== -3 || state.polygonOffsetUnits !== -3 ||
      state.blending !== (shade ? THREE.CustomBlending : THREE.AdditiveBlending) ||
      (shade && (state.fog || state.blendSrc !== THREE.OneFactor || state.blendDst !== THREE.OneMinusSrcAlphaFactor || state.blendSrcAlpha !== THREE.ZeroFactor || state.blendDstAlpha !== THREE.OneFactor))) throw new Error('SG shade/halo source blend/depth/fog contract mismatch');
    if (input.source.mapFormat !== THREE.RGBAFormat || input.source.mapColorSpace !== (shade ? THREE.NoColorSpace : THREE.SRGBColorSpace)) throw new Error('SG shade/halo atlas channel/color-space mismatch');
    const material = new THREE.MeshBasicNodeMaterial(); material.name = input.name; Object.assign(material,state);
    try {
      const rect = shade ? v.vec4('sgRect') : null;
      const uv = rect ? rect.xy.add(input.rawUv.mul(rect.zw)) : input.textures.uv('map',input.rawUv);
      const sample = input.textures.sample('map',uv);
      material.colorNode = shade ? T.vec3(1) : m.vec3('diffuse').mul(sample.rgb);
      material.opacityNode = shade ? T.float(1) : m.scalar('opacity').mul(sample.a);
      if (shade) {
        const output = signShadeOutput(THREE,sample,v.vec3('sgLamp'),v.vec4('sgP').x,input.trim.night);
        installSourceOutputHook(material,()=>output);
      } else installSourceOutputHook(material,rgba=>signHaloOutput(THREE,rgba,m.scalar('sgGain'),input.trim.night));
      return material;
    } catch (error) { material.dispose(); throw error; }
  }
  if (program === 'ar33sgDu' || program === 'ar33sgG') {
    if (input.state.transparent || !input.state.depthWrite || input.state.premultipliedAlpha || input.state.blending !== THREE.NormalBlending) throw new Error('SG metal/glow source render-state mismatch');
    let color = input.source.vertexColors ? m.vec3('diffuse').mul(input.rawColor) : m.vec3('diffuse');
    let roughness = m.scalar('roughness'), emission = m.vec3('emissive').mul(m.scalar('emissiveIntensity'));
    if (program === 'ar33sgDu') {
      const up = T.normalize(T.cameraViewMatrix.mul(T.vec4(0,1,0,0)).xyz);
      // Source dust is inserted at emissivemap_fragment, after LT's color_fragment edit.
      const dust = signDustNodes(THREE,color.mul(sourceDiffuseTrim(THREE,input.trim)),roughness,T.dot(T.normalView,up)); color = dust.color; roughness = dust.roughness;
    } else {
      const glow = signGlowNodes(THREE,color,m.vec3('sgEm'),input.trim.night,m.scalar('sgDay'),m.scalar('sgNd'));
      color = glow.color; emission = emission.add(glow.emission);
    }
    return createSourceStandardMaterial(THREE,{name:input.name,state:input.state,envMapIntensityNode:m.scalar('envMapIntensity'),lightingModel:()=>createSourceLightingModel(THREE,{trim:input.trim}),
      surface:{color:program === 'ar33sgDu' ? color : color.mul(sourceDiffuseTrim(THREE,input.trim)),opacity:m.scalar('opacity'),emission,roughness,metalness:m.scalar('metalness'),alphaTest:T.float(0),hasAlphaTest:false,
        ...(program === 'ar33sgG' ? {beforeFog:(rgba:Node<'vec4'>)=>signEaseOutput(THREE,rgba,input.trim.night)} : {})}});
  }
  if (program === 'ar33sgGvc') {
    if (input.source.mapRoles.length || !input.source.vertexColors || input.source.hasAlphaTest || input.state.transparent || !input.state.depthWrite || input.state.premultipliedAlpha || input.state.blending !== THREE.NormalBlending) throw new Error('SG glow-VC semantic/render-state contract mismatch');
    const lit = T.smoothstep(0.12, 0.55, input.trim.night), p = v.vec4('sgP');
    return createSourceStandardMaterial(THREE, { name: input.name, state: input.state,
      envMapIntensityNode: m.scalar('envMapIntensity'), lightingModel: () => createSourceLightingModel(THREE, { trim: input.trim }),
      surface: { color: m.vec3('diffuse').mul(input.rawColor).mul(T.mix(1, p.y, lit)).mul(sourceDiffuseTrim(THREE, input.trim)),
        opacity: m.scalar('opacity'), emission: m.vec3('emissive').mul(m.scalar('emissiveIntensity')).add(v.vec3('sgLamp').mul(T.max(lit, p.x))),
        roughness: m.scalar('roughness'), metalness: m.scalar('metalness'), alphaTest: T.float(0), hasAlphaTest: false,
        beforeFog: rgba => signEaseOutput(THREE, rgba, input.trim.night) },
    });
  }
  if (input.source.mapRoles.length !== 1 || input.source.mapRoles[0] !== 'map') throw new Error('SG face requires exactly its authored atlas map');
  if (input.source.mapFormat !== (mask ? THREE.RedFormat : THREE.RGBAFormat) || input.source.mapColorSpace !== (mask ? THREE.NoColorSpace : THREE.SRGBColorSpace)) throw new Error('SG atlas channel/color-space contract mismatch');
  if (input.source.hasAlphaTest !== decal || input.state.transparent !== decal || input.state.depthWrite !== !decal ||
    input.state.blending !== THREE.NormalBlending || input.state.premultipliedAlpha || input.state.polygonOffset !== decal ||
    (decal && (input.state.polygonOffsetFactor !== -2 || input.state.polygonOffsetUnits !== -2))) throw new Error('SG face source alpha/render-state contract mismatch');
  const diffuse = m.vec3('diffuse');
  const face = signFaceNodes(THREE, {
    color: input.source.vertexColors ? diffuse.mul(input.rawColor) : diffuse,
    opacity: m.scalar('opacity'), night: input.trim.night, saturation: m.scalar('sgSatK'), uv: input.rawUv,
    mapUv: input.textures.uv('map', input.rawUv), sampleAtlas: uv => input.textures.sample('map', uv),
    variant: { rect: v.vec4('sgRect'), bg: v.vec3('sgBg'), fg: v.vec3('sgFg'), lamp: v.vec3('sgLamp'), p: v.vec4('sgP'), f: v.vec4('sgF') },
  }, mask, decal);
  return createSourceStandardMaterial(THREE, { name: input.name, state: input.state,
    envMapIntensityNode: m.scalar('envMapIntensity'), lightingModel: () => createSourceLightingModel(THREE, { trim: input.trim }),
    surface: { color: face.color.mul(sourceDiffuseTrim(THREE, input.trim)), opacity: face.opacity,
      emission: m.vec3('emissive').mul(m.scalar('emissiveIntensity')).add(face.emission), roughness: face.roughness, metalness: face.metalness,
      alphaTest: m.scalar('alphaTest'), hasAlphaTest: decal, beforeFog: rgba => signEaseOutput(THREE, rgba, input.trim.night) },
  });
}
