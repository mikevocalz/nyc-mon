import type { GestureResponderEvent } from 'react-native';

type PointLike = {
  nativeEvent: { offsetX?: number; offsetY?: number; locationX?: number; locationY?: number };
};

const point = (event: PointLike) => {
  const e = event.nativeEvent;
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
