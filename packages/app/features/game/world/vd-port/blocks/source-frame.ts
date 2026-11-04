import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import type { SourceParameterBinding } from './source-bindings.ts';

/** Avoid derivatives of large absolute source coordinates when the glass derives a stable plane normal. */
export function sourceCameraRelativeGeometricNormal(THREE: Three, affine: Node<'vec4'>): Node<'vec3'> {
  const T = THREE.TSL;
  const view = T.normalize(T.cross(T.dFdx(T.positionView), T.dFdy(T.positionView)));
  const world = T.normalize(T.vec4(view, 0).mul(T.cameraViewMatrix).xyz);
  return T.normalize(world.mul(T.vec3(affine.x, 1, affine.y)));
}

/** Frame-table equivalent; affine is [sx, sz, ox, oz], validated by the offline registry. */
export function sourcePatternFrameNodes(THREE: Three, input: {
  position: Node<'vec3'>; normal: Node<'vec3'>; baseY: Node<'float'>; curb: Node<'float'>; affine: Node<'vec4'>;
}) {
  const T = THREE.TSL, p = input.position, a = input.affine;
  return {
    position: T.vec3(p.x.sub(a.z).div(a.x), p.y.add(input.baseY).sub(input.curb), p.z.sub(a.w).div(a.y)),
    normal: T.normalize(input.normal.mul(T.vec3(a.x, 1, a.y))),
  };
}

/** Inverse of the baker's structure-local Y flatten and Valdrada-to-scene XZ affine transform. */
export function sourcePatternFrame(THREE: Three, input: {
  /** Absolute scene position: use worldPatternPosition so floating-origin moves preserve the authored pattern. */
  position: Node<'vec3'>;
  normal: Node<'vec3'>;
  baseY: Node<'float'>;
  curb: Node<'float'>;
  affine: { sx: number; sz: number; ox: number; oz: number };
}) {
  const { sx, sz, ox, oz } = input.affine;
  if (![sx, sz, ox, oz].every(Number.isFinite) || sx === 0 || sz === 0) throw new Error('Invalid authored building coordinate transform');
  // Normals transform by inverse transpose; undoing the affine multiplies by its scale.
  return sourcePatternFrameNodes(THREE, { ...input, affine: THREE.TSL.vec4(sx, sz, ox, oz) });
}

/** Restore authored object coordinates after offline instance flattening; matrix columns are authenticated frame-table data. */
export function sourceVegetationFrameNodes(THREE: Three, input: {
  position: Node<'vec3'>; normal: Node<'vec3'>; frame: SourceParameterBinding;
}) {
  const T = THREE.TSL, f = input.frame;
  const matrix = (prefix: string) => T.mat4(f.vec4(`${prefix}0`), f.vec4(`${prefix}1`), f.vec4(`${prefix}2`), f.vec4(`${prefix}3`));
  const source = sourcePatternFrameNodes(THREE, { ...input, baseY: f.scalar('baseY'), curb: f.scalar('curb'), affine: f.vec4('affine') });
  const combined = matrix('combined'), inverse = matrix('inverseCombined'), localToScene = matrix('localToScene');
  return {
    sourcePosition: source.position,
    localPosition: inverse.mul(T.vec4(source.position, 1)).xyz,
    // Undo the inverse-transpose normal transform; source normal is already normalized.
    objectNormal: T.normalize(T.vec4(source.normal, 0).mul(combined).xyz),
    sourceOrigin: f.vec4('combined3').xz,
    instanceTranslation: f.vec2('instanceTranslationXZ'),
    instanced: f.scalar('isInstanced'),
    sceneWindDelta: (delta: Node<'vec3'>) => localToScene.mul(T.vec4(delta, 0)).xyz,
  };
}
