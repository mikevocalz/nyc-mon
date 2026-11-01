// Container-local rectangle maths shared by the controller layout resolver,
// saved-position revalidation and the component. Pure: no react-native
// import, so node --test covers every fold arrangement.
//
// Coordinates are container-local layout units (dp on Android, pt on iOS).
// The caller converts window-space fold geometry once, subtracting the
// container's window origin on BOTH axes: `foldLayoutsFromRegions` in
// @acme/ui/adaptive-panes converts x only, so the host subtracts y itself
// (the GameScreen pattern).
//
// Fold policy (mikevocalz-foldable-layouts skill §4, same as the Game HUD):
// a separating fold or a fully occluding hinge splits the container into
// usable regions; a flat, non-separating, non-occluding crease does not. A
// zero-width separating fold still cuts. Every reported fold is processed, so
// a trifold yields three columns. Folds outside the container are ignored.
import type { FoldLayout } from '../../adaptive-panes/fold-layout.ts';

/** An axis-aligned rectangle in container-local layout units. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Safe-area insets the host has not already consumed, in layout units. */
export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** True when the fold creates two usable regions rather than a visual crease. */
export function foldSplits(fold: FoldLayout): boolean {
  return fold.separating || fold.occlusionType === 'full';
}

/**
 * Cut the inset container by every splitting fold. Vertical folds make
 * columns, horizontal folds make rows; the result is ordered top-to-bottom,
 * then left-to-right. An empty array means the insets consumed everything.
 *
 * @see {@linkcode foldSplits}
 */
export function usableRegions(
  width: number,
  height: number,
  insets: Insets,
  folds: readonly FoldLayout[],
): Rect[] {
  const base: Rect = {
    x: insets.left,
    y: insets.top,
    width: Math.max(0, width - insets.left - insets.right),
    height: Math.max(0, height - insets.top - insets.bottom),
  };
  const cutsX: [number, number][] = [];
  const cutsY: [number, number][] = [];
  for (const fold of folds) {
    if (!foldSplits(fold)) continue;
    if (![fold.x, fold.y, fold.width, fold.height].every(Number.isFinite)) continue;
    if (fold.orientation === 'vertical') {
      const start = fold.x;
      const end = fold.x + Math.max(0, fold.width);
      if (end < base.x || start > base.x + base.width) continue;
      cutsX.push([start, end]);
    } else {
      const start = fold.y;
      const end = fold.y + Math.max(0, fold.height);
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

const EPSILON = 1e-6;

/** True when `rect` lies wholly inside one of `regions`. Test helper and dev assertion. */
export function insideOneRegion(rect: Rect, regions: readonly Rect[]): boolean {
  return regions.some(
    (r) =>
      rect.x >= r.x - EPSILON &&
      rect.y >= r.y - EPSILON &&
      rect.x + rect.width <= r.x + r.width + EPSILON &&
      rect.y + rect.height <= r.y + r.height + EPSILON,
  );
}

/** True when the two rectangles share positive area. Touching edges do not intersect. */
export function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function centreDistance(a: Rect, b: Rect): number {
  const dx = a.x + a.width / 2 - (b.x + b.width / 2);
  const dy = a.y + a.height / 2 - (b.y + b.height / 2);
  return Math.hypot(dx, dy);
}

/**
 * The region a rect belongs to: the one it overlaps most, or the nearest by
 * centre when it overlaps none (a saved position dragged off-screen). `null`
 * only when there are no regions at all.
 */
export function regionFor(rect: Rect, regions: readonly Rect[]): Rect | null {
  let best: Rect | null = null;
  let bestArea = 0;
  for (const region of regions) {
    const area = overlapArea(rect, region);
    if (area > bestArea) {
      best = region;
      bestArea = area;
    }
  }
  if (best) return best;
  for (const region of regions) {
    if (!best || centreDistance(rect, region) < centreDistance(rect, best)) best = region;
  }
  return best;
}

/**
 * Pull `rect` inside `region` leaving `margin` on every side. A rect larger
 * than the room shrinks to the room (never below zero) so it can never poke
 * into an inset or across a fold.
 */
export function clampIntoRegion(rect: Rect, region: Rect, margin: number): Rect {
  const roomW = Math.max(0, region.width - 2 * margin);
  const roomH = Math.max(0, region.height - 2 * margin);
  const width = Math.min(rect.width, roomW);
  const height = Math.min(rect.height, roomH);
  const minX = region.x + margin;
  const minY = region.y + margin;
  const maxX = region.x + region.width - margin - width;
  const maxY = region.y + region.height - margin - height;
  return {
    x: Math.min(Math.max(rect.x, minX), Math.max(minX, maxX)),
    y: Math.min(Math.max(rect.y, minY), Math.max(minY, maxY)),
    width,
    height,
  };
}

/**
 * The largest axis-aligned rectangle inside `region` that keeps `gap` clear of
 * every obstacle. Candidates are bounded by the region and obstacle edges, so
 * the search is exact for the handful of rects a controller has. Returns a
 * zero-area rect at the region's centre when nothing is clear.
 */
export function largestClearRect(region: Rect, obstacles: readonly Rect[], gap: number): Rect {
  const padded = obstacles
    .filter((o) => intersects(o, region))
    .map((o) => ({ x: o.x - gap, y: o.y - gap, width: o.width + 2 * gap, height: o.height + 2 * gap }));
  const xs = new Set<number>([region.x, region.x + region.width]);
  const ys = new Set<number>([region.y, region.y + region.height]);
  for (const o of padded) {
    for (const x of [o.x, o.x + o.width]) if (x > region.x && x < region.x + region.width) xs.add(x);
    for (const y of [o.y, o.y + o.height]) if (y > region.y && y < region.y + region.height) ys.add(y);
  }
  const xList = [...xs].sort((a, b) => a - b);
  const yList = [...ys].sort((a, b) => a - b);
  let best: Rect = { x: region.x + region.width / 2, y: region.y + region.height / 2, width: 0, height: 0 };
  let bestArea = 0;
  for (let i = 0; i < xList.length; i += 1) {
    for (let j = i + 1; j < xList.length; j += 1) {
      const x0 = xList[i];
      const x1 = xList[j];
      if (x0 === undefined || x1 === undefined) continue;
      for (let k = 0; k < yList.length; k += 1) {
        for (let l = k + 1; l < yList.length; l += 1) {
          const y0 = yList[k];
          const y1 = yList[l];
          if (y0 === undefined || y1 === undefined) continue;
          const area = (x1 - x0) * (y1 - y0);
          if (area <= bestArea) continue;
          const candidate: Rect = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
          if (padded.some((o) => intersects(o, candidate))) continue;
          best = candidate;
          bestArea = area;
        }
      }
    }
  }
  return best;
}
