// Primary shell-navigation placement policy. Pure: no react-native import, so
// node --test covers every platform/posture/width combination.
// SOT: ./adaptive-panes/README.md (Navigation rail)
// SOT-KEYWORDS: adaptive navigation material rail bottom bar posture tabletop extra large
import type { WindowSizeClass } from './adaptive-panes/constants.ts';
import type { FoldLayout } from './adaptive-panes/fold-layout.ts';

/** Which navigation chrome a window gets. */
export type AdaptiveNavigationKind =
  | 'bottom-compact'
  | 'bottom-medium'
  | 'rail-collapsed'
  | 'rail-expanded'
  | 'apple-hardware-rail'
  | 'apple-sidebar';

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
  /** Where the navigation sits. `left`/`right` already account for RTL. */
  position: 'bottom' | 'left' | 'right';
  /** True for any side placement (rail, sidebar, hardware column). */
  rail: boolean;
  /** True when the rail should show labels beside icons (extra-large). */
  expanded: boolean;
  /** Physical column width when Apple has reserved an outer-edge control column. */
  hardwareWidth: number;
}

/** Input to {@linkcode resolveAdaptiveNavigationPlacement}. */
export interface ResolveAdaptiveNavigationPlacementInput {
  platform: 'android' | 'ios' | 'other';
  sizeClass: WindowSizeClass;
  /** Current window height in dp/points. Android compact height is <480dp. */
  heightDp: number;
  folds: readonly FoldLayout[];
  hardwareEdge?: HardwareEdgeColumn | null;
  isRTL: boolean;
}

function logicalStart(isRTL: boolean): 'left' | 'right' {
  return isRTL ? 'right' : 'left';
}

/**
 * Primary shell navigation policy.
 *
 * Android follows Material 3 Adaptive navigation semantics:
 * - compact -> short bottom navigation
 * - tabletop or compact height (<480dp) -> short medium bottom navigation
 * - otherwise -> start-edge wide rail
 * - extra-large -> expanded wide rail
 *
 * Apple is deliberately different:
 * - a reserved hardware column (iPhone Duo style) wins and remains PHYSICAL, not logical
 * - ordinary compact iPhone -> bottom
 * - regular-width iPad/tablet -> leading sidebar
 *
 * Fold posture comes from the Expo Modules 2 WindowManager bridge. Multiple
 * folds are accepted so a trifold is not collapsed to "hinge #1".
 */
export function resolveAdaptiveNavigationPlacement({
  platform,
  sizeClass,
  heightDp,
  folds,
  hardwareEdge,
  isRTL,
}: ResolveAdaptiveNavigationPlacementInput): AdaptiveNavigationPlacement {
  const tabletop = folds.some((fold) => fold.posture === 'tabletop');

  if (platform === 'ios') {
    if (hardwareEdge && hardwareEdge.width > 0) {
      return {
        kind: 'apple-hardware-rail',
        position: hardwareEdge.edge,
        rail: true,
        expanded: false,
        hardwareWidth: hardwareEdge.width,
      };
    }

    if (sizeClass === 'compact') {
      return {
        kind: 'bottom-compact',
        position: 'bottom',
        rail: false,
        expanded: false,
        hardwareWidth: 0,
      };
    }

    return {
      kind: 'apple-sidebar',
      position: logicalStart(isRTL),
      rail: true,
      expanded: sizeClass === 'extraLarge',
      hardwareWidth: 0,
    };
  }

  if (platform === 'android') {
    if (sizeClass === 'compact') {
      return {
        kind: 'bottom-compact',
        position: 'bottom',
        rail: false,
        expanded: false,
        hardwareWidth: 0,
      };
    }

    if (tabletop || heightDp < 480) {
      return {
        kind: 'bottom-medium',
        position: 'bottom',
        rail: false,
        expanded: false,
        hardwareWidth: 0,
      };
    }

    const expanded = sizeClass === 'extraLarge';
    return {
      kind: expanded ? 'rail-expanded' : 'rail-collapsed',
      position: logicalStart(isRTL),
      rail: true,
      expanded,
      hardwareWidth: 0,
    };
  }

  return {
    kind: sizeClass === 'compact' ? 'bottom-compact' : 'rail-collapsed',
    position: sizeClass === 'compact' ? 'bottom' : logicalStart(isRTL),
    rail: sizeClass !== 'compact',
    expanded: false,
    hardwareWidth: 0,
  };
}
