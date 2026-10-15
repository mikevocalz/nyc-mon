'use client';
// Live shell-navigation placement: stable hardware family (retained for the
// process) plus window size class and any Apple hardware edge column, resolved
// through the pure policy in ./adaptive-navigation.ts.
// SOT: ./adaptive-navigation.ts · ./hardware-family.ts · ./adaptive-panes/README.md (Navigation rail)
// SOT-KEYWORDS: adaptive navigation placement hook rail bottom hardware family foldable
import { useEffect } from 'react';
import { Dimensions, I18nManager, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import {
  resolveAdaptiveNavigationPlacement,
  type AdaptiveNavigationPlacement,
  type HardwareEdgeColumn,
} from './adaptive-navigation';
import { foldLayoutsFromRegions } from './adaptive-panes/fold-layout';
import { useWindowSizeClass } from './adaptive-panes/use-window-size-class';
import {
  detectHardwareFamily,
  retainHardwareFamily,
  type HardwareEvidence,
  type HardwareFamily,
} from './hardware-family';
import { isHeadsetAndroid } from './headset';
import { useReservedRegions } from './reserved-regions';

/**
 * A safe-area inset this wide is a system-reserved control column, not a
 * cutout. 64 dp clears every notch and rounded-corner inset in landscape.
 */
const HARDWARE_EDGE_COLUMN_MIN_DP = 64;

function hardwareEdgeColumn(left: number, right: number): HardwareEdgeColumn | null {
  if (Platform.OS !== 'ios') return null;
  const leftColumn = left >= HARDWARE_EDGE_COLUMN_MIN_DP ? left : 0;
  const rightColumn = right >= HARDWARE_EDGE_COLUMN_MIN_DP ? right : 0;
  if (leftColumn === 0 && rightColumn === 0) return null;
  return leftColumn > rightColumn
    ? { edge: 'left', width: leftColumn }
    : { edge: 'right', width: rightColumn };
}

function evidence(divisionSeen: boolean, hardwareColumn: boolean): HardwareEvidence {
  const screen = Dimensions.get('screen');
  return {
    os: Platform.OS,
    headset: isHeadsetAndroid(
      Platform.OS,
      Platform.constants as { Manufacturer?: string; Brand?: string } | undefined,
    ),
    isPad: Platform.OS === 'ios' && (Platform as { isPad?: boolean }).isPad === true,
    smallestScreenDp: Platform.OS === 'android' ? Math.min(screen.width, screen.height) : null,
    divisionSeen,
    hardwareColumn,
  };
}

/**
 * The process-wide family. Hardware does not change while the process runs,
 * so it lives outside any component and only ever strengthens: headset, iPad
 * and Android sw600 resolve on the first frame; a foldable resolves when the
 * ReservedRegions module first reports a hinge and stays resolved on the
 * cover screen afterwards.
 */
const familyStore = createStore<{ family: HardwareFamily }>(() => ({
  family: detectHardwareFamily(evidence(false, false)),
}));

/**
 * Where the app's primary navigation belongs right now: bottom tabs, or a
 * physical-right rail (collapsed or expanded). Re-renders on resize, fold and
 * family resolution.
 *
 * @see {@linkcode resolveAdaptiveNavigationPlacement} for the policy.
 */
export function useAdaptiveNavigationPlacement(): AdaptiveNavigationPlacement {
  const sizeClass = useWindowSizeClass();
  const { height } = useWindowDimensions();
  const { left, right } = useSafeAreaInsets();
  const regions = useReservedRegions();
  const family = useStore(familyStore, (state) => state.family);

  const folds = foldLayoutsFromRegions(regions);
  const hardwareEdge = hardwareEdgeColumn(left, right);
  // Only a division is a hinge; a UIKit occlusion can be a camera cutout.
  const divisionSeen = regions.some((region) => region.kind === 'division');
  const hardwareColumn = hardwareEdge !== null;

  useEffect(() => {
    const next = detectHardwareFamily(evidence(divisionSeen, hardwareColumn));
    const known = familyStore.getState().family;
    const merged = retainHardwareFamily(known, next);
    if (merged !== known) familyStore.setState({ family: merged });
  }, [divisionSeen, hardwareColumn, height]);

  return resolveAdaptiveNavigationPlacement({
    platform:
      Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : Platform.OS === 'web' ? 'web' : 'other',
    hardwareFamily: family,
    sizeClass,
    heightDp: height,
    folds,
    hardwareEdge,
    isRTL: I18nManager.isRTL,
  });
}
