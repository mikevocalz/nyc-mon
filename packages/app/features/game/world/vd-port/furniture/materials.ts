// The pooled instancer's five materials, Valdrada client/src/city/instancer.js L226-L432 translated to TSL node
// materials. One material per kind is shared by every pool of that kind, so a kind is one pipeline (and one shadow
// pipeline) however many pools draw with it.
//
//   base     MeshStandardMaterial  vertexColors, roughness 0.82, metalness 0.05                (L226 baseMat)
//   lens     MeshStandardMaterial  vertexColors, roughness 0.17, metalness 0.55                (L236 lensMat, SG13 signal glass)
//   glow     MeshBasicMaterial     vertexColors, gl_FragColor.rgb *= 0.25 + night * 2.4       (L394-L400 glowMat)
//   tex      MeshStandardMaterial  vertexColors + the panel atlas, roughness 0.62, metal 0.05   (L409 texMat)
//   glowTex  MeshBasicMaterial     vertexColors + the panel atlas, *= 0.85 + night * 1.6      (L415-L431 glowTexMat)
//
// Every pool multiplies its kit vertex colour by the instance colour (instanceColor: the U10 weathering tint, a
// caller's hex, nextTint's roof tint), exactly as instancer.js uploads `p.cols`.
//
// Not carried over, and why (each is a hook into a Valdrada system this port does not have):
//   applyLightTrim (materials.js L292): diffuse x mix(0.30, 0.88, night) x STREET_CAL. It calibrates a prop against
//     Valdrada's own sun and its trimmed ground shader; the nyc-mon ground (vd-materials.ts) is not trimmed, so the trim
//     alone would set every prop at ~0.58 of the pavement it stands on, the mismatch the calibration exists to remove.
//   applyCityAO (materials.js L355): samples Valdrada's baked city sky-visibility texture (ENV.cityAO), not in the port.
//   applySnowCap (materials.js L253): reads ENV.snow; the port's ctx carries no weather (lane A, types.ts).
import type { Three } from '@acme/ui/three';
import { shadowSafe } from '../shared/shadow-safe.ts';
import type { Node } from 'three/webgpu';
import type { PoolMaterialKind } from './pool-data.ts';
import { lampScaleNode } from './signal-clock.ts';

type Material = InstanceType<Three['Material']>;
type Texture = InstanceType<Three['Texture']>;

/** The three per-instance vec4 attributes (pool-data.ts INSTANCE_FLOATS, in order). */
export const VD_POOL_ATTRIBUTES = ['vdPoolA', 'vdPoolB', 'vdPoolC'] as const;

/**
 * The instance pose (instancer.js claim: Matrix4.compose(position, a yaw about +Y, scale)): scale, turn, offset. The
 * normal takes the inverse-transpose of that matrix, i.e. divided by the scale then turned, as three's InstanceNode
 * does for instanceMatrix. Divided by a positive scale it cannot vanish, so the normalize is safe.
 */
export function poolPositionNode(THREE: Three, clock: Node<'float'>): Node<'vec3'> {
  const T = THREE.TSL;
  const a = T.attribute<'vec4'>(VD_POOL_ATTRIBUTES[0], 'vec4');
  const b = T.attribute<'vec4'>(VD_POOL_ATTRIBUTES[1], 'vec4');
  const lamp = T.attribute<'vec4'>(VD_POOL_ATTRIBUTES[2], 'vec4').w;
  return T.Fn(() => {
    const c = T.cos(a.w);
    const s = T.sin(a.w);
    const turn = (v: Node<'vec3'>) => T.vec3(c.mul(v.x).add(s.mul(v.z)), v.y, c.mul(v.z).sub(s.mul(v.x)));
    // a signal lamp collapses to 0.001 when the clock has it off (sim/signals.js SignalController)
    const scale = b.xyz.mul(lampScaleNode(THREE, lamp, clock)) as Node<'vec3'>;
    T.normalLocal.assign(T.normalize(turn(T.normalLocal.div(scale) as Node<'vec3'>)));
    return turn(T.positionLocal.mul(scale) as Node<'vec3'>).add(a.xyz);
  })() as unknown as Node<'vec3'>;
}

export interface PoolMaterials {
  get(kind: PoolMaterialKind): Material;
  dispose(): void;
}

/** instancer.js's numbers per kind: roughness/metalness for the lit kinds, the night gain a + night * b for the glow. */
export const POOL_KIND_PARAMS: Readonly<Record<PoolMaterialKind, { lit: true; roughness: number; metalness: number } | { lit: false; a: number; b: number }>> = {
  base: { lit: true, roughness: 0.82, metalness: 0.05 },
  lens: { lit: true, roughness: 0.17, metalness: 0.55 },
  tex: { lit: true, roughness: 0.62, metalness: 0.05 },
  glow: { lit: false, a: 0.25, b: 2.4 },
  glowTex: { lit: false, a: 0.85, b: 1.6 },
};

/**
 * The materials. `night` is the port's ENV.night; `physical` says colours are linear (Valdrada's vertex colours are
 * linear already) where the direct path wants display values; `atlas` is the panel atlas texture.
 *
 * Every pool samples the atlas (the bake parks a plain pool's uv on its white block, panelArt.js blankUV), so the three
 * lit kinds are one node graph that differs only in the roughness and metalness uniforms, and the two glow kinds one
 * graph that differs only in its gain uniforms: two shaders (plus the lit one's shadow depth) for every pool.
 */
export function createPoolMaterials(THREE: Three, night: Node<'float'>, physical: boolean, atlas: Texture, clock: Node<'float'>): PoolMaterials {
  const T = THREE.TSL;
  const position = poolPositionNode(THREE, clock);
  const tint = T.attribute<'vec4'>(VD_POOL_ATTRIBUTES[2], 'vec4').rgb;
  // kit vertex colour x instance colour x atlas, in the working space of the lane (vd-materials.ts `working`,
  // inverted: Valdrada's colours are linear, the direct path draws display values)
  const shade = (rgb: Node<'vec3'>) => (physical ? rgb : T.sRGBTransferOETF(T.max(rgb, T.vec3(0)))) as Node<'vec3'>;
  const kit = T.attribute<'vec3'>('color', 'vec3').mul(tint).mul(T.texture(atlas).rgb) as Node<'vec3'>;
  const made = new Map<PoolMaterialKind, Material>();
  const build = (kind: PoolMaterialKind): Material => {
    const k = POOL_KIND_PARAMS[kind];
    if (k.lit) {
      const m = new THREE.MeshStandardNodeMaterial();
      m.roughness = k.roughness;
      m.metalness = k.metalness;
      m.positionNode = position;
      m.colorNode = T.vec4(shade(kit), 1);
      // three's depth pass draws a FrontSide material's back faces: a closed prop writes its own underside and throws
      // nothing (instancer.js L482-L489 sets shadowSide DoubleSide for the shadow set)
      m.shadowSide = THREE.DoubleSide;
      return m;
    }
    const m = new THREE.MeshBasicNodeMaterial();
    m.positionNode = position;
    const gain = T.uniform(k.a).add(night.mul(T.uniform(k.b)));
    m.colorNode = T.vec4(shade(kit.mul(gain) as Node<'vec3'>), 1);
    return m;
  };
  return {
    get(kind) {
      let m = made.get(kind);
      if (!m) { m = shadowSafe(THREE, build(kind)); m.name = `vd-pool:${kind}`; made.set(kind, m); }
      return m;
    },
    dispose() { for (const m of made.values()) m.dispose(); made.clear(); },
  };
}
