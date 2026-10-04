/**
 * The four NYC-MON districts. Every component with a `district` prop, every
 * story's district control and every background theme reads this list.
 */
export type District = 'downtown' | 'midtown' | 'harlem' | 'megacity';

/** Every district, in map order from the tip of the island up and out. */
export const DISTRICTS: readonly District[] = ['downtown', 'midtown', 'harlem', 'megacity'];

/** Display names. */
export const DISTRICT_NAME: Record<District, string> = {
  downtown: 'Downtown',
  midtown: 'Midtown',
  harlem: 'Harlem',
  megacity: 'Mega City',
};

/** The backgrounds' name for DISTRICT_NAME; kept so `DISTRICT_NAMES` stays a public export. */
export const DISTRICT_NAMES = DISTRICT_NAME;
