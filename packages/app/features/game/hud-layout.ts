// Hinge-safe placement for the Game HUD over an uninterrupted world canvas.
// Pure: no react-native import, so node --test covers every fold arrangement.
//
// Policy (mikevocalz-foldable-layouts skill, sections 4 and 5):
// - The world canvas spans the whole screen container, hinge included. It is
//   one workspace; splitting it into two cameras would break PR #29's
//   "uninterrupted world canvas" rule.
// - Every HUD element lives wholly inside one usable region. No banner or
//   interactive control may straddle a separating fold or occluding hinge.
// - Separating folds (Android isSeparating, iPhone Duo active division) and
//   FULL occlusion split the container. A flat, non-separating, non-occluding
//   crease does not: no fabricated dead strip.
// - Every reported fold is processed, not only index zero (trifolds).
// - Navigation chrome is drawn by the tab layout OUTSIDE this container. The
//   hardware family picks rail vs bottom bar (adaptive-navigation); this
//   function only needs which physical edge the rail is on.
//
// The arcade controller (stick, six caps, START/STOP pill) is placed by
// `AdaptiveControlLayout` in @acme/ui/game-controls, which reuses the same
// `usableRegions` rule. Decision (2026-10-15, G01 08-handoff.md § Route):
// the old camera column and move pad are retired; this file keeps only the
// status banner and the blocking region. Map-data credits are in Settings,
// outside the gameplay HUD.
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
}

export interface GameHudLayout {
  /** Usable regions after insets and folds, physical left-to-right then top-to-bottom. */
  regions: Rect[];
  status: Rect;
  /** The one usable region a blocking state's message and action sit in; the controller's region too. */
  blocking: Rect;
}

export const HUD_MARGIN = 16;
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

  // The controller region is the lowest row (hands), on the logical trailing
  // edge unless the rail is there, then the opposite physical edge. Blocking
  // banners carry actions (Retry, Back to the Apollo), so they share it.
  const trailing: 'left' | 'right' = input.isRTL ? 'left' : 'right';
  const edge: 'left' | 'right' = input.railEdge === trailing ? (trailing === 'right' ? 'left' : 'right') : trailing;
  const bottomRow = Math.max(...all.map((r) => r.y));
  const lowest = all.filter((r) => r.y === bottomRow);
  const controlRegion = edge === 'right'
    ? lowest.reduce((a, b) => (b.x > a.x ? b : a))
    : lowest.reduce((a, b) => (b.x < a.x ? b : a));

  const statusWidth = Math.max(0, Math.min(STATUS_MAX_WIDTH, controlRegion.width - 2 * HUD_MARGIN));
  const status: Rect = {
    x: controlRegion.x + (controlRegion.width - statusWidth) / 2,
    y: controlRegion.y + HUD_MARGIN,
    width: statusWidth,
    height: Math.min(STATUS_HEIGHT, Math.max(0, controlRegion.height - 2 * HUD_MARGIN)),
  };

  return { regions, status, blocking: { ...controlRegion } };
}

/** Test helper and dev assertion: true when a rect lies wholly inside one usable region. */
export function insideOneRegion(rect: Rect, regions: readonly Rect[]): boolean {
  return regions.some((r) => rect.x >= r.x - 1e-6 && rect.y >= r.y - 1e-6
    && rect.x + rect.width <= r.x + r.width + 1e-6 && rect.y + rect.height <= r.y + r.height + 1e-6);
}
