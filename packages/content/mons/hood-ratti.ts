import type { Bloodline, MonSpeciesDef } from '@acme/core';
import { type BloodlineRef, buildBloodline, rosterForm } from './define.ts';

/**
 * F01 · Hood Ratti Bloodline. Starter slot 1 (DECISIONS.md #1).
 * Source: roster v11.1, docs/canon/source/NYC_MON_Egg_Baby_All_Forms_Roster_v11_1.md L150-L156.
 * Malik's partner Ratti is one individual of this bloodline; the player's starter is a different one.
 */
const ref: BloodlineRef = { bloodlineId: 'F01', bloodlineName: 'Hood Ratti' };

export const hoodRattiForms: readonly MonSpeciesDef[] = [
  rosterForm(ref, 1, 'Metro Egg', 'Egg'),
  rosterForm(ref, 2, 'Squeaklet', 'Baby'),
  rosterForm(ref, 3, 'Lil’ Ratti', 'Small'),
  rosterForm(ref, 4, 'Hood Ratti', 'Mid'),
  rosterForm(ref, 5, 'Ratti Royale', 'Max'),
  rosterForm(ref, 6, 'Agua Ratti', 'Max'),
  rosterForm(ref, 7, 'Phantom Ratti', 'Max'),
];

/** Evolution chain, Egg-rooted; the Mid branches to each Max form (DECISIONS.md #12). */
export const hoodRattiBloodline: Bloodline = buildBloodline(ref, hoodRattiForms);
