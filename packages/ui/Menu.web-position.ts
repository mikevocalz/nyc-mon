/** Coordinates are CSS pixels in the layout viewport; visual viewport offsets are explicit. */
export interface MenuRect { left: number; top: number; right: number; bottom: number }
export interface MenuViewport { left: number; top: number; width: number; height: number }
export function placeMenu(anchor: MenuRect, viewport: MenuViewport, desiredWidth: number, desiredHeight: number) {
  const margin = 8, gap = 6;
  const width = Math.max(1, Math.min(desiredWidth, viewport.width - margin * 2));
  const leftEdge = viewport.left + margin;
  const topEdge = viewport.top + margin;
  const rightEdge = viewport.left + viewport.width - margin;
  const bottomEdge = viewport.top + viewport.height - margin;
  const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, high));
  const belowTop = clamp(anchor.bottom + gap, topEdge, bottomEdge);
  const aboveBottom = clamp(anchor.top - gap, topEdge, bottomEdge);
  const below = Math.max(0, bottomEdge - belowTop);
  const above = Math.max(0, aboveBottom - topEdge);
  const flip = desiredHeight > below && above > below;
  let maxHeight = flip ? above : below;
  let top = flip ? aboveBottom - Math.min(desiredHeight, maxHeight) : belowTop;
  // A trigger that covers the viewport must not leave the popup zero-sized.
  if (maxHeight < Math.min(44, viewport.height - margin * 2)) {
    maxHeight = Math.max(1, viewport.height - margin * 2);
    top = topEdge;
  }
  return { left: clamp(anchor.right - width, leftEdge, Math.max(leftEdge, rightEdge - width)), top, width, maxHeight, side: flip ? 'above' as const : 'below' as const };
}
