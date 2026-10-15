// Package entry for `@acme/ui/adaptive-panes`. Barrel only.
export { AdaptivePanes, PaneOpenContext, SplitView, usePaneOpen } from './AdaptivePanes';
export * from './parts';

/** Hinge/division geometry for single-pane screens outside a SplitView host. */
export { useReservedRegions } from '../reserved-regions';
