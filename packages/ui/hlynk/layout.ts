/**
 * H-Lynk Core geometry in points (dp on Android), from
 * docs/design/hlynk/DIRECTION.md "Anatomy on a phone" and M01 08-handoff.md
 * "Layout". Kept as data so the canon sheet (Decision #16, not yet in
 * docs/canon/source/) changes these in one diff.
 */
export const HLYNK_GEOMETRY = {
  /** red body each side of the head and screen */
  railPt: 12,
  /** black scanner head band */
  headPt: 40,
  /** scanner head strip in the compact layout */
  headCompactPt: 24,
  /** black lip around the screen */
  bezelPt: 4,
  /** square key face */
  keyPt: 48,
  /** square trackpad */
  trackpadPt: 112,
  /** red ring inset on the trackpad's black face */
  ringInsetPt: 4,
  /** space above and below the trackpad in the control row */
  rowPadPt: 12,
  /** compact control bar */
  barCompactPt: 72,
  /** below this the control row cannot hold the trackpad: switch to compact */
  minRowPt: 120,
  /** the shell never grows past phone width (medium windows and up) */
  maxWidthPt: 440,
  /** on medium windows and up the control row stops growing here */
  maxRowPt: 200,
  /** smallest gap between controls in the row */
  minGapPt: 8,
  /** the trackpad never shrinks below a key */
  minTrackpadPt: 48,
  /** compact pill trackpad: preferred width and height */
  pillPt: { width: 224, height: 56 },
  /** Material 3 compact/medium boundary */
  mediumWidthPt: 600,
} as const;

/** How the shell is laid out. `compact` is for short windows (landscape, slide-over). */
export type ShellLayout = 'standard' | 'compact';

/** The space the shell is given. */
export interface ShellViewport {
  widthPt: number;
  heightPt: number;
  safeTopPt: number;
  safeBottomPt: number;
}

/** Resolved shell geometry. Produced by {@linkcode measureShell}. */
export interface ShellGeometry {
  layout: ShellLayout;
  /** body width (≤ maxWidthPt) */
  bodyWidthPt: number;
  /** body height, safe insets excluded */
  bodyHeightPt: number;
  headPt: number;
  /** outer size of the screen, bezel included */
  screenWidthPt: number;
  screenHeightPt: number;
  /** height of the control row (standard) or bar (compact) */
  rowPt: number;
  /** trackpad size: the square's side, or the pill's width (its height is `pillPt.height`) */
  trackpadPt: number;
}

/** Room left for the trackpad once four keys and five gaps take their share of `rowWidthPt`. */
function trackpadRoom(rowWidthPt: number): number {
  const g = HLYNK_GEOMETRY;
  return rowWidthPt - g.keyPt * 4 - g.minGapPt * 5;
}

/**
 * Lay the shell out for a viewport. Standard: 3:4 screen between 12 pt rails,
 * the control row takes what is left (capped on medium windows and up).
 * Compact, when that would leave under `minRowPt` (or when forced): full-bleed
 * screen, 24 pt head strip, 72 pt bar. Pure.
 */
export function measureShell(viewport: ShellViewport, force?: ShellLayout): ShellGeometry {
  const g = HLYNK_GEOMETRY;
  const bodyWidthPt = Math.min(viewport.widthPt, g.maxWidthPt);
  const usableHeightPt = Math.max(0, viewport.heightPt - viewport.safeTopPt - viewport.safeBottomPt);
  const screenWidthPt = bodyWidthPt - g.railPt * 2;
  const screenHeightPt = (screenWidthPt * 4) / 3;
  const leftForRowPt = usableHeightPt - g.headPt - screenHeightPt;
  const layout: ShellLayout = force ?? (leftForRowPt < g.minRowPt ? 'compact' : 'standard');
  if (layout === 'compact') {
    return {
      layout,
      bodyWidthPt,
      bodyHeightPt: usableHeightPt,
      headPt: g.headCompactPt,
      screenWidthPt: bodyWidthPt,
      screenHeightPt: Math.max(0, usableHeightPt - g.headCompactPt - g.barCompactPt),
      rowPt: g.barCompactPt,
      trackpadPt: Math.max(g.minTrackpadPt, Math.min(g.pillPt.width, trackpadRoom(bodyWidthPt - g.railPt * 2))),
    };
  }
  const wide = viewport.widthPt >= g.mediumWidthPt;
  const rowPt = wide ? Math.min(leftForRowPt, g.maxRowPt) : leftForRowPt;
  return {
    layout,
    bodyWidthPt,
    bodyHeightPt: g.headPt + screenHeightPt + rowPt,
    headPt: g.headPt,
    screenWidthPt,
    screenHeightPt,
    rowPt,
    // Narrower than 360 pt (e.g. a 320 pt phone): the pad shrinks rather than the keys.
    trackpadPt: Math.max(g.minTrackpadPt, Math.min(g.trackpadPt, trackpadRoom(screenWidthPt))),
  };
}

/** Height the standard control row needs: the trackpad plus its padding. */
export const STANDARD_ROW_NEED_PT = HLYNK_GEOMETRY.trackpadPt + HLYNK_GEOMETRY.rowPadPt * 2;

/**
 * The layout to force on {@linkcode measureShell}. A screen's own `layout`
 * wins; otherwise the shell goes compact while the software keyboard is up,
 * so a text field on the screen stays visible on short phones (DECISIONS
 * D-16g, M09 naming). `undefined` lets the shell measure. Pure.
 */
export function resolveForcedLayout(forced: ShellLayout | undefined, keyboardVisible: boolean): ShellLayout | undefined {
  if (forced) return forced;
  return keyboardVisible ? 'compact' : undefined;
}
