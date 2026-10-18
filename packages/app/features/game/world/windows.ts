// Which windows are lit. The facade shader runs the same formula per pixel
// (materials.ts), from the wall uv (u = metres along the wall, v = metres
// up) and a per-building seed read from the wall colour. Pure, so node
// tests pin the pattern; the GPU copy uses the same constants.

/** Floor height and bay width of the window grid, metres, as the facade shader draws it. */
export const WINDOW_GRID = {
  masonry: { floor: 3.2, bay: 3.0 },
  glass: { floor: 3.6, bay: 1.6 },
} as const;

/** The classic shader hash: fract(sin(dot) * 43758.5453), 0..1. */
export function windowHash(column: number, row: number, seed: number): number {
  const x = Math.sin(column * 12.9898 + row * 78.233 + seed * 37.719) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Share of a building's windows lit at dusk, 0.25..0.75: some blocks are
 * mostly dark, some nearly all on, so the city reads as lived in rather
 * than as one pattern.
 */
export function litDensity(seed: number): number {
  const h = windowHash(seed * 7.31, 3.7, 1.13);
  return 0.25 + h * 0.5;
}

/**
 * How the daypart scales the lit share — the world clock's `dayFactor`
 * (PR07, living-city/clock.ts) reaches the facades as `tod` (0 day …
 * 1 night): a quarter of the dusk density by day, all of it by night,
 * capped under certainty so some rooms always stay dark. The facade
 * shader applies the same formula to its emissive mask (materials.ts);
 * the L3 interior layer uses it per window (glass.ts `litShare`).
 */
export const LIT_SHARE_DAY = 0.25;
export const LIT_SHARE_GAIN = 0.95;
export const LIT_SHARE_CAP = 0.95;
/** The authored default: the unflagged city stands at dusk (materials.ts). */
export const LIT_SHARE_TOD = 0.8;
export function litShareAt(density: number, tod: number): number {
  const t = Math.min(1, Math.max(0, tod));
  return Math.min(LIT_SHARE_CAP, density * (LIT_SHARE_DAY + LIT_SHARE_GAIN * t));
}

/** Whether the window at (column, row) of a building with this seed is lit. Ground-floor shopfronts are handled apart. */
export function windowLit(column: number, row: number, seed: number): boolean {
  if (row < 1) return false;
  return windowHash(column, row, seed) < litDensity(seed);
}

/** Two warm and one cool interior tone, picked per window by a second hash. */
export function windowTone(column: number, row: number, seed: number): 0 | 1 | 2 {
  const h = windowHash(column + 17.1, row + 3.3, seed);
  return h < 0.55 ? 0 : h < 0.85 ? 1 : 2;
}
