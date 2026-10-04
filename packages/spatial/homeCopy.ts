import type { District } from '@acme/ui';

/**
 * Home and site copy in one place. The premise ("each district has its own
 * NYC-MON characters") is a working draft the owner has not signed off yet,
 * so every user-facing line lives here and nowhere else.
 */
export const HOME_COPY = {
  tagline: 'Every block has a legend.',
  intro:
    'Each New York district has its own NYC-MON. Find them on your phone, then meet them in a headset.',
  openCity: 'Walk the district',
  closeCity: 'Leave the district',
  headsetTitle: 'Same city in the headset',
  headsetBody: 'Quest and PICO open the district you pick here, at street level.',
} as const;

export const DISTRICT_COPY: Record<District, { name: string; line: string }> = {
  downtown: { name: 'Downtown', line: 'Supertalls and spires packed down to the water.' },
  midtown: { name: 'Midtown', line: 'Deco crowns and a water tank on every other roof.' },
  harlem: { name: 'Harlem', line: 'Brownstone stoops, the projects and the towers behind them.' },
  megacity: { name: 'Mega City', line: 'The New York the other three grow into.' },
};

export const DISTRICTS: readonly District[] = ['downtown', 'midtown', 'harlem', 'megacity'];

/** One-line site description for metadata. */
export const SITE_DESCRIPTION = `${HOME_COPY.tagline} ${HOME_COPY.intro}`;
