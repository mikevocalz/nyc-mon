// Primary shell-navigation placement policy. Pure: no react-native import, so
// node --test covers every runtime/family/width combination.
// SOT: ./adaptive-panes/README.md (Navigation rail) · mikevocalz-foldable-layouts skill §2
// SOT-KEYWORDS: adaptive navigation rail bottom tabs hardware family foldable tablet headset physical right rtl
import type { WindowSizeClass } from './adaptive-panes/constants.ts';
import type { FoldLayout } from './adaptive-panes/fold-layout.ts';
import type { HardwareFamily } from './hardware-family.ts';

export type { HardwareFamily } from './hardware-family.ts';

/** Which navigation chrome a window gets. */
export type AdaptiveNavigationKind = 'bottom-compact' | 'rail-collapsed' | 'rail-expanded';

/** A full-height system-reserved column on a PHYSICAL edge (Apple). */
export interface HardwareEdgeColumn {
  edge: 'left' | 'right';
  width: number;
}

/**
 * The resolved placement, returned by
 * {@linkcode resolveAdaptiveNavigationPlacement}.
 */
export interface AdaptiveNavigationPlacement {
  kind: AdaptiveNavigationKind;
  /**
   * PHYSICAL edge. A rail is always `right`, also in RTL; convert with
   * {@linkcode tabBarPositionForPlacement} before handing it to a navigator
   * whose layout mirrors under RTL.
   */
  position: 'bottom' | 'right';
  /** True for the side rail. */
  rail: boolean;
  /** True when the rail should show labels beside icons (extra-large). */
  expanded: boolean;
  /** Width of an Apple hardware column the rail sits in (right edge only), else 0. */
  hardwareWidth: number;
  /** The family the decision was made for; `unknown` means still resolving. */
  family: HardwareFamily;
}

/** Input to {@linkcode resolveAdaptiveNavigationPlacement}. */
export interface ResolveAdaptiveNavigationPlacementInput {
  /** `web` and `other` are browser runtimes: never a side rail. */
  platform: 'android' | 'ios' | 'web' | 'other';
  /**
   * Stable device family. Omitted means `unknown`, which keeps the bootstrap
   * bottom tabs until the family resolves; it never means "verified phone".
   */
  hardwareFamily?: HardwareFamily;
  /** Content-space signal. Only chooses collapsed vs expanded rail. */
  sizeClass: WindowSizeClass;
  /** Live geometry. Does not affect navigation; accepted so callers can pass the full window state. */
  heightDp?: number;
  /** Live fold posture. Navigation does not change with posture. */
  folds?: readonly FoldLayout[];
  hardwareEdge?: HardwareEdgeColumn | null;
  isRTL: boolean;
}

const BOTTOM_TABS = {
  kind: 'bottom-compact',
  position: 'bottom',
  rail: false,
  expanded: false,
  hardwareWidth: 0,
} as const;

/**
 * Primary shell navigation policy: hardware family chooses the native shell,
 * current usable space chooses content panes elsewhere.
 *
 * - Web (any device, any width): bottom tabs, never a side rail.
 * - Native ordinary phone: bottom tabs at every width, height and posture.
 * - Native foldable/dual-screen (open, folded cover, book or tabletop),
 *   tablet and headset: a rail on the PHYSICAL right, also in RTL.
 *   `extraLarge` windows expand it with labels.
 * - Native `unknown`: the bootstrap bottom tabs while the family resolves.
 *   The hook retains a verified family for the process, so this is never a
 *   permanent phone classification.
 */
export function resolveAdaptiveNavigationPlacement({
  platform,
  hardwareFamily = 'unknown',
  sizeClass,
  hardwareEdge,
}: ResolveAdaptiveNavigationPlacementInput): AdaptiveNavigationPlacement {
  const native = platform === 'android' || platform === 'ios';
  const railFamily =
    hardwareFamily === 'foldable' || hardwareFamily === 'tablet' || hardwareFamily === 'headset';

  if (!native || !railFamily) {
    return { ...BOTTOM_TABS, family: hardwareFamily };
  }

  const expanded = sizeClass === 'extraLarge';
  return {
    kind: expanded ? 'rail-expanded' : 'rail-collapsed',
    position: 'right',
    rail: true,
    expanded,
    hardwareWidth:
      platform === 'ios' && hardwareEdge && hardwareEdge.edge === 'right' ? hardwareEdge.width : 0,
    family: hardwareFamily,
  };
}

/**
 * The expo-router / React Navigation `tabBarPosition` that renders on the
 * placement's PHYSICAL edge. The navigator lays scene and bar out in a
 * `flexDirection: 'row'`, which Yoga mirrors when `I18nManager.isRTL`, so
 * the trailing `right` slot lands on the physical left in RTL. Passing `left`
 * there keeps the rail physically right without disabling RTL.
 */
export function tabBarPositionForPlacement(
  placement: Pick<AdaptiveNavigationPlacement, 'position'>,
  isRTL: boolean,
): 'bottom' | 'left' | 'right' {
  if (placement.position === 'bottom') return 'bottom';
  return isRTL ? 'left' : 'right';
}
