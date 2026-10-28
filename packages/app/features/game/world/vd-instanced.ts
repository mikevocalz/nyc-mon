// Instanced drawing for the vd lane's baked vehicle bodies (vd-car-mesh.ts):
// the parked cars (street-props.ts) and the moving fleet
// (living-city/vehicle-actor.ts) draw every body and detail level as a plain
// Mesh over an InstancedBufferGeometry, never an InstancedMesh.
//
// Why: three r186 adds `object.uuid` to an InstancedMesh's render cache key
// (RenderObject.getMaterialCacheKey), so every InstancedMesh runs its own node
// build, about 22 ms of JS and several MB of garbage on a desktop CPU, for
// the colour pass and again for the shadow pass, even with no instance drawn.
// Thirty-four vehicle meshes (six parked bodies x near/mid/far, eight fleet
// bodies x near/mid) made that the largest block of the city's first frame on
// the 4 GB iPad. A Mesh with instanceCount on its geometry has no uuid in its
// key, so every mesh sharing a material and an attribute layout reuses one
// node build, one shader module and one pipeline.
//
// The transform rides in one instanced vertex attribute, read by the
// material's positionNode (the shadow pass copies positionNode, so casters
// move with it):
//
//   vdXform  vec4  x, z, s * cos(yaw), s * sin(yaw)
//
// The same yaw about +Y and uniform scale `s` that Matrix4.compose(position
// (x, 0, z), quaternion from axis Y, scale (s, s, s)) builds, so a slot
// written here draws where the matrix did. The per-instance data shares one
// InstancedInterleavedBuffer per mesh: one vertex buffer, one upload.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';

/** The instance transform attribute (see the header). */
export const VD_XFORM_ATTRIBUTE = 'vdXform';

type Geometry = InstanceType<Three['BufferGeometry']>;
type InstancedGeometry = InstanceType<Three['InstancedBufferGeometry']>;
type Interleaved = InstanceType<Three['InstancedInterleavedBuffer']>;

/** Writes slot `slot`'s vdXform into `array` at `slot * stride + offset`. */
export function writeVdXform(
  array: Float32Array, slot: number, stride: number, offset: number, x: number, z: number, yaw: number, scale = 1,
): void {
  const o = slot * stride + offset;
  array[o] = x;
  array[o + 1] = z;
  array[o + 2] = scale * Math.cos(yaw);
  array[o + 3] = scale * Math.sin(yaw);
}

/**
 * The vertex transform for vdXform: turns positionLocal and normalLocal about +Y, scales, then offsets. Assign it to
 * a material's positionNode; every mesh drawing with that material must carry vdXform.
 */
export function vdXformPositionNode(THREE: Three): Node<'vec3'> {
  const T = THREE.TSL;
  const xf = T.attribute<'vec4'>(VD_XFORM_ATTRIBUTE, 'vec4');
  return T.Fn(() => {
    const c = xf.z;
    const s = xf.w;
    const k = T.length(T.vec2(c, s));
    const turn = (v: Node<'vec3'>) => T.vec3(c.mul(v.x).add(s.mul(v.z)), v.y.mul(k), c.mul(v.z).sub(s.mul(v.x)));
    T.normalLocal.assign(T.normalize(turn(T.normalLocal)));
    return turn(T.positionLocal).add(T.vec3(xf.x, 0, xf.y));
  })() as unknown as Node<'vec3'>;
}

/**
 * An InstancedBufferGeometry over `base`'s attributes, index and bounds (shared, not copied), plus the per-instance
 * `fields` laid into one interleaved buffer of `capacity` slots. instanceCount starts at 0.
 */
export function vdInstancedGeometry(
  THREE: Three, base: Geometry, capacity: number, fields: readonly (readonly [name: string, size: number])[],
): { geometry: InstancedGeometry; buffer: Interleaved; stride: number; offsets: Readonly<Record<string, number>> } {
  const geometry = new THREE.InstancedBufferGeometry();
  for (const [name, attribute] of Object.entries(base.attributes)) geometry.setAttribute(name, attribute as Parameters<InstancedGeometry['setAttribute']>[1]);
  geometry.setIndex(base.index);
  geometry.boundingBox = base.boundingBox;
  geometry.boundingSphere = base.boundingSphere;
  geometry.userData = base.userData;
  let stride = 0;
  const offsets: Record<string, number> = {};
  for (const [name, size] of fields) { offsets[name] = stride; stride += size; }
  stride = Math.ceil(stride / 4) * 4;
  // Static usage on purpose: three r186 re-uploads a DynamicDrawUsage buffer on every frame it draws
  // (Attributes.update), version bump or not. Writers set `needsUpdate` when a slot changes.
  const buffer = new THREE.InstancedInterleavedBuffer(new Float32Array(Math.max(1, capacity) * stride), stride, 1);
  for (const [name, size] of fields) geometry.setAttribute(name, new THREE.InterleavedBufferAttribute(buffer, size, offsets[name]!));
  geometry.instanceCount = 0;
  return { geometry, buffer, stride, offsets };
}
