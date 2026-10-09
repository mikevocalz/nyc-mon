import { z } from 'zod';

/**
 * The three places the Mon can hide in Peek (D-15b, M16), left to right.
 * One shared game for every Bloodline. How each Bloodline hides is a
 * performance question, TODO(canon) Q44; it never changes these rules.
 */
export const PEEK_SPOTS = ['left', 'middle', 'right'] as const;
export const PeekSpotSchema = z.enum(PEEK_SPOTS);

/** Rounds in one Peek session (M16: "Round n of 6"). */
export const PEEK_ROUNDS_PER_SESSION = 6;

/**
 * One finished round of Peek: where the Mon hid and every spot the Caller
 * tried, in order. A round always ends with a find, so the last guess is the
 * hiding spot. A wrong guess is just another try; nothing is lost.
 */
export const PeekRoundSchema = z
  .object({
    hiddenAt: PeekSpotSchema,
    guesses: z.array(PeekSpotSchema).min(1).max(PEEK_SPOTS.length),
  })
  .refine((round) => round.guesses[round.guesses.length - 1] === round.hiddenAt, {
    message: 'a finished round ends on the hiding spot',
  });

/** The finished rounds of one Peek session, the input to `peekQuality`. Never stored in Phase 1. */
export const PeekResultSchema = z.object({
  rounds: z.array(PeekRoundSchema).max(PEEK_ROUNDS_PER_SESSION),
});
