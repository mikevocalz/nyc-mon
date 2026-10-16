import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VertexBuffer } from './geometry.ts';
import { box, cone, cylinder, frame } from './parts.ts';
import { emitAwning, emitCornice, emitFireEscapeFloor, emitStoop, emitWaterTower, STOOP_REACH } from './facade-detail.ts';
import { emitStackedText, emitText } from './lettering.ts';

/** Every triangle counter-clockwise seen from the side its normal points to (front faces visible). */
function assertWinding(buffer: VertexBuffer, label: string) {
  const p = buffer.positions; const n = buffer.normals;
  assert.ok(buffer.vertexCount > 0 && buffer.vertexCount % 3 === 0, label);
  for (let t = 0; t < buffer.vertexCount; t += 3) {
    const a = [p[t * 3]!, p[t * 3 + 1]!, p[t * 3 + 2]!];
    const b = [p[t * 3 + 3]!, p[t * 3 + 4]!, p[t * 3 + 5]!];
    const c = [p[t * 3 + 6]!, p[t * 3 + 7]!, p[t * 3 + 8]!];
    const u = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
    const v = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
    const cross = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
    const dot = cross[0]! * n[t * 3]! + cross[1]! * n[t * 3 + 1]! + cross[2]! * n[t * 3 + 2]!;
    assert.ok(dot > -1e-9, `${label}: triangle ${t / 3} faces away from its normal`);
  }
}

const out = [Math.SQRT1_2, -Math.SQRT1_2] as const;
const grey = [0.5, 0.5, 0.5];

test('boxes, cylinders and cones face outward in any frame, rolled or not', () => {
  for (const f of [frame(0, 0, [0, 1]), frame(10, -4, out, 2)]) {
    const b = new VertexBuffer();
    box(b, f, [-1, 0, -0.5], [1, 2, 0.5], grey);
    box(b, f, [-1, 0, -0.5], [1, 0.1, 0.5], grey, { roll: 0.7 });
    cylinder(b, f, 0.3, 0.2, 0.5, 0, 1, 8, grey);
    cone(b, f, 0, 0, 0.5, 1, 1.6, 8, grey);
    assertWinding(b, 'parts');
  }
});

test('stoops, cornices, fire escapes, awnings and water towers face outward', () => {
  const f = frame(5, 5, out);
  const b = new VertexBuffer();
  emitStoop(b, f, 0.5, grey, grey);
  emitCornice(b, f, 8, 12, grey);
  emitFireEscapeFloor(b, f, 0, 6.4, grey, false);
  emitFireEscapeFloor(b, f, 0, 9.6, grey, true);
  emitAwning(b, f, 1, 3.8, grey);
  emitWaterTower(b, 3, 3, 20, 1, grey, grey, grey);
  assertWinding(b, 'detail');
  // The stoop stays within its reach of the wall.
  const s = new VertexBuffer();
  emitStoop(s, frame(0, 0, [0, 1]), 0, grey, grey);
  for (let i = 2; i < s.positions.length; i += 3) assert.ok(s.positions[i]! <= STOOP_REACH + 1e-9 && s.positions[i]! >= -1e-9);
});

test('lettering faces its viewer and reads left to right', () => {
  const b = new VertexBuffer();
  emitText(b, 'APOLLO', { x: 0, y: 5, z: 0, right: [1, 0], height: 0.8, color: grey });
  emitStackedText(b, 'APOLLO', { x: 0, y: 10, z: 0, right: [0, 1], height: 1, color: grey });
  assertWinding(b, 'lettering');
  // Reading along +x the face looks toward +z (right x up); the first letter is the leftmost.
  const first = new VertexBuffer();
  emitText(first, 'AB', { x: 0, y: 0, z: 0, right: [1, 0], height: 0.7, color: grey });
  assert.equal(first.normals[2], 1);
  assert.ok(first.positions[0]! < first.positions[6 * 3]!, 'A left of B');
});
