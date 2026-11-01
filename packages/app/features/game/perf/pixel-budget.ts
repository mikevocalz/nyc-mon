// The physical city's pixel budget. Its tier rows (perf/tier.ts) were sized
// and measured on the iPhone 17 drawing buffer, about 3.2 MP. Every
// full-screen target it allocates (MRT, bloom chain, SSR) scales with the
// buffer, so a bigger screen at the same ratio multiplies memory: a 12.9"
// iPad Pro at 2x is 5.6 MP on a 4 GB device, and iOS kills the app while
// the city loads. The ratio is capped so the buffer stays within budget.

/** iPhone 17 drawing buffer, 1206 x 2622 px. */
export const PHYSICAL_PIXEL_BUDGET = 1206 * 2622;

/** The largest pixel ratio, up to `max`, whose drawing buffer fits the budget. */
export function budgetedPixelRatio(width: number, height: number, max: number, budget: number = PHYSICAL_PIXEL_BUDGET): number {
  const area = width * height;
  if (!(area > 0)) return max;
  return Math.min(max, Math.sqrt(budget / area));
}
