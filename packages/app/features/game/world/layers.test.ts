import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AREA_ORDER, AREA_STEP, areaLayer, LAYER, SHADOW_BAND_METRES, SHADOW_RADIUS, shadowBands } from './city-mesh.ts';

test('ground layers stack bottom to top with depth-resolvable gaps', () => {
  const heights = AREA_ORDER.map(areaLayer);
  for (let i = 1; i < heights.length; i++) assert.ok(heights[i]! - heights[i - 1]! >= AREA_STEP - 1e-12, AREA_ORDER[i]!);
  const stack = [Math.max(...heights), LAYER.sidewalks, LAYER.roads, LAYER.crossings, LAYER.shadows];
  for (let i = 1; i < stack.length; i++) assert.ok(stack[i]! - stack[i - 1]! >= 0.0025, `layer ${i}`);
  assert.ok(LAYER.shadows < 0.1, 'still under a Caller\'s sole');
  assert.equal(areaLayer('pitch') > areaLayer('park'), true, 'pitches sit on the park');
});

test('shadow bands cover the radius around the focus and clamp to the tile', () => {
  const minZ = -900;
  const count = 38;
  const [first, last] = shadowBands(0, minZ, count);
  assert.ok(minZ + first * SHADOW_BAND_METRES <= -SHADOW_RADIUS);
  assert.ok(minZ + (last + 1) * SHADOW_BAND_METRES >= SHADOW_RADIUS);
  assert.deepEqual(shadowBands(-5000, minZ, count), [0, 0]);
  assert.deepEqual(shadowBands(5000, minZ, count), [count - 1, count - 1]);
});
