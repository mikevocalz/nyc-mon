import type { MouseCursorProps } from './types';

/**
 * Touch screens have no cursor to replace, so native renders nothing. The
 * drawing (MouseFace in ./shapes) renders on native for anything that wants
 * the mark, such as the end of an XR controller ray.
 */
export function MouseCursor(_props: MouseCursorProps) {
  return null;
}
