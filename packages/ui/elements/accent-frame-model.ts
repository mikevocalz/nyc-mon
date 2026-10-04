/** Pure geometry for AccentFrame's corners. No React, so node:test can run it. */

export type Corner = 'tl' | 'tr' | 'br' | 'bl';
export type CornerStyle = 'setback' | 'cornice' | 'square';

/** px, or a percentage of the corner box (which grows on hover). */
export type Extent = number | `${number}%`;

export interface CornerPiece {
  /** Offset from the frame's side edge (left or right). */
  x: Extent;
  /** Offset from the frame's top or bottom edge. */
  y: Extent;
  width: Extent;
  height: Extent;
  /** face: the tone's main fill; side: its darker step; top: its lit step. */
  shade: 'face' | 'side' | 'top';
}

/**
 * The blocks that make one corner, drawn for the top-left and mirrored by
 * anchoring to bottom/right for the others. `t` is the block thickness.
 *
 * - setback: three tiers stepping inward (100%, 62%, 30% of the arm), the
 *   stepped shoulders of a Deco tower.
 * - cornice: a cap 1.75t deep with a row of dentils under it, down the side
 *   too: the brownstone roofline.
 * - square: a single solid L.
 */
export function cornerPieces(style: CornerStyle, t: number): CornerPiece[] {
  const arm = (offset: number, length: Extent, shade: CornerPiece['shade'], depth = t): CornerPiece[] => [
    { x: offset, y: offset, width: length, height: depth, shade },
    { x: offset, y: offset, width: t, height: length, shade },
  ];
  if (style === 'square') return arm(0, '100%', 'face');
  if (style === 'setback') {
    return [...arm(0, '100%', 'face'), ...arm(t, '62%', 'side'), ...arm(t * 2, '30%', 'top')];
  }
  const cap = Math.round(t * 1.75);
  const dentil = Math.max(2, Math.round(t * 0.8));
  const gap = cap + Math.max(1, Math.round(t * 0.4));
  const dentils: CornerPiece[] = [];
  for (const at of [34, 56, 78] as const) {
    dentils.push({ x: `${at}%`, y: gap, width: dentil, height: dentil, shade: 'side' });
    dentils.push({ x: t + Math.max(1, Math.round(t * 0.4)), y: `${at}%`, width: dentil, height: dentil, shade: 'side' });
  }
  return [
    { x: 0, y: 0, width: '100%', height: cap, shade: 'face' },
    { x: 0, y: 0, width: t, height: '100%', shade: 'face' },
    { x: 0, y: 0, width: cap, height: cap, shade: 'top' },
    ...dentils,
  ];
}
