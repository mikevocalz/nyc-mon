/**
 * Pane widths in dp.
 *
 * The layout normally sizes panes with the `w-pane-*` classes backed by
 * `--container-pane-*`. A collapse ANIMATION needs the same values as numbers,
 * because an animated width has to interpolate towards a number, not a class.
 *
 * These mirror `packages/theme/tokens.ts` at the app's rem polyfill of 14
 * (metro.config.js `polyfills.rem`), the same basis `DEFAULT_PRIMARY_WIDTH`
 * already uses. A test asserts the two stay in step.
 */
export const REM = 14;

export const PANE_WIDTH_DP = {
  primary: 20 * REM,
  primaryNarrow: 16 * REM,
  supplementary: 21 * REM,
  inspector: 20 * REM,
  /*
    The DETAIL pane's collapse width. It normally has no width of its own —
    it is the pane that absorbs the window — but a pane that collapses has to
    interpolate towards a number, and it grows FROM this one when it is also
    the fill pane (`CollapsiblePane`'s `grow`, not `flex-1`, for exactly that
    reason). Sized to match `supplementary` so three columns collapse at one
    rate rather than three.
  */
  detail: 21 * REM,
} as const;

export type PaneWidthKey = keyof typeof PANE_WIDTH_DP;
