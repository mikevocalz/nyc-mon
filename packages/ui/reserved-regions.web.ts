// Web has no native fold feature; the hook answers the empty list so callers
// branch on data, not on platform. A `ReservedRegionsOverride` (Storybook,
// tests) supplies simulated regions instead.
// SOT-KEYWORDS: reserved regions folding feature web fork
import { useReservedRegionsOverride } from './reserved-regions-override';
import type { ReservedRegion } from './reserved-regions.types';

export type {
  FoldOcclusionType,
  FoldOrientation,
  FoldState,
  ReservedRegion,
} from './reserved-regions.types';

const NONE: readonly ReservedRegion[] = [];

/**
 * The window's reserved regions: fold divisions and camera occlusions, in dp,
 * window-relative. Empty on web unless a `ReservedRegionsOverride` is mounted.
 */
export function useReservedRegions(): readonly ReservedRegion[] {
  return useReservedRegionsOverride() ?? NONE;
}
