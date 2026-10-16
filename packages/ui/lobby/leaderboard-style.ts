// The NYC Rank panel's keylines and its accessible names, kept out of the
// component so node tests and the contrast registry can cite them by line.
//
// Keylines sit on the `SolidPanel tone="ink"` face, which is `ink-800` in both
// schemes (packages/ui/neon/SolidPanel.tsx), not `ink-950`. Review finding H3
// measured `royal-500` (2.56:1) and `orange-700` (2.55:1) there, both under
// the 3:1 UI floor. The steps below are the lightest step of each family that
// clears 3:1 on ink-800 while keeping the district's hue; packages/theme/
// contrast.ts registers each one against ink-800.
import type { District } from '../district/districts';
import { rankRegionLabel, rankStatusSpoken, rowAccessibleLabel } from './lobby-copy.ts';
import type { LeaderboardModel, LeaderboardRow } from './lobby-contract.ts';

/** Header-band keyline per last verified district, on the ink-800 face. */
export const DISTRICT_KEYLINE: Readonly<Record<District, string>> = {
  // royal-400 on ink-800: 3.96:1.
  downtown: 'border-royal-400',
  // orange-500 on ink-800: 5.48:1.
  midtown: 'border-orange-500',
  // Harlem's brick family, one step lighter than orange-700: orange-600 on ink-800 is 4.14:1.
  harlem: 'border-orange-600',
  // carolina-500 on ink-800: 5.58:1.
  megacity: 'border-carolina-500',
};

/** The keyline with no district: the downtown royal, on the same face. */
export const DEFAULT_KEYLINE = 'border-royal-400';

/** Row divider: decorative (rank and name text carry each row), registered as such in contrast.ts. */
export const ROW_DIVIDER = 'border-royal-500/40';

/** The Caller's own row marker: carolina-500 on ink-800, 5.58:1. */
export const SELF_ROW_MARKER = 'border-l-carolina-500';

/** The keyline class for an optional district. */
export function keylineFor(district: District | undefined): string {
  return district === undefined ? DEFAULT_KEYLINE : DISTRICT_KEYLINE[district];
}

/**
 * What a screen reader reaches on the panel (review finding H2;
 * G02 07-a11y.md § Focus order: region, status, rows, own row, "Try again").
 * The region is a header element with its own label; each row is its own
 * element. Nothing here folds the rows into the region.
 */
export interface LeaderboardAccessibility {
  /** `g02.rank.a11y.region` on the header band. */
  readonly regionLabel: string;
  /** One `g02.rank.row.a11y` per visible row, in rank order. */
  readonly rowLabels: readonly string[];
}

/** The rows the panel shows: the ranked page plus the Caller's own row when it is not already on it. */
export function panelRowsOf(model: LeaderboardModel): readonly LeaderboardRow[] {
  switch (model.status) {
    case 'ready':
    case 'stale': {
      const self = model.self;
      if (self === null || model.rows.some((row) => row.playerId === self.playerId)) return model.rows;
      return [...model.rows, self];
    }
    case 'loading':
    case 'unavailable':
    case 'empty':
    case 'error':
      return [];
  }
}

export function leaderboardAccessibility(model: LeaderboardModel, rows: readonly LeaderboardRow[]): LeaderboardAccessibility {
  return {
    regionLabel: rankRegionLabel(rankStatusSpoken(model.status)),
    rowLabels: rows.map((row) => rowAccessibleLabel(row.rank, row.name, row.isSelf)),
  };
}
