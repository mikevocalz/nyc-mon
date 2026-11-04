/**
 * Tested geometry for a source-owned rich Popover.
 * Values are logical viewport pixels / native layout dp, not physical pixels.
 * No DOM/React dependency: both native and web can use the same rules.
 */

export type PopoverRect = Readonly<{ left: number; top: number; right: number; bottom: number }>;
export type PopoverViewport = Readonly<{ left: number; top: number; width: number; height: number }>;
export type PopoverPlacement = 'auto' | 'above' | 'below';
export type PopoverResult = Readonly<{
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  side: 'above' | 'below';
  scrollable: boolean;
}>;
export type PopoverRegion = Readonly<{
  active: boolean;
  separating?: boolean;
  kind: 'division' | 'occlusion';
  orientation?: 'vertical' | 'horizontal';
}>;
const finite = (value: number): boolean => Number.isFinite(value);
const clamp = (value: number, start: number, end: number): number =>
  Math.max(start, Math.min(value, end));

export function popoverVessel(options: Readonly<{
  width: number;
  height: number;
  keyboardHeight?: number;
  regions?: readonly PopoverRegion[];
}>): 'anchored' | 'sheet' {
  const { width, height, keyboardHeight = 0, regions = [] } = options;
  if (![width, height, keyboardHeight].every(finite) || width < 0 || height < 0 || keyboardHeight < 0)
    throw new RangeError('Invalid popover viewport');
  // A native OS popup is not guaranteed to avoid a separating hinge.
  // A source-owned sheet is the conservative mode until physical pane QA.
  const interrupted = regions.some(region => region.active &&
    (region.kind === 'occlusion' || (region.kind === 'division' && region.separating === true)));
  return interrupted || width < 600 || height - keyboardHeight < 350 ? 'sheet' : 'anchored';
}

/**
 * Place a non-modal floating instrument near its trigger and keep every pixel
 * inside the supplied usable viewport. Web supplies visualViewport offsets,
 * native hosts can supply an occlusion-free pane's bounds.
 */
export function placePopover(
  anchor: PopoverRect,
  viewport: PopoverViewport,
  requestedWidth: number,
  requestedHeight: number,
  placement: PopoverPlacement = 'auto',
  direction: 'ltr' | 'rtl' = 'ltr',
): PopoverResult {
  if (![anchor.left, anchor.top, anchor.right, anchor.bottom, viewport.left, viewport.top,
    viewport.width, viewport.height, requestedWidth, requestedHeight].every(finite) ||
    anchor.right < anchor.left || anchor.bottom < anchor.top || viewport.width <= 0 ||
    viewport.height <= 0 || requestedWidth <= 0 || requestedHeight <= 0)
    throw new RangeError('Invalid popover geometry');
  const margin = 8;
  const gap = 6;
  const usableWidth = Math.max(1, viewport.width - 2 * margin);
  const usableHeight = Math.max(1, viewport.height - 2 * margin);
  const width = Math.min(requestedWidth, usableWidth);
  const viewportBottom = viewport.top + viewport.height - margin;
  const viewportTop = viewport.top + margin;
  const belowTop = clamp(anchor.bottom + gap, viewportTop, viewportBottom);
  const aboveBottom = clamp(anchor.top - gap, viewportTop, viewportBottom);
  const belowRoom = Math.max(0, viewportBottom - belowTop);
  const aboveRoom = Math.max(0, aboveBottom - viewportTop);
  let side: 'above' | 'below' = placement === 'auto'
    ? (belowRoom >= requestedHeight || belowRoom >= aboveRoom ? 'below' : 'above')
    : placement;
  let room = side === 'below' ? belowRoom : aboveRoom;
  // A preferred direction cannot yield an unreachable or invisible panel.
  if (room < 88 && (side === 'below' ? aboveRoom : belowRoom) > room) {
    side = side === 'below' ? 'above' : 'below';
    room = side === 'below' ? belowRoom : aboveRoom;
  }
  const maxHeight = Math.max(1, Math.min(requestedHeight, room >= 88 ? room : usableHeight));
  const top = room >= 88
    ? (side === 'below' ? belowTop : aboveBottom - maxHeight)
    : viewportTop;
  const desiredLeft = direction === 'rtl' ? anchor.left : anchor.right - width;
  const left = clamp(desiredLeft, viewport.left + margin,
    Math.max(viewport.left + margin, viewport.left + viewport.width - margin - width));
  return {
    left, top, width, maxHeight,
    side, scrollable: requestedHeight > maxHeight,
  };
}
