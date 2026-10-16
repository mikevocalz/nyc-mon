import { z } from 'zod';
import { IdSchema } from './primitives.ts';

// The leaderboard row as the lobby renders it (Master Directive v2 §3 "Rive
// leaderboard", data contract). Validated at the boundary: a row that fails
// this schema is dropped before it reaches a Rive binding, so the panel never
// paints a NaN score or a 30-character name.

/** Public display names are capped at 24 UTF-16 units so a rank row stays one line. */
export const LEADERBOARD_DISPLAY_NAME_MAX_LENGTH = 24;

/**
 * One ranked row. `score` is whatever authoritative metric the ranking
 * authority publishes; the client never computes it and never names a rule
 * for it (no scoring mechanics exist yet, Law 1).
 */
export const LeaderboardRowSchema = z.object({
  rank: z.number().int().min(1),
  playerId: IdSchema,
  displayName: z.string().min(1).max(LEADERBOARD_DISPLAY_NAME_MAX_LENGTH),
  score: z.number().min(0),
  /** True on the viewing player's own row, so the panel can highlight it. */
  isSelf: z.boolean(),
});

/** A ranking scope. Only `global` exists until game rules define another. */
export const LEADERBOARD_SCOPES = ['global'] as const;
export const LeaderboardScopeSchema = z.enum(LEADERBOARD_SCOPES);

export type LeaderboardRow = z.infer<typeof LeaderboardRowSchema>;
export type LeaderboardScope = z.infer<typeof LeaderboardScopeSchema>;
