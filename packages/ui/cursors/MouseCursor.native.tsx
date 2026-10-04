import type { MouseCursorProps } from './types';

/**
 * Touch screens have no pointer to chase, so native renders nothing. The
 * drawing (CityMouse in ./mouse) renders on native for anything that wants
 * the character itself.
 */
export function MouseCursor(_props: MouseCursorProps) {
  return null;
}
