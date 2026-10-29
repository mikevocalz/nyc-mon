import type { Three } from '@acme/ui/three';
import type { Node, UniformNode } from 'three/webgpu';

type Tsl = Three['TSL'];
type RenderScene = { userData: { renderOrigin?: { x: number; y: number; z: number } } };

/**
 * One update hook per material node, reading the scene being rendered. No TSL-global cache: scenes can be
 * built, compiled and rendered interleaved without leaking one scene's origin into another's pattern graph.
 */
export function renderOriginNode(THREE: Three): UniformNode<'vec3', InstanceType<Three['Vector3']>> {
  return THREE.TSL.uniform(new THREE.Vector3())
    .setGroup(THREE.TSL.renderGroup)
    .onRenderUpdate(({ scene }, self) => {
      const origin = (scene as unknown as RenderScene).userData.renderOrigin;
      self.value.set(origin?.x ?? 0, origin?.y ?? 0, origin?.z ?? 0);
    }) as never;
}

export function setRenderOrigin(scene: RenderScene, x: number, y: number, z: number): void {
  let origin = scene.userData.renderOrigin;
  if (!origin) scene.userData.renderOrigin = origin = { x: 0, y: 0, z: 0 };
  origin.x = x;
  origin.y = y;
  origin.z = z;
}

export function worldPatternPosition(THREE: Three): Node<'vec3'> {
  const T: Tsl = THREE.TSL;
  return T.positionWorld.add(renderOriginNode(THREE)) as Node<'vec3'>;
}
