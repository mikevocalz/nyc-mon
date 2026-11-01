import type { ReactNode } from 'react';

/**
 * How two related panes share a window (foldable skill §9, Apple's iPhone Duo
 * HIG "Arrangement views"). `split` divides the area between them; `overlay`
 * stacks the primary over the secondary and moves them to either side of a
 * separating or half-open fold.
 */
export type PaneArrangement = 'split' | 'overlay';

/** The PHYSICAL side the primary pane takes when the panes sit side by side. Never flips in RTL. */
export type PhysicalSide = 'left' | 'right';

/** Which engine lays the pane pair out. One per view, chosen once per process. */
export type ArrangementBackend = 'native' | 'fallback';

export interface ArrangementPanesProps {
  arrangement: PaneArrangement;
  /** Physical side of the primary pane when side by side, in RTL too (skill §2, §9 step 5). */
  primarySide: PhysicalSide;
  /**
   * The pane that is always shown. Pass a stable element (no keys from
   * geometry, skill §6), or a function of whether the companion pane is beside
   * it, for a screen whose single-pane layout carries both panes' content.
   */
  primary: ReactNode | ((secondaryShown: boolean) => ReactNode);
  /**
   * The companion pane. Called with whether it is beside the primary right
   * now; when it is hidden or covered (overlay with no fold) return null so it
   * neither draws nor reaches the screen reader. Its slot stays mounted.
   */
  secondary: (shown: boolean) => ReactNode;
  /**
   * The existing AdaptivePanes-style layout for web, SSR, XR, iOS before
   * 27.1, and a binary built before the native view was linked. Rendered
   * instead of the native backend, never alongside it.
   */
  fallback: () => ReactNode;
  /** Width of a navigation rail drawn inside this view on its PHYSICAL right; the panes stay clear of it. */
  insetRightPt?: number;
  testID?: string;
}
