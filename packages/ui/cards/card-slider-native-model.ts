/**
 * Pure maths for the native CardSlider (CardSlider.native.tsx): how each
 * native carousel strategy maps onto the slider's index, and each card's
 * spoken label. Covered by card-slider-native-model.test.ts.
 */
import { sliderMetrics, type VisibleCount } from './card-slider-model.ts';

/**
 * Native carousel strategy, after Material 3's carousels.
 * - uncontained: `visibleCount` equal cards, the web slider's layout. Default.
 * - hero: one centred card between two peeking neighbours.
 * - multiBrowse: a large leading card with smaller ones trailing.
 */
export type CardSliderVariant = 'uncontained' | 'hero' | 'multiBrowse';

export interface NativeSliderLayout {
  /** Cards that count as on screen, for the spoken status and the counter. */
  visible: number;
  /** Last index the carousel can settle on. */
  maxIndex: number;
  /** uncontained: each card's width. multiBrowse: the large card's width. px. */
  itemWidth: number;
  /** Snap interval for the React Native list fallback. */
  stride: number;
}

/** Share of the track the multi-browse large card takes. */
export const MULTI_BROWSE_SHARE = 0.68;

export function nativeSliderLayout(
  variant: CardSliderVariant, width: number, count: number, vc: VisibleCount, gap: number,
): NativeSliderLayout {
  if (variant === 'uncontained') {
    const m = sliderMetrics(width, count, vc, gap);
    return { visible: m.visible, maxIndex: m.maxIndex, itemWidth: m.itemWidth, stride: m.stride };
  }
  // Hero and multi-browse settle on every card, one focused card at a time.
  const itemWidth = variant === 'multiBrowse' ? Math.round(width * MULTI_BROWSE_SHARE) : width;
  return { visible: 1, maxIndex: Math.max(0, count - 1), itemWidth, stride: itemWidth + gap };
}


/** Spoken name for each card. */
export function slideLabels(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Card ${i + 1} of ${count}`);
}
