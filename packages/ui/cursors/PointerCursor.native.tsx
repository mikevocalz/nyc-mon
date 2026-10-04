import type { PointerCursorProps } from './types';

/**
 * Touch screens have no cursor to replace, so native renders nothing. The
 * drawing itself (CursorArrow in ./shapes) works on native for anything that
 * needs the mark, such as the end of an XR controller ray.
 */
export function PointerCursor(_props: PointerCursorProps) {
  return null;
}
