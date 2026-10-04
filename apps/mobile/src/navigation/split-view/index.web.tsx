// Web: the same adaptive layout as Android. expo-router's SplitView is
// iOS-only and renders a bare <Slot /> elsewhere, which drops every column.
export * from '@acme/ui/adaptive-panes/parts';
export { PaneOpenContext, usePaneOpen } from '@acme/ui/adaptive-panes';
export { SplitView } from './AdaptiveSplitView';
export { SwipeableRow, ACTION_WIDTH, type SwipeableRowProps } from './SwipeableRow';
