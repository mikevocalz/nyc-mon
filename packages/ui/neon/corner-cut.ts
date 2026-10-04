/**
 * Corner-cut geometry shared by the web clip-path and the native Skia path,
 * so both platforms cut the same shape. Mirrors NeonBlade's corner-cut
 * button (`ccb-clip-*`): one corner, or `all` (top-left and bottom-right).
 */
export type CutCorner = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left' | 'all';

const cutsFor = (corner: CutCorner) => ({
  tl: corner === 'top-left' || corner === 'all',
  tr: corner === 'top-right',
  br: corner === 'bottom-right' || corner === 'all',
  bl: corner === 'bottom-left',
});

/** Polygon points, clockwise from the top-left, for a w x h box. */
export function cornerCutPolygon(width: number, height: number, cut: number, corner: CutCorner): [number, number][] {
  const c = Math.max(0, Math.min(cut, width / 2, height / 2));
  const k = cutsFor(corner);
  const points: [number, number][] = [];
  if (k.tl) points.push([0, c], [c, 0]);
  else points.push([0, 0]);
  if (k.tr) points.push([width - c, 0], [width, c]);
  else points.push([width, 0]);
  if (k.br) points.push([width, height - c], [width - c, height]);
  else points.push([width, height]);
  if (k.bl) points.push([c, height], [0, height - c]);
  else points.push([0, height]);
  return points;
}

/** The same polygon as a CSS `clip-path`, sized by the element itself. */
export function cornerCutClipPath(cut: number, corner: CutCorner): string {
  const k = cutsFor(corner);
  const c = `${cut}px`;
  const far = `calc(100% - ${c})`;
  const points: string[] = [];
  if (k.tl) points.push(`0 ${c}`, `${c} 0`);
  else points.push('0 0');
  if (k.tr) points.push(`${far} 0`, `100% ${c}`);
  else points.push('100% 0');
  if (k.br) points.push(`100% ${far}`, `${far} 100%`);
  else points.push('100% 100%');
  if (k.bl) points.push(`${c} 100%`, `0 ${far}`);
  else points.push('0 100%');
  return `polygon(${points.join(', ')})`;
}

/**
 * Cut length for a shape inset by `inset` px, so a border drawn as an outer
 * shape over an inner one keeps an even width along the diagonal.
 */
export function insetCut(cut: number, inset: number): number {
  return Math.max(0, cut - inset * (Math.SQRT2 - 1));
}

/** px for the opt-in `rounded` prop: the theme's `rounded-soft` step (0.625rem). */
export const ROUND_RADIUS = 10;
