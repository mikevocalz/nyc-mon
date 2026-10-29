// How MONS lays out in the space it has (skills/mikevocalz-foldable-layouts:
// hardware picks the nav shell, usable space picks the panes). Pure, so the
// phone / portrait / landscape / fold boundaries are node-tested. Measured
// against the screen's own content box, which on rail hardware is already
// left of the rail and under the header.

/** The `md` breakpoint (`REGULAR_MIN_WIDTH`, 768): below it there is never room for two panes. */
export const SPLIT_MIN_WIDTH = 768;
/** A phone on its side is wide but short: the entry's Mon needs this much height beside the list. */
export const SPLIT_MIN_HEIGHT = 500;
/** The list pane's share of the row when no fold places the boundary. */
export const LIST_SHARE = 0.4;
/** The list never gets narrower than a row needs (thumb, number, name) nor wider than reads well. */
export const LIST_MIN = 320;
export const LIST_MAX = 440;

/** Where a separating vertical fold puts the boundary, in row coordinates (from the kit's fold planner). */
export interface FoldSplit {
  /** Width of the region before the fold. */
  readonly leadingWidth: number;
  /** Width the fold itself occupies (0 for a separating crease, the hinge for an occluding one). */
  readonly gapWidth: number;
}

export type MonsArrangement =
  | { readonly mode: 'single' }
  | { readonly mode: 'split'; readonly listWidth: number; readonly gapWidth: number };

/**
 * - A separating vertical fold with room on both sides (an open foldable,
 *   book posture): list on the leading region, entry on the trailing one,
 *   the boundary ON the fold, nothing under the hinge.
 * - Otherwise landscape from md and at least 500 tall (iPad landscape, a
 *   wide window; never a phone on its side): list left
 *   at two fifths, clamped, entry right.
 * - Everything else (phones, iPad portrait, a narrow window): one column,
 *   the list, and a row opens the entry as its own screen.
 */
export function monsArrangement(input: { readonly width: number; readonly height: number; readonly fold: FoldSplit | null }): MonsArrangement {
  const { width, height, fold } = input;
  if (fold !== null && fold.leadingWidth >= LIST_MIN && width - fold.leadingWidth - fold.gapWidth >= LIST_MIN) {
    return { mode: 'split', listWidth: fold.leadingWidth, gapWidth: fold.gapWidth };
  }
  if (width >= SPLIT_MIN_WIDTH && height >= SPLIT_MIN_HEIGHT && width > height) {
    const listWidth = Math.round(Math.min(LIST_MAX, Math.max(LIST_MIN, width * LIST_SHARE)));
    return { mode: 'split', listWidth, gapWidth: 0 };
  }
  return { mode: 'single' };
}
