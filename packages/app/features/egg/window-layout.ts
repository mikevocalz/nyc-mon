import type { FitBlock } from '@acme/ui';

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

/** The smallest ring the three 48 dp stops fit on (3 × 48). */
export const RING_MIN_DP = 144;
/** The smallest egg case in the accessibility-size list layout. */
export const LIST_CASE_MIN_DP = 72;

/** One `ChoiceRows` row: `min-h-target`, or one body line at the OS scale plus `py-2` and the 2 dp border. */
function choiceRowsHeight(fontScale: number): number {
  const row = Math.max(48, Math.ceil(24 * fontScale + 16 + 4));
  return row * 3 + 8 * 2;
}

/** The parts of M10 the fit sees. Lengths are the copy's character counts at render time. */
export interface IncubateFitParts {
  titleChars: number;
  bodyChars: number;
  /** The head lives in the companion panel on a split Duo (Decision H-2). */
  headInScreen: boolean;
  listLayout: boolean;
  /** "Ready at {time}" length, or 0 before a time is chosen. */
  readyChars: number;
  actionsShown: boolean;
  /** Error title and body lengths, or null when there is no error. */
  error: { titleChars: number; bodyChars: number } | null;
  fontScale: number;
  /** Width of the screen's content area, for the ring cap. */
  widthDp: number;
}

/** Ring cap: 260 on phones, 300 once the screen is 600 wide, 360 beside the text (M10 handoff "Layout"). */
function ringCap(widthDp: number, side: boolean): number {
  if (side) return 360;
  return widthDp >= 600 ? 300 : 260;
}

/**
 * M10 as fit blocks, top to bottom (Decision H-3): head, ring (or case and
 * rows at accessibility sizes), ready line, error, the word-labelled trackpad
 * actions and Start. Nothing scrolls; `fitHLynkContent` shrinks the ring,
 * then the type. Pure.
 */
export function incubateFitBlocks(parts: IncubateFitParts, side: boolean): FitBlock[] {
  const blocks: FitBlock[] = [];
  if (parts.headInScreen) {
    blocks.push({ kind: 'text', role: 'title', chars: parts.titleChars });
    blocks.push({ kind: 'text', role: 'body', chars: parts.bodyChars, tight: true });
  }
  if (parts.listLayout) {
    blocks.push({ kind: 'media', minPt: LIST_CASE_MIN_DP, maxPt: 120 });
    blocks.push({ kind: 'fixed', heightPt: choiceRowsHeight(parts.fontScale) });
  } else {
    blocks.push({ kind: 'media', minPt: RING_MIN_DP, maxPt: ringCap(parts.widthDp, side) });
  }
  if (parts.readyChars > 0) blocks.push({ kind: 'text', role: 'strong', chars: parts.readyChars });
  if (parts.error) {
    blocks.push({ kind: 'text', role: 'strong', chars: parts.error.titleChars });
    blocks.push({ kind: 'text', role: 'body', chars: parts.error.bodyChars });
    blocks.push({ kind: 'controls', size: 'md' });
  }
  if (parts.actionsShown) blocks.push({ kind: 'controls', size: 'sm', minRowWidthPt: 240 });
  blocks.push({ kind: 'controls', size: 'lg' });
  return blocks;
}

/** Side by side (ring trailing) when the screen is landscape, except in the list layout. */
export function incubateArrangement(widthDp: number, heightDp: number, listLayout: boolean): 'stack' | 'side' {
  return !listLayout && isLandscapeWindow(widthDp, heightDp) ? 'side' : 'stack';
}

/** The parts of M08 the fit sees. */
export interface MeetFitParts {
  titleChars: number;
  captionChars: number;
  /** `m08.santoro.line` ships empty; 0 draws nothing. */
  santoroChars: number;
  headInScreen: boolean;
  listLayout: boolean;
  /** The egg card is up (approaching or confirming). */
  cardShown: boolean;
  confirming: boolean;
  actionsShown: boolean;
  fontScale: number;
}

/**
 * Smallest triptych height: a 48 dp tap row plus the egg still above it.
 * Short landscape windows (phone landscape, 640 × 360) land near this floor.
 */
export const TRIPTYCH_MIN_DP = 96;

/**
 * M08 as fit blocks (Decision H-3). The triptych is the flexible block and
 * carries the card as its overlay; at accessibility sizes the card and rows
 * are in the flow instead. Card copy is counted at the authored step, as the
 * card draws it. Pure.
 */
export function meetFitBlocks(parts: MeetFitParts): FitBlock[] {
  const blocks: FitBlock[] = [];
  if (parts.headInScreen) {
    blocks.push({ kind: 'text', role: 'title', chars: parts.titleChars });
    blocks.push({ kind: 'text', role: 'body', chars: parts.captionChars, tight: true });
    if (parts.santoroChars > 0) blocks.push({ kind: 'text', role: 'body', chars: parts.santoroChars, tight: true });
  }
  if (parts.listLayout) {
    // Rows with a detail line: two text lines at the OS scale, py-2, border.
    const row = Math.max(48, Math.ceil(44 * parts.fontScale + 20));
    blocks.push({ kind: 'fixed', heightPt: row * 3 + 16 });
    if (parts.cardShown) {
      // Card: title bar, number, bloodline, body (3 lines), CTA; confirming adds a line and a second CTA.
      const line = 24 * parts.fontScale;
      const cta = Math.max(48, 20 * parts.fontScale + 40);
      const card = 48 + line * 2 + line * 3 + cta + (parts.confirming ? line + cta : 0) + 24 + 8 * 4;
      blocks.push({ kind: 'fixed', heightPt: Math.ceil(card) });
    }
  } else {
    blocks.push({ kind: 'media', minPt: TRIPTYCH_MIN_DP, maxPt: 10_000 });
  }
  if (parts.actionsShown) blocks.push({ kind: 'controls', size: 'sm', minRowWidthPt: 320 });
  return blocks;
}
