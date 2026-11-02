import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CELL } from './cells/cell-rules.ts';
import { absoluteToRender, createFloatingOrigin, renderToAbsolute, updateFloatingOrigin } from './floating-origin.ts';

test('starts at zero and leaves no-op updates unchanged', () => {
  const origin = createFloatingOrigin();
  assert.deepEqual(origin, { cx: 0, cz: 0 });
  for (const x of [0, CELL, 2 * CELL, -2 * CELL]) {
    assert.equal(updateFloatingOrigin(origin, x, -x), false);
    assert.deepEqual(origin, { cx: 0, cz: 0 });
  }
});

test('positive and negative threshold crossings snap to containing whole cells', () => {
  const positive = createFloatingOrigin();
  assert.equal(updateFloatingOrigin(positive, 256.001, 0), true);
  assert.deepEqual(positive, { cx: 2, cz: 0 });
  const negative = createFloatingOrigin();
  assert.equal(updateFloatingOrigin(negative, 0, -256.001), true);
  assert.deepEqual(negative, { cx: 0, cz: -3 });
});

test('hysteresis prevents rebasing while oscillating across the crossed boundary', () => {
  for (const sign of [1, -1]) {
    const origin = createFloatingOrigin();
    assert.equal(updateFloatingOrigin(origin, sign * 256.001, sign * 256.001), true);
    const snapshot = { ...origin };
    for (const distance of [255.999, 256, 256.001, 255.5]) {
      assert.equal(updateFloatingOrigin(origin, sign * distance, sign * distance), false);
      assert.deepEqual(origin, snapshot);
    }
  }
});

test('axes rebase independently at exact and just-outside thresholds', () => {
  const origin = createFloatingOrigin();
  assert.equal(updateFloatingOrigin(origin, 300, 128), true);
  assert.deepEqual(origin, { cx: 2, cz: 0 });
  assert.equal(updateFloatingOrigin(origin, 512, -256), false);
  assert.equal(updateFloatingOrigin(origin, 512.001, -256.001), true);
  assert.deepEqual(origin, { cx: 4, cz: -3 });
});

test('repeated rebases use absolute coordinates without accumulating drift', () => {
  const origin = createFloatingOrigin();
  const out = { x: 0, y: 0, z: 0 };
  for (const x of [300, 900, 49000.125, -300, -900, -49000.125, 0]) {
    const absolute = Object.freeze({ x, y: 13.25, z: x === 0 ? 0 : -x });
    assert.equal(updateFloatingOrigin(origin, absolute.x, absolute.z), true);
    assert.equal(Number.isInteger(origin.cx), true);
    assert.equal(Number.isInteger(origin.cz), true);
    absoluteToRender(origin, absolute, out);
    assert.ok(out.x >= 0 && out.x < CELL);
    assert.ok(out.z >= 0 && out.z < CELL);
    renderToAbsolute(origin, out, out);
    assert.deepEqual(out, absolute);
  }
});

test('conversions return caller outputs, preserve inputs and Y, and support in-place roundtrips', () => {
  const origin = createFloatingOrigin();
  updateFloatingOrigin(origin, 49000, -49000);
  const absolute = Object.freeze({ x: 49000.125, y: -4.5, z: -48999.75 });
  const render = { x: 0, y: 0, z: 0, tag: 'reused' };
  const restored = { x: 0, y: 0, z: 0 };
  assert.equal(absoluteToRender(origin, absolute, render), render);
  assert.equal(render.tag, 'reused');
  assert.equal(render.y, absolute.y);
  assert.equal(renderToAbsolute(origin, render, restored), restored);
  assert.deepEqual(restored, absolute);
  assert.equal(absoluteToRender(origin, restored, restored), restored);
  assert.equal(renderToAbsolute(origin, restored, restored), restored);
  assert.deepEqual(restored, absolute);
});

test('subtracting the origin before float32 conversion preserves millimetre separation at 49 km', () => {
  for (const sign of [1, -1]) {
    const origin = createFloatingOrigin();
    const a = Object.freeze({ x: sign * 49000, y: 0, z: sign * 49000 });
    const b = Object.freeze({ x: a.x + 0.001, y: 0, z: a.z + 0.001 });
    updateFloatingOrigin(origin, a.x, a.z);
    const ra = { x: 0, y: 0, z: 0 };
    const rb = { x: 0, y: 0, z: 0 };
    absoluteToRender(origin, a, ra);
    absoluteToRender(origin, b, rb);
    assert.equal(Math.fround(a.x), Math.fround(b.x));
    assert.ok(Math.abs((Math.fround(rb.x) - Math.fround(ra.x)) - 0.001) < 0.00001);
    assert.ok(Math.abs((Math.fround(rb.z) - Math.fround(ra.z)) - 0.001) < 0.00001);
  }
});
