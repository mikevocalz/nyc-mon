'use client';
// Native arrangement backend (foldable skill §9 step 3): react-native-arrangement-view
// 0.4.0 where it arranges both panes, the caller's fallback everywhere else.
// One engine per view: the fallback is rendered instead of the native view,
// never inside or beside it. The backend is fixed for the process, so folding,
// rotating or resizing never swaps engines or remounts a pane (skill §6).
// SOT-KEYWORDS: arrangement view native backend foldable hinge duo split overlay
import { I18nManager, Platform, UIManager } from 'react-native';
import { ArrangementView, type ArrangementLayout } from 'react-native-arrangement-view';
import { isHeadsetAndroid } from '../headset';
import { useInstanceStore, useStore } from '../use-instance-store';
import type { ArrangementBackend, ArrangementPanesProps } from './arrangement.types';
import { chooseArrangementBackend, primaryEdgeFor, secondaryShown } from './backend';

let resolved: ArrangementBackend | undefined;

function nativeRegistered(): boolean {
  try {
    // Bridgeless: UIManager.hasViewManagerConfig → unstable_hasComponent. False
    // in a binary built before the library was linked, so the JS can ship
    // ahead of the native rebuild without rendering an unknown component.
    return UIManager.hasViewManagerConfig('RNArrangementView');
  } catch {
    return false;
  }
}

/** The backend for this process, resolved on first use. */
export function useArrangementBackend(): ArrangementBackend {
  resolved ??= chooseArrangementBackend({
    os: Platform.OS,
    osVersion: Platform.Version,
    headset: isHeadsetAndroid(Platform.OS, Platform.constants as { Manufacturer?: string; Brand?: string } | undefined),
    nativeRegistered: nativeRegistered(),
  });
  return resolved;
}

export function ArrangementPanes(props: ArrangementPanesProps) {
  return useArrangementBackend() === 'native' ? <NativePanes {...props} /> : <>{props.fallback()}</>;
}

function NativePanes({ arrangement, primarySide, primary, secondary, insetRightPt = 0, testID }: ArrangementPanesProps) {
  const store = useInstanceStore(() => ({ layout: null as ArrangementLayout | null }));
  const shown = useStore(store, (s) => secondaryShown(s.layout));
  // Yoga swaps left and right under RTL, so the physical right inset is
  // written as paddingLeft there. The library reports its geometry inside the
  // padding box on both platforms (ArrangementView.kt setContentInsets,
  // RNArrangementView.mm updateLayoutMetrics), so the fold stays correct.
  const swapped = I18nManager.isRTL && I18nManager.doLeftAndRightSwapInRTL;
  const inset = insetRightPt > 0 ? (swapped ? { paddingLeft: insetRightPt } : { paddingRight: insetRightPt }) : null;
  return (
    <ArrangementView
      testID={testID}
      style={[{ flex: 1 }, inset]}
      arrangement={arrangement}
      axes="both"
      primaryEdge={primaryEdgeFor(primarySide, I18nManager.isRTL)}
      // No hinge angle: Android's WindowManager has none and the repo never
      // infers one (skill §7). Turning observation off also keeps the Android
      // hinge-angle sensor unregistered (HingeTracker.kt `enabled`).
      observeHinge={false}
      // The Surface Duo reports its hinge as a flat, non-separating fold (measured
      // 2026-10-16: width 0, separating false), which `avoidSeparating` ignores, so
      // the split fell at the view's middle, 40 dp short of the hinge. A flat
      // fold only splits where two panes fit anyway (arrange.ts), so phones are unaffected.
      hingePolicy="alwaysAvoid"
      onArrangementLayoutChange={(layout) => store.setState({ layout })}
    >
      <ArrangementView.Primary>{typeof primary === 'function' ? primary(shown) : primary}</ArrangementView.Primary>
      <ArrangementView.Secondary>{secondary(shown)}</ArrangementView.Secondary>
    </ArrangementView>
  );
}
