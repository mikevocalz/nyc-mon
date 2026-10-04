import type { CardSliderProps } from './card-slider.types';
import type { CardSliderVariant } from './card-slider-native-model.ts';

/**
 * Props the native CardSlider takes on top of the shared CardSliderProps.
 * `variant` picks a native carousel strategy; web has one layout, the
 * uncontained one. `snap` and `onIndexChange` would be useful on web too,
 * and belong in card-slider.types.ts once the web fork takes them.
 */
export interface CardSliderNativeExtras {
  /** Native carousel strategy. Default uncontained, the web layout. */
  variant?: CardSliderVariant;
  /** Snap a card at a time. Default true. */
  snap?: boolean;
  /**
   * Cut the native carousel's mask at the bottom-right corner, this many px,
   * with a keyline in the tone. For plain slides with no frame of their own;
   * framed slides (CardSliderImageItem) already draw their shape. Default 0.
   */
  itemCut?: number;
  /** Fires when the slider settles on a new index: swipe, buttons, autoplay, or assistive tech. */
  onIndexChange?: (index: number) => void;
}

export type CardSliderNativeProps = CardSliderProps & CardSliderNativeExtras;
