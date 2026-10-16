import type { LeaderboardPage, LeaderboardRow as CoreRow } from '@acme/core';
import { assertNever } from '@acme/core';
import type { LeaderboardModel, LeaderboardRow } from '@acme/ui/lobby';

// `LeaderboardPage` (@acme/core, what the source answers) → `LeaderboardModel`
// (@acme/ui/lobby, what the panel shows). Exhaustive over `status`, so a new
// page status fails typecheck here (08-handoff.md "Tests to write"). The one
// translation beyond field names: `error` with reason `no-ranking-authority`
// is `unavailable`, the honest state while no server ranking exists
// (contract.ts note on `LeaderboardStatus`). A score is carried through
// because the authority published it; the panel never names its unit.

function rowOf(row: CoreRow): LeaderboardRow {
  return { rank: row.rank, name: row.displayName, score: row.score, isSelf: row.isSelf, playerId: row.playerId };
}

function selfOf(rows: readonly LeaderboardRow[], selfRank: number | undefined): LeaderboardRow | null {
  const own = rows.find((row) => row.isSelf);
  if (own) return own;
  if (selfRank === undefined) return null;
  // Ranked on another page: the panel shows the rank; the name is the Caller's own row elsewhere.
  return null;
}

/**
 * Maps a page to the panel's model. `'loading'` with a previous page that
 * had rows keeps those rows on screen (as `ready`, or as the previous
 * `stale`) so a refetch never flashes the panel empty.
 */
export function toLeaderboardModel(page: LeaderboardPage | 'loading', previous: LeaderboardPage | null): LeaderboardModel {
  if (page === 'loading') {
    if (previous !== null && previous.rows.length > 0) return toLeaderboardModel(previous, null);
    return { status: 'loading' };
  }
  switch (page.status) {
    case 'ready': {
      const rows = page.rows.map(rowOf);
      return { status: 'ready', rows, self: selfOf(rows, page.selfRank) };
    }
    case 'empty':
      // Eligibility to rank is the authority's call; without a rule, nobody is told they will be first.
      return { status: 'empty', selfEligible: false };
    case 'stale': {
      const rows = page.rows.map(rowOf);
      return { status: 'stale', rows, self: selfOf(rows, page.selfRank), updatedAtMs: page.asOf };
    }
    case 'error':
      switch (page.reason) {
        case 'no-ranking-authority':
          return { status: 'unavailable' };
        case 'transport':
        case 'invalid-rows':
          return { status: 'error', reason: page.reason };
        default:
          return assertNever(page.reason);
      }
    default:
      return assertNever(page);
  }
}
