import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import type { SourceRenderState } from './source-standard.ts';
import { installSourceOutputHook } from './source-output.ts';

/** Explicit source MeshBasicMaterial path: no synthetic physical lighting or emissive term. */
export function createSourceBasicMaterial(THREE: Three, input: {
  name: string;
  state: SourceRenderState;
  color: Node<'vec3'>;
  opacity: Node<'float'>;
  alphaTest?: Node<'float'>;
  beforeFog?: (rgba: Node<'vec4'>) => Node<'vec4'>;
}) {
  const material = new THREE.MeshBasicNodeMaterial();
  material.name = input.name;
  Object.assign(material, input.state);
  material.colorNode = input.color;
  material.opacityNode = input.opacity;
  if (input.alphaTest) material.alphaTestNode = input.alphaTest;
  if (input.beforeFog) installSourceOutputHook(material, input.beforeFog);
  return material;
}
