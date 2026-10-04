/**
 * Pure paging math for CardSlider, shared by the web and native forks and
 * covered by unit tests. Ported from NeonBlade's card slider (getVisible,
 * maxIndex, page and progress maths).
 */
export type VisibleCount = number | { sm?: number; md?: number; lg?: number; xl?: number };

/** Cards visible at once for a container width. Breakpoints match Tailwind's md/lg/xl. */
export function visibleFor(containerWidth: number, vc: VisibleCount): number {
  if (typeof vc === 'number') return Math.max(1, Math.floor(vc));
  const { sm = 1, md, lg, xl } = vc;
  if (xl !== undefined && containerWidth >= 1280) return Math.max(1, xl);
  if (lg !== undefined && containerWidth >= 1024) return Math.max(1, lg);
  if (md !== undefined && containerWidth >= 768) return Math.max(1, md);
  return Math.max(1, sm);
}

export interface SliderMetrics {
  visible: number;
  /** Width of one card, px. */
  itemWidth: number;
  /** Distance between card starts (card + gap), the snap interval. */
  stride: number;
  /** Last index a card can start the viewport at. */
  maxIndex: number;
}

export function sliderMetrics(containerWidth: number, count: number, vc: VisibleCount, gap: number): SliderMetrics {
  const visible = Math.min(visibleFor(containerWidth, vc), Math.max(1, count));
  const itemWidth = Math.max(0, (containerWidth - gap * (visible - 1)) / visible);
  return { visible, itemWidth, stride: itemWidth + gap, maxIndex: Math.max(0, count - visible) };
}

/** Index for a scroll offset, rounded to the nearest snap point. */
export function indexAtOffset(offset: number, stride: number, maxIndex: number): number {
  if (stride <= 0) return 0;
  return clampIndex(Math.round(offset / stride), maxIndex);
}

export function clampIndex(index: number, maxIndex: number): number {
  return Math.max(0, Math.min(maxIndex, index));
}

/**
 * Where a step lands. Without loop it stops at the ends; with loop, stepping
 * past the last start wraps to 0 and stepping back from 0 wraps to the end.
 */
export function stepIndex(index: number, delta: number, maxIndex: number, loop: boolean): number {
  const next = index + delta;
  if (loop && maxIndex > 0) {
    if (next > maxIndex) return 0;
    if (next < 0) return maxIndex;
  }
  return clampIndex(next, maxIndex);
}

/** Keyboard map for the carousel region: arrows step, Home and End jump. */
export function indexForKey(key: string, index: number, maxIndex: number, loop: boolean): number | null {
  switch (key) {
    case 'ArrowRight': return stepIndex(index, 1, maxIndex, loop);
    case 'ArrowLeft': return stepIndex(index, -1, maxIndex, loop);
    case 'Home': return 0;
    case 'End': return maxIndex;
    default: return null;
  }
}

/** 0 to 1 along the track, for the progress bar. A slider that fits on one page is full. */
export function progressOf(index: number, maxIndex: number): number {
  return maxIndex > 0 ? index / maxIndex : 1;
}

export const pad2 = (n: number) => String(n).padStart(2, '0');
