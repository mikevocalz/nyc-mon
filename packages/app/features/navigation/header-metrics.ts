// The app header's fixed geometry (pt). Pure, so node --test pins it.
// The header is one height on every route: the window's top inset plus a
// fixed bar. Nothing inside the bar (a title, the Back button) can grow it.
// SOT-KEYWORDS: app header height fixed bar back slot safe area

/** The header's controls (wordmark, Back, Notifications) are 44 pt tall. */
export const HEADER_CONTROL_PT = 44;
/** Space above and below the controls. */
export const HEADER_PAD_Y_PT = 8;
/** The orange keyline along the bar's bottom edge. */
export const HEADER_KEYLINE_PT = 2;
/** The bar under the top inset, keyline included: 62 pt. */
export const HEADER_BAR_PT = HEADER_CONTROL_PT + 2 * HEADER_PAD_Y_PT + HEADER_KEYLINE_PT;

/**
 * The header's layout for a window top inset. `back` is accepted so callers
 * state it, and ignored on purpose: Back sits in the 44 pt slot.
 */
export function appHeaderLayout({ topInset }: { topInset: number; back: boolean }): { height: number; bar: number; slot: number } {
  return { height: topInset + HEADER_BAR_PT, bar: HEADER_BAR_PT, slot: HEADER_CONTROL_PT };
}

/** The scale that fits a control `size` pt tall into the 44 pt slot. Shrinks only; 1 before it is measured. */
export function fitToHeaderSlot(size: number): number {
  return size <= 0 ? 1 : Math.min(1, HEADER_CONTROL_PT / size);
}
