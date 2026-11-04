import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import type { SourcePageImage } from './source-page-loader.ts';
import type { SourceTextureBinding } from './source-bindings.ts';

export interface SourceSampler {
  /** Already verified, resident and owned by the scene's page lease. */
  texture: SourcePageImage;
  layer?: Node<'float'>;
  /** Original column-major source mapTransform. PBR uniform samplers never call uv(). */
  matrix?: readonly [Node<'vec3'>, Node<'vec3'>, Node<'vec3'>];
}

const arrayTexture = (texture: SourcePageImage) => 'isDataArrayTexture' in texture || 'isCompressedArrayTexture' in texture;

export function sourceTextureBinding(THREE: Three, samplers: Readonly<Record<string, SourceSampler>>): SourceTextureBinding & {
  rebind(name: string, texture: SourceSampler['texture']): void;
} {
  const bindings = new Map(Object.entries(samplers).map(([name, sampler]) => [name, { ...sampler, nodes: [] as ReturnType<Three['TSL']['texture']>[] }]));
  const get = (name: string) => {
    const sampler = bindings.get(name);
    if (!sampler) throw new Error(`Missing resident authored sampler ${name}`);
    return sampler;
  };
  return {
    rebind(name, texture) {
      const sampler = get(name);
      if (arrayTexture(texture) !== arrayTexture(sampler.texture) || texture.format !== sampler.texture.format || texture.type !== sampler.texture.type || texture.colorSpace !== sampler.texture.colorSpace) {
        throw new Error(`Authored sampler ${name} changed its fixed page layout`);
      }
      sampler.texture = texture;
      for (const node of sampler.nodes) node.value = texture;
    },
    uv(name, raw) {
      const matrix = get(name).matrix;
      if (!matrix) throw new Error(`Missing authored UV matrix for ${name}`);
      const [a, b, c] = matrix;
      return THREE.TSL.vec2(a.x.mul(raw.x).add(b.x.mul(raw.y)).add(c.x), a.y.mul(raw.x).add(b.y.mul(raw.y)).add(c.y));
    },
    sample(name, uv, gradient) {
      const sampler = get(name);
      let node = THREE.TSL.texture(sampler.texture, uv);
      if (arrayTexture(sampler.texture)) {
        if (!sampler.layer) throw new Error(`Missing authored array layer for ${name}`);
        node = node.depth(sampler.layer);
      }
      if (gradient) node = node.grad(gradient.dx, gradient.dy);
      sampler.nodes.push(node);
      return node;
    },
  };
}
