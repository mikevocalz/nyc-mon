import assert from 'node:assert/strict';
import test from 'node:test';
import { valdradaToScene } from './transform.ts';
// The bake's reference transform (tooling/city/valdrada/decode.mjs toScene, rounded to 0.1 m).
// @ts-expect-error untyped tooling module
import { toScene } from '../../../../../../tooling/city/valdrada/decode.mjs';

const ORIGIN = [-73.94975, 40.81005] as const;

test('the port transform agrees with the bake toScene to its 0.1 m rounding', () => {
  const f = valdradaToScene(ORIGIN);
  // the Apollo's frontage ends, the Studio Museum, the MVV crossing (Valdrada world metres)
  for (const [vx, vz] of [[1769.0, -2981.7], [1781.9, -2974.7], [1987.2, -2825.2], [1088.46, -3623.33], [2599.45, -2250.89]] as const) {
    const [x, z] = f(vx, vz);
    const [rx, rz] = toScene(vx, vz) as [number, number];
    assert.ok(Math.abs(x - rx) <= 0.051 && Math.abs(z - rz) <= 0.051, `${vx},${vz}: ${x},${z} vs ${rx},${rz}`);
  }
});

test('lengths change by Valdrada-to-scene scale only (under 0.2 %)', () => {
  const f = valdradaToScene(ORIGIN);
  const [ax, az] = f(1769.0, -2981.7), [bx, bz] = f(1781.9, -2974.7);
  const v = Math.hypot(1781.9 - 1769.0, -2974.7 + 2981.7), s = Math.hypot(bx - ax, bz - az);
  assert.ok(Math.abs(s / v - 1) < 0.002, `ratio ${s / v}`);
});
