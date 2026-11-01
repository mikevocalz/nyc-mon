import { describe, expect, it } from 'vitest';
import { LEADERBOARD_DISPLAY_NAME_MAX_LENGTH, LeaderboardRowSchema } from '../schemas/leaderboard.ts';
import { createUnavailableLeaderboardSource, type LeaderboardSource, validateLeaderboardRows } from '../leaderboard/source.ts';

describe('leaderboard boundary (§3 data contract, §13 LeaderboardSource)', () => {
  it('a row needs an integer rank ≥ 1, a 1–24 character name, a finite score ≥ 0, a player id and isSelf', () => {
    const good = { rank: 1, playerId: 'p1', displayName: 'Dee', score: 0, isSelf: true };
    expect(LeaderboardRowSchema.parse(good)).toEqual(good);
    expect(LeaderboardRowSchema.safeParse({ ...good, rank: 1.5 }).success).toBe(false);
    expect(LeaderboardRowSchema.safeParse({ ...good, rank: 0 }).success).toBe(false);
    expect(LeaderboardRowSchema.safeParse({ ...good, displayName: 'x'.repeat(LEADERBOARD_DISPLAY_NAME_MAX_LENGTH + 1) }).success).toBe(false);
    expect(LeaderboardRowSchema.safeParse({ ...good, score: -1 }).success).toBe(false);
    expect(LeaderboardRowSchema.safeParse({ ...good, score: Number.POSITIVE_INFINITY }).success).toBe(false);
    expect(LeaderboardRowSchema.safeParse({ ...good, playerId: '' }).success).toBe(false);
    expect(LeaderboardRowSchema.safeParse({ ...good, isSelf: 'yes' }).success).toBe(false);
  });

  it('validateLeaderboardRows keeps input order, drops bad rows and repeated player ids, and never throws', () => {
    expect(validateLeaderboardRows(undefined)).toEqual({ rows: [], droppedCount: 0 });
    expect(validateLeaderboardRows('rows')).toEqual({ rows: [], droppedCount: 0 });
    const { rows, droppedCount } = validateLeaderboardRows([
      { rank: 2, playerId: 'b', displayName: 'B', score: 5, isSelf: false },
      null,
      { rank: 1, playerId: 'a', displayName: 'A', score: 9, isSelf: false },
      { rank: 3, playerId: 'b', displayName: 'B again', score: 1, isSelf: false },
    ]);
    expect(rows.map((r) => r.playerId)).toEqual(['b', 'a']);
    expect(droppedCount).toBe(2);
  });

  it('the unavailable source answers an honest error every time and exposes no way to submit a score', async () => {
    const source: LeaderboardSource = createUnavailableLeaderboardSource();
    expect(await source.load()).toEqual({ status: 'error', rows: [], reason: 'no-ranking-authority' });
    expect(await source.load({ scope: 'global', cursor: 'page-2' })).toEqual({ status: 'error', rows: [], reason: 'no-ranking-authority' });
    expect('submitScore' in source).toBe(false);
    expect(Object.keys(source)).toEqual(['load']);
  });
});
