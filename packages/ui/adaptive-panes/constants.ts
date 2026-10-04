/**
 * Window size classes and the pane visibility policy derived from them.
 *
 * Breakpoints are Android's five current window width classes (Material 3
 * Adaptive / androidx.window `WindowSizeClass`), expressed in dp.
 * `useWindowDimensions()` already reports dp on Android and points on iOS, so
 * no PixelRatio conversion belongs anywhere in this module.
 *
 * TWO WIDTH SYSTEMS COEXIST IN THIS PACKAGE, deliberately:
 *
 * - THIS module's five bands (compact/medium/expanded/large/extraLarge) decide
 *   how many panes tile beside each other.
 * - `../size-class.constants.ts`'s binary `compact|regular` split at 768 dp
 *   decides one-column vs two-column composition inside a screen.
 *
 * They answer different questions and are kept apart on purpose: merging them
 * would force every two-state consumer through a five-state matrix.
 *
 * The numbers live here until `@acme/theme` carries a `widthClassMinDp` token
 * (see README, "Token debt"); the theme package is owned elsewhere.
 *
 * @see https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes
 */

/**
 * Lower bound (inclusive, dp) of each class. Ordered widest-first so that
 * resolution is a `find`, not a chain of comparisons.
 */
export const WINDOW_SIZE_CLASS_MIN_WIDTH_DP = {
  extraLarge: 1600,
  large: 1200,
  expanded: 840,
  medium: 600,
  compact: 0,
} as const;

export type WindowSizeClass = keyof typeof WINDOW_SIZE_CLASS_MIN_WIDTH_DP;

/** Widest-first, so the first match wins. */
export const WINDOW_SIZE_CLASSES_BY_WIDTH = [
  'extraLarge',
  'large',
  'expanded',
  'medium',
  'compact',
] as const satisfies readonly WindowSizeClass[];

/**
 * Resolve a width in dp to its window size class.
 *
 * Lives here rather than beside the hook so it carries no `react-native`
 * import and stays directly testable.
 */
export function windowSizeClassForWidth(widthDp: number): WindowSizeClass {
  const match = WINDOW_SIZE_CLASSES_BY_WIDTH.find(
    (sizeClass) => widthDp >= WINDOW_SIZE_CLASS_MIN_WIDTH_DP[sizeClass],
  );
  // The last entry's lower bound is 0, so this only falls through for a
  // negative width, which RN never reports.
  return match ?? 'compact';
}

/**
 * Pane widths as Tailwind classes backed by --container-pane-* tokens
 * (packages/theme/tokens.ts). Fixed-width leading panes, flexible detail pane —
 * so only the leading panes and the inspector are sized here.
 */
export const PANE_WIDTH_CLASS = {
  primary: 'w-pane-primary',
  primaryNarrow: 'w-pane-primary-narrow',
  supplementary: 'w-pane-supplementary',
  inspector: 'w-pane-inspector',
} as const;

/**
 * Which panes are on screen at each size class, for both the 2-column
 * (primary + detail) and 3-column (primary + supplementary + detail) shapes.
 *
 * `inspector` is honoured only where it is `true`; below that it must occupy no
 * layout space at all rather than render zero-width.
 */
export interface PaneVisibility {
  readonly primary: boolean;
  readonly supplementary: boolean;
  readonly inspector: boolean;
  /**
   * The trailing, flexible pane — `detail` in the host's props, `Main` in its
   * markup, `secondary` in `SplitNavigableColumn`'s navigation vocabulary.
   *
   * It is `true` in every automatic policy below and always will be: the
   * detail pane is what a list-detail layout is FOR, so no size class hides it
   * on its own. It appears here only so that a user can hide it on a host
   * that offers the control, through the same override map as the other
   * panes rather than a second visibility mechanism.
   */
  readonly detail: boolean;
  /** Primary uses the narrow token — the "rail" step before it disappears. */
  readonly primaryNarrow: boolean;
}

const VISIBILITY_TWO_COLUMN: Record<WindowSizeClass, PaneVisibility> = {
  extraLarge: { primary: true, supplementary: false, inspector: true, detail: true, primaryNarrow: false },
  large: { primary: true, supplementary: false, inspector: true, detail: true, primaryNarrow: false },
  expanded: { primary: true, supplementary: false, inspector: true, detail: true, primaryNarrow: false },
  medium: { primary: true, supplementary: false, inspector: false, detail: true, primaryNarrow: true },
  compact: { primary: false, supplementary: false, inspector: false, detail: true, primaryNarrow: false },
};

const VISIBILITY_THREE_COLUMN: Record<WindowSizeClass, PaneVisibility> = {
  extraLarge: { primary: true, supplementary: true, inspector: true, detail: true, primaryNarrow: false },
  large: { primary: true, supplementary: true, inspector: true, detail: true, primaryNarrow: false },
  // Sidebar collapses to the narrow rail first, supplementary is kept because
  // it is the pane that actually drives the detail route.
  expanded: { primary: true, supplementary: true, inspector: false, detail: true, primaryNarrow: true },
  medium: { primary: false, supplementary: true, inspector: false, detail: true, primaryNarrow: false },
  compact: { primary: false, supplementary: false, inspector: false, detail: true, primaryNarrow: false },
};

export function paneVisibility(
  sizeClass: WindowSizeClass,
  columnCount: 1 | 2,
): PaneVisibility {
  return columnCount === 2
    ? VISIBILITY_THREE_COLUMN[sizeClass]
    : VISIBILITY_TWO_COLUMN[sizeClass];
}

/** Exactly one pane is visible at compact; every other class tiles. */
export function isCollapsed(sizeClass: WindowSizeClass): boolean {
  return sizeClass === 'compact';
}

