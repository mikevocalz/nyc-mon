import type { ReactElement } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Layout strategy, named after Material 3's carousels so iOS and Android
 * take the same value.
 * - hero: one centred card between two peeking neighbours.
 * - multiBrowse: a large leading card, the next ones smaller after it.
 * - uncontained: `visibleCount` equal cards per page (the web slider's layout).
 */
export type NycCarouselVariant = 'hero' | 'multiBrowse' | 'uncontained';
export type NycCutCorner = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left' | 'all';

export interface NycCarouselProps {
  /** One React Native element per card. Each is hosted natively through @expo/ui's RNHostView. */
  slides: ReactElement[];
  variant?: NycCarouselVariant;
  /** Controlled index: change it to scroll the carousel there. */
  index: number;
  /** Called when the carousel settles on a card after a swipe. */
  onIndexChange?: (index: number) => void;
  /** Animate index-driven scrolls. Pass false under reduced motion. */
  animated?: boolean;
  /** Uncontained: equal cards per page. */
  visibleCount?: number;
  /** Uncontained (Android) and multi-browse: card width, dp/pt. */
  itemWidth?: number;
  /** Hero: the widest the centred card may grow. 0 fills. */
  maxItemWidth?: number;
  itemSpacing?: number;
  contentPadding?: number;
  /** Snap a card at a time. Default true. */
  snap?: boolean;
  userScrollEnabled?: boolean;
  cutCorner?: NycCutCorner;
  /** Corner cut length. 0 leaves square corners. */
  cut?: number;
  /** Keyline in the slider tone around each card's cut shape. */
  keylineColor?: string;
  keylineWidth?: number;
  /** Spoken name per card, e.g. "Card 2 of 6" (iOS). */
  itemLabels?: string[];
  style?: StyleProp<ViewStyle>;
}
