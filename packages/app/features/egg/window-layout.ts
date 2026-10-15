/**
 * Window-shape rules for M08 and M10. Pure: the screens pass the values of
 * `useWindowDimensions()` on every render, so a Horizon OS 2D window resized
 * between 360 and 1280 dp, a split view, or a rotated tablet re-lays out live.
 * Never read `Dimensions` at import.
 */

/**
 * Landscape or a short window: the card docks beside the stage (M08) and the
 * ring moves to a trailing column (M10). Covers tablet landscape, split view
 * and the Quest 2D window (1280 × 800 dp by default).
 */
export function isLandscapeWindow(widthDp: number, heightDp: number): boolean {
  return widthDp > heightDp;
}

/**
 * The OS text size is in the accessibility range, so M08's triptych and M10's
 * ring become radio rows (07-a11y.md "Accessibility sizes"). iOS reports
 * fontScale 1.353 at XXXL and 1.647 at AX1; Android's accessibility sizes
 * start above 1.3. 1.5 splits both.
 */
export const ACCESSIBILITY_FONT_SCALE = 1.5;

export function isAccessibilityTextSize(fontScale: number): boolean {
  return fontScale >= ACCESSIBILITY_FONT_SCALE;
}

/**
 * M10 ring diameter: `min(screenW − 64, 260)` on phones, up to 300 on tablet
 * portrait and 360 in a landscape window (M10 handoff "Layout"), never under
 * the 3 × 48 dp the stops need.
 */
export function ringSizeDp(widthDp: number, heightDp: number): number {
  const landscape = isLandscapeWindow(widthDp, heightDp);
  if (landscape) return Math.max(144, Math.min(360, heightDp - 280, widthDp / 2 - 48));
  const cap = widthDp >= 600 ? 300 : 260;
  return Math.max(144, Math.min(cap, widthDp - 64));
}
