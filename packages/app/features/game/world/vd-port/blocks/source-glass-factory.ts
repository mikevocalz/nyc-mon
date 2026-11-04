// Authored PBR glass is separate from kitwinglass3 and scanned wall materials.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { classifySourcePbrGlass, type SourcePbrGlassIdentity } from './source-glass-programs.ts';
import { pbrGlassNodes, type SourceGlassFrame, type SourceGlassEnvironment } from './glass-material.ts';
import { createSourceStandardMaterial, type SourceRenderState } from './source-standard.ts';
import { createSourceLightingModel, sourceLightCapture } from './source-lighting.ts';
import type { SourceParameterBinding } from './source-bindings.ts';
export { classifySourcePbrGlass, sourcePbrGlassParameterSchema, SOURCE_PBR_GLASS_PROGRAMS, type SourcePbrGlassIdentity } from './source-glass-programs.ts';
export interface SourcePbrGlassInput {
  name: string; source: SourcePbrGlassIdentity; state: SourceRenderState;
  material: SourceParameterBinding; variant: SourceParameterBinding;
  /** Original absolute source coordinates, including true per-structure elevation and tilted pane normal. */
  frame: SourceGlassFrame;
  /** Source-frame geometric normal from camera-relative derivatives, distinct from the tilted shading normal. */
  geometricNormal: Node<'vec3'>;
  environment: SourceGlassEnvironment;
  /** Exact source pgCAO sample and rectangle; the ground is zero when that source texture is disabled. */
  ground: { sample: Node<'vec4'>; rect: Node<'vec4'> };
}
export function createSourcePbrGlassMaterial(THREE: Three, input: SourcePbrGlassInput) {
  const flags = classifySourcePbrGlass(input.source), T = THREE.TSL, m = input.material, v = input.variant;
  const state = input.state;
  if (state.transparent !== !flags.opaque || state.depthWrite !== flags.opaque || state.premultipliedAlpha ||
    state.blending !== (flags.opaque ? THREE.NormalBlending : THREE.CustomBlending) ||
    (!flags.opaque && (state.blendSrc !== THREE.OneFactor || state.blendDst !== THREE.OneMinusSrcAlphaFactor || state.blendSrcAlpha !== THREE.OneFactor || state.blendDstAlpha !== THREE.OneMinusSrcAlphaFactor))) throw new Error('PBR glass source blend/depth contract mismatch');
  const emission = m.vec3('emissive').mul(m.scalar('emissiveIntensity'));
  const groundHeight = T.select(input.ground.rect.z.greaterThan(0), input.ground.sample.g.mul(127.5), 0);
  const glass = pbrGlassNodes(THREE, { ...input.frame, ...flags, environment: input.environment,
    geometricNormal: input.geometricNormal, groundHeight,
    tint: m.vec3('diffuse'), tintRatio: flags.tintAttributes ? v.vec3('fkTr') : T.vec3(1),
    bodyOverride: flags.tintAttributes ? v.vec4('pgBody') : T.vec4(-1), opacity: m.scalar('opacity'),
    parameters: { f0: m.scalar('pgF0'), roughness: m.scalar('pgRough'), dirt: m.scalar('pgDirt'), streetWidth: m.scalar('pgStW'),
      body: m.vec3('pgBody'), room: m.vec4('pgRm'), blinds: m.scalar('pgBl'), transmission: m.scalar('pgTr'), seed: m.scalar('pgSd'),
      sheers: m.scalar('pgShr'), glow: m.scalar('pgGlow'), storeyLocked: m.scalar('pgSlk'), litShare: m.scalar('pgLit'), origin: m.vec3('pgOrg') },
  });
  const capture = sourceLightCapture(THREE);
  // makeGlass has its own analytic sky/terrain terms; it never installs LT/ST34/CS34/city-AO wrappers.
  return createSourceStandardMaterial(THREE, { name: input.name, state,
    envMapIntensityNode: m.scalar('envMapIntensity'), lightingModel: () => createSourceLightingModel(THREE, { capture }),
    surface: { color: glass.color, opacity: glass.opacity, emission, roughness: m.scalar('roughness'), metalness: m.scalar('metalness'),
      hasAlphaTest: false, alphaTest: T.float(0), beforeFog: rgba => glass.output({ ...capture, outgoing: rgba.rgb, emission }) },
  });
}
