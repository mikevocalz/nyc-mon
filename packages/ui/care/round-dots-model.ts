/** One round's dot. Discrete rounds, never a score (M16 `RoundDots`). */
export type RoundDot = 'done' | 'current' | 'ahead';

/** Dots for `total` rounds with round `current` (1-based) in play. `current` is clamped into range. */
export function roundDots(total: number, current: number): RoundDot[] {
  const n = Math.max(0, Math.floor(total));
  if (n === 0) return [];
  const c = Math.min(n, Math.max(1, Math.floor(current)));
  return Array.from({ length: n }, (_, i) => (i + 1 < c ? 'done' : i + 1 === c ? 'current' : 'ahead'));
}
