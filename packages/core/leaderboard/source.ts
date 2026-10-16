import { type LeaderboardRow, LeaderboardRowSchema, type LeaderboardScope } from '../schemas/leaderboard.ts';

// The lobby's leaderboard boundary (Master Directive v2 §3 "Rive leaderboard"
// and §13 `LeaderboardSource`). The type is deliberately read-only: there is
// no `submitScore`, because a competitive ranking never trusts a score the
// client computed. Scores enter the ranking server-side from authoritative
// events, or not at all.

export interface LeaderboardQuery {
  /** Defaults to `global`, the only scope game rules define today. */
  readonly scope?: LeaderboardScope;
  /** Opaque, from a previous page's `nextCursor`. */
  readonly cursor?: string;
}

/**
 * Why a page is an error. `no-ranking-authority` is the honest answer while no
 * server ranking exists; `transport` is a failed request; `invalid-rows` means
 * the authority answered but nothing in the body passed {@linkcode LeaderboardRowSchema}.
 */
export type LeaderboardErrorReason = 'no-ranking-authority' | 'transport' | 'invalid-rows';

/** One page of the ranking. Map it with an exhaustive `switch` on `status`. */
export type LeaderboardPage =
  | {
      readonly status: 'ready';
      readonly rows: readonly LeaderboardRow[];
      /** The viewing player's rank when they are ranked, even if their row is on another page. */
      readonly selfRank?: number;
      readonly nextCursor?: string;
    }
  | { readonly status: 'empty'; readonly rows: readonly [] }
  | {
      /** Rows from a cache the authority could not refresh. Shown with a "last updated" marker. */
      readonly status: 'stale';
      readonly rows: readonly LeaderboardRow[];
      readonly selfRank?: number;
      readonly nextCursor?: string;
      /** When the rows were last known to be current, epoch ms. */
      readonly asOf: number;
    }
  | { readonly status: 'error'; readonly rows: readonly []; readonly reason: LeaderboardErrorReason };

/**
 * Where the lobby reads rankings from. Read-only by design: see the note at
 * the top of this file. A `load` never throws for a bad ranking; it resolves
 * an `error` page so the lobby can render it and START stays usable
 * (fixture 11: a leaderboard outage never blocks a valid resume).
 */
export interface LeaderboardSource {
  load(query?: LeaderboardQuery): Promise<LeaderboardPage>;
}

export interface LeaderboardRowValidation {
  /** Rows that passed, in input order, with duplicate `playerId`s after the first dropped. */
  readonly rows: readonly LeaderboardRow[];
  /** How many input entries were dropped. */
  readonly droppedCount: number;
}

/**
 * Validates a ranking body row by row. A bad row is dropped, not fatal, so
 * one malformed entry cannot blank the panel; the count lets the caller
 * decide whether the page is still `ready`.
 */
export function validateLeaderboardRows(input: unknown): LeaderboardRowValidation {
  if (!Array.isArray(input)) return { rows: [], droppedCount: 0 };
  const rows: LeaderboardRow[] = [];
  const seen = new Set<string>();
  let droppedCount = 0;
  for (const entry of input) {
    const parsed = LeaderboardRowSchema.safeParse(entry);
    if (!parsed.success || seen.has(parsed.data.playerId)) {
      droppedCount++;
      continue;
    }
    seen.add(parsed.data.playerId);
    rows.push(parsed.data);
  }
  return { rows, droppedCount };
}

/**
 * The source the lobby uses until a ranking authority exists. Every `load`
 * resolves `{ status: 'error', reason: 'no-ranking-authority' }`: no server
 * computes a ranking yet, and this package will not pretend one does with
 * client-side scores or placeholder rows. The backend work that replaces this
 * is scoped separately (Master Directive v2 §3).
 */
export function createUnavailableLeaderboardSource(): LeaderboardSource {
  return {
    load: () => Promise.resolve({ status: 'error', rows: [], reason: 'no-ranking-authority' }),
  };
}
