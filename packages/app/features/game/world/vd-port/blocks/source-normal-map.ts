// Three0.185.1 normal_fragment_begin/maps + getTangentFrame (Valdrada source renderer).
// No source tangents exist in this region. Use the transformed normal-map UV,
// rather than the default geometry UV used by a generic TSL normalMap node.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';

export function sourceTangentNormal(THREE: Three, input: {
  sample: Node<'vec3'>; uv: Node<'vec2'>; scale: Node<'vec2'>; side: number; flatShading: boolean;
}): Node<'vec3'> {
  const T = THREE.TSL;
  let normal = input.flatShading ? T.normalFlat : T.normalViewGeometry;
  if (!input.flatShading) {
    if (input.side === THREE.BackSide) normal = normal.negate();
    else if (input.side === THREE.DoubleSide) normal = normal.mul(T.faceDirection);
  }
  const q0 = T.dFdx(T.positionView), q1 = T.dFdy(T.positionView), st0 = T.dFdx(input.uv), st1 = T.dFdy(input.uv);
  const q1perp = T.cross(q1, normal), q0perp = T.cross(normal, q0);
  const tangent = q1perp.mul(st0.x).add(q0perp.mul(st1.x));
  const bitangent = q1perp.mul(st0.y).add(q0perp.mul(st1.y));
  const det = T.max(T.dot(tangent, tangent), T.dot(bitangent, bitangent)), valid = det.greaterThan(0);
  // The source zero determinant branch returns scale0. Keep inverseSqrt's input
  // finite even on backends that eagerly evaluate select's two operands.
  let scale = T.inverseSqrt(T.select(valid, det, 1)).mul(T.select(valid, 1, 0));
  // r185 normal_fragment_begin applies DOUBLE_SIDED to both TBN columns even under FLAT_SHADED.
  if (input.side === THREE.DoubleSide) scale = scale.mul(T.faceDirection);
  const mapped = input.sample.mul(2).sub(1);
  return T.normalize(tangent.mul(scale).mul(mapped.x).mul(input.scale.x)
    .add(bitangent.mul(scale).mul(mapped.y).mul(input.scale.y)).add(normal.mul(mapped.z)));
}
