import type { GestureResponderEvent } from 'react-native';

type PointLike = {
  nativeEvent: { offsetX?: number; offsetY?: number; locationX?: number; locationY?: number; clientX?: number; clientY?: number };
  currentTarget?: unknown;
};

type Measurable = { getBoundingClientRect: () => { left: number; top: number } };

const point = (event: PointLike) => {
  const e = event.nativeEvent;
  // Web: measure against the element the handler is on. offsetX is relative
  // to whatever child was hit (the canvas, a label), which is not the plot.
  const t = event.currentTarget as Measurable | undefined;
  if (typeof e.clientX === 'number' && typeof e.clientY === 'number' && t && typeof t.getBoundingClientRect === 'function') {
    const r = t.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  const x = e.offsetX ?? e.locationX;
  const y = e.offsetY ?? e.locationY;
  return x === undefined || y === undefined ? null : { x, y };
};

/**
 * Pointer and touch handlers for a plot surface, spread onto a View.
 *   Web mouse and pen: hover selects (pointer events), leaving clears.
 *   Touch (web and native): press and drag select through the responder
 *   system, release keeps the selection so the value stays readable, and a
 *   parent ScrollView can still take over a vertical drag.
 */
export function plotPointer(onPoint: (x: number, y: number) => void, onLeave: () => void) {
  const handle = (event: PointLike) => {
    const p = point(event);
    if (p) onPoint(p.x, p.y);
  };
  return {
    onPointerMove: handle,
    onPointerLeave: onLeave,
    onStartShouldSetResponder: () => true,
    onResponderTerminationRequest: () => true,
    onResponderGrant: (e: GestureResponderEvent) => handle(e as unknown as PointLike),
    onResponderMove: (e: GestureResponderEvent) => handle(e as unknown as PointLike),
  } as object;
}
