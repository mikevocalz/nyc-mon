import assert from 'node:assert/strict';
import { test } from 'node:test';
import { litDensity, windowHash, windowLit, windowTone } from './windows.ts';

test('the pattern is deterministic and the ground floor stays dark', () => {
  for (let c = 0; c < 20; c++) for (let r = 0; r < 10; r++) assert.equal(windowLit(c, r, 41.5), windowLit(c, r, 41.5));
  for (let c = 0; c < 50; c++) assert.equal(windowLit(c, 0, 12.25), false);
  for (let i = 0; i < 200; i++) {
    const h = windowHash(i * 1.7, i * 0.3, i);
    assert.ok(h >= 0 && h < 1);
  }
});

test('buildings vary in density between a quarter and three quarters lit, and hit their density', () => {
  const densities = Array.from({ length: 200 }, (_, i) => litDensity(i * 0.5));
  for (const d of densities) assert.ok(d >= 0.25 && d <= 0.75);
  assert.ok(Math.max(...densities) - Math.min(...densities) > 0.35, 'blocks differ');
  for (const seed of [3.5, 18.25, 77.75]) {
    let lit = 0;
    let all = 0;
    for (let c = 0; c < 60; c++) for (let r = 1; r < 41; r++) { all++; if (windowLit(c, r, seed)) lit++; }
    assert.ok(Math.abs(lit / all - litDensity(seed)) < 0.06, `seed ${seed}: ${lit / all} vs ${litDensity(seed)}`);
  }
});

test('mostly warm interiors with some cool ones', () => {
  const counts = [0, 0, 0];
  for (let c = 0; c < 80; c++) for (let r = 1; r < 31; r++) counts[windowTone(c, r, 9.5)]!++;
  assert.ok(counts[0]! > counts[1]! && counts[1]! > counts[2]! && counts[2]! > 0, counts.join(','));
});
