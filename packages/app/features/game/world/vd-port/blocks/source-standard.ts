import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { installSourceOutputHook } from './source-output.ts';

/** Fixed render state is part of a family key; differing states must never share a template/material. */
export interface SourceRenderState {
  fog: boolean;
  wireframe?: boolean;
  shadowSide?: number | null;
  flatShading?: boolean;
  side: number;
  transparent: boolean;
  depthWrite: boolean;
  depthTest: boolean;
  colorWrite: boolean;
  blending: number;
  blendSrc: number;
  blendDst: number;
  blendSrcAlpha: number | null;
  blendDstAlpha: number | null;
  blendEquation: number;
  blendEquationAlpha: number | null;
  premultipliedAlpha: boolean;
  alphaHash: boolean;
  alphaToCoverage: boolean;
  polygonOffset: boolean;
  polygonOffsetFactor: number;
  polygonOffsetUnits: number;
}

/** Fully authored nodes, after original map, vertex-color, tint, and emission semantics have been composed. */
export interface SourceSurfaceNodes {
  color: Node<'vec3'>;
  opacity: Node<'float'>;
  emission: Node<'vec3'>;
  roughness: Node<'float'>;
  metalness: Node<'float'>;
  normal?: Node<'vec3'>;
  alphaTest: Node<'float'>;
  /** The source alphaTest branch must be compiled even when its threshold is a table lookup. */
  hasAlphaTest: boolean;
  beforeFog?: (rgba: Node<'vec4'>) => Node<'vec4'>;
}

/** No generic shader fallback: callers must classify and compose the exact source graph before invoking this. */
export function createSourceStandardMaterial(THREE: Three, input: {
  name: string;
  state: SourceRenderState;
  surface: SourceSurfaceNodes;
  envMapIntensity?: number;
  envMapIntensityNode?: Node<'float'>;
  lightingModel?: () => InstanceType<Three['PhysicalLightingModel']>;
}) {
  const material = new THREE.MeshStandardNodeMaterial();
  material.name = input.name;
  Object.assign(material, input.state);
  const surface = input.surface;
  material.colorNode = surface.color;
  material.opacityNode = surface.opacity;
  material.emissiveNode = surface.emission;
  material.roughnessNode = surface.roughness;
  material.metalnessNode = surface.metalness;
  if (surface.normal) material.normalNode = surface.normal;
  if (surface.hasAlphaTest) {
    // NodeMaterial checks alphaTestNode as well; the explicit branch is preserved by this node.
    material.alphaTestNode = surface.alphaTest;
  }
  if (input.envMapIntensityNode) {
    // EnvironmentNode normally reads one material uniform. A family uses a descriptor-table value instead,
    // applying it to BOTH environment terms exactly once, before authored reflection edits.
    material.envMapIntensity = 1;
    material.setupLightingModel = () => {
      const model = input.lightingModel?.() ?? new THREE.PhysicalLightingModel();
      const indirect = model.indirect;
      model.indirect = function (builder) {
        const context = builder.context as { radiance: Node<'vec3'>; iblIrradiance: Node<'vec3'> };
        context.radiance.mulAssign(input.envMapIntensityNode!);
        context.iblIrradiance.mulAssign(input.envMapIntensityNode!);
        indirect.call(this, builder);
      };
      return model;
    };
  } else {
    if (input.envMapIntensity !== undefined) material.envMapIntensity = input.envMapIntensity;
    if (input.lightingModel) material.setupLightingModel = input.lightingModel;
  }
  if (surface.beforeFog) installSourceOutputHook(material, surface.beforeFog);
  return material;
}
