import type { CardSliderProps } from './CardSlider.shared';
import type { CardSliderVariant } from './card-slider-native-model.ts';

/**
 * Props the native CardSlider takes on top of CardSliderProps. Names follow
 * the web fork's NeonBlade port (autoPlay, autoPlayInterval, showEdgeFades,
 * edgeFadeColor, buttonPosition) so one call site works on every platform;
 * `variant`, `snap` and `onIndexChange` belong in the shared
 * card-slider.types.ts when the web fork takes them.
 */
export interface CardSliderNativeExtras {
  /** Native carousel strategy. Default uncontained, the web layout. */
  variant?: CardSliderVariant;
  /** Snap a card at a time. Default true. */
  snap?: boolean;
  /** Fires when the slider settles on a new index: swipe, buttons, autoplay, or assistive tech. */
  onIndexChange?: (index: number) => void;
  /** Advance on a timer, with a pause/play control. Starts paused under reduced motion. Default false. */
  autoPlay?: boolean;
  /** ms between steps. Default 3000. */
  autoPlayInterval?: number;
  /** Stepped fades over the track's left and right edges. Default false. */
  showEdgeFades?: boolean;
  /** Fade colour; match the surface behind. Default the night surface. */
  edgeFadeColor?: string;
  /** sides: previous/next over the track edges. bottom: in the bar under it. Default bottom. */
  buttonPosition?: 'sides' | 'bottom';
}

export type CardSliderNativeProps = CardSliderProps & CardSliderNativeExtras;
