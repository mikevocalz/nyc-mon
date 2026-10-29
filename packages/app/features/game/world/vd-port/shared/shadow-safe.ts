// One shadow program for every opaque vd-port material.
//
// three r186 builds a material's shadow-pass shader from its colorNode's alpha (Renderer._getShadowNodes: shadowAlpha =
// material.colorNode.a), so every distinct colour graph compiled its own shadow module and pipeline: 19 of the 48 vd-port
// pipelines on the all-lanes walk were shadow variants of materials with the same vertex layout. An opaque material's
// colour is never needed by the shadow pass, so here it moves out of colorNode into setupDiffuseColor, which only the
// colour pass calls (the shadow pass draws the shadow override material): every opaque material then shares the shadow
// program of its mask and side. Transparent and alpha-tested materials keep their colorNode: their shadow cut-out reads it.
import type { Three } from '@acme/ui/three';

type Mat = InstanceType<Three['Material']> & {
  colorNode?: { getCacheKey(): string } | null;
  customProgramCacheKey(): string;
  alphaTest: number;
  transparent: boolean;
  setupDiffuseColor?: (builder: unknown) => void;
  userData: Record<string, unknown>;
};

export function shadowSafe<M extends InstanceType<Three['Material']>>(THREE: Three, material: M): M {
  const m = material as unknown as Mat;
  const color = m.colorNode;
  if (!color || m.transparent || m.alphaTest > 0 || typeof m.setupDiffuseColor !== 'function' || m.userData.vdShadowSafe) return material;
  const T = THREE.TSL as unknown as { diffuseColor: { assign(v: unknown): void }; vec4(a: unknown, b?: unknown): { xyz: unknown } & Record<string, unknown> };
  const base = m.setupDiffuseColor.bind(m);
  // The node builder state is cached by the material's key, which hashes its node properties (NodeMaterial
  // customProgramCacheKey: each node's id via Node.customCacheKey). With the graph out of colorNode, its key goes back in
  // here, or two materials that differ only in their colour graph would share one builder state, and one material's colour.
  const key = color.getCacheKey();
  const prevKey = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${prevKey()}|vdss:${key}`;
  m.colorNode = null;
  m.userData.vdShadowSafe = true;
  m.setupDiffuseColor = (builder: unknown) => {
    // three's own mask, vertex colour, opacity and alpha handling first (on materialColor, white), then the graph
    base(builder);
    T.diffuseColor.assign(T.vec4((T.vec4(color) as { xyz: unknown }).xyz, 1));
  };
  return material;
}

/**
 * The same for every shadow caster under `root` (after the shadow roles are set): one shadow program per mask, side and
 * vertex layout instead of one per colour graph. Returns how many materials changed.
 */
export function shadowSafeCasters(THREE: Three, root: InstanceType<Three['Object3D']>): number {
  let changed = 0;
  root.traverse((o) => {
    const mesh = o as InstanceType<Three['Mesh']>;
    if (!(mesh as { isMesh?: boolean }).isMesh || !mesh.castShadow) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const was = (m as { colorNode?: unknown }).colorNode;
      shadowSafe(THREE, m);
      if (was && !(m as { colorNode?: unknown }).colorNode) changed++;
    }
  });
  return changed;
}
