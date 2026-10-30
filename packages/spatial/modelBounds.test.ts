import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { viroReadableGlb } from './glbDequantize.ts';
import { readModelPoints } from './modelBounds.ts';

const range = (points: Float32Array, axis: number) => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = axis; i < points.length; i += 3) {
    lo = Math.min(lo, points[i]!);
    hi = Math.max(hi, points[i]!);
  }
  return [lo, hi];
};

describe('readModelPoints', () => {
  // Expected heights are three.js's skinned bind pose for the same files (SkinnedMesh.getVertexPosition).
  for (const [name, height] of [['squeaklet', 0.68], ['lil-ratti', 1.696], ['metro-egg', 0.15]] as const) {
    it(`reads ${name} standing on its origin at its bind-pose height`, () => {
      const points = readModelPoints(viroReadableGlb(new Uint8Array(readFileSync(new URL(`../../apps/web/public/mons/${name}.glb`, import.meta.url)))))!;
      const [lo, hi] = range(points, 1);
      assert.ok(Math.abs(lo!) < 0.005, `${name} base ${lo}`);
      assert.ok(Math.abs(hi! - height) < 0.005, `${name} top ${hi}`);
    });
  }

  // Holding still, Viro web ignores the skin: mesh-space positions under the rig node (Squeaklet's rig is scaled 0.4).
  for (const [name, bottom, top] of [['squeaklet', -0.219, 0.4], ['lil-ratti', -0.766, 1]] as const) {
    it(`reads ${name} where Viro draws it holding still`, () => {
      const points = readModelPoints(viroReadableGlb(new Uint8Array(readFileSync(new URL(`../../apps/web/public/mons/${name}.glb`, import.meta.url)))), 'viro-still')!;
      const [lo, hi] = range(points, 1);
      assert.ok(Math.abs(lo! - bottom) < 0.005, `${name} base ${lo}`);
      assert.ok(Math.abs(hi! - top) < 0.005, `${name} top ${hi}`);
    });
  }

  it('reads an unskinned model the same in both poses', () => {
    const egg = viroReadableGlb(new Uint8Array(readFileSync(new URL('../../apps/web/public/mons/metro-egg.glb', import.meta.url))));
    assert.deepEqual(readModelPoints(egg, 'viro-still'), readModelPoints(egg, 'bind'));
  });

  it('falls back to the accessor box for quantized positions and returns null for junk', () => {
    const quantized = readModelPoints(new Uint8Array(readFileSync(new URL('../../apps/web/public/mons/metro-egg.glb', import.meta.url))))!;
    assert.equal(quantized.length % 3, 0);
    const [lo, hi] = range(quantized, 1);
    assert.ok(lo! > -0.01 && hi! > 0.14 && hi! < 0.17);
    assert.equal(readModelPoints(new Uint8Array([1, 2, 3])), null);
  });
});
