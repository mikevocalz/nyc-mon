// Everything in the adaptive-panes surface except the host component itself:
// types, stores, the fold planner, navigation placement and the pane chrome.
// apps/mobile re-exports this beside its own platform-specific `SplitView`.
export type {
  AdaptivePanesProps,
  AdaptivePanesProps as SplitViewProps,
  AdaptivePanesCommands,
  AdaptivePanesCommands as SplitViewCommands,
  SplitNavigableColumn,
} from './types';
export { useAdaptivePaneSelection, useAdaptivePanesStore } from './context';
export {
  createAdaptivePanesStore,
  type AdaptivePanesState,
  type AdaptivePanesStore,
} from './store';
export { useWindowSizeClass, windowSizeClassForWidth } from './use-window-size-class';
export {
  WINDOW_SIZE_CLASS_MIN_WIDTH_DP,
  PANE_WIDTH_CLASS,
  isCollapsed,
  paneVisibility,
  type PaneVisibility,
  type WindowSizeClass,
} from './constants';
export { PANE_WIDTH_DP, REM } from './pane-widths';
export {
  foldLayoutFromRegions,
  foldLayoutsFromRegions,
  foldLayoutsIntersectingRow,
  resolveTrailingInspectorLayout,
  resolveVerticalFoldPanePlan,
  resolveVerticalMultiFoldPanePlan,
  type FoldLayout,
  type FoldPosture,
  type TrailingInspectorLayout,
  type TrailingInspectorLayoutInput,
  type VerticalFoldPanePlan,
  type VerticalFoldPanePlanInput,
  type VerticalMultiFoldPanePlan,
  type VerticalMultiFoldPanePlanInput,
} from './fold-layout';
export { useFoldLayout, useFoldLayouts } from './use-fold-layout';
export {
  useReservedRegions,
  type FoldOcclusionType,
  type FoldOrientation,
  type FoldState,
  type ReservedRegion,
} from '../reserved-regions';
export { ReservedRegionsOverride } from '../reserved-regions-override';
export {
  resolveAdaptiveNavigationPlacement,
  type AdaptiveNavigationKind,
  type AdaptiveNavigationPlacement,
  type HardwareEdgeColumn,
  type ResolveAdaptiveNavigationPlacementInput,
} from '../adaptive-navigation';
export { useAdaptiveNavigationPlacement } from '../use-adaptive-navigation-placement';

// Pane chrome — composable pieces the host arranges, exported for direct use
// by feature screens and Storybook.
export { CollapsiblePane, type CollapsiblePaneProps } from './CollapsiblePane';
export { DetailNavbar, type DetailNavbarProps } from './DetailNavbar';
export { PaneDivider, type PaneDividerProps } from './PaneDivider';
export { PaneEdgesContext, usePaneEdges, type PaneEdges } from './pane-edges';
export { PaneListHeader, type PaneListHeaderProps } from './PaneListHeader';
export { PaneSearchBar, type PaneSearchBarProps } from './PaneSearchBar';
export { PaneToggle, type PaneToggleProps } from './PaneToggle';
export { SidebarSection, type SidebarSectionProps } from './SidebarSection';
export { usePaneVisibility } from './use-pane-visibility';
export { useStickyHeader, type StickyHeader } from './use-sticky-header';
export { usePaneSearch, usePaneSearchStore } from './pane-search.store';
export { horizontalGesturesEnabled, type SearchablePane } from './pane-search';
export {
  configurePaneOverrideStorage,
  usePaneOverrideStore,
  type PaneOverrideStorage,
} from './pane-overrides.store';
export type { TogglablePane, PaneOverrides } from './pane-overrides';
export { TRANSITIONS } from './transitions';
