import assert from 'node:assert/strict';
import test from 'node:test';
import { fourMarks, glyphPath, glyphSize, PIXEL_GLYPHS } from './pixel-glyphs.ts';
import { lcdColors, segmentDigits, segmentMask } from './lcd-model.ts';

test('every pixel glyph is rectangular and lights at least one cell', () => {
  for (const [name, bitmap] of Object.entries(PIXEL_GLYPHS)) {
    const { cols, rows } = glyphSize(bitmap);
    assert.ok(cols > 0 && rows > 0, name);
    assert.ok(glyphPath(bitmap).length > 0, name);
  }
  assert.throws(() => glyphSize(['##', '#']), RangeError);
});

test('glyph paths merge runs of lit cells per row', () => {
  assert.equal(glyphPath(['##.#']), 'M0 0h2v1h-2zM3 0h1v1h-1z');
  assert.equal(glyphPath(['...']), '');
});

test('four marks clamp, floor and survive NaN', () => {
  assert.deepEqual(fourMarks(3), [true, true, true, false]);
  assert.deepEqual(fourMarks(9), [true, true, true, true]);
  assert.deepEqual(fourMarks(-1), [false, false, false, false]);
  assert.deepEqual(fourMarks(2.9), [true, true, false, false]);
  assert.deepEqual(fourMarks(Number.NaN), [false, false, false, false]);
});

test('segment digits right-align and cap instead of wrapping', () => {
  assert.deepEqual(segmentDigits(7, 2), [' ', '7']);
  assert.deepEqual(segmentDigits(123, 2), ['9', '9']);
  assert.deepEqual(segmentDigits(-4, 2), [' ', '0']);
  assert.deepEqual(segmentMask('8'), [true, true, true, true, true, true, true]);
  assert.deepEqual(segmentMask('1'), [false, true, true, false, false, false, false]);
  assert.deepEqual(segmentMask(' '), [false, false, false, false, false, false, false]);
});

test('lights out changes the panel in both schemes, and ink never equals ground', () => {
  for (const scheme of ['daylit', 'night'] as const) {
    const on = lcdColors(scheme, false);
    const off = lcdColors(scheme, true);
    assert.notDeepEqual(on, off);
    assert.notEqual(on.ink, on.ground);
    assert.notEqual(off.ink, off.ground);
  }
});
