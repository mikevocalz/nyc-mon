import type { Three } from '@acme/ui/three';
import type { Node, UniformNode } from 'three/webgpu';

type Tsl = Three['TSL'];
type RenderScene = { userData: { renderOrigin?: { x: number; y: number; z: number } } };

/**
 * The render-origin uniform, one node per THREE instance so every material's graph names it identically (a fresh
 * node per call would mint a distinct WGSL name and fork the shared shaders). No TSL-global VALUE cache: the
 * update hook reads the scene being rendered, so interleaved scenes never leak one origin into another's graph.
 */
const originNodes = new WeakMap<Three, UniformNode<'vec3', InstanceType<Three['Vector3']>>>();
export function renderOriginNode(THREE: Three): UniformNode<'vec3', InstanceType<Three['Vector3']>> {
  let node = originNodes.get(THREE);
  if (!node) {
    node = THREE.TSL.uniform(new THREE.Vector3())
      .setGroup(THREE.TSL.renderGroup)
      .onRenderUpdate(({ scene }, self) => {
        const origin = (scene as unknown as RenderScene).userData.renderOrigin;
        self.value.set(origin?.x ?? 0, origin?.y ?? 0, origin?.z ?? 0);
      }) as never;
    originNodes.set(THREE, node);
  }
  return node;
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
