import type { RefObject } from 'react';

/** Native surfaces are already sRGB; nothing to correct. */
export function useSrgbDrawingBuffer(_host: RefObject<unknown>, _redraw: () => void) {}
