import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DSTS_DEFAULT_RIG } from '@acme/ui/three/cel';
import { atLuminanceOf, cityCelRig, KEY_LEVEL } from './cel-rig.ts';
import { CITY_COLORS, hexToRgb } from './palette.ts';

const luminance = (c: readonly number[]) => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('palette hues at the studio rig levels: key scaled by KEY_LEVEL, fills at the rig', () => {
  const rig = cityCelRig([-0.45, 0.78, 0.43]);
  close(luminance(rig.key.color), luminance(DSTS_DEFAULT_RIG.key.color) * KEY_LEVEL);
  close(luminance(rig.fill1.color), luminance(DSTS_DEFAULT_RIG.fill1.color));
  close(luminance(rig.fill2.color), luminance(DSTS_DEFAULT_RIG.fill2.color));
  // Hue comes from the palette: the key keeps the sun token's channel ratios.
  const sun = hexToRgb(CITY_COLORS.sun);
  close(rig.key.color[2] / rig.key.color[0], sun[2] / sun[0]);
  // The cool fill ramp reads bluer than red.
  assert.ok(rig.cool[2] > rig.cool[0]);
});

test('ramp edges ascend inside the u range, bands ascend, and the key follows the sun', () => {
  const rig = cityCelRig([0, 1, 0]);
  assert.ok(rig.ramp[0] < rig.ramp[1] && rig.ramp[0] > 0 && rig.ramp[1] < 1);
  assert.ok(rig.bands[0] < rig.bands[1] && rig.bands[1] < rig.bands[2]);
  assert.deepEqual(rig.key.dir.map((v) => Math.round(v * 1e6) / 1e6), [0, 1, 0]);
  assert.equal(rig.sh.length, 9);
});

test('atLuminanceOf keeps hue and hits the reference level', () => {
  const out = atLuminanceOf([0.2, 0.4, 0.8], [1, 1, 1], 0.5);
  close(luminance(out), 0.5);
  close(out[1] / out[0], 2);
});
