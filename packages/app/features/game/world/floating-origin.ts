import { CELL } from './cells/cell-rules.ts';

export interface FloatingOrigin {
  cx: number;
  cz: number;
}

export interface OriginPoint {
  x: number;
  y: number;
  z: number;
}

export function createFloatingOrigin(): FloatingOrigin {
  return { cx: 0, cz: 0 };
}

export function updateFloatingOrigin(origin: FloatingOrigin, absoluteX: number, absoluteZ: number): boolean {
  let changed = false;
  if (Math.abs(absoluteX - origin.cx * CELL) > 2 * CELL) {
    origin.cx = Math.floor(absoluteX / CELL);
    changed = true;
  }
  if (Math.abs(absoluteZ - origin.cz * CELL) > 2 * CELL) {
    origin.cz = Math.floor(absoluteZ / CELL);
    changed = true;
  }
  return changed;
}

export function absoluteToRender<T extends OriginPoint>(origin: Readonly<FloatingOrigin>, absolute: Readonly<OriginPoint>, out: T): T {
  out.x = absolute.x - origin.cx * CELL;
  out.y = absolute.y;
  out.z = absolute.z - origin.cz * CELL;
  return out;
}

export function renderToAbsolute<T extends OriginPoint>(origin: Readonly<FloatingOrigin>, render: Readonly<OriginPoint>, out: T): T {
  out.x = render.x + origin.cx * CELL;
  out.y = render.y;
  out.z = render.z + origin.cz * CELL;
  return out;
}
