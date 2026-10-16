// Backend choice for ArrangementPanes (foldable skill §9 steps 3 and 4). Pure,
// so the platform matrix is node-tested; the .native file feeds it the real
// Platform values once per process.
// SOT-KEYWORDS: arrangement view backend fallback foldable hinge duo
import type { ArrangementBackend, PhysicalSide } from './arrangement.types';

export interface BackendInput {
  os: string;
  /** `Platform.Version`: a string on iOS ("27.1"), the API level on Android. */
  osVersion: string | number;
  /** Quest / PICO 2D window: XR keeps its own adapter (skill §7, §9 step 4). */
  headset: boolean;
  /** The RNArrangementView native component is in this binary. */
  nativeRegistered: boolean;
}

/** iOS release that ships SwiftUI's ArrangementView, which the library binds to. */
export const IOS_ARRANGEMENT_MIN: readonly [number, number] = [27, 1];

function iosAtLeast(version: string | number, [major, minor]: readonly [number, number]): boolean {
  const [a = 0, b = 0] = String(version).split('.').map((part) => Number.parseInt(part, 10) || 0);
  return a > major || (a === major && b >= minor);
}

/**
 * `native` only where react-native-arrangement-view 0.4.0 arranges both panes:
 * Android (its own Jetpack WindowManager listener, panes laid out by its
 * `arrange()`), and iOS 27.1+ (SwiftUI ArrangementView). Below iOS 27.1 the
 * library shows the primary pane alone, so the fallback keeps the brand pane
 * on wide windows there. Web, SSR, XR headsets and a binary without the
 * native view always fall back.
 */
export function chooseArrangementBackend(input: BackendInput): ArrangementBackend {
  if (!input.nativeRegistered || input.headset) return 'fallback';
  if (input.os === 'android') return 'native';
  if (input.os === 'ios') return iosAtLeast(input.osVersion, IOS_ARRANGEMENT_MIN) ? 'native' : 'fallback';
  return 'fallback';
}

/**
 * The library's logical `primaryEdge` for a PHYSICAL side. Its Android
 * `arrange()` puts the primary after the split when `(edge === 'trailing') !==
 * rtl`, and its iOS host reverses SwiftUI's direction to match, so the
 * physical right is `trailing` in LTR and `leading` in RTL.
 */
export function primaryEdgeFor(side: PhysicalSide, isRTL: boolean): 'leading' | 'trailing' {
  const trailing = side === 'right' ? !isRTL : isRTL;
  return trailing ? 'trailing' : 'leading';
}

/**
 * Whether the companion pane is beside the primary. Overlay with no fold to
 * split on reports both panes full-size and overlapping: the companion is
 * covered, so it is not shown.
 */
export function secondaryShown(layout: { secondaryVisible: boolean; isOverlapping: boolean } | null): boolean {
  return layout !== null && layout.secondaryVisible && !layout.isOverlapping;
}
