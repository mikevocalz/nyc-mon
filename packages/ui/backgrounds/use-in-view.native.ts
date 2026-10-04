import type { InView, InViewOptions } from './use-in-view.types';

const noop = () => undefined;

/**
 * Native screens mount their scenes with the screen and the navigator
 * unmounts them with it, so a native scene counts as near and visible.
 */
export function useInView(_options: InViewOptions = {}): InView {
  return { ref: noop, hasBeenNear: true, isVisible: true };
}
