import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PREVIEW_FOV, previewCamera } from './modelFraming.ts';

const fillOf = (height: number, scale = 1) => {
  const { position } = previewCamera(height, scale);
  const visible = 2 * position[2] * Math.tan((PREVIEW_FOV * Math.PI) / 360);
  return (height * scale) / visible;
};

test('an egg and a Max fill the same share of the frame', () => {
  const egg = fillOf(0.152);
  assert.ok(Math.abs(egg - 0.65) < 1e-9);
  assert.ok(Math.abs(fillOf(1.766) - egg) < 1e-9);
  assert.ok(Math.abs(fillOf(0.152, 3) - egg) < 1e-9);
});

test('looks at the middle of the model from level with it', () => {
  const { position, focalPoint } = previewCamera(0.152, 1);
  assert.equal(position[1], 0.076);
  assert.deepEqual(focalPoint, [0, 0.076, 0]);
});

test('a model with no measured height frames as 1 m', () => {
  assert.deepEqual(previewCamera(null, 1), previewCamera(1, 1));
});
