// TS resolution anchor. Bundlers load the platform forks: index.ios.tsx
// (expo-router's UISplitViewController) and index.android.tsx / index.web.tsx
// (the kit's adaptive layout, bound to the router in AdaptiveSplitView.tsx).
//
// MUST be .tsx, matching the forks' extension. Metro resolves in the order
// .android.ts | .native.ts | .ts | .android.tsx | .native.tsx | .tsx, so a
// `.ts` anchor beside `.tsx` forks wins on native.
//
// It re-exports the adaptive implementation, never the iOS fork: on any
// platform without its own fork this file IS the bundle, and expo-router's
// SplitView outside iOS renders a bare <Slot />, so the columns never mount.
//
// Everything except `SplitView` is the kit's, re-exported unchanged.
export * from '@acme/ui/adaptive-panes/parts';
export { PaneOpenContext, usePaneOpen } from '@acme/ui/adaptive-panes';
export { SplitView } from './AdaptiveSplitView';
export { SwipeableRow, ACTION_WIDTH, type SwipeableRowProps } from './SwipeableRow';
