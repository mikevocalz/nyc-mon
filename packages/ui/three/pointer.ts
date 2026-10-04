import type { ThreePointer } from './types';

/** Layout px within a width x height box to normalised device coordinates (-1..1, y up), as three's Raycaster wants. */
export function toNdc(x: number, y: number, width: number, height: number): ThreePointer {
  if (width <= 0 || height <= 0) return { x: 0, y: 0, inside: false };
  const inside = x >= 0 && y >= 0 && x <= width && y <= height;
  return { x: (x / width) * 2 - 1, y: 1 - (y / height) * 2, inside };
}

/**
 * Frame-rate independent ease toward a target: the same response at 30, 60
 * or 120 fps. `rate` is per second.
 */
export function approach(current: number, target: number, delta: number, rate: number): number {
  return target + (current - target) * Math.exp(-rate * delta);
}
