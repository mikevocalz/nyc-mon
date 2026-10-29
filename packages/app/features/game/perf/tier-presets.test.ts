import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  detectWorldPreset, parseWorldPreset, screenError, screenErrorDistance, screenErrorScale, worldStreamEnabled, WORLD_PRESETS,
} from './tier-presets.ts';

test('an explicit preset wins, then the high world tier, then the logical size', () => {
  assert.equal(detectWorldPreset({ width: 390, height: 844 }, 'high', false).name, 'high');
  assert.equal(detectWorldPreset({ width: 390, height: 844 }, null, true).name, 'high');
  // The 12.9" iPad's logical size; GameScreen's pixel budget draws it at 2049 x 1536, which a pixel test would call a phone.
  assert.equal(detectWorldPreset({ width: 1366, height: 1024 }, null, false).name, 'ipad-a12x');
  assert.equal(detectWorldPreset({ width: 1024, height: 1366 }, null, false).name, 'ipad-a12x');
  // iPhone 17: 402 x 874 pt.
  assert.equal(detectWorldPreset({ width: 402, height: 874 }, null, false).name, 'phone');
});

test('parseWorldPreset accepts the three names only', () => {
  assert.equal(parseWorldPreset(' iPad-A12X '), 'ipad-a12x');
  assert.equal(parseWorldPreset('phone'), 'phone');
  assert.equal(parseWorldPreset('ultra'), null);
  assert.equal(parseWorldPreset(undefined), null);
});

test("screen error follows Valdrada's err * K / max(1, dist)", () => {
  const k = screenErrorScale(2048, 50);
  assert.ok(Math.abs(k - 2048 / (2 * Math.tan((25 * Math.PI) / 180))) < 1e-9);
  assert.equal(screenError(0.25, 0.2, k), 0.25 * k, 'distance floors at 1 m');
  const d = screenErrorDistance(0.3, k, 2);
  assert.ok(Math.abs(screenError(0.3, d, k) - 2) < 1e-9);
});

test('streaming defaults on under the physical stack only; an explicit flag wins', () => {
  assert.equal(worldStreamEnabled(true, null), true);
  assert.equal(worldStreamEnabled(false, null), false);
  assert.equal(worldStreamEnabled(true, false), false);
  assert.equal(worldStreamEnabled(false, true), true);
});

test('presets keep the A12X row the tightest and every budget positive', () => {
  const a12x = WORLD_PRESETS['ipad-a12x'];
  const high = WORLD_PRESETS.high;
  assert.ok(a12x.budget.geometryBytes <= high.budget.geometryBytes && a12x.shadowTile <= high.shadowTile);
  assert.ok(a12x.bloomResolutionScale < high.bloomResolutionScale);
  for (const p of Object.values(WORLD_PRESETS)) {
    assert.ok(p.budget.geometryBytes > 0 && p.budget.cellDraws > 0 && p.budget.triangles > 0, p.name);
    assert.ok(p.hysteresis > 0 && p.hysteresis < 1, p.name);
  }
});
