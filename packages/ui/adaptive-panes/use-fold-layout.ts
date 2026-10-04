'use client';
// Fold geometry for AdaptivePanes, in the pane row's local coordinates.
//
// `useReservedRegions` normalizes iOS reserved regions and Android
// FoldingFeature into one WINDOW-coordinate shape (web reports none unless a
// `ReservedRegionsOverride` simulates some). AdaptivePanes measures its own row
// origin in that same space, and this hook converts every fold to row-local x.
// Until the row origin is known it returns no folds: snapping content to a
// window-relative x would be worse than not snapping.
// SOT-KEYWORDS: fold layout window origin hinge adaptive panes
import { useReservedRegions } from '../reserved-regions';
import { foldLayoutFromRegions, foldLayoutsFromRegions, type FoldLayout } from './fold-layout';

/** Every fold in the window, in the row's coordinates; empty until measured. */
export function useFoldLayouts(rowWindowX: number | null): FoldLayout[] {
  const regions = useReservedRegions();
  return rowWindowX === null ? [] : foldLayoutsFromRegions(regions, rowWindowX);
}

/** The first fold only, for layouts that can place a single boundary. */
export function useFoldLayout(rowWindowX: number | null): FoldLayout | null {
  const regions = useReservedRegions();
  return rowWindowX === null ? null : foldLayoutFromRegions(regions, rowWindowX);
}
