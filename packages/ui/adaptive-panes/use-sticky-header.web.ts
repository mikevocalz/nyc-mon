'use client';
// PLATFORM FORK — web: the header does not auto-hide. A scroll-linked
// retracting header is a small-viewport economy; on web the pane header
// simply stays put, and Reanimated stays out of the Next bundle (not in
// `transpilePackages` — the same trade every web fork in this repo records).
// SOT: ./sticky-header.ts (the pure math the native fork animates) · ./README.md
// SOT-KEYWORDS: sticky header web static noop fork
import type { StickyHeader } from './sticky-header.types';

const STATIC_HEADER: StickyHeader = {
  scrollHandler: undefined,
  headerStyle: undefined,
  onHeaderLayout: () => {
    // Height only matters when the header retracts by its own height.
  },
};

export function useStickyHeader(): StickyHeader {
  return STATIC_HEADER;
}

export type { StickyHeader };
