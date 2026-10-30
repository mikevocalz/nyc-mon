// Pointer input for the website's city walk: one finger or the mouse drags the map, two fingers pinch to zoom and
// twist to turn. Pure, so node --test covers it; the screen feeds it pointer positions in CSS px. The units and signs
// are the native Game screen's (camera-input.ts panToAction, pinchToAction, rotationToAction), so a drag on the website
// moves the map the way it does on the H-Lynk.
import { panToAction, pinchToAction, rotationToAction } from '../camera-input.ts';
import type { CityCameraAction } from '../city-camera.ts';
import type { CityCamera } from '../city-scene.ts';

export interface PointerPoint { readonly x: number; readonly y: number }

/** Below this many px of finger spread the twist angle is noise, so no turn is read. */
const MIN_TWIST_SPAN_PX = 24;

/**
 * The camera actions for pointers moving from `before` to `after` (same ids, same order). One pointer pans; two pan by
 * their midpoint, zoom by their spread and turn by their angle. Any other count does nothing.
 */
export function pointerActions(
  before: readonly PointerPoint[],
  after: readonly PointerPoint[],
  camera: CityCamera,
  viewportHeight: number,
): CityCameraAction[] {
  if (before.length !== after.length) return [];
  if (after.length === 1) {
    const dx = after[0]!.x - before[0]!.x;
    const dy = after[0]!.y - before[0]!.y;
    return dx === 0 && dy === 0 ? [] : [panToAction(dx, dy, camera, viewportHeight)];
  }
  if (after.length !== 2) return [];
  const [a0, b0] = before as [PointerPoint, PointerPoint];
  const [a1, b1] = after as [PointerPoint, PointerPoint];
  const actions: CityCameraAction[] = [];
  const mid = (a: PointerPoint, b: PointerPoint) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const m0 = mid(a0, b0);
  const m1 = mid(a1, b1);
  if (m1.x !== m0.x || m1.y !== m0.y) actions.push(panToAction(m1.x - m0.x, m1.y - m0.y, camera, viewportHeight));
  const span0 = Math.hypot(b0.x - a0.x, b0.y - a0.y);
  const span1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
  if (span0 > 0 && span1 > 0 && span0 !== span1) actions.push(pinchToAction(span1 / span0));
  if (span0 >= MIN_TWIST_SPAN_PX && span1 >= MIN_TWIST_SPAN_PX) {
    let turn = Math.atan2(b1.y - a1.y, b1.x - a1.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x);
    // The shortest way round, so crossing ±π never spins the map.
    if (turn > Math.PI) turn -= 2 * Math.PI;
    if (turn < -Math.PI) turn += 2 * Math.PI;
    if (turn !== 0) actions.push(rotationToAction(turn));
  }
  return actions;
}
