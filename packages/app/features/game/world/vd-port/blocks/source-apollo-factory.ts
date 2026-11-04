import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { apolloSurfaceNodes } from './apollo-material.ts';
import { classifyApolloSource, type SourceApolloIdentity } from './source-apollo-programs.ts';
import { createSourceStandardMaterial, type SourceRenderState } from './source-standard.ts';
import { createSourceBasicMaterial } from './source-basic.ts';
import { createSourceLightingModel } from './source-lighting.ts';
import { sourceDiffuseTrim, type SourceLightTrim } from './source-light-trim.ts';
import type { SourceParameterBinding, SourceTextureBinding } from './source-bindings.ts';

/** Original mapped marquee/paint surfaces and unlit tube output, with shared table values. */
export function createSourceApolloMaterial(THREE: Three, input: {
  name: string; source: SourceApolloIdentity; state: SourceRenderState;
  material: SourceParameterBinding; textures: SourceTextureBinding; rawUv: Node<'vec2'>;
  night: Node<'float'>; trim?: SourceLightTrim;
}) {
  const program = classifyApolloSource(input.source), T = THREE.TSL, m = input.material;
  if (input.source.type === 'MeshBasicMaterial') {
    const output = apolloSurfaceNodes(THREE, program, { emission: T.vec3(0), night: input.night }).output;
    if (!output) throw new Error('Authored Apollo basic output is missing');
    return createSourceBasicMaterial(THREE, { name: input.name, state: input.state,
      color: m.vec3('diffuse'), opacity: m.scalar('opacity'), beforeFog: output });
  }
  if (!input.trim) throw new Error('Missing authored Apollo light trim');
  let color = m.vec3('diffuse'), opacity = m.scalar('opacity');
  let emission = m.vec3('emissive').mul(m.scalar('emissiveIntensity'));
  for (const role of input.source.mapRoles) {
    const sample = input.textures.sample(role, input.textures.uv(role, input.rawUv));
    if (role === 'map') { color = color.mul(sample.rgb); opacity = opacity.mul(sample.a); }
    else if (role === 'emissiveMap') emission = emission.mul(sample.rgb);
    else throw new Error(`Unported Apollo texture role: ${role}`);
  }
  const modified = apolloSurfaceNodes(THREE, program, { emission, night: input.night });
  if (!modified.emission || modified.output) throw new Error('Authored Apollo standard modifier mismatch');
  return createSourceStandardMaterial(THREE, {
    name: input.name, state: input.state, envMapIntensityNode: m.scalar('envMapIntensity'),
    lightingModel: () => createSourceLightingModel(THREE, { trim: input.trim }),
    surface: { color: color.mul(sourceDiffuseTrim(THREE, input.trim)), opacity, emission: modified.emission,
      roughness: m.scalar('roughness'), metalness: m.scalar('metalness'),
      alphaTest: m.scalar('alphaTest'), hasAlphaTest: input.source.hasAlphaTest },
  });
}
