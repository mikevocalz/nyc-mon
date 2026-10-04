/**
 * A chunky 3x5 pixel font for street-sign glyphs and route bullets.
 *
 * Each glyph is 15 bits, row-major from the top-left pixel (bit 0) to the
 * bottom-right (bit 14). The GPU shader tests bits with float maths; the Skia
 * fallback expands them into rectangles with `glyphPixels`.
 */
const ROWS: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010',
  '8': '111101111101111', '9': '111101111001110',
  '-': '000000111000000', '.': '000000000000010', '/': '001001010100100', '#': '101111101111101',
  '+': '000010111010000', '=': '000111000111000', '>': '100010001010100', '<': '001010100010001',
  '^': '010101000000000', ':': '000010000010000', '*': '101010101000000', '&': '010101010101011',
  '@': '111101111100011', '!': '010010010000010', '?': '110001010000010', '|': '010010010010010',
};

const MASKS = new Map<string, number>();
for (const [char, bits] of Object.entries(ROWS)) {
  let mask = 0;
  for (let i = 0; i < 15; i++) if (bits[i] === '1') mask += 2 ** i;
  MASKS.set(char, mask);
}

/** Bit mask for a character; lower case folds to upper; unknown characters get a solid block. */
export function glyphMask(char: string): number {
  if (char === ' ') return 0;
  return MASKS.get(char.toUpperCase()) ?? 0b111111111111111;
}

/** The characters a string can show, as masks; spaces and duplicates dropped. */
export function glyphPool(text: string): number[] {
  const pool = [...new Set([...text].filter((c) => c.trim()))].map(glyphMask);
  return pool.length ? pool : [glyphMask('#')];
}

/** Lit pixels of a mask as (col, row) pairs, for renderers without the glyph shader. */
export function glyphPixels(mask: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < 15; i++) if (Math.floor(mask / 2 ** i) % 2 === 1) out.push([i % 3, Math.floor(i / 3)]);
  return out;
}
