// Where the persistent H-Lynk and its companion pane sit inside the stage host.
// Pure: no React, no platform modules, so node tests run it directly.
// SOT: docs/design/foldable-arrangements.md ("Companion pane on the persistent stage")
// SOT-KEYWORDS: companion pane stage host tablet landscape portrait hinge fold

/** A fold in the host's own coordinates (foldLayoutsFromRegions, made host-local). */
export interface HostFold {
  readonly orientation: 'vertical' | 'horizontal';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * - `single`: the device alone, as on a phone.
 * - `row`: the pane on the physical left, the device on the physical right
 *   (the H-Lynk's documented side, foldable-arrangements.md), `gap` between.
 * - `column`: the device in a band at the top, the pane under it.
 */
export type CompanionPlan =
  | { readonly kind: 'single' }
  | { readonly kind: 'row'; readonly paneWidth: number; readonly gap: number }
  | { readonly kind: 'column'; readonly stageHeight: number; readonly gap: number };

export interface CompanionPlanInput {
  /**
   * A tablet-class window: native rail hardware (tablet, foldable, headset)
   * or web, at md width or more. A phone is never enabled, so a landscape
   * phone keeps its single-device layout.
   */
  readonly enabled: boolean;
  /** The stage host's measured size, pt/dp; null before the first layout pass. */
  readonly width: number | null;
  readonly height: number | null;
  /** Folds already converted to host coordinates. */
  readonly folds?: readonly HostFold[];
}

/** Below these the device or the pane stops being useful; the plan falls back to `single`. */
export const COMPANION_MIN = {
  /** Narrowest device column in a row: the body plus its rails stay clear at 48 pt keys. */
  deviceWidth: 320,
  /** Narrowest pane: keeps 44 pt targets and a readable line. */
  paneWidth: 280,
  /** Shortest device band in a column. */
  stageHeight: 380,
  /** Shortest pane under the device. */
  paneHeight: 220,
} as const;

/** The pane's share of a row, and its cap (a longer line stops being readable). */
const ROW = { share: 0.4, max: 480, gap: 24 } as const;
/** The device band's share of a column: the device larger and top-aligned, the pane below. */
const COLUMN = { share: 0.6, gap: 16 } as const;

export function planCompanion({ enabled, width, height, folds = [] }: CompanionPlanInput): CompanionPlan {
  if (!enabled || width === null || height === null || width <= 0 || height <= 0) return { kind: 'single' };
  if (width > height) {
    // A vertical fold through the row is the boundary: the pane on one side, the device on the other.
    const fold = folds.find((f) => f.orientation === 'vertical' && f.x > 0 && f.x + f.width < width);
    if (fold !== undefined) {
      const right = width - fold.x - fold.width;
      if (fold.x >= COMPANION_MIN.paneWidth && right >= COMPANION_MIN.deviceWidth) {
        return { kind: 'row', paneWidth: fold.x, gap: fold.width };
      }
      return { kind: 'single' };
    }
    const paneWidth = Math.min(ROW.max, Math.round(width * ROW.share));
    if (paneWidth < COMPANION_MIN.paneWidth || width - paneWidth - ROW.gap < COMPANION_MIN.deviceWidth) return { kind: 'single' };
    return { kind: 'row', paneWidth, gap: ROW.gap };
  }
  // Tabletop: the device above the fold, the pane below it.
  const fold = folds.find((f) => f.orientation === 'horizontal' && f.y > 0 && f.y + f.height < height);
  if (fold !== undefined) {
    const below = height - fold.y - fold.height;
    if (fold.y >= COMPANION_MIN.stageHeight && below >= COMPANION_MIN.paneHeight) {
      return { kind: 'column', stageHeight: fold.y, gap: fold.height };
    }
    return { kind: 'single' };
  }
  const stageHeight = Math.round(height * COLUMN.share);
  if (stageHeight < COMPANION_MIN.stageHeight || height - stageHeight - COLUMN.gap < COMPANION_MIN.paneHeight) return { kind: 'single' };
  return { kind: 'column', stageHeight, gap: COLUMN.gap };
}

/** The device's box inside the host for a plan (physical left/top), for overlays that must sit over the device only. */
export function stageFrameFor(plan: CompanionPlan, width: number, height: number): { x: number; y: number; width: number; height: number } {
  if (plan.kind === 'row') {
    const x = plan.paneWidth + plan.gap;
    return { x, y: 0, width: Math.max(0, width - x), height };
  }
  if (plan.kind === 'column') return { x: 0, y: 0, width, height: plan.stageHeight };
  return { x: 0, y: 0, width, height };
}

/** Folds in window coordinates to host-local ones, dropping any outside the host. */
export function hostFolds(
  folds: readonly HostFold[],
  origin: { readonly x: number; readonly y: number },
  size: { readonly width: number; readonly height: number },
): HostFold[] {
  return folds
    .map((f) => ({ ...f, x: f.x - origin.x, y: f.y - origin.y }))
    .filter((f) => f.x + f.width > 0 && f.x < size.width && f.y + f.height > 0 && f.y < size.height);
}
