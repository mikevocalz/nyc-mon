// Hinge-safe placement for the Game HUD over an uninterrupted world canvas.
// Pure: no react-native import, so node --test covers every fold arrangement.
//
// Policy (mikevocalz-foldable-layouts skill, sections 4 and 5):
// - The world canvas spans the whole screen container, hinge included. It is
//   one workspace; splitting it into two cameras would break PR #29's
//   "uninterrupted world canvas" rule.
// - Every HUD cluster lives wholly inside one usable region. No control,
//   banner or attribution link may straddle a separating fold or sit inside an
//   occluding hinge.
// - Separating folds (Android isSeparating, iPhone Duo active division) and
//   FULL occlusion split the container. A flat, non-separating, non-occluding
//   crease does not: no fabricated dead strip.
// - Every reported fold is processed, not only index zero (trifolds).
// - Navigation chrome is drawn by the tab layout OUTSIDE this container. The
//   hardware family picks rail vs bottom bar (separate agent's change to
//   adaptive-navigation); this function only needs which physical edge the
//   rail is on, so the camera controls can sit on the far edge from it.
//
// Coordinates: container-local layout units (dp / pt). The caller converts
// window-space fold geometry once, subtracting the container's window origin
// on BOTH axes. Note: useFoldLayouts(rowWindowX) in @acme/ui/adaptive-panes
// only converts x; horizontal (tabletop) folds keep window y, so the screen
// uses foldLayoutsFromRegions + its own y offset instead.
import type { FoldLayout } from '@acme/ui/adaptive-panes/parts';

export interface Rect { x: number; y: number; width: number; height: number }
export interface Insets { top: number; right: number; bottom: number; left: number }

export interface GameHudLayoutInput {
  width: number;
  height: number;
  /** Safe-area insets not already consumed by the tab layout. */
  insets: Insets;
  /** Folds in container-local coordinates. */
  folds: readonly FoldLayout[];
  /** Physical edge holding the navigation rail, or null for a bottom bar / none. */
  railEdge: 'left' | 'right' | null;
  isRTL: boolean;
  /** Buttons in the camera column (zoom in/out, rotate left/right, compass, move toggle). */
  controlCount: number;
  /** Extra rows when the move pad is open (one 3x3 pad). */
  movePadOpen: boolean;
}

export interface GameHudLayout {
  /** Usable regions after insets and folds, physical left-to-right then top-to-bottom. */
  regions: Rect[];
  controls: Rect & { axis: 'vertical' | 'horizontal'; edge: 'left' | 'right' };
  movePad: Rect | null;
  attribution: Rect;
  status: Rect;
}

/** Kit IconButton md/lg is 44-48; reserve 48 so Android's 48dp floor fits. */
export const HUD_TARGET = 48;
export const HUD_GAP = 8;
export const HUD_MARGIN = 16;
const ATTRIBUTION_HEIGHT = 44;
const ATTRIBUTION_MAX_WIDTH = 280;
const STATUS_MAX_WIDTH = 420;
const STATUS_HEIGHT = 120;

function splits(fold: FoldLayout): boolean {
  return fold.separating || fold.occlusionType === 'full';
}

/** Cut the usable rect by every splitting fold. Vertical folds make columns, horizontal folds make rows. */
export function usableRegions(width: number, height: number, insets: Insets, folds: readonly FoldLayout[]): Rect[] {
  const base: Rect = {
    x: insets.left,
    y: insets.top,
    width: Math.max(0, width - insets.left - insets.right),
    height: Math.max(0, height - insets.top - insets.bottom),
  };
  const cutsX: [number, number][] = [];
  const cutsY: [number, number][] = [];
  for (const fold of folds) {
    if (!splits(fold)) continue;
    if (![fold.x, fold.y, fold.width, fold.height].every(Number.isFinite)) continue;
    if (fold.orientation === 'vertical') {
      const start = fold.x; const end = fold.x + Math.max(0, fold.width);
      // Ignore folds outside the container (off-row features); a zero-width fold inside still cuts.
      if (end < base.x || start > base.x + base.width) continue;
      cutsX.push([start, end]);
    } else {
      const start = fold.y; const end = fold.y + Math.max(0, fold.height);
      if (end < base.y || start > base.y + base.height) continue;
      cutsY.push([start, end]);
    }
  }
  const spans = (from: number, length: number, cuts: [number, number][]) => {
    const out: [number, number][] = [];
    let cursor = from;
    for (const [start, end] of [...cuts].sort((a, b) => a[0] - b[0])) {
      if (start > cursor) out.push([cursor, Math.min(start, from + length)]);
      cursor = Math.max(cursor, end);
    }
    if (cursor < from + length) out.push([cursor, from + length]);
    return out.filter(([a, b]) => b - a > 0);
  };
  const regions: Rect[] = [];
  for (const [y0, y1] of spans(base.y, base.height, cutsY)) {
    for (const [x0, x1] of spans(base.x, base.width, cutsX)) {
      regions.push({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
    }
  }
  return regions;
}

export function resolveGameHudLayout(input: GameHudLayoutInput): GameHudLayout {
  const regions = usableRegions(input.width, input.height, input.insets, input.folds);
  const fallback: Rect = { x: input.insets.left, y: input.insets.top, width: 0, height: 0 };
  const all = regions.length > 0 ? regions : [fallback];

  // Controls go on the logical trailing edge (thumb side in the reading
  // direction) unless the rail is there, then the opposite physical edge.
  const trailing: 'left' | 'right' = input.isRTL ? 'left' : 'right';
  const edge: 'left' | 'right' = input.railEdge === trailing ? (trailing === 'right' ? 'left' : 'right') : trailing;

  const bottomRow = Math.max(...all.map((r) => r.y));
  const lowest = all.filter((r) => r.y === bottomRow);
  const controlRegion = edge === 'right'
    ? lowest.reduce((a, b) => (b.x > a.x ? b : a))
    : lowest.reduce((a, b) => (b.x < a.x ? b : a));
  const attributionRegion = edge === 'right'
    ? lowest.reduce((a, b) => (b.x < a.x ? b : a))
    : lowest.reduce((a, b) => (b.x > a.x ? b : a));

  // Column if it fits above the attribution row; otherwise a row along the bottom.
  const count = Math.max(1, input.controlCount);
  const columnLength = count * HUD_TARGET + (count - 1) * HUD_GAP;
  const columnFits = columnLength + 2 * HUD_MARGIN + ATTRIBUTION_HEIGHT <= controlRegion.height;
  const axis: 'vertical' | 'horizontal' = columnFits ? 'vertical' : 'horizontal';
  const cw = axis === 'vertical' ? HUD_TARGET : columnLength;
  const ch = axis === 'vertical' ? columnLength : HUD_TARGET;
  const cx = edge === 'right'
    ? controlRegion.x + controlRegion.width - HUD_MARGIN - cw
    : controlRegion.x + HUD_MARGIN;
  const cy = controlRegion.y + controlRegion.height - HUD_MARGIN - ch
    - (axis === 'horizontal' && attributionRegion === controlRegion ? ATTRIBUTION_HEIGHT : 0);
  const controls = { x: cx, y: cy, width: cw, height: ch, axis, edge };

  // Move pad: 3x3 grid beside the column, inside the same region.
  const padSize = 3 * HUD_TARGET + 2 * HUD_GAP;
  let movePad: Rect | null = null;
  if (input.movePadOpen) {
    const px = edge === 'right' ? cx - HUD_GAP - padSize : cx + cw + HUD_GAP;
    const py = Math.max(controlRegion.y + HUD_MARGIN, cy + ch - padSize);
    const fits = px >= controlRegion.x && px + padSize <= controlRegion.x + controlRegion.width && py + padSize <= controlRegion.y + controlRegion.height;
    // Too narrow beside the column: stack the pad above it instead of crossing a fold.
    movePad = fits
      ? { x: px, y: py, width: padSize, height: padSize }
      : { x: edge === 'right' ? controlRegion.x + controlRegion.width - HUD_MARGIN - padSize : controlRegion.x + HUD_MARGIN,
          y: Math.max(controlRegion.y + HUD_MARGIN, cy - HUD_GAP - padSize), width: padSize, height: padSize };
  }

  const attributionWidth = Math.max(0, Math.min(ATTRIBUTION_MAX_WIDTH,
    attributionRegion.width - 2 * HUD_MARGIN - (attributionRegion === controlRegion && axis === 'vertical' ? cw + HUD_GAP : 0)));
  const attribution: Rect = {
    x: edge === 'right' ? attributionRegion.x + HUD_MARGIN : attributionRegion.x + attributionRegion.width - HUD_MARGIN - attributionWidth,
    y: attributionRegion.y + attributionRegion.height - HUD_MARGIN - ATTRIBUTION_HEIGHT,
    width: attributionWidth,
    height: ATTRIBUTION_HEIGHT,
  };

  // Status banners carry actions (Retry, Back to the Apollo), so they share
  // the controls' region: on a tabletop fold that is the lower half, where
  // hands are.
  const statusWidth = Math.max(0, Math.min(STATUS_MAX_WIDTH, controlRegion.width - 2 * HUD_MARGIN));
  const status: Rect = {
    x: controlRegion.x + (controlRegion.width - statusWidth) / 2,
    y: controlRegion.y + HUD_MARGIN,
    width: statusWidth,
    height: Math.min(STATUS_HEIGHT, Math.max(0, controlRegion.height - 2 * HUD_MARGIN)),
  };

  return { regions, controls, movePad, attribution, status };
}

/** Test helper and dev assertion: true when a rect lies wholly inside one usable region. */
export function insideOneRegion(rect: Rect, regions: readonly Rect[]): boolean {
  return regions.some((r) => rect.x >= r.x - 1e-6 && rect.y >= r.y - 1e-6
    && rect.x + rect.width <= r.x + r.width + 1e-6 && rect.y + rect.height <= r.y + r.height + 1e-6);
}
