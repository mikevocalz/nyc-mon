import assert from 'node:assert/strict';
import test from 'node:test';
import { FONT_H, FONT_W, ICON_HEART_FULL, MENU_ICONS, fontGlyph, hasGlyph } from './lcd-glyphs.ts';
import { LCD_ICON_IDS, emptyLcdLayer, toQuarter, type LcdLayerSpec } from './lcd-layer.ts';
import {
  INK_DIM, INK_FULL, LCD_COLS, lcdLayout, lcdRows, numeralDigits, rasterizeLcdLayer, wrapCells,
} from './lcd-raster.ts';

const labels = { fullness: 'Fullness', social: 'Social', energy: 'Energy' };
const base = emptyLcdLayer(labels);
const cell = (r: { cols: number; data: Uint8Array }, x: number, y: number) => {
  const i = (y * r.cols + x) * 4;
  return { ink: r.data[i]!, glow: r.data[i + 1]!, text: r.data[i + 2]! };
};
const count = (r: { data: Uint8Array }, pred: (ink: number, glow: number, text: number) => boolean) => {
  let n = 0;
  for (let i = 0; i < r.data.length; i += 4) if (pred(r.data[i]!, r.data[i + 1]!, r.data[i + 2]!)) n++;
  return n;
};

test('every glyph row fits its width', () => {
  for (const ch of ' !"\'()+,-./0123456789:?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz') {
    assert.ok(hasGlyph(ch), ch);
    const rows = fontGlyph(ch);
    assert.equal(rows.length, FONT_H, ch);
    for (const r of rows) assert.ok(r >= 0 && r < 1 << FONT_W, ch);
  }
  assert.deepEqual(fontGlyph('~'), fontGlyph('?'));
  for (const id of LCD_ICON_IDS) {
    assert.equal(MENU_ICONS[id].length, 8, id);
    assert.ok(MENU_ICONS[id].some((r) => r !== 0), id);
  }
});

test('rows follow the aspect and stay in range', () => {
  assert.equal(lcdRows(834, 1194), Math.round((LCD_COLS * 1194) / 834));
  assert.equal(lcdRows(1194, 834), 240);
  assert.equal(lcdRows(0, 0), 275);
});

test('layout keeps every region on the LCD and in order', () => {
  for (const rows of [240, 275, 300, 360]) {
    const L = lcdLayout(rows);
    assert.ok(L.heartRows[2]! + 16 <= L.monArea.y, `hearts above the Mon at ${rows}`);
    assert.ok(L.monArea.y + L.monArea.h <= L.statusY, `Mon above status at ${rows}`);
    assert.ok(L.statusY + 32 <= L.barY, `status above the bar at ${rows}`);
    assert.ok(L.barY + 20 <= L.captionY, `bar above the caption at ${rows}`);
    assert.ok(L.captionY + FONT_H * 2 <= rows, `caption on the LCD at ${rows}`);
    assert.ok(L.sprite.x >= 0 && L.sprite.x + L.sprite.w <= L.cols);
  }
});

test('wrap breaks at words, caps the lines and splits long words', () => {
  assert.deepEqual(wrapCells('Asking for food now please', 15, 2), ['Asking for food', 'now please']);
  assert.deepEqual(wrapCells('a b c d e f g h', 3, 2), ['a b', 'c d']);
  assert.deepEqual(wrapCells('abcdefgh', 3, 3), ['abc', 'def', 'gh']);
});

test('text is drawn 2 cells per font pixel, flagged as text and never as glow', () => {
  const spec: LcdLayerSpec = { ...base, statusLine: { text: 'I' } };
  const L = lcdLayout(275);
  const r = rasterizeLcdLayer(spec, 275);
  // "I" row 0 is 0x0e: font pixels 1..3 set, so cells 2..7 from the line's x (6) are ink.
  for (let x = 6 + 2; x < 6 + 8; x++) for (let y = L.statusY; y < L.statusY + 2; y++) {
    const c = cell(r, x, y);
    assert.equal(c.ink, INK_FULL);
    assert.equal(c.text, 255);
    assert.equal(c.glow, 0);
  }
  assert.equal(cell(r, 6, L.statusY).ink, 0);
  assert.equal(count(r, (_i, g, t) => g > 0 && t > 0), 0, 'no cell is both text and glow');
});

test('hearts: lit count is filled, the rest are outlines', () => {
  const r0 = rasterizeLcdLayer({ ...base, hearts: { fullness: 0, social: 0, energy: 0 } }, 275);
  const r4 = rasterizeLcdLayer({ ...base, hearts: { fullness: 4, social: 4, energy: 4 } }, 275);
  const filled = ICON_HEART_FULL.reduce((n, row) => n + row.toString(2).split('1').length - 1, 0);
  const glow0 = count(r0, (_i, g) => g > 0);
  const glow4 = count(r4, (_i, g) => g > 0);
  assert.ok(glow4 > glow0);
  const L = lcdLayout(275);
  // Centre of the first heart in the top row: filled when lit, paper when an outline.
  const cx = L.heartsX + 6;
  const cy = L.heartRows[0]! + 6;
  assert.equal(cell(r4, cx, cy).ink, INK_FULL);
  assert.equal(cell(r0, cx, cy).ink, 0);
  assert.ok(filled > 20);
});

test('poop piles, call and cold add cells; the status page drops them', () => {
  const plain = count(rasterizeLcdLayer(base, 275), (i) => i > 0);
  let prev = plain;
  for (const n of [1, 2, 3, 4] as const) {
    const now = count(rasterizeLcdLayer({ ...base, poop: n }, 275), (i) => i > 0);
    assert.ok(now > prev, `pile ${n}`);
    prev = now;
  }
  assert.ok(count(rasterizeLcdLayer({ ...base, call: true }, 275), (i) => i > 0) > plain);
  assert.ok(count(rasterizeLcdLayer({ ...base, cold: true }, 275), (i) => i > 0) > plain);
  const statusPage = {
    disciplineLabel: 'Bounds', discipline: 2, weightLabel: 'Weight', weight: { value: 7, digits: 2 },
    ageLabel: 'Age', age: { value: 3, digits: 3 }, stage: 'Baby',
  } as const;
  const st = rasterizeLcdLayer({ ...base, page: 'status', poop: 4, call: true, statusPage }, 275);
  const stNoPiles = rasterizeLcdLayer({ ...base, page: 'status', statusPage }, 275);
  assert.deepEqual(st.data, stNoPiles.data);
});

test('focused icon is an inverted box; disabled icons are dim and never glow', () => {
  const L = lcdLayout(275);
  const r = rasterizeLcdLayer({ ...base, iconBar: { focus: 0, disabled: ['medicine'] } }, 275);
  const slot = (LCD_COLS - 4) / 9;
  const x0 = Math.round(2 + slot / 2 - 8);
  // The box's top-left corner is ink (the icon starts inside it).
  assert.equal(cell(r, x0 - 2, L.barY).ink, INK_FULL);
  const mx = Math.round(2 + slot * 5 + slot / 2 - 8);
  let dim = 0;
  for (let y = L.barY; y < L.barY + 20; y++) for (let x = mx; x < mx + 16; x++) {
    const c = cell(r, x, y);
    if (c.ink > 0) {
      assert.equal(c.ink, INK_DIM);
      assert.equal(c.glow, 0);
      dim++;
    }
  }
  assert.ok(dim > 10);
});

test('numerals clamp and pad; quarters clamp', () => {
  assert.deepEqual(numeralDigits({ value: 7, digits: 3 }), [null, null, 7]);
  assert.deepEqual(numeralDigits({ value: 12345, digits: 2 }), [9, 9]);
  assert.deepEqual(numeralDigits({ value: -3, digits: 1 }), [0]);
  assert.equal(toQuarter(9), 4);
  assert.equal(toQuarter(-1), 0);
  assert.equal(toQuarter(Number.NaN), 0);
});
