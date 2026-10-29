// Where ScreenPanes' two landscape panes meet when a separating vertical
// hinge crosses the page row. Pure: node --test covers it. Type-only import,
// so no react-native loads under node.
// SOT: skills/mikevocalz-foldable-layouts/SKILL.md §4 (hinge-safe geometry)
// SOT-KEYWORDS: screen panes fold hinge split landscape two pane gutter
import type { FoldLayout } from '@acme/ui/adaptive-panes/parts';

/** Space kept clear on each side of the hinge (pt), so no text or target sits on its edge. */
export const FOLD_GUTTER = 16;

/** Narrowest pane worth showing on either side of the hinge (pt). */
export const FOLD_PANE_MIN = 280;

export interface ScreenPanesFoldSplit {
  /** Width of the primary pane, ending FOLD_GUTTER before the hinge. */
  readonly primaryWidth: number;
  /** The gap between the panes: the hinge plus a gutter on each side. */
  readonly gap: number;
}

/**
 * The split for a page row whose folds are already in row-local x (from
 * `useFoldLayouts(rowWindowX)`). `padStart` and `padEnd` are the row's own
 * horizontal padding. Uses the first SEPARATING VERTICAL fold inside the row;
 * a zero-width separating fold still counts (it is a real boundary), a flat
 * non-separating crease does not. Returns null (keep the class layout) when
 * no such fold crosses the row or a side would be narrower than `minPane`:
 * the panes then keep their authored widths rather than hiding content.
 */
export function screenPanesFoldSplit({
  folds,
  rowWidth,
  padStart,
  padEnd,
  minPane = FOLD_PANE_MIN,
  gutter = FOLD_GUTTER,
}: {
  readonly folds: readonly FoldLayout[];
  readonly rowWidth: number | null;
  readonly padStart: number;
  readonly padEnd: number;
  readonly minPane?: number;
  readonly gutter?: number;
}): ScreenPanesFoldSplit | null {
  if (rowWidth === null || rowWidth <= 0) return null;
  const fold = folds.find((f) => {
    if (!f.separating || f.orientation !== 'vertical') return false;
    const end = f.x + Math.max(0, f.width);
    return f.width === 0 ? f.x > 0 && f.x < rowWidth : f.x < rowWidth && end > 0;
  });
  if (fold === undefined) return null;
  const width = Math.max(0, fold.width);
  const primaryWidth = fold.x - padStart - gutter;
  const trailing = rowWidth - padEnd - (fold.x + width) - gutter;
  if (primaryWidth < minPane || trailing < minPane) return null;
  return { primaryWidth, gap: width + gutter * 2 };
}
