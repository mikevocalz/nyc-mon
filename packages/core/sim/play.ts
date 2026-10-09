import type { PeekRound } from '../types/index.ts';

// Peek (D-15b, M16 06-critique S-3, S-5). One shared game; no per-Bloodline
// rule (TODO(canon) Q44). No score is ever shown.

/** Lowest play quality a finished Peek session gives. Any play is worth most of the gain. */
export const PEEK_MIN_QUALITY = 0.6;

/**
 * The `quality` for `applyCare({ kind: 'play', quality })` from a Peek
 * session's finished rounds: `0.6 + 0.4 × firstTryFinds / rounds`, in
 * [0.6, 1]. A wrong guess still counts: a round found on a later try adds
 * the base share. Returns `undefined` when no round finished, which means
 * no play is applied (S-5: leaving at round 0 applies nothing).
 *
 * TODO(canon): tuning, not canon; the lead signs off S-3.
 */
export function peekQuality(rounds: readonly PeekRound[]): number | undefined {
  if (rounds.length === 0) return undefined;
  const firstTry = rounds.filter((r) => r.guesses[0] === r.hiddenAt).length;
  return PEEK_MIN_QUALITY + (1 - PEEK_MIN_QUALITY) * (firstTry / rounds.length);
}
