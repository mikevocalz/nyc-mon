import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { CYCLE_METRES, createCallerProxyWith, poseFor } from './caller-proxy.ts';
import { INITIAL_CALLER_STATE, createCallerStore } from './caller-store.ts';
import { GROUNDED, RUN_SPEED, WALK_SPEED, startJump } from './locomotion.ts';

const frame = { delta: 1 / 60, time: 0, reducedMotion: false };

test('an idle Caller stands straight; walking swings legs against arms; running swings wider', () => {
  assert.deepEqual(poseFor({ gait: 'idle', speed: 0, stride: 3, jump: GROUNDED }), { leg: 0, arm: 0, bob: 0, lean: 0 });
  const quarter = CYCLE_METRES / 4;
  const walk = poseFor({ gait: 'walk', speed: WALK_SPEED, stride: quarter, jump: GROUNDED });
  const run = poseFor({ gait: 'run', speed: RUN_SPEED, stride: quarter, jump: GROUNDED });
  assert.ok(walk.leg > 0 && walk.arm < 0);
  assert.ok(run.leg > walk.leg && run.lean > walk.lean);
  // One full cycle later the pose repeats: the swing follows distance, not time.
  const later = poseFor({ gait: 'walk', speed: WALK_SPEED, stride: quarter + CYCLE_METRES, jump: GROUNDED });
  assert.ok(Math.abs(later.leg - walk.leg) < 1e-9);
});

test('the proxy builds with the world THREE, hides until spawned, then follows the store', () => {
  const store = createCallerStore();
  const actor = createCallerProxyWith(store)(THREE);
  const root = actor.object as THREE.Group;
  assert.equal(actor.id, 'caller-proxy');
  assert.equal(root.visible, false);
  assert.equal(actor.update(frame), false);

  store.setState({ spawned: true, x: 4, z: -2, groundY: 0.5, heading: 1, gait: 'walk', speed: WALK_SPEED, stride: 0.4 });
  assert.equal(actor.update(frame), true, 'walking keeps an on-demand canvas drawing');
  assert.equal(root.visible, true);
  assert.deepEqual(root.position.toArray(), [4, 0.5, -2]);
  assert.equal(root.rotation.y, 1);

  store.setState({ gait: 'idle', speed: 0, jump: startJump(GROUNDED) });
  assert.equal(actor.update(frame), true, 'a jump in the air keeps drawing');
  store.setState({ jump: GROUNDED });
  assert.equal(actor.update(frame), false, 'an idle Caller costs no frames');

  // About 1.8 m tall, on the ground.
  const box = new THREE.Box3().setFromObject(root.getObjectByName('caller-proxy:figure')!);
  assert.ok(box.max.y - box.min.y > 1.6 && box.max.y - box.min.y < 2, `height ${box.max.y - box.min.y}`);
  assert.ok(root.getObjectByName('caller-proxy:ring'));

  const scene = new THREE.Scene();
  scene.add(root);
  actor.dispose();
  actor.dispose();
  assert.equal(root.parent, null);
  assert.deepEqual(INITIAL_CALLER_STATE.spawned, false);
});
