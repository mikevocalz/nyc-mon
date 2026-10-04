import assert from 'node:assert/strict';
import test from 'node:test';
import { brand, palette } from '@acme/theme';
import {
  clampIndex, indexAtOffset, indexForKey, pad2, progressOf, sliderMetrics, stepIndex, visibleFor,
} from './card-slider-model.ts';
import { DEFAULT_NOTCH, insetNotch, notchClipPath, notchPolygon } from './notch.ts';
import { DISTRICT_TONE, TONE_CLASSES, resolveTone, toneHex, toneVariants } from './tones.ts';

test('district picks the tone unless a tone is passed', () => {
  assert.equal(resolveTone(undefined, 'harlem'), 'brick');
  assert.equal(resolveTone(undefined, 'downtown'), 'royal');
  assert.equal(resolveTone('leaf', 'harlem'), 'leaf');
  assert.equal(resolveTone(), 'orange');
  assert.deepEqual(Object.keys(DISTRICT_TONE).sort(), ['downtown', 'harlem', 'megacity', 'midtown']);
});

test('tone hex values are the palette steps the classes use', () => {
  assert.equal(toneHex('orange').face, palette.orange[500]);
  assert.equal(toneHex('orange').plate, palette.orange[700]);
  assert.equal(toneHex('orange').glow, brand.royal);
  assert.equal(toneHex('brick').face, palette.orange[800]);
  assert.equal(toneHex('brick').glow, brand.apple);
  assert.equal(toneHex('royal').on, brand.white);
  assert.equal(toneHex('carolina').on, brand.night);
});

test('every tone has every class role, and toneVariants maps them all', () => {
  for (const classes of Object.values(TONE_CLASSES)) {
    for (const value of Object.values(classes)) assert.ok(typeof value === 'string' && value.length > 0);
  }
  const v = toneVariants((c) => c.face);
  assert.equal(v.royal, 'bg-royal-500');
  assert.equal(Object.keys(v).length, 6);
});

test('notch polygon cuts a trapezoid out of the requested sides only', () => {
  const shape = { sides: ['top'] as const, size: 10, width: 40, widthV: 20, skew: 5 };
  assert.deepEqual(notchPolygon(200, 100, shape), [
    [0, 0], [75, 0], [80, 10], [120, 10], [125, 0], [200, 0], [200, 100], [0, 100],
  ]);
  const all = notchPolygon(200, 100, { ...shape, sides: ['top', 'right', 'bottom', 'left'] });
  assert.equal(all.length, 4 + 16);
  assert.deepEqual(all[6], [200, 35]);
});

test('notch never digs past half the box, and the inset notch is shallower', () => {
  const pts = notchPolygon(30, 12, { ...DEFAULT_NOTCH, size: 40 });
  assert.ok(pts.every(([, y]) => y <= 6 || y === 12));
  assert.equal(insetNotch(DEFAULT_NOTCH, 3).size, DEFAULT_NOTCH.size - 3);
  assert.equal(insetNotch(DEFAULT_NOTCH, 99).size, 0);
});

test('notch clip-path matches the px polygon order', () => {
  assert.equal(
    notchClipPath({ sides: ['top'], size: 10, width: 40, widthV: 20, skew: 5 }),
    'polygon(0 0, calc(50% - 25px) 0, calc(50% - 20px) 10px, calc(50% + 20px) 10px, calc(50% + 25px) 0, 100% 0, 100% 100%, 0 100%)',
  );
});

test('visible count follows the breakpoints', () => {
  const vc = { sm: 1, md: 2, xl: 4 };
  assert.equal(visibleFor(390, vc), 1);
  assert.equal(visibleFor(800, vc), 2);
  assert.equal(visibleFor(1100, vc), 2);
  assert.equal(visibleFor(1280, vc), 4);
  assert.equal(visibleFor(500, 0), 1);
});

test('slider metrics: card width, stride and the last start index', () => {
  const m = sliderMetrics(1000, 6, 3, 20);
  assert.equal(m.visible, 3);
  assert.equal(m.itemWidth, 320);
  assert.equal(m.stride, 340);
  assert.equal(m.maxIndex, 3);
  assert.equal(sliderMetrics(1000, 2, 3, 20).visible, 2);
});

test('offsets snap to the nearest card and clamp to the track', () => {
  assert.equal(indexAtOffset(0, 340, 3), 0);
  assert.equal(indexAtOffset(500, 340, 3), 1);
  assert.equal(indexAtOffset(9999, 340, 3), 3);
  assert.equal(indexAtOffset(10, 0, 3), 0);
  assert.equal(clampIndex(-2, 3), 0);
});

test('stepping stops at the ends unless loop is on', () => {
  assert.equal(stepIndex(3, 1, 3, false), 3);
  assert.equal(stepIndex(3, 1, 3, true), 0);
  assert.equal(stepIndex(0, -1, 3, true), 3);
  assert.equal(stepIndex(0, -1, 0, true), 0);
});

test('keyboard: arrows step, Home and End jump, other keys pass through', () => {
  assert.equal(indexForKey('ArrowRight', 1, 3, false), 2);
  assert.equal(indexForKey('ArrowLeft', 0, 3, false), 0);
  assert.equal(indexForKey('End', 0, 3, false), 3);
  assert.equal(indexForKey('Home', 2, 3, false), 0);
  assert.equal(indexForKey('Tab', 2, 3, false), null);
});

test('progress and counter', () => {
  assert.equal(progressOf(0, 3), 0);
  assert.equal(progressOf(3, 3), 1);
  assert.equal(progressOf(0, 0), 1);
  assert.equal(pad2(7), '07');
});
