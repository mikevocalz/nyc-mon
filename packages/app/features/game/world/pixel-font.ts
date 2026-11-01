// A 5 x 7 capital pixel font for the street-name blades, packed at run time
// into a small DataTexture atlas, one quad per letter.
//
// Why this and not the usual options: react-native-webgpu has no DOM
// canvas, so CanvasTexture and canvas-backed SDF text (troika) cannot run
// on native, and the repo has no 3D text path to reuse. A glyph atlas
// baked into the dataset would add a bake step and an image decoder for 41
// tiny glyphs. The pixel table below is the source: `atlasPixels()` writes
// it into an RGBA byte array (as foliage.ts does for the leaf alpha), and
// each letter is one quad sampling its cell with nearest filtering, so the
// lettering stays sharp. Drawing lit pixels as merged quads was tried
// first: 171 000 triangles for the tile's 218 signs, against about 17 000
// as atlas quads. Pure: node tests pin the layout and the atlas.

/** Rows top to bottom, `#` lit. Capitals, digits and the punctuation street names use. */
export const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
};

export const GLYPH_WIDTH = 5;
export const GLYPH_HEIGHT = 7;
/** Pixels from one letter's left edge to the next. */
export const ADVANCE = 6;
export const SPACE_ADVANCE = 4;
/** Atlas cells are 8 x 8 (the glyph plus a clear border so filtering never bleeds a neighbour in). */
export const CELL = 8;
export const ATLAS_COLUMNS = 8;
export const GLYPH_ORDER = Object.keys(GLYPHS);
export const ATLAS_WIDTH = CELL * ATLAS_COLUMNS;
export const ATLAS_HEIGHT = CELL * Math.ceil(GLYPH_ORDER.length / ATLAS_COLUMNS);

/** RGBA bytes, row 0 at the top (flipY off), white where a pixel is lit, alpha carrying coverage. */
export function atlasPixels(): Uint8Array {
  const out = new Uint8Array(ATLAS_WIDTH * ATLAS_HEIGHT * 4);
  GLYPH_ORDER.forEach((ch, index) => {
    const ox = (index % ATLAS_COLUMNS) * CELL + 1;
    const oy = Math.floor(index / ATLAS_COLUMNS) * CELL;
    GLYPHS[ch]!.forEach((line, row) => {
      for (let x = 0; x < GLYPH_WIDTH; x++) {
        if (line[x] !== '#') continue;
        const o = ((oy + row) * ATLAS_WIDTH + ox + x) * 4;
        out.fill(255, o, o + 4);
      }
    });
  });
  return out;
}

/** The atlas rectangle of a glyph in uv (v = 0 at the top row, since the texture is not flipped). */
export function glyphUv(index: number): { u0: number; v0: number; u1: number; v1: number } {
  const x = (index % ATLAS_COLUMNS) * CELL + 1;
  const y = Math.floor(index / ATLAS_COLUMNS) * CELL;
  return { u0: x / ATLAS_WIDTH, v0: y / ATLAS_HEIGHT, u1: (x + GLYPH_WIDTH) / ATLAS_WIDTH, v1: (y + GLYPH_HEIGHT) / ATLAS_HEIGHT };
}

/** A placed letter: its atlas index and its left edge in pixels from the start of the text. */
export interface PlacedGlyph { index: number; x: number }

/** Lay out `text` (capitals; unknown characters become spaces). Width is in pixels. */
export function layoutText(text: string): { glyphs: PlacedGlyph[]; width: number } {
  const glyphs: PlacedGlyph[] = [];
  let pen = 0;
  const chars = [...text.toUpperCase()];
  chars.forEach((ch, i) => {
    const index = GLYPH_ORDER.indexOf(ch);
    if (index < 0) { pen += SPACE_ADVANCE; return; }
    glyphs.push({ index, x: pen });
    pen += i === chars.length - 1 ? GLYPH_WIDTH : ADVANCE;
  });
  return { glyphs, width: pen };
}
