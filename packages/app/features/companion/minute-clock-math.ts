/** Milliseconds until the next local minute boundary after `nowMs` (never 0). */
export function msToNextMinute(nowMs: number): number {
  const rest = 60_000 - (nowMs % 60_000);
  return rest === 0 ? 60_000 : rest;
}
