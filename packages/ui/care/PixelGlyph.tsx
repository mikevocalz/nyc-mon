'use client';
import Svg, { Path } from 'react-native-svg';
import { hiddenA11y } from '../hlynk/a11y';
import { View } from '../tw';
import { glyphPath, glyphSize, PIXEL_GLYPHS, type PixelBitmap, type PixelGlyphName } from './pixel-glyphs';

export interface PixelGlyphProps {
  /** A named glyph from `PIXEL_GLYPHS`, or a bitmap of `#` cells. */
  glyph: PixelGlyphName | PixelBitmap;
  /** Points per cell. */
  cell: number;
  /** Lit-cell colour (a theme token value). */
  color: string;
  /** Unlit-cell colour; leave out for a transparent ground. Decorative, exempt from contrast. */
  unlit?: string;
  testID?: string;
}

/**
 * One 1-bit glyph drawn as square cells (a Mon Space LCD icon, a heart, a
 * poop pile). Always decorative: the control or row that holds it carries
 * the words. One SVG path for the lit cells, one for the unlit ones.
 */
export function PixelGlyph({ glyph, cell, color, unlit, testID }: PixelGlyphProps) {
  const bitmap: PixelBitmap = typeof glyph === 'string' ? PIXEL_GLYPHS[glyph] : glyph;
  const { cols, rows } = glyphSize(bitmap);
  const off = unlit === undefined ? null : bitmap.map((row) => row.replace(/[^#]/g, '+').replace(/#/g, '.').replace(/\+/g, '#'));
  return (
    <View testID={testID} {...(hiddenA11y(true) as object)} style={{ width: cols * cell, height: rows * cell }}>
      <Svg width={cols * cell} height={rows * cell} viewBox={`0 0 ${cols} ${rows}`}>
        {off !== null ? <Path d={glyphPath(off)} fill={unlit} /> : null}
        <Path d={glyphPath(bitmap)} fill={color} />
      </Svg>
    </View>
  );
}
