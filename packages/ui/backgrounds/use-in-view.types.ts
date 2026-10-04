/** Options for `useInView`. */
export interface InViewOptions {
  /**
   * How far outside the viewport the element counts as near, in CSS pixels.
   * A scene mounts once it comes this close, so it is drawn by the time it
   * scrolls in. Default 600.
   */
  nearMarginPx?: number;
}

/** Where an element sits relative to the viewport, as `useInView` reports it. */
export interface InView {
  /** Callback ref: attach to the element to watch. */
  ref: (node: object | null) => (() => void) | undefined;
  /** The element has come within `nearMarginPx` of the viewport at least once. Stays true. */
  hasBeenNear: boolean;
  /** Some part of the element is inside the viewport now. */
  isVisible: boolean;
}
