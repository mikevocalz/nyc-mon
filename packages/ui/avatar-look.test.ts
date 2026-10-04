import assert from 'node:assert/strict';
import test from 'node:test';
import { brand, palette } from '@acme/theme';
import { mixColor, parseColor } from './neon/colors.ts';
import {
  AVATAR_CLIP_PATH,
  AVATAR_GRADIENTS,
  avatarCut,
  avatarGradientStops,
  avatarLook,
} from './avatar-look.ts';

const luminance = (css: string) => {
  const [r, g, b] = parseColor(css).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

test('cornerCut is the default look; neon aliases it; bracket stays opt-in', () => {
  assert.equal(avatarLook(undefined), 'cornerCut');
  assert.equal(avatarLook('neon'), 'cornerCut');
  assert.equal(avatarLook('bracket'), 'bracket');
});

test('default gradient is skyline: carolina 400, royal 400, apple 300', () => {
  assert.deepEqual(avatarGradientStops(), [palette.carolina[400], palette.royal[400], palette.apple[300]]);
});

test('custom pairs resolve brand tokens and NeonBlade presets', () => {
  assert.deepEqual(avatarGradientStops(['cyan', 'royal']), [brand.carolina, brand.royal]);
  assert.deepEqual(avatarGradientStops(['#00F3FF', '#FF00FF']), ['#00F3FF', '#FF00FF']);
});

test('night initials hold 4.5:1 at every stop and midpoint of every preset', () => {
  for (const [preset, stops] of Object.entries(AVATAR_GRADIENTS)) {
    const samples = stops.flatMap((stop, i) => (i === 0 ? [stop] : [mixColor(stops[i - 1]!, stop, 0.5), stop]));
    for (const stop of samples) {
      assert.ok(contrast(brand.night, stop) >= 4.5, `${preset} at ${stop}: ${contrast(brand.night, stop).toFixed(2)}`);
    }
  }
});

test('the cut takes about a fifth of the side off the bottom-right corner', () => {
  assert.equal(AVATAR_CLIP_PATH, 'polygon(0 0, 100% 0, 100% 78%, 78% 100%, 0 100%)');
  assert.equal(avatarCut(64, 64), 14);
  assert.equal(avatarCut(32, 40), 7);
});
