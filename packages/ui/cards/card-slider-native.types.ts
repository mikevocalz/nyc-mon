import type { CardSliderProps } from './card-slider.types';
import type { CardSliderVariant } from './card-slider-native-model.ts';

/**
 * Props the native CardSlider takes on top of the shared CardSliderProps.
 * `variant` picks a native carousel strategy; web has one layout, the
 * uncontained one. `snap` would be useful on web too, and belongs in
 * card-slider.types.ts once the web fork takes it.
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
}

export type CardSliderNativeProps = CardSliderProps & CardSliderNativeExtras;
