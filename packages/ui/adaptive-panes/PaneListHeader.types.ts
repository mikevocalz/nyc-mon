// Shared props for the PaneListHeader platform forks.
// SOT: ./PaneListHeader.native.tsx (retracting) · ./PaneListHeader.web.tsx (static)
// SOT-KEYWORDS: pane list header props title subtitle sticky types
import type { ReactNode } from 'react';
import type { StickyHeader } from './sticky-header.types';

export interface PaneListHeaderProps {
  title: string;
  /** Context line — a count, a filter, whatever the list is currently showing. */
  subtitle?: string;
  header: StickyHeader;
  /** Controls rendered at the trailing edge (toggles, filters). */
  children?: ReactNode;
}
