/**
 * 1-bit glyphs for the Mon Space LCD and the care rows: `#` is a lit cell,
 * anything else is off. Every row of a glyph has the same width. Drawn by
 * `PixelGlyph`; the bitmaps are data so the same art can go to a canvas or a
 * shader layer later.
 */
export type PixelBitmap = readonly string[];

export const PIXEL_GLYPHS = {
  heart: [
    '.##.##.',
    '#######',
    '#######',
    '.#####.',
    '..###..',
    '...#...',
  ],
  heartEmpty: [
    '.##.##.',
    '#..#..#',
    '#.....#',
    '.#...#.',
    '..#.#..',
    '...#...',
  ],
  segmentOn: [
    '#####',
    '#####',
    '#####',
  ],
  segmentOff: [
    '#####',
    '#...#',
    '#####',
  ],
  meal: [
    '.........',
    '..#.#.#..',
    '..#.#.#..',
    '.........',
    '#########',
    '#.......#',
    '.#.....#.',
    '..#####..',
    '.........',
  ],
  snack: [
    '.........',
    '#.......#',
    '##.###.##',
    '.#######.',
    '.##.#.##.',
    '.#######.',
    '##.###.##',
    '#.......#',
    '.........',
  ],
  play: [
    '..#####..',
    '.##...##.',
    '##.#.#.##',
    '#.......#',
    '#.#...#.#',
    '#..###..#',
    '##.....##',
    '.##...##.',
    '..#####..',
  ],
  lights: [
    '...###...',
    '..#...#..',
    '.#.....#.',
    '.#.....#.',
    '.#..#..#.',
    '..#.#.#..',
    '...###...',
    '...###...',
    '....#....',
  ],
  clean: [
    '....#....',
    '....#....',
    '...###...',
    '..#####..',
    '.##.####.',
    '.#.#####.',
    '.#######.',
    '..#####..',
    '...###...',
  ],
  medicine: [
    '...###...',
    '...#.#...',
    '..#####..',
    '..#...#..',
    '..#.#.#..',
    '..##.##..',
    '..#.#.#..',
    '..#...#..',
    '..#####..',
  ],
  discipline: [
    '.#######.',
    '#.......#',
    '#...#...#',
    '#...#...#',
    '#...#...#',
    '#.......#',
    '#...#...#',
    '.###.###.',
    '....##...',
  ],
  status: [
    '.........',
    '#.......#',
    '#.....#.#',
    '#.....#.#',
    '#...#.#.#',
    '#...#.#.#',
    '#.#.#.#.#',
    '#########',
    '.........',
  ],
  pause: [
    '.##...##.',
    '.##...##.',
    '.##...##.',
    '.##...##.',
    '.##...##.',
    '.##...##.',
    '.##...##.',
  ],
  poop: [
    '....#....',
    '...##....',
    '..####...',
    '..#####..',
    '.#######.',
    '#########',
  ],
  cold: [
    '....#....',
    '.#..#..#.',
    '..#.#.#..',
    '...###...',
    '#########',
    '...###...',
    '..#.#.#..',
    '.#..#..#.',
    '....#....',
  ],
  sneeze: [
    '.#...',
    '#.#.#',
    '...#.',
    '.#...',
    '#.#.#',
  ],
  attention: [
    '.##.',
    '.##.',
    '.##.',
    '.##.',
    '....',
    '.##.',
  ],
  sleep: [
    '#####....',
    '...#.....',
    '..#..###.',
    '.#.....#.',
    '#####.#..',
    '.....###.',
  ],
} as const satisfies Record<string, PixelBitmap>;

export type PixelGlyphName = keyof typeof PIXEL_GLYPHS;

/** A glyph's size in cells. Throws on a ragged bitmap, so bad art fails the test, not the screen. */
export function glyphSize(bitmap: PixelBitmap): { readonly cols: number; readonly rows: number } {
  const cols = bitmap[0]?.length ?? 0;
  for (const row of bitmap) if (row.length !== cols) throw new RangeError(`ragged glyph row "${row}"`);
  return { cols, rows: bitmap.length };
}

/**
 * The lit cells of a glyph as one SVG path (`M x y h1 v1 h-1 z` per cell,
 * runs merged per row), in cell units. One path per glyph keeps a row of
 * icons to a handful of native nodes.
 */
export function glyphPath(bitmap: PixelBitmap): string {
  const parts: string[] = [];
  bitmap.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== '#') { x += 1; continue; }
      let end = x;
      while (end < row.length && row[end] === '#') end += 1;
      parts.push(`M${x} ${y}h${end - x}v1h${-(end - x)}z`);
      x = end;
    }
  });
  return parts.join('');
}

/** 0..4 filled marks, then empty ones, for a four-mark row (hearts, discipline). Clamped and floored. */
export function fourMarks(filled: number): readonly boolean[] {
  const n = Math.max(0, Math.min(4, Math.floor(Number.isFinite(filled) ? filled : 0)));
  return [0, 1, 2, 3].map((i) => i < n);
}
