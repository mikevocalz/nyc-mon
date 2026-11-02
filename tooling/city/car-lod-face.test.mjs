import assert from 'node:assert/strict';
import { test } from 'node:test';
import { carLodFace } from './car-lod-face.mjs';

test('collapsed and collinear LOD triangles are rejected before any normalization', () => {
  assert.equal(carLodFace([0, 0, 0, 0, 0, 0, 1, 1, 1], [0, 1, 2]), null);
  assert.equal(carLodFace([0, 0, 0, 1, 1, 1, 2, 2, 2], [0, 1, 2]), null);
});

test('thin nonzero faces survive without a world-scale area tolerance', () => {
  const positions = [0, 0, 0, 1e-10, 0, 0, 0, 1e-10, 0];
  const face = carLodFace(positions, [0, 1, 2]);
  assert.ok(face);
  assert.ok(face.length > 0);
  assert.equal(face.gz / face.length, 1);
  assert.equal(carLodFace(positions, [0, 2, 1]).gz / face.length, -1);
  assert.deepEqual(positions, [0, 0, 0, 1e-10, 0, 0, 0, 1e-10, 0], 'source positions are not welded or quantized');
});
