import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import type { ThreeContext, ThreeFrame } from '@acme/ui/three';
import { CAMERA_MIN_DISTANCE, CHASE_PITCH, cameraPose, createCityScene, OVERVIEW_PITCH } from './city-scene.ts';
import { parseCityDataset } from './city-dataset.ts';
import { syntheticTileV2 as fixtureV2 } from './world/synthetic-tile.ts';
import type { SceneActorFactory } from './scene-actor.ts';

const frame = (delta = 0, reducedMotion = false) => ({ delta, time: 0, reducedMotion } as unknown as ThreeFrame);
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
  // the streamer may add its own redraws while cells are still to build or fading (cell-stream.ts update's busy flag)
  assert.ok(invalidations.count >= 1, 'a moving actor asks for the next frame');
  const movingCount = invalidations.count;
  moving = false;
  built.update!(frame(0.016), input);
  // at rest the actor adds no redraw of its own (any growth is the streamer's own pending cells)
  assert.ok(invalidations.count - movingCount <= 1, 'the actor at rest adds no redraw');
  built.dispose!(); built.dispose!();
  assert.equal(disposed, 1);
});

test('rebases the render root to whole cells while actors receive the absolute origin', () => {
  let seen: { x?: number; z?: number; changed?: boolean } = {};
  const input = params({
    actors: [(three) => {
      const object = new (three as typeof THREE).Object3D();
      return { id: 'test', object, update: (f) => { seen = { x: f.originX, z: f.originZ, changed: f.originChanged }; return false; }, dispose: () => {} };
    }],
  });
  const built = createCityScene(context(), input);
  built.update!(frame(), { ...input, camera: { ...input.camera, x: 49000, z: -49000, yaw: 0 } });
  const root = built.scene.children[0]!;
  assert.deepEqual([Math.round(root.position.x), Math.round(root.position.z)], [-48896, 49024]);
  assert.equal(seen.x, 48896);
  assert.equal(seen.z, -49024);
  assert.equal(seen.changed, true);
  const absolute = cameraPose({ x: 49000, z: -49000, yaw: 0, distance: input.camera.distance });
  assert.equal(built.camera.position.x, absolute.position[0]! - 48896);
  assert.equal(built.camera.position.z, absolute.position[2]! + 49024);
  built.update!(frame(), { ...input, camera: { ...input.camera, x: 0, z: 0, yaw: 0 } });
  assert.deepEqual([root.position.x + 0, root.position.z + 0], [0, 0]);
  assert.equal(seen.x, 0);
  assert.equal(seen.z, 0);
  assert.equal(seen.changed, true);
  built.dispose!();
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

test('a Klipp shot lands through the rig, follows its own look point, and hands back to the chase camera', () => {
  const input = params();
  const invalidations = { count: 0 };
  const built = createCityScene(context(invalidations), input);
  const camera = built.camera as THREE.PerspectiveCamera;
  const before = camera.position.clone();
  const originalFogDensity = built.scene.fog instanceof THREE.FogExp2 ? built.scene.fog.density : null;
  const shot = {
    position: [55, 4, 32] as [number, number, number],
    quaternion: [0, 0, 0, 1] as [number, number, number, number],
    near: .2, far: 2000, fov: 60,
    lookAt: [0, 1, 0] as [number, number, number],
  };
  // Blends advance on real time; dt 1 lands the shot blend in one frame.
  built.update!(frame(1), { ...input, cinematicShot: shot });
  assert.deepEqual(camera.position.toArray(), [55, 4, 32]);
  assert.equal(camera.fov, 60);
  // Legacy linear fog follows look distance. Physical/sky-rig exponential
  // fog instead preserves its authored density when the camera changes.
  const fog = built.scene.fog;
  const shotDistance = Math.hypot(55 - 0, 4 - 1, 32 - 0);
  if (fog instanceof THREE.Fog) {
    assert.ok(Math.abs(fog.near - (shotDistance * 1.4 + 250)) < 1e-6, `fog.near ${fog.near}`);
  } else {
    assert.ok(fog instanceof THREE.FogExp2);
    assert.equal(fog.density, originalFogDensity);
  }
  built.update!(frame(1), { ...input, cinematicShot: null });
  assert.ok(camera.position.equals(before), 'the blend lands back on the chase pose');
  assert.equal(camera.fov, 50);
  built.dispose?.();
});

test('an out-of-range shot clamps its lens mid-flight; reduced motion cuts', () => {
  const input = params();
  const built = createCityScene(context(), input);
  const camera = built.camera as THREE.PerspectiveCamera;
  const telephoto = {
    position: [55, 4, 32] as [number, number, number],
    quaternion: [0, 0, 0, 1] as [number, number, number, number],
    near: .2, far: 2000, fov: 8,
  };
  built.update!(frame(1), { ...input, cinematicShot: telephoto });
  assert.deepEqual(camera.position.toArray(), [55, 4, 32]);
  assert.equal(camera.fov, 20, 'clamped into the lens range instead of rejected');
  built.update!(frame(1), { ...input, cinematicShot: null });
  const still = {
    position: [1, 200, 60] as [number, number, number],
    quaternion: [0, 0, 0, 1] as [number, number, number, number],
    near: .2, far: 2000, fov: 60,
  };
  built.update!(frame(0, true), { ...input, cinematicShot: still });
  assert.deepEqual(camera.position.toArray(), [1, 200, 60], 'reduced motion: the shot cuts in one frame');
  built.dispose?.();
});

test('a held shot stays in world space across repeated frames and origin rebases, then returns to chase', () => {
  const input = params();
  input.camera.x = 49000;
  input.camera.z = -49000;
  const built = createCityScene(context(), input);
  const shot = {
    position: [49055, 4, -48968] as [number, number, number],
    quaternion: [0, 0, 0, 1] as [number, number, number, number],
    near: 0.2, far: 2000, fov: 60,
    lookAt: [49000, 1, -49000] as [number, number, number],
  };
  const root = built.scene.children[0]!;
  const assertShot = () => {
    assert.deepEqual(built.camera.position.toArray(), [
      shot.position[0] + root.position.x, shot.position[1], shot.position[2] + root.position.z,
    ]);
    const sky = built.scene.getObjectByName('city:sky')!;
    assert.deepEqual(sky.position.toArray(), shot.position);
  };
  built.update!(frame(1), { ...input, cinematicShot: shot });
  assertShot();
  for (let i = 0; i < 3; i++) {
    built.update!(frame(0), { ...input, cinematicShot: shot });
    assertShot();
  }
  const moved = { ...input, camera: { ...input.camera, x: 50000, z: -50000 } };
  built.update!(frame(0), { ...moved, cinematicShot: shot });
  assertShot();
  built.update!(frame(1), { ...moved, cinematicShot: null });
  const chase = cameraPose(moved.camera);
  assert.deepEqual(built.camera.position.toArray(), [
    chase.position[0] + root.position.x, chase.position[1], chase.position[2] + root.position.z,
  ]);
  built.dispose?.();
});
