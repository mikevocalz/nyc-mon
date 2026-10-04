import assert from 'node:assert/strict';
import test from 'node:test';
import { chaseStep, facingLeftFor, poseFor, settled } from './chase-model.ts';

test('the chase closes the same share of the gap whatever the frame rate', () => {
  const target = { x: 100, y: 0 };
  let a = { x: 0, y: 0 };
  for (let i = 0; i < 4; i++) a = chaseStep(a, target, 1000 / 60, 8); // four 60 Hz frames
  let b = { x: 0, y: 0 };
  for (let i = 0; i < 2; i++) b = chaseStep(b, target, 1000 / 30, 8); // two 30 Hz frames
  assert.ok(Math.abs(a.x - b.x) < 1e-9);
  assert.ok(a.x > 0 && a.x < 100);
  assert.deepEqual(chaseStep({ x: 5, y: 5 }, { x: 9, y: 9 }, 0, 8), { x: 5, y: 5 });
});

test('facing flips only outside the dead zone', () => {
  assert.equal(facingLeftFor(-5, false), true);
  assert.equal(facingLeftFor(5, true), false);
  assert.equal(facingLeftFor(-1, false), false);
  assert.equal(facingLeftFor(1, true), true);
});

test('the mouse runs while behind and sits once caught up and the pointer rests', () => {
  assert.equal(poseFor(40, 5000), 'run');
  assert.equal(poseFor(2, 100), 'run');
  assert.equal(poseFor(2, 1200), 'idle');
  assert.equal(settled({ x: 1, y: 1 }, { x: 1.1, y: 1.2 }), true);
  assert.equal(settled({ x: 1, y: 1 }, { x: 3, y: 1 }), false);
});
