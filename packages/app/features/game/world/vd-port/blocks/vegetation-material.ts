// Valdrada world/vg37.js, world/materials.js applySnowCap and city/cpFloraKit.js fadeMat14 @2724c79 (MIT).
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';

type F = Node<'float'>;
type V2 = Node<'vec2'>;
type V3 = Node<'vec3'>;
type V4 = Node<'vec4'>;

export function sourceVegetationProgram(key: string, hash: string): 0 | 1 {
  const prefix = 'vg37leaf5|snowcap0.6true|cityaon|cs34|lighttrim2.6,2.6,2.6|st34|lf14';
  if (hash === '1421a5c1' && key === `${prefix}0`) return 0;
  if (hash === '1421a5c1' && key === `${prefix}1`) return 1;
  throw new Error(`Unsupported authored vegetation program: ${key} (${hash})`);
}

/** The tint is the source vertex×instance RGB; sampled map RGB has not yet multiplied it. */
export function vegetationColorNode(THREE: Three, color: V3, tint: V3): V3 {
  const T = THREE.TSL;
  const max = T.max(color.r, T.max(color.g, color.b)), min = T.min(color.r, T.min(color.g, color.b));
  const flower = T.smoothstep(0.15, 0.28, max).mul(T.float(1).sub(T.smoothstep(0.75, 0.92, max.sub(min).div(T.max(max, 1e-4)))));
  const luma = T.dot(tint, T.vec3(0.3, 0.59, 0.11));
  const tintMax = T.max(tint.r, T.max(tint.g, tint.b)), tintMin = T.min(tint.r, T.min(tint.g, tint.b));
  const saturation = tintMax.sub(tintMin).div(T.max(tintMax, 1e-4));
  const value = T.mix(luma, T.clamp(luma.mul(1.6), 0.75, 1.1), T.smoothstep(0.2, 0.45, saturation));
  return color.mul(T.mix(T.vec3(value), tint, flower));
}

/** Return a local-space delta; the caller restores the original source instance frame before this calculation. */
export function vegetationWindDelta(THREE: Three, input: {
  localPosition: V3; objectNormal: V3; instanceTranslation: V2; instanced: boolean | F; time: F; amplitude: F;
}): V3 {
  const T = THREE.TSL, p = input.localPosition;
  const flag = typeof input.instanced === 'boolean' ? T.float(input.instanced ? 1 : 0) : input.instanced;
  const iw = input.instanceTranslation.mul(flag);
  const phase = T.fract(iw.x.mul(0.137).add(iw.y.mul(0.071))).mul(6.283);
  const height = T.max(p.y, 0);
  const sway = T.sin(input.time.mul(1.3).add(phase).add(iw.x.mul(0.05))).mul(0.6)
    .add(T.sin(input.time.mul(2.1).add(phase.mul(1.7))).mul(0.4));
  const flutter = T.sin(input.time.mul(6.7).add(T.dot(p, T.vec3(9.1, 7.3, 8.7))).add(phase))
    .mul(0.006).mul(input.amplitude).mul(T.min(height, 1));
  const delta = input.objectNormal.mul(flutter);
  const displacement = sway.mul(0.014).mul(input.amplitude).mul(height).mul(height).mul(flag);
  return delta.add(T.vec3(displacement, 0, displacement.mul(0.6)));
}

/** Both card faces use the volume normal. Input normal must undo Three's back-face flip exactly as source does. */
export function vegetationNormalNode(THREE: Three, normal: V3, viewPosition: V3, uv: V2, normalSample: V4, strength: F): V3 {
  const T = THREE.TSL;
  const dp1 = T.dFdx(viewPosition), dp2 = T.dFdy(viewPosition), du1 = T.dFdx(uv), du2 = T.dFdy(uv);
  const d2p = T.cross(dp2, normal), d1p = T.cross(normal, dp1);
  const tangent = d2p.mul(du1.x).add(d1p.mul(du2.x)), bitangent = d2p.mul(du1.y).add(d1p.mul(du2.y));
  const inverse = T.inverseSqrt(T.max(T.max(T.dot(tangent, tangent), T.dot(bitangent, bitangent)), 1e-12));
  const mapped = normalSample.xyz.mul(2).sub(1);
  return T.normalize(normal.add(tangent.mul(inverse).mul(mapped.x).add(bitangent.mul(inverse).mul(mapped.y)).mul(strength)));
}

/** Call only for directional lights, using their shadowed source lightColor and view-space direction. */
export function vegetationTranslucencyNode(THREE: Three, lightColor: V3, lightDirection: V3, viewDirection: V3,
  diffuse: V3, strength: F, translucency: F): V3 {
  const T = THREE.TSL;
  return lightColor.mul(T.float(0.15).add(T.pow(T.saturate(T.dot(viewDirection.negate(), lightDirection)), 3).mul(0.85)))
    .mul(diffuse).mul(strength).mul(translucency);
}

/** After base physical material initialization, before its direct/indirect lighting. */
export function applyVegetationSpecular(THREE: Three): void {
  THREE.TSL.specularColorBlended.assign(THREE.TSL.specularColorBlended.mul(0.6));
  THREE.TSL.specularF90.mulAssign(0.45);
}

/** Snow uses the initial view normal before leaf-relief and back-face corrections, matching wrapper insertion order. */
export function vegetationSnowNodes(THREE: Three, color: V3, roughness: F, initialNormalView: V3, snow: F) {
  const T = THREE.TSL;
  const up = T.normalize(T.cameraViewMatrix.mul(T.vec4(0, 1, 0, 0)).xyz);
  const cap = snow.mul(0.6).mul(T.smoothstep(0.4, 0.75, T.dot(initialNormalView, up)));
  return { color: T.mix(color, T.vec3(0.87, 0.9, 0.94), cap), roughness: T.mix(roughness, 0.62, cap) };
}

/** Origin is the original mesh/instance origin. Screen position uses bottom-left source gl_FragCoord pixels. */
export function vegetationFadeMask(THREE: Three, input: {
  origin: V2; camera: V2; ranges: V4; enabled: F; frame: F; screenPosition: V2; level: 0 | 1;
}): Node<'bool'> {
  const T = THREE.TSL, r = input.ranges, distance = T.length(input.origin.sub(input.camera));
  const f1 = T.float(1).sub(T.smoothstep(r.x.sub(r.y), r.x.add(r.y), distance));
  const f2 = T.float(1).sub(T.smoothstep(r.z.sub(r.w), r.z, distance));
  const enabled = input.enabled.greaterThan(0.5);
  const lo = T.select(enabled, input.level === 0 ? T.float(-1) : f1, -1);
  const hi = T.select(enabled, input.level === 0 ? f1 : f2, 2);
  const hash = T.fract(T.fract(T.dot(input.screenPosition.add(T.vec2(3.31, 7.93).mul(input.frame).mul(1.618)), T.vec2(0.06711056, 0.00583715))).mul(52.9829189));
  return hash.greaterThanEqual(lo).and(hash.lessThan(hi));
}
