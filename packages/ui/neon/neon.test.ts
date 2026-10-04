import assert from 'node:assert/strict';
import test from 'node:test';
import { brand, palette } from '@acme/theme';
import { mixColor, neonColor, parseColor, withAlpha } from './colors.ts';
import { cornerCutClipPath, cornerCutPolygon, insetCut } from './corner-cut.ts';
import { shadeSteps } from './shade.ts';

test('NeonBlade presets map onto NYC-MON tokens', () => {
  assert.equal(neonColor('cyan').base, brand.carolina);
  assert.equal(neonColor('pink').base, brand.apple);
  assert.equal(neonColor('green').base, brand.leaf);
  assert.equal(neonColor('white').base, brand.white);
  assert.equal(neonColor('orange').base, brand.orange);
});

test('default is orange with a royal glow; other tones glow in their own hue', () => {
  const d = neonColor();
  assert.equal(d.base, brand.orange);
  assert.equal(d.glow, brand.royal);
  assert.equal(neonColor('cyan').glow, brand.carolina);
  assert.equal(neonColor('pink', 'royal').glow, brand.royal);
});

test('raw CSS colours pass through', () => {
  assert.equal(neonColor('#ff4400').base, '#ff4400');
  assert.equal(neonColor('#ff4400').token, null);
});

test('parseColor handles hex, short hex, alpha hex, rgb() and rgba()', () => {
  assert.deepEqual(parseColor('#ffffff'), [1, 1, 1, 1]);
  assert.deepEqual(parseColor('#f00'), [1, 0, 0, 1]);
  assert.deepEqual(parseColor('#0000ff80').map((v) => Math.round(v * 100) / 100), [0, 0, 1, 0.5]);
  assert.deepEqual(parseColor('rgb(255, 0, 0)'), [1, 0, 0, 1]);
  assert.deepEqual(parseColor('rgba(0,0,255,0.25)'), [0, 0, 1, 0.25]);
  assert.deepEqual(parseColor('transparent'), [0, 0, 0, 0]);
  assert.deepEqual(parseColor('orange'), parseColor(brand.orange));
});

test('withAlpha and mixColor', () => {
  assert.equal(withAlpha('#FC7C00', 0.5), 'rgba(252,124,0,0.5)');
  assert.equal(mixColor('#000000', '#FFFFFF', 0.5), '#808080');
});

test('token shade steps are the palette steps the Tailwind classes use', () => {
  const s = shadeSteps('orange');
  assert.equal(s.face, palette.orange[500]);
  assert.equal(s.top, palette.orange[400]);
  assert.equal(s.side, palette.orange[700]);
  assert.equal(s.deep, palette.orange[900]);
});

test('raw colour shade steps get darker from top to shadow', () => {
  const lum = (c: string) => parseColor(c).slice(0, 3).reduce((a, b) => a + b, 0);
  const s = shadeSteps('#3366CC');
  assert.ok(lum(s.highlight) > lum(s.top));
  assert.ok(lum(s.top) > lum(s.face));
  assert.ok(lum(s.face) > lum(s.side));
  assert.ok(lum(s.side) > lum(s.deep));
  assert.ok(lum(s.deep) > lum(s.shadow));
});

test('corner cut polygon and clip-path agree on the cut corner', () => {
  assert.deepEqual(cornerCutPolygon(100, 40, 10, 'bottom-right'), [[0, 0], [100, 0], [100, 30], [90, 40], [0, 40]]);
  assert.equal(
    cornerCutClipPath(10, 'bottom-right'),
    'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)',
  );
  assert.equal(cornerCutPolygon(100, 40, 10, 'all').length, 6);
});

test('the cut never exceeds half the box, and the inset cut is shorter', () => {
  const pts = cornerCutPolygon(20, 10, 50, 'top-left');
  assert.deepEqual(pts[0], [0, 5]);
  assert.ok(insetCut(16, 2) < 16);
});
