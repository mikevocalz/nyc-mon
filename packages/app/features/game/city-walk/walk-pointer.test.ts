import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_CITY_CAMERA, moveCityCamera } from '../city-camera.ts';
import { pointerActions } from './walk-pointer.ts';

const camera = { ...INITIAL_CITY_CAMERA, yaw: 0 };
const apply = (before: { x: number; y: number }[], after: { x: number; y: number }[]) =>
  pointerActions(before, after, camera, 800).reduce(moveCityCamera, camera);

test('one pointer drags the map with it, like the native drag', () => {
  assert.ok(apply([{ x: 100, y: 100 }], [{ x: 200, y: 100 }]).x < camera.x, 'drag right -> camera west');
  assert.ok(apply([{ x: 100, y: 100 }], [{ x: 100, y: 200 }]).z < camera.z, 'drag down -> camera forward');
  assert.deepEqual(pointerActions([{ x: 1, y: 1 }], [{ x: 1, y: 1 }], camera, 800), []);
});

test('two pointers spreading zoom in, closing zoom out', () => {
  assert.ok(apply([{ x: 100, y: 100 }, { x: 200, y: 100 }], [{ x: 50, y: 100 }, { x: 250, y: 100 }]).distance < camera.distance);
  assert.ok(apply([{ x: 50, y: 100 }, { x: 250, y: 100 }], [{ x: 100, y: 100 }, { x: 200, y: 100 }]).distance > camera.distance);
});

test('two pointers twisting turn the view the shortest way round', () => {
  const turned = apply([{ x: 100, y: 100 }, { x: 200, y: 100 }], [{ x: 100, y: 100 }, { x: 200, y: 110 }]);
  assert.notEqual(turned.yaw, camera.yaw);
  const across = pointerActions([{ x: 0, y: 0 }, { x: -100, y: 1 }], [{ x: 0, y: 0 }, { x: -100, y: -1 }], camera, 800);
  const orbit = across.find((a) => a.type === 'orbit');
  assert.ok(orbit && orbit.type === 'orbit' && Math.abs(orbit.radians) < 0.1, 'crossing the -x axis is a small turn');
});

test('mismatched or extra pointers do nothing', () => {
  assert.deepEqual(pointerActions([{ x: 0, y: 0 }], [{ x: 0, y: 0 }, { x: 1, y: 1 }], camera, 800), []);
  const three = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }];
  assert.deepEqual(pointerActions(three, three.map((p) => ({ x: p.x + 5, y: p.y })), camera, 800), []);
});
