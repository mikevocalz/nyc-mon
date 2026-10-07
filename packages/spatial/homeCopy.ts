import type { District } from '@acme/ui';

/**
 * Home and site copy shared by the web site and the spatial screens. The
 * slogan lives here once; the site's home copy (apps/web/components/home/copy.ts)
 * reads it from `HOME_COPY.tagline`. `intro` is also the site-wide meta
 * description, so it names the creatures as Mons and promises nothing the
 * site doesn't show.
 */
export const HOME_COPY = {
  tagline: 'Every block has a legend.',
  intro: "Mons live on New York's blocks, from Harlem to Downtown. Become a Caller and raise your own Mon.",
  openCity: 'Walk the district',
  closeCity: 'Leave the district',
  headsetTitle: 'Same city in the headset',
  headsetBody: 'Quest and PICO open the district you pick here, at street level.',
} as const;

/**
 * `streets` is the real place a district board points to: the cross streets
 * of the bundled photography in @acme/assets/photos. Canon doesn't place Mega
 * City on a map yet, so it has none.
 */
export const DISTRICT_COPY: Record<District, { name: string; line: string; streets: string | null }> = {
  downtown: { name: 'Downtown', line: 'Supertalls and spires packed down to the water.', streets: 'Wall St at Broad St' },
  midtown: { name: 'Midtown', line: 'Deco crowns and a water tank on every other roof.', streets: 'Lexington Ave at 42nd St' },
  harlem: { name: 'Harlem', line: 'Brownstone stoops, the projects and the towers behind them.', streets: 'Lenox Ave at 125th St' },
  megacity: { name: 'Mega City', line: 'The New York the other three grow into.', streets: null },
};

export const DISTRICTS: readonly District[] = ['downtown', 'midtown', 'harlem', 'megacity'];

/** One-line site description for metadata. */
export const SITE_DESCRIPTION = `${HOME_COPY.tagline} ${HOME_COPY.intro}`;
