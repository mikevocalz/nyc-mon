import type { Three } from '@acme/ui/three';
import type { Node, UniformNode } from 'three/webgpu';

type Tsl = Three['TSL'];
type RenderScene = { userData: { renderOrigin?: { x: number; y: number; z: number } } };

type OriginNode = UniformNode<'vec3', InstanceType<Three['Vector3']>>;
const nodes = new WeakMap<Three, OriginNode>();

/**
 * One uniform per three module, shared by every material that offsets its pattern position. It reads the scene
 * being rendered on each render call (renderGroup), so scenes built, compiled and rendered interleaved never see
 * each other's origin: the value is set from the scene in hand just before that scene draws. It has to be one node:
 * a node per material gives each material its own node id, so materials with the same graph stop sharing a
 * shader module and a pipeline (pbr-material.test.ts: "two sets and three option sets build into one shader").
 */
export function renderOriginNode(THREE: Three): OriginNode {
  let node = nodes.get(THREE);
  if (!node) {
    node = THREE.TSL.uniform(new THREE.Vector3())
      .setGroup(THREE.TSL.renderGroup)
      .onRenderUpdate(({ scene }, self) => {
        const origin = (scene as unknown as RenderScene).userData.renderOrigin;
        self.value.set(origin?.x ?? 0, origin?.y ?? 0, origin?.z ?? 0);
      }) as never as OriginNode;
    nodes.set(THREE, node);
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
