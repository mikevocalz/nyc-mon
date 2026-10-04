/**
 * Notch geometry for `<Card variant="notch">`, a port of NeonBlade's notch
 * card clip path. A notch is a trapezoid bitten out of the middle of a side:
 * `size` deep, `width` across its floor, with `skew` px of slope each side.
 *
 * The polygon walks clockwise: the top edge left to right, the right edge top
 * to bottom, the bottom edge right to left, the left edge bottom to top.
 * `notchPolygon` gives px points for Skia; `notchClipPath` gives the same
 * shape as a CSS clip-path sized by the element itself.
 */
export type NotchSide = 'top' | 'right' | 'bottom' | 'left';

export interface NotchShape {
  sides: readonly NotchSide[];
  /** Depth of the notch, px. */
  size: number;
  /** Floor width of notches on the top and bottom edges, px. */
  width: number;
  /** Floor width of notches on the left and right edges, px. */
  widthV: number;
  /** Extra width of the notch mouth on each side, px. 0 is a square notch. */
  skew: number;
}

export const DEFAULT_NOTCH: NotchShape = { sides: ['top'], size: 10, width: 72, widthV: 40, skew: 10 };

/** The shape inset by `inset` px, for the face drawn inside a border. */
export function insetNotch(shape: NotchShape, inset: number): NotchShape {
  return { ...shape, size: Math.max(0, shape.size - inset) };
}

type Pt = [number, number];

/** Px polygon for a w x h box. Notches are clamped so they fit the side. */
export function notchPolygon(w: number, h: number, shape: NotchShape): Pt[] {
  const d = Math.max(0, Math.min(shape.size, w / 2, h / 2));
  const wH = Math.min(shape.width, w);
  const wV = Math.min(shape.widthV, h);
  const halfH = Math.min(wH / 2 + shape.skew, w / 2);
  const halfV = Math.min(wV / 2 + shape.skew, h / 2);
  const has = (s: NotchSide) => shape.sides.includes(s);
  const cx = w / 2;
  const cy = h / 2;
  const pts: Pt[] = [[0, 0]];
  if (has('top') && d > 0) pts.push([cx - halfH, 0], [cx - wH / 2, d], [cx + wH / 2, d], [cx + halfH, 0]);
  pts.push([w, 0]);
  if (has('right') && d > 0) pts.push([w, cy - halfV], [w - d, cy - wV / 2], [w - d, cy + wV / 2], [w, cy + halfV]);
  pts.push([w, h]);
  if (has('bottom') && d > 0) pts.push([cx + halfH, h], [cx + wH / 2, h - d], [cx - wH / 2, h - d], [cx - halfH, h]);
  pts.push([0, h]);
  if (has('left') && d > 0) pts.push([0, cy + halfV], [d, cy + wV / 2], [d, cy - wV / 2], [0, cy - halfV]);
  return pts;
}

/** The same polygon as a CSS clip-path, unclamped (CSS has no layout size here). */
export function notchClipPath(shape: NotchShape): string {
  const { size: d, width: wH, widthV: wV, skew } = shape;
  const halfH = wH / 2 + skew;
  const halfV = wV / 2 + skew;
  const has = (s: NotchSide) => shape.sides.includes(s);
  const pts: string[] = ['0 0'];
  if (has('top') && d > 0) {
    pts.push(`calc(50% - ${halfH}px) 0`, `calc(50% - ${wH / 2}px) ${d}px`, `calc(50% + ${wH / 2}px) ${d}px`, `calc(50% + ${halfH}px) 0`);
  }
  pts.push('100% 0');
  if (has('right') && d > 0) {
    pts.push(
      `100% calc(50% - ${halfV}px)`, `calc(100% - ${d}px) calc(50% - ${wV / 2}px)`,
      `calc(100% - ${d}px) calc(50% + ${wV / 2}px)`, `100% calc(50% + ${halfV}px)`,
    );
  }
  pts.push('100% 100%');
  if (has('bottom') && d > 0) {
    pts.push(
      `calc(50% + ${halfH}px) 100%`, `calc(50% + ${wH / 2}px) calc(100% - ${d}px)`,
      `calc(50% - ${wH / 2}px) calc(100% - ${d}px)`, `calc(50% - ${halfH}px) 100%`,
    );
  }
  pts.push('0 100%');
  if (has('left') && d > 0) {
    pts.push(`0 calc(50% + ${halfV}px)`, `${d}px calc(50% + ${wV / 2}px)`, `${d}px calc(50% - ${wV / 2}px)`, `0 calc(50% - ${halfV}px)`);
  }
  return `polygon(${pts.join(', ')})`;
}
