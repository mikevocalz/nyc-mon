import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import type { ThreeContext, ThreeFrame } from '@acme/ui/three';
import { CAMERA_MIN_DISTANCE, CHASE_PITCH, cameraPose, createCityScene, OVERVIEW_PITCH } from './city-scene.ts';
import { parseCityDataset } from './city-dataset.ts';
import { syntheticTileV2 as fixtureV2 } from './world/synthetic-tile.ts';
import type { SceneActorFactory } from './scene-actor.ts';

const frame = (delta = 0) => ({ delta, time: 0, reducedMotion: false } as unknown as ThreeFrame);
function context(invalidations = { count: 0 }) {
  // Scene construction does not create a GPU renderer.
  return { THREE, invalidate: () => { invalidations.count++; } } as unknown as ThreeContext;
}
function params(extra: Partial<{ actors: SceneActorFactory[] }> = {}) {
  return { camera: { x: 0, z: 0, yaw: 0, distance: 200 }, dataset: parseCityDataset(fixtureV2()), ...extra };
}

test('bakes buildings, roads, areas and shadows into a few merged meshes', () => {
  const built = createCityScene(context(), params());
  const names: string[] = [];
  built.scene.traverse((o) => { if (o.name.startsWith('city:')) names.push(o.name); });
  for (const name of ['city:walls-masonry', 'city:walls-glass', 'city:roofs', 'city:roads', 'city:sidewalks', 'city:areas', 'city:contact-shadows', 'city:sky', 'city:ground', 'city:landmarks']) {
    assert.ok(names.includes(name), name);
  }
  const glass = built.scene.getObjectByName('city:walls-glass') as THREE.Mesh;
  glass.geometry.computeBoundingBox();
  assert.equal(Math.round(glass.geometry.boundingBox!.max.y), 60);
  assert.ok(built.camera.position.y > 0);
  assert.equal(built.scene.background, null, 'no Color background (renders black on react-native-webgpu)');
  built.dispose!();
});

test('the camera pose keeps the overview framing and drops to a chase pitch close in', () => {
  const far = cameraPose({ x: 0, z: 0, yaw: 0, distance: 220 });
  assert.ok(Math.abs(far.pitch - OVERVIEW_PITCH) < 1e-9);
  assert.ok(Math.abs(far.position[1] - 0.8 * 220) < 1e-6, 'height 0.8 x distance, as camera-input assumes');
  const near = cameraPose({ x: 5, z: 6, yaw: 0, distance: 1 });
  assert.equal(near.distance, CAMERA_MIN_DISTANCE);
  assert.ok(Math.abs(near.pitch - CHASE_PITCH) < 1e-9);
  assert.ok(near.target[1] > 1, 'close up it looks at the Caller, not the pavement');
  assert.deepEqual([near.position[0], near.position[2]], [5, 6 + CAMERA_MIN_DISTANCE]);
  const mid = cameraPose({ x: 0, z: 0, yaw: 0, distance: 60 });
  assert.ok(mid.pitch > CHASE_PITCH && mid.pitch < OVERVIEW_PITCH);
});

test('resize keeps camera state; updates stay on the same dataset', () => {
  const input = params(); const built = createCityScene(context(), input);
  const before = built.camera.position.clone();
  built.resize!(1200, 800); assert.ok(built.camera.position.equals(before));
  assert.equal((built.camera as THREE.PerspectiveCamera).aspect, 1.5);
  built.resize!(Number.NaN, 0); assert.equal((built.camera as THREE.PerspectiveCamera).aspect, 1.5);
  built.update!(frame(), { ...input, camera: { ...input.camera, x: 40 } });
  assert.equal(built.camera.position.x, 40);
  assert.throws(() => built.update!(frame(), params()), /Remount/);
  built.dispose!();
});

test('actors join the scene once, update before the camera, keep the canvas drawing while moving, and dispose', () => {
  const calls: string[] = [];
  let moving = true;
  let disposed = 0;
  const factory: SceneActorFactory = (three) => {
    const T = three as typeof THREE;
    const object = new T.Object3D();
    object.name = 'actor:test';
    return {
      id: 'test', object,
      update: (f) => { calls.push(`update:${f.delta}`); return moving; },
      dispose: () => { disposed++; },
    };
  };
  const invalidations = { count: 0 };
  const input = params({ actors: [factory] });
  const built = createCityScene(context(invalidations), input);
  assert.ok(built.scene.getObjectByName('actor:test'));
  built.update!(frame(0.016), input);
  assert.deepEqual(calls, ['update:0.016']);
  assert.equal(invalidations.count, 1, 'a moving actor asks for the next frame');
  moving = false;
  built.update!(frame(0.016), input);
  assert.equal(invalidations.count, 1, 'at rest the on-demand canvas stops');
  built.dispose!(); built.dispose!();
  assert.equal(disposed, 1);
});

test('disposes every geometry and material exactly once', () => {
  const built = createCityScene(context(), params());
  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  built.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material);
    }
  });
  let count = 0;
  for (const resource of resources) resource.addEventListener('dispose', () => { count++; });
  built.dispose!(); built.dispose!();
  assert.equal(count, resources.size); assert.equal(built.scene.children.length, 0);
});

test('rejects invalid cameras before allocating meshes', () => {
  const input = params(); input.camera.x = Number.NaN;
  assert.throws(() => createCityScene(context(), input), /camera/);
});
