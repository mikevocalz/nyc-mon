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
  /**
   * Widest phone: viewports up to this width lay out exactly as on a phone.
   * Wider viewports fit the body to the height (Decision H-1,
   * docs/design/hlynk/ADAPTIVE.md).
   */
  maxWidthPt: 440,
  /** Wider than a phone, the body may grow toward the height up to this width (Material medium boundary). */
  maxGrownWidthPt: 600,
  /** Narrowest standard body: a 320 pt phone. A fit narrower than this goes compact instead. */
  minBodyPt: 320,
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

/** Body width at which head + 3:4 screen + a `rowPt` control row exactly fill `usableHeightPt`. */
function bodyWidthForHeight(usableHeightPt: number, rowPt: number): number {
  const g = HLYNK_GEOMETRY;
  return Math.floor(((usableHeightPt - g.headPt - rowPt) * 3) / 4 + g.railPt * 2);
}

/**
 * Body width for a viewport. Up to `maxWidthPt` (every phone in portrait) the
 * body is the viewport width, as before. Wider viewports fit the body to the
 * height with the 3:4 screen kept: it grows toward the height when a roomy
 * `maxRowPt` row still fits (tablet portrait, a tall window), and shrinks
 * below phone width when the 440 pt body would not leave a standard row (a
 * Surface Duo panel). A fit under `minBodyPt` keeps 440 and the shell goes
 * compact, exactly as phone landscape does today. Decision H-1.
 */
function fitBodyWidth(widthPt: number, usableHeightPt: number, force: ShellLayout | undefined): number {
  const g = HLYNK_GEOMETRY;
  const phone = Math.min(widthPt, g.maxWidthPt);
  if (widthPt <= g.maxWidthPt || force === 'compact') return phone;
  const grown = bodyWidthForHeight(usableHeightPt, g.maxRowPt);
  if (grown >= g.maxWidthPt) return Math.min(widthPt, grown, g.maxGrownWidthPt);
  const shrunk = Math.min(g.maxWidthPt, bodyWidthForHeight(usableHeightPt, STANDARD_ROW_NEED_PT));
  return shrunk >= g.minBodyPt ? shrunk : phone;
}

/**
 * Lay the shell out for a viewport. Standard: 3:4 screen between 12 pt rails,
 * the control row takes what is left (capped on medium windows and up).
 * Compact, when that would leave under `minRowPt` (or when forced): full-bleed
 * screen, 24 pt head strip, 72 pt bar. Viewports wider than a phone fit the
 * body to the height first ({@linkcode fitBodyWidth}). Pure.
 */
export function measureShell(viewport: ShellViewport, force?: ShellLayout): ShellGeometry {
  const g = HLYNK_GEOMETRY;
  const usableHeightPt = Math.max(0, viewport.heightPt - viewport.safeTopPt - viewport.safeBottomPt);
  const bodyWidthPt = fitBodyWidth(viewport.widthPt, usableHeightPt, force);
  const screenWidthPt = bodyWidthPt - g.railPt * 2;
  const screenHeightPt = (screenWidthPt * 4) / 3;
  const leftForRowPt = usableHeightPt - g.headPt - screenHeightPt;
  const layout: ShellLayout = force ?? (leftForRowPt < g.minRowPt ? 'compact' : 'standard');
  if (layout === 'compact') {
    // Compact spans the whole viewport: a short window has no height to
    // spare, so the screen takes every point of width (Decision H-1). Up to
    // 440 pt wide this is the same width as before.
    const compactWidthPt = Math.max(0, viewport.widthPt);
    return {
      layout,
      bodyWidthPt: compactWidthPt,
      bodyHeightPt: usableHeightPt,
      headPt: g.headCompactPt,
      screenWidthPt: compactWidthPt,
      screenHeightPt: Math.max(0, usableHeightPt - g.headCompactPt - g.barCompactPt),
      rowPt: g.barCompactPt,
      trackpadPt: Math.max(g.minTrackpadPt, Math.min(g.pillPt.width, trackpadRoom(compactWidthPt - g.railPt * 2))),
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

/** A rectangle in the shell host's local layout units (pt / dp). */
export interface HLynkRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The fold fields the placement reads. Structurally a subset of
 * `FoldLayout` from `adaptive-panes/fold-layout`, so `foldLayoutsFromRegions`
 * output passes straight in once both axes are host-local.
 */
export interface HLynkFold {
  orientation: 'vertical' | 'horizontal';
  separating: boolean;
  occlusionType?: 'none' | 'full';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HLynkPlacementInput {
  widthPt: number;
  heightPt: number;
  /** Folds in host-local coordinates (both axes). */
  folds: readonly HLynkFold[];
  /**
   * Width of a navigation rail drawn inside this host on its PHYSICAL right
   * edge (foldables, tablets: skill §2). 0 when the rail is outside the host
   * or absent. The device never overlaps it.
   */
  railRightPt?: number;
  /** Passed through to the per-region {@linkcode measureShell}. */
  force?: ShellLayout;
}

/**
 * How the host is used. `single`: the device alone (phone, folded cover,
 * compact window). `wide`: one regular-width window, brand pane left, device
 * right. `book`: a vertical fold, brand in the left region, device in the
 * right. `tabletop`: a horizontal fold, brand above, device below.
 */
export type HLynkArrangement = 'single' | 'wide' | 'book' | 'tabletop';

/** Where the brand pane and the device go. Produced by {@linkcode planHLynkPlacement}. */
export interface HLynkPlacement {
  arrangement: HLynkArrangement;
  /** Usable regions after splitting folds and the rail, top-to-bottom then physical left-to-right. */
  regions: HLynkRect[];
  /** The rect the whole device is centred in. */
  device: HLynkRect;
  /** The NYC-MON brand pane, or null when the device is alone. */
  brand: HLynkRect | null;
}

/** Regular width (Material's medium class): from here a single window shows the brand pane. */
export const HLYNK_TWO_PANE_MIN_PT = 600;
/** Narrowest brand pane; 600 − 232 − 2 × 24 leaves the 320 pt minimum body. */
export const HLYNK_BRAND_MIN_PT = 232;
/** Space either side of the device inside its pane on a single wide window. */
export const HLYNK_DEVICE_GUTTER_PT = 24;

function splitsHost(fold: HLynkFold): boolean {
  return fold.separating || fold.occlusionType === 'full';
}

/**
 * Cut the host by every separating fold and every FULL occlusion. A flat,
 * non-separating, non-occluding crease cuts nothing; a zero-width separating
 * fold inside the host still cuts. Folds outside the host are ignored. Pure.
 */
export function hlynkUsableRegions(widthPt: number, heightPt: number, folds: readonly HLynkFold[]): HLynkRect[] {
  const w = Math.max(0, widthPt);
  const h = Math.max(0, heightPt);
  const cutsX: [number, number][] = [];
  const cutsY: [number, number][] = [];
  for (const fold of folds) {
    if (!splitsHost(fold)) continue;
    if (![fold.x, fold.y, fold.width, fold.height].every(Number.isFinite)) continue;
    if (fold.orientation === 'vertical') {
      const start = fold.x;
      const end = fold.x + Math.max(0, fold.width);
      if (end <= 0 || start >= w) continue;
      cutsX.push([Math.max(0, start), Math.min(w, end)]);
    } else {
      const start = fold.y;
      const end = fold.y + Math.max(0, fold.height);
      if (end <= 0 || start >= h) continue;
      cutsY.push([Math.max(0, start), Math.min(h, end)]);
    }
  }
  const spans = (length: number, cuts: [number, number][]): [number, number][] => {
    const out: [number, number][] = [];
    let cursor = 0;
    for (const [start, end] of [...cuts].sort((a, b) => a[0] - b[0])) {
      if (start > cursor) out.push([cursor, start]);
      cursor = Math.max(cursor, end);
    }
    if (cursor < length) out.push([cursor, length]);
    return out.filter(([a, b]) => b - a > 0);
  };
  const regions: HLynkRect[] = [];
  for (const [y0, y1] of spans(h, cutsY)) {
    for (const [x0, x1] of spans(w, cutsX)) regions.push({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
  }
  return regions;
}

const fitsBrand = (r: HLynkRect) => r.width >= HLYNK_BRAND_MIN_PT && r.height >= HLYNK_BRAND_MIN_PT;

/**
 * Place the H-Lynk device and the NYC-MON brand pane (Decision H-2,
 * docs/design/hlynk/ADAPTIVE.md). The rail, when it shares the host, is cut
 * off the physical right first. Then:
 *
 * - A splitting vertical fold (book, flat dual-screen span): the device sits
 *   wholly in the rightmost region, the brand pane in the leftmost. Physical,
 *   also in RTL, like the rail.
 * - A splitting horizontal fold (tabletop): brand above, device below.
 * - No split and at least {@linkcode HLYNK_TWO_PANE_MIN_PT} wide: the device
 *   pane is the body's height-fit width plus gutters on the right; the brand
 *   pane takes the rest on the left when it is at least
 *   {@linkcode HLYNK_BRAND_MIN_PT} wide and the device keeps its standard
 *   layout (a short window gives the compact device the full width).
 * - Otherwise the device is alone. Pure.
 */
export function planHLynkPlacement(input: HLynkPlacementInput): HLynkPlacement {
  const rail = Math.max(0, Math.min(input.railRightPt ?? 0, input.widthPt));
  const w = Math.max(0, input.widthPt - rail);
  const h = Math.max(0, input.heightPt);
  const whole: HLynkRect = { x: 0, y: 0, width: w, height: h };
  const regions = hlynkUsableRegions(w, h, input.folds);
  const usable = regions.length > 0 ? regions : [whole];

  if (usable.length > 1) {
    const rows = [...new Set(usable.map((r) => r.y))];
    const bottomY = Math.max(...rows);
    const topY = Math.min(...rows);
    const lowest = usable.filter((r) => r.y === bottomY);
    const highest = usable.filter((r) => r.y === topY);
    const device = lowest.reduce((a, b) => (b.x > a.x ? b : a));
    const brandCandidate = rows.length > 1
      ? highest.reduce((a, b) => (b.x < a.x ? b : a))
      : usable.reduce((a, b) => (b.x < a.x ? b : a));
    const brand = brandCandidate !== device && fitsBrand(brandCandidate) ? brandCandidate : null;
    return { arrangement: rows.length > 1 ? 'tabletop' : 'book', regions: usable, device, brand };
  }

  const region = usable[0]!;
  if (region.width >= HLYNK_TWO_PANE_MIN_PT) {
    const g = HLYNK_GEOMETRY;
    const room = region.width - HLYNK_BRAND_MIN_PT - HLYNK_DEVICE_GUTTER_PT * 2;
    const geo = measureShell({ widthPt: room, heightPt: region.height, safeTopPt: 0, safeBottomPt: 0 }, input.force);
    const body = geo.bodyWidthPt;
    // A short window (phone landscape, a keyboard up) needs every point for
    // the compact device, so the brand pane only appears beside a standard one.
    if (geo.layout === 'standard' && body >= g.minBodyPt) {
      const deviceWidth = body + HLYNK_DEVICE_GUTTER_PT * 2;
      const brand: HLynkRect = { x: region.x, y: region.y, width: region.width - deviceWidth, height: region.height };
      const device: HLynkRect = { x: region.x + brand.width, y: region.y, width: deviceWidth, height: region.height };
      return { arrangement: 'wide', regions: usable, device, brand };
    }
  }
  return { arrangement: 'single', regions: usable, device: region, brand: null };
}

/** Where the body goes inside the box its pane gives it. Produced by {@linkcode placeBodyInFrame}. */
export interface BodyPlacement {
  geo: ShellGeometry;
  /** Offset of the body's top-left corner from the box's top-left corner. */
  left: number;
  top: number;
}

/**
 * Size the body for the box its pane gives it and centre it on both axes.
 * The box is whatever the arrangement backend handed the device pane: a
 * native Arrangement View pane on Android and iOS 27.1, or the fallback
 * planner's device region. Centring is arithmetic on the measured box, never
 * flex alignment, so the body's centre is the pane's centre on every backend.
 * `measureShell` never returns a body larger than its viewport; the clamp at
 * 0 only guards a degenerate (zero or negative) box. Pure.
 */
export function placeBodyInFrame(frame: { width: number; height: number }, force?: ShellLayout): BodyPlacement {
  const width = Math.max(0, frame.width);
  const height = Math.max(0, frame.height);
  const geo = measureShell({ widthPt: width, heightPt: height, safeTopPt: 0, safeBottomPt: 0 }, force);
  return {
    geo,
    left: Math.max(0, (width - geo.bodyWidthPt) / 2),
    top: Math.max(0, (height - geo.bodyHeightPt) / 2),
  };
}

/**
 * Widest the shell's pane gets when `HLynkStage` shows companion panes beside
 * it on a landscape md+ window (the open-foldable layout). Under
 * {@linkcode HLYNK_TWO_PANE_MIN_PT}, so the shell's own planner keeps the
 * device alone in its pane: the companion pane takes the brand pane's place
 * on the left instead of a third column. `HLynkStage` writes the same number
 * into its `max-w-[592px]` class; `adaptive.test.ts` holds the two together.
 */
export const HLYNK_STAGE_SHELL_MAX_PT = 592;

/** How a fold splits the stage between the companion pane and the shell. Produced by {@linkcode planHLynkStageSplit}. */
export interface HLynkStageSplit {
  /** `row`: a vertical fold, companion pane left, shell right. `column`: a horizontal fold, pane above, shell below. */
  axis: 'row' | 'column';
  /** The companion pane's width (`row`) or height (`column`): it ends where the first usable region ends. */
  panePt: number;
}

/**
 * Where the companion pane ends when a separating or fully occluding fold
 * cuts the stage, so no pane ever straddles a hinge (foldable skill §4).
 * `regions` are the stage's usable regions ({@linkcode hlynkUsableRegions},
 * or `HLynkPlacement.regions`). The pane takes the first region (leftmost;
 * topmost on a horizontal fold, as the brand pane does in Decision H-2) and
 * the shell takes the rest, hinge included, which its own planner cuts away.
 * `null` when nothing splits the stage: the panes then follow the window's
 * breakpoint and orientation classes. Pure.
 */
export function planHLynkStageSplit(regions: readonly HLynkRect[]): HLynkStageSplit | null {
  if (regions.length < 2) return null;
  const topY = Math.min(...regions.map((r) => r.y));
  if (new Set(regions.map((r) => r.y)).size > 1) {
    const top = regions.filter((r) => r.y === topY);
    return { axis: 'column', panePt: Math.max(...top.map((r) => r.y + r.height)) };
  }
  const leftmost = regions.reduce((a, b) => (b.x < a.x ? b : a));
  return { axis: 'row', panePt: leftmost.x + leftmost.width };
}
