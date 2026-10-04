'use client';
// Simulated reserved regions for previews and tests.
//
// Storybook runs on web, where no fold exists, and a foldable emulator is not
// always at hand. Wrapping a subtree in `ReservedRegionsOverride` makes
// `useReservedRegions` answer the given regions instead of the native module,
// so the REAL pipeline (regions -> foldLayoutsFromRegions -> pane planner) runs
// against a known hinge. Coordinates are window-relative, in dp, exactly as the
// native module reports them.
// SOT-KEYWORDS: reserved regions override simulate fold hinge storybook
import { createContext, use, type ReactNode } from 'react';
import type { ReservedRegion } from './reserved-regions.types';

const ReservedRegionsOverrideContext = createContext<readonly ReservedRegion[] | null>(null);

/**
 * Make {@linkcode useReservedRegions} return `regions` for everything below,
 * ignoring the native module. For Storybook stories and tests that need a
 * fold, a hinge or a posture without a device.
 */
export function ReservedRegionsOverride({
  regions,
  children,
}: {
  /** Window-relative regions in dp, as the native module would report them. */
  regions: readonly ReservedRegion[];
  children?: ReactNode;
}) {
  return <ReservedRegionsOverrideContext value={regions}>{children}</ReservedRegionsOverrideContext>;
}

/** The simulated regions, or null when no override is mounted. */
export function useReservedRegionsOverride(): readonly ReservedRegion[] | null {
  return use(ReservedRegionsOverrideContext);
}
