// Pixel-font lettering as glyph quads on a vertical face: street-name
// blades, bodega signs, the Apollo marquee and blade. One quad per letter
// samples the atlas (pixel-font.ts) in `materials.lettering`; the vertex
// colour is the ink. Pure: no three import.
import type { VertexBuffer } from './geometry.ts';
import { GLYPH_HEIGHT, GLYPH_WIDTH, glyphUv, layoutText } from './pixel-font.ts';

export interface TextFace {
  /** Centre of the line of text, scene metres. */
  x: number; y: number; z: number;
  /** Unit direction the text reads along (left to right for a viewer facing the face). */
  right: readonly [number, number];
  /** Letter height, metres. */
  height: number;
  /** Horizontal scale of the letters, 1 = square pixels. */
  condense?: number;
  color: readonly number[];
}

/** Width of `text` in metres at a letter height and condense. */
export function textWidth(text: string, height: number, condense = 1): number {
  return layoutText(text).width * (height / GLYPH_HEIGHT) * condense;
}

/**
 * One line of text facing the viewer. The face normal is the reading
 * direction turned a quarter left (right x up), so a viewer in front reads
 * left to right.
 */
export function emitText(buffer: VertexBuffer, text: string, face: TextFace): void {
  const { glyphs, width } = layoutText(text);
  const px = (face.height / GLYPH_HEIGHT) * (face.condense ?? 1);
  const [rx, rz] = face.right;
  // Normal = right x up, in scene axes: (rx, 0, rz) x (0, 1, 0) = (-rz, 0, rx).
  const nx = -rz; const nz = rx;
  const sx = face.x - rx * (width * px) / 2;
  const sz = face.z - rz * (width * px) / 2;
  const yb = face.y - face.height / 2;
  const yt = face.y + face.height / 2;
  for (const glyph of glyphs) {
    const { u0, v0, u1, v1 } = glyphUv(glyph.index);
    const a0 = glyph.x * px;
    const a1 = a0 + GLYPH_WIDTH * px;
    const x0 = sx + rx * a0; const z0 = sz + rz * a0;
    const x1 = sx + rx * a1; const z1 = sz + rz * a1;
    buffer.quad([x0, yb, z0], [x1, yb, z1], [x1, yt, z1], [x0, yt, z0], [nx, 0, nz], face.color, [[u0, v1], [u1, v1], [u1, v0], [u0, v0]]);
  }
}

/** Letters stacked top to bottom (a theatre blade sign), centred on `face` (x, y, z). */
export function emitStackedText(buffer: VertexBuffer, text: string, face: TextFace, gap = 0.18): void {
  const letters = [...text];
  const step = face.height * (1 + gap);
  const top = face.y + (step * (letters.length - 1)) / 2;
  letters.forEach((ch, i) => emitText(buffer, ch, { ...face, y: top - i * step }));
}
