import assert from 'node:assert/strict';
import test from 'node:test';
import { MOUSE_FACE, toPathData, type Pt } from './mouse-face.ts';

const all = (): Pt[] => [...MOUSE_FACE.lines.flat(), ...MOUSE_FACE.nose];

test('the mouse face stays inside its 100-unit box with room for round caps', () => {
  for (const [x, y] of all()) {
    assert.ok(x >= 4 && x <= 96, `x ${x}`);
    assert.ok(y >= 4 && y <= 96, `y ${y}`);
  }
});

test('the face is mirror-symmetric about x = 50', () => {
  const key = ([x, y]: Pt) => `${x.toFixed(1)},${y.toFixed(1)}`;
  const points = new Set(all().map(key));
  for (const [x, y] of all()) assert.ok(points.has(key([100 - x, y])), `no mirror for ${x},${y}`);
});

test('the face is centred on the hotspot', () => {
  const xs = all().map(([x]) => x);
  const ys = all().map(([, y]) => y);
  assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - 50) < 0.5);
  assert.ok(Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - 50) < 3);
});

test('the snout is a point at the bottom, narrower than the head is wide', () => {
  const nose = MOUSE_FACE.nose;
  const tip = Math.max(...nose.map(([, y]) => y));
  assert.ok(tip > 88);
  assert.match(toPathData([nose], true), /^M50 81 L.* Z$/);
});
