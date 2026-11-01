// The controller layout surface without the host component: resolver,
// saved-position revalidation and geometry. No react-native import anywhere
// below, so the app's stores and node tests can import this path (mirrors
// `@acme/ui/adaptive-panes/parts`).
//
// Needs one `exports` entry in packages/ui/package.json (lane C1 owns it):
//   "./game-controls/layout/parts": "./game-controls/layout/parts.ts"
export type { LayoutProfile } from '../contract.ts';
export {
  CONTROL_MARGIN_DP,
  CONTROL_SIZE_DP,
  RAIL_CLEARANCE_DP,
  TABLET_GRIP_MARGIN_DP,
  TABLET_GRIP_RAISE_DP,
  USABLE_SCALE_MIN,
  resolveControllerLayout,
  resolveLayoutProfile,
  type ControllerLayout,
  type ControllerLayoutInput,
  type ControllerRuntime,
} from './controller-layout-resolver.ts';
export {
  CONTROL_SCALE_MAX,
  CONTROL_SCALE_MIN,
  EMPTY_SAVED_LAYOUTS,
  LAYOUT_PROFILES,
  MAX_OFFSET_DP,
  clampControlOffset,
  clampControlScale,
  parseControlOffset,
  parseSavedControlLayouts,
  parseSavedProfileLayout,
  revalidatePosition,
  type ControlOffset,
  type MovableControl,
  type SavedControlLayouts,
  type SavedProfileLayout,
} from './revalidate-positions.ts';
export {
  clampIntoRegion,
  foldSplits,
  insideOneRegion,
  intersects,
  largestClearRect,
  regionFor,
  usableRegions,
  type Insets,
  type Rect,
} from './geometry.ts';
