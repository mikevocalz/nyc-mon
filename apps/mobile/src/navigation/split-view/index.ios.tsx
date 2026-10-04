/**
 * iOS delegates to expo-router's UISplitViewController wrapper untouched.
 *
 * Re-exported rather than wrapped so that `SplitView.Column` keeps its
 * identity: expo-router filters children with `child.type === SplitViewColumn`
 * (expo-router/build/split-view/split-view.js), and any wrapper component here
 * would fail that check and be dropped with a warning.
 *
 * The pane chrome (PaneToggle, PaneSearchBar, DetailNavbar, ...) and the size
 * class helpers are still the kit's.
 */
import './pane-storage';

export * from '@acme/ui/adaptive-panes/parts';
export { PaneOpenContext, usePaneOpen } from '@acme/ui/adaptive-panes';
export { SplitView } from 'expo-router/unstable-split-view';
export { SwipeableRow, ACTION_WIDTH, type SwipeableRowProps } from './SwipeableRow';
