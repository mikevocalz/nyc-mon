import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ADVANCE, ATLAS_HEIGHT, ATLAS_WIDTH, atlasPixels, GLYPH_HEIGHT, GLYPH_ORDER, GLYPH_WIDTH, GLYPHS, glyphUv, layoutText, SPACE_ADVANCE } from './pixel-font.ts';

test('every glyph is 5 x 7 and the street-name alphabet is covered', () => {
  for (const [ch, rows] of Object.entries(GLYPHS)) {
    assert.equal(rows.length, GLYPH_HEIGHT, ch);
    for (const row of rows) assert.match(row, /^[#.]{5}$/, ch);
  }
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-&') assert.ok(GLYPHS[ch], ch);
});

test('the atlas holds each glyph pixel for pixel inside its cell', () => {
  const pixels = atlasPixels();
  assert.equal(pixels.length, ATLAS_WIDTH * ATLAS_HEIGHT * 4);
  const lit = (x: number, y: number) => pixels[(y * ATLAS_WIDTH + x) * 4 + 3] === 255;
  GLYPH_ORDER.forEach((ch, index) => {
    const { u0, v0, u1, v1 } = glyphUv(index);
    assert.ok(u0 >= 0 && u1 <= 1 && v0 >= 0 && v1 <= 1 && u1 > u0 && v1 > v0);
    const ox = Math.round(u0 * ATLAS_WIDTH);
    const oy = Math.round(v0 * ATLAS_HEIGHT);
    assert.equal(Math.round(u1 * ATLAS_WIDTH) - ox, GLYPH_WIDTH);
    GLYPHS[ch]!.forEach((row, y) => {
      for (let x = 0; x < GLYPH_WIDTH; x++) assert.equal(lit(ox + x, oy + y), row[x] === '#', `${ch} ${x},${y}`);
    });
    // The column left of the glyph is a clear border, so neighbours never bleed in.
    for (let y = 0; y < GLYPH_HEIGHT; y++) assert.equal(lit(ox - 1, oy + y), false);
  });
});

test('layout advances by letter and space, upper-cases, and measures to the last ink', () => {
  const { glyphs, width } = layoutText('w 125');
  assert.deepEqual(glyphs.map((g) => GLYPH_ORDER[g.index]), ['W', '1', '2', '5']);
  assert.deepEqual(glyphs.map((g) => g.x), [0, ADVANCE + SPACE_ADVANCE, 2 * ADVANCE + SPACE_ADVANCE, 3 * ADVANCE + SPACE_ADVANCE]);
  assert.equal(width, 3 * ADVANCE + SPACE_ADVANCE + GLYPH_WIDTH);
});
