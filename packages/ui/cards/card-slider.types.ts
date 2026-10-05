import type { ReactNode } from 'react';
import type { CutCorner } from '../neon/corner-cut';
import type { VisibleCount } from './card-slider-model';
import type { ControlTone, District } from './tones';

/**
 * CardSlider's public API, shared by every implementation: web
 * (CardSlider.web.tsx) and the native carousels. Port of NeonBlade's
 * card-slider props, with NYC-MON tones and districts.
 */
export type CardSliderProgressStyle = 'bar' | 'dots' | 'counter';
/** Where {@linkcode SliderControls} sits relative to the slide content. */
export type CardSliderProgressPosition = 'inset' | 'below-content';
/** sides: over the left and right edges of the track. bottom: in the bar under it, either side of the progress. */
export type CardSliderButtonPosition = 'sides' | 'bottom';
/** always, or only while the slider is hovered or has keyboard focus. */
export type CardSliderButtonVisibility = 'always' | 'hover';
/** frame: an L bracket on each card corner. plus: a small plus on each corner. */
export type CardSliderCornerAccentStyle = 'frame' | 'plus';
/** Which corner of a navigation button is cut. */
export type ButtonCorner = Exclude<CutCorner, 'all'>;

export interface CardSliderProps {
  /** Slides: kit Cards or anything else. Each becomes one snap stop. */
  children: ReactNode;
  /** Names the carousel for screen readers, e.g. "Featured blocks". */
  label: string;
  /**
   * Controlled slide index. When set, the track scrolls only when this prop
   * changes; buttons, keys, swipes and autoplay report the requested index
   * through {@linkcode onIndexChange} instead of moving the slider themselves.
   */
  index?: number;
  /**
   * Fires when the slider settles on a new index — swipe, buttons, keyboard,
   * autoplay or assistive tech. When {@linkcode index} is controlled it fires
   * on every request and the parent owns the value.
   */
  onIndexChange?: (index: number) => void;
  /** Cards visible at once: a number, or per breakpoint `{ sm, md, lg, xl }`. Default 1. */
  visibleCount?: VisibleCount;
  /** Gap between cards, px. Default 16. */
  gap?: number;
  /** Previous and next buttons. Default true. */
  showButtons?: boolean;
  showProgress?: boolean;
  /** bar: a solid fill; dots: one tile per stop; counter: 02 / 06. Default bar. */
  progressStyle?: CardSliderProgressStyle;
  /** Keep controls inset with the track, or place them below the slide content. Default inset. */
  progressPosition?: CardSliderProgressPosition;
  /** Stepping past the last card wraps to the first. Default false. */
  loop?: boolean;
  /** Where previous and next sit. Default sides. */
  buttonPosition?: CardSliderButtonPosition;
  /** Show the buttons always, or on hover and keyboard focus. Default always. */
  buttonVisibility?: CardSliderButtonVisibility;
  /** Cut corner of the previous button. Default bottom-left. */
  prevButtonCorner?: ButtonCorner;
  /** Cut corner of the next button. Default bottom-right. */
  nextButtonCorner?: ButtonCorner;
  /** Mouse drag on web (touch swipe is always on). Default true. */
  enableSwipe?: boolean;
  /** Drag distance, px, that moves to the next card. Default 50. */
  swipeThreshold?: number;
  /**
   * Advance on a timer. A play/pause control appears in the bar, and the
   * timer also holds while the slider is hovered or focused. Under reduced
   * motion it starts paused. Default false.
   */
  autoPlay?: boolean;
  /** ms between steps. Default 3000. */
  autoPlayInterval?: number;
  /** Stepped night fades over the left and right edges. Default false. */
  showEdgeFades?: boolean;
  /** Fade colour, any CSS colour; match the page behind. Default the night surface. */
  edgeFadeColor?: string;
  /** Brackets on each card corner in the tone. Default false. */
  showCornerAccents?: boolean;
  cornerAccentStyle?: CardSliderCornerAccentStyle;
  /** Venetian-blind lines over the track (NeonBlade's scan lines). Default false. */
  scanLines?: boolean;
  /** Classes for the track viewport. */
  viewportClassName?: string;
  tone?: ControlTone;
  district?: District;
  className?: string;
  /** Classes for each slide wrapper. */
  itemClassName?: string;
}

/**
 * A static image as the bundler hands it over: a URL string (Vite, or a
 * remote URL), StaticImageData (Next) or an asset id number (Metro).
 */
export type CardSliderImageSource = string | number | { src: string; width?: number; height?: number };

/** Frame drawn around an image slide, the same shapes as the Card variants. */
export type CardSliderImageFrame = 'notch' | 'cornerCut' | 'beam';
/** Photo box ratio: wide 16:9 (4:3 below md), classic 4:3, tall 4:5. Fixed, so slides never shift as photos load. */
export type CardSliderImageAspect = 'wide' | 'classic' | 'tall';

/**
 * One image slide's data: a photo with a title band. Shared by the web and
 * native sliders, so every platform renders the same item from the same
 * record.
 */
export interface CardSliderImageItemData {
  /** Stable key. */
  id: string;
  image: {
    source: CardSliderImageSource;
    /** What the photo shows, read by screen readers. */
    alt: string;
    /** Tiny data URL shown blurred until the photo loads. */
    blurDataURL?: string;
  };
  /** Band headline, e.g. the landmark. */
  title: string;
  /** Second band line, e.g. the street. */
  subtitle?: string;
  /** A short reading on the right of the band, e.g. "Crews 4". */
  meta?: string;
  /** Picks the band and chip tone, and the chip label. */
  district: District;
  /** Overrides the district's tone. */
  tone?: ControlTone;
  /** Chip text. Default the district name. */
  chip?: string;
}
