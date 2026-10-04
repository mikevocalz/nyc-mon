import type { NycCarouselProps } from './NycCarousel.types';

// Platform resolution anchor and the web build: there is no native carousel
// here, so callers render their own slider. Metro loads the .ios/.android files.
export const isNycCarouselAvailable = false;
export function NycCarousel(_props: NycCarouselProps): null {
  return null;
}
