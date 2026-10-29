import {
  FONT_H, FONT_W, ICON_CALL, ICON_COLD, ICON_HEART_EMPTY, ICON_HEART_FULL, ICON_POOP, ICON_PX, MENU_ICONS,
  SEGMENTS, fontGlyph,
} from './lcd-glyphs.ts';
import { LCD_ICON_IDS, type LcdLayerSpec, type LcdNumeralSpec, type LcdQuarter, type LcdTextLine } from './lcd-layer.ts';

/**
 * Rasterises an {@linkcode LcdLayerSpec} into one RGBA8 texel per LCD cell.
 * The TSL material (lcd-material.ts) reads the channels:
 *
 * - R: ink, 0 (paper) to 255 (full ink). {@linkcode INK_DIM} marks unlit
 *   segments and disabled icons.
 * - G: 255 where a lit, non-text cell may bloom at night (icons, hearts,
 *   piles, glyphs, lit segments). Text runs are never in G.
 * - B: 255 on text cells. Text skips the ghosting pass and the bloom.
 *
 * Pure; no DOM and no three.js, so node tests check cells directly.
 */

/** LCD cells across. Height follows the screen's aspect (see {@linkcode lcdRows}). */
export const LCD_COLS = 192;
export const INK_FULL = 255;
/** Unlit segments (decorative) and disabled icons. */
export const INK_DIM = 64;

const M = 6;
const TEXT_SCALE = 2;
const ICON_SCALE = 2;
const CHAR_ADV = FONT_W * TEXT_SCALE + 2;
const LINE_H = FONT_H * TEXT_SCALE + 4;
const ICON_CELLS = ICON_PX * ICON_SCALE;
const HEART_ADV = ICON_CELLS + 2;

/** Rows for a screen of `width` x `height`, clamped so the layout always fits. */
export function lcdRows(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return 275;
  return Math.max(240, Math.min(360, Math.round((LCD_COLS * height) / width)));
}

export interface CellRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Where everything sits, in cells from the top-left. Shared by the raster and the material. */
export interface LcdLayout {
  readonly cols: number;
  readonly rows: number;
  /** The attention lamp, top-right of the LCD. */
  readonly led: { readonly cx: number; readonly cy: number; readonly r: number };
  readonly heartRows: readonly number[];
  readonly heartsX: number;
  /** The Mon's area between the hearts and the status line. */
  readonly monArea: CellRect;
  /** The dithered Mon sprite: a square in the middle of the Mon's area. */
  readonly sprite: CellRect;
  readonly statusY: number;
  readonly barY: number;
  readonly captionY: number;
  readonly charsPerLine: number;
}

export function lcdLayout(rows: number): LcdLayout {
  const cols = LCD_COLS;
  const heartRows = [22, 22 + ICON_CELLS + 2, 22 + 2 * (ICON_CELLS + 2)];
  const heartsX = cols - M - 4 * HEART_ADV + 2;
  const captionY = rows - M - FONT_H * TEXT_SCALE;
  const barY = captionY - 4 - (ICON_CELLS + 4);
  const statusY = barY - 4 - (2 * LINE_H - 4);
  const top = heartRows[2]! + ICON_CELLS + 4;
  const monArea = { x: M, y: top, w: cols - 2 * M, h: Math.max(16, statusY - 4 - top) };
  const side = Math.max(16, Math.min(monArea.h, cols - 2 * 44));
  const sprite = { x: Math.round((cols - side) / 2), y: monArea.y + Math.round((monArea.h - side) / 2), w: side, h: side };
  return {
    cols,
    rows,
    led: { cx: cols - M - 5, cy: 10, r: 5 },
    heartRows,
    heartsX,
    monArea,
    sprite,
    statusY,
    barY,
    captionY,
    charsPerLine: Math.floor((cols - 2 * M + 2) / CHAR_ADV),
  };
}

/** Word wrap to `max` characters a line, at most `lines` lines; overlong words break. */
export function wrapCells(text: string, max: number, lines: number): string[] {
  const out: string[] = [];
  let line = '';
  const push = (s: string) => {
    if (out.length < lines) out.push(s);
  };
  for (const raw of text.trim().split(/\s+/)) {
    let word = raw;
    while (word.length > max) {
      if (line) {
        push(line);
        line = '';
      }
      push(word.slice(0, max));
      word = word.slice(max);
    }
    const next = line ? `${line} ${word}` : word;
    if (next.length > max) {
      push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) push(line);
  return out;
}

/** One RGBA8 cell buffer. `data` is row-major from the top-left. */
export interface LcdRaster {
  readonly cols: number;
  readonly rows: number;
  readonly data: Uint8Array;
}

class Painter {
  readonly data: Uint8Array;
  readonly cols: number;
  readonly rows: number;
  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.data = new Uint8Array(cols * rows * 4);
  }
  set(x: number, y: number, ink: number, glow: boolean, text: boolean) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const i = (y * this.cols + x) * 4;
    this.data[i] = ink;
    this.data[i + 1] = glow ? 255 : 0;
    this.data[i + 2] = text ? 255 : 0;
    this.data[i + 3] = 255;
  }
  rect(x: number, y: number, w: number, h: number, ink: number, glow: boolean) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, ink, glow, false);
  }
  /**
   * A bitmap of `width`-bit rows at `scale` cells per pixel. Set pixels get
   * `ink`; unset pixels are left alone. For the inverted focus, pass ink 0
   * over a filled box: the glyph is cut out of the box as paper.
   */
  bitmap(rows: readonly number[], width: number, x: number, y: number, scale: number, ink: number, opts: { glow: boolean; text: boolean }) {
    rows.forEach((bits, r) => {
      for (let c = 0; c < width; c++) {
        if (((bits >> (width - 1 - c)) & 1) === 0) continue;
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) this.set(x + c * scale + sx, y + r * scale + sy, ink, opts.glow, opts.text);
      }
    });
  }
  text(s: string, x: number, y: number) {
    [...s].forEach((ch, i) => this.bitmap(fontGlyph(ch), FONT_W, x + i * CHAR_ADV, y, TEXT_SCALE, INK_FULL, { glow: false, text: true }));
  }
}

/** Width in cells of `s` in the LCD face. */
export const textCells = (s: string): number => (s.length === 0 ? 0 : s.length * CHAR_ADV - 2);

/** Seven-segment digit box, cells. */
export const DIGIT_W = 10;
export const DIGIT_H = 18;
const SEG = 2;

/** Digit cells for a numeral, left to right; `null` is a blank (dim-only) leading cell. */
export function numeralDigits(n: LcdNumeralSpec): (number | null)[] {
  const max = 10 ** n.digits - 1;
  const v = Math.max(0, Math.min(max, Math.floor(Number.isFinite(n.value) ? n.value : 0)));
  const s = String(v).padStart(n.digits, ' ');
  return [...s].map((c) => (c === ' ' ? null : Number(c)));
}

function digit(p: Painter, x: number, y: number, d: number | null) {
  const mid = Math.floor((DIGIT_H - SEG) / 2);
  const rects: readonly (readonly [number, number, number, number])[] = [
    [SEG, 0, DIGIT_W - 2 * SEG, SEG], // a
    [DIGIT_W - SEG, SEG, SEG, mid - SEG], // b
    [DIGIT_W - SEG, mid + SEG, SEG, DIGIT_H - mid - 2 * SEG], // c
    [SEG, DIGIT_H - SEG, DIGIT_W - 2 * SEG, SEG], // d
    [0, mid + SEG, SEG, DIGIT_H - mid - 2 * SEG], // e
    [0, SEG, SEG, mid - SEG], // f
    [SEG, mid, DIGIT_W - 2 * SEG, SEG], // g
  ];
  // Pass one: every segment dim. Pass two: the lit ones at full ink.
  for (const [rx, ry, rw, rh] of rects) p.rect(x + rx, y + ry, rw, rh, INK_DIM, false);
  if (d === null) return;
  const lit = SEGMENTS[d]!;
  rects.forEach(([rx, ry, rw, rh], i) => {
    if (lit[i]) p.rect(x + rx, y + ry, rw, rh, INK_FULL, true);
  });
}

function numeral(p: Painter, rightX: number, y: number, n: LcdNumeralSpec) {
  const ds = numeralDigits(n);
  const width = ds.length * (DIGIT_W + 3) - 3;
  ds.forEach((d, i) => digit(p, rightX - width + i * (DIGIT_W + 3), y, d));
}

function hearts(p: Painter, x: number, y: number, n: LcdQuarter) {
  for (let i = 0; i < 4; i++) {
    p.bitmap(i < n ? ICON_HEART_FULL : ICON_HEART_EMPTY, ICON_PX, x + i * HEART_ADV, y, ICON_SCALE, INK_FULL, { glow: true, text: false });
  }
}

function lines(p: Painter, line: LcdTextLine | null, x: number, y: number, max: number, cap: number) {
  if (!line) return;
  wrapCells(line.text, max, Math.min(cap, line.maxLines ?? 2)).forEach((l, i) => p.text(l, x, y + i * LINE_H));
}

/** The spec's cells for an LCD `rows` tall. */
export function rasterizeLcdLayer(spec: LcdLayerSpec, rows: number): LcdRaster {
  const L = lcdLayout(rows);
  const p = new Painter(L.cols, L.rows);
  const labelMax = Math.floor((L.heartsX - M - 4) / CHAR_ADV);

  // Heart rows: the same on both pages.
  const rowsSpec = [
    [spec.heartLabels.fullness, spec.hearts.fullness],
    [spec.heartLabels.energy, spec.hearts.energy],
    [spec.heartLabels.social, spec.hearts.social],
  ] as const;
  rowsSpec.forEach(([label, n], i) => {
    const y = L.heartRows[i]!;
    p.text(label.slice(0, labelMax), M, y + 1);
    hearts(p, L.heartsX, y, n);
  });

  if (spec.page === 'status' && spec.statusPage) {
    const s = spec.statusPage;
    const right = L.cols - M;
    let y = L.monArea.y + 2;
    p.text(s.disciplineLabel.slice(0, 9), M, y + 2);
    for (let i = 0; i < 4; i++) {
      const bx = right - (4 - i) * 15 + 3;
      if (i < s.discipline) p.rect(bx, y, 12, 18, INK_FULL, true);
      else {
        p.rect(bx, y, 12, 18, INK_DIM, false);
        p.rect(bx + 2, y + 2, 8, 14, 0, false);
      }
    }
    y += 24;
    p.text(s.weightLabel.slice(0, 9), M, y + 2);
    numeral(p, right, y, s.weight);
    y += 24;
    p.text(s.ageLabel.slice(0, 9), M, y + 2);
    numeral(p, right, y, s.age);
    y += 26;
    p.text(s.stage.slice(0, L.charsPerLine), M, y);
  } else {
    const a = L.monArea;
    const rightX = L.sprite.x + L.sprite.w + 2;
    if (spec.cold) p.bitmap(ICON_COLD, ICON_PX, a.x, a.y, ICON_SCALE, INK_FULL, { glow: true, text: false });
    if (spec.call) p.bitmap(ICON_CALL, ICON_PX, rightX, a.y, ICON_SCALE, INK_FULL, { glow: true, text: false });
    // Piles in a 2 x 2 block at the bottom-right of the Mon's area, filled bottom row first.
    for (let i = 0; i < spec.poop; i++) {
      const col = i % 2;
      const row = 1 - Math.floor(i / 2);
      p.bitmap(ICON_POOP, ICON_PX, rightX + col * (ICON_CELLS + 2), a.y + a.h - (row + 1) * (ICON_CELLS + 2), ICON_SCALE, INK_FULL, { glow: true, text: false });
    }
  }

  lines(p, spec.statusLine, M, L.statusY, L.charsPerLine, 2);

  // Icon bar: nine slots; the focused one is an inverted box.
  const slot = (L.cols - 2 * 2) / LCD_ICON_IDS.length;
  const disabled = new Set(spec.iconBar.disabled ?? []);
  LCD_ICON_IDS.forEach((id, i) => {
    const cx = 2 + slot * i + slot / 2;
    const x = Math.round(cx - ICON_CELLS / 2);
    const y = L.barY + 2;
    const off = disabled.has(id);
    if (spec.iconBar.focus === i) {
      p.rect(x - 2, y - 2, ICON_CELLS + 4, ICON_CELLS + 4, off ? INK_DIM : INK_FULL, !off);
      p.bitmap(MENU_ICONS[id], ICON_PX, x, y, ICON_SCALE, 0, { glow: false, text: false });
    } else {
      p.bitmap(MENU_ICONS[id], ICON_PX, x, y, ICON_SCALE, off ? INK_DIM : INK_FULL, { glow: !off, text: false });
    }
  });

  lines(p, spec.caption, M, L.captionY, L.charsPerLine, 1);
  return { cols: L.cols, rows: L.rows, data: p.data };
}
