import type { District } from '@acme/ui';

/**
 * The district board's stops in route order, north to south, then Mega City:
 * the order a rider reads a line map (same as the home SignageBoard). Pure
 * data, shared by the server board and its client motion.
 */
export const BOARD_ROUTE: readonly District[] = ['harlem', 'midtown', 'downtown', 'megacity'];

/**
 * The photograph each stop shows: a bundled photo on the district's own
 * corner (DISTRICT_COPY.streets names the same avenue), and the night bridge
 * for Mega City, which canon gives no street.
 */
export const BOARD_PHOTO: Record<District, { id: string; focal: { x: number; y: number } }> = {
  harlem: { id: 'harlem-lenox-rowhouses', focal: { x: 0.45, y: 0.55 } },
  midtown: { id: 'midtown-chrysler-spire', focal: { x: 0.5, y: 0.3 } },
  downtown: { id: 'downtown-nyse', focal: { x: 0.5, y: 0.5 } },
  megacity: { id: 'megacity-brooklyn-bridge-night', focal: { x: 0.5, y: 0.6 } },
};
