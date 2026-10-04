import type { MonSpeciesDef } from '@acme/core';
import { type Bloodline, rosterForm } from './define.ts';

/**
 * F01 · Hood Ratti Bloodline. Starter slot 1 (DECISIONS.md #1).
 * Source: roster v11.1, docs/canon/source/NYC_MON_Egg_Baby_All_Forms_Roster_v11_1.md L150-L156.
 * Malik's partner Ratti is one individual of this bloodline; the player's starter is a different one.
 */
export const hoodRattiBloodline: Bloodline = { bloodlineId: 'F01', bloodlineName: 'Hood Ratti' };

export const hoodRattiForms: readonly MonSpeciesDef[] = [
  rosterForm(hoodRattiBloodline, 1, 'Metro Egg', 'Egg'),
  rosterForm(hoodRattiBloodline, 2, 'Squeaklet', 'Baby'),
  rosterForm(hoodRattiBloodline, 3, 'Lil’ Ratti', 'Small'),
  rosterForm(hoodRattiBloodline, 4, 'Hood Ratti', 'Mid'),
  rosterForm(hoodRattiBloodline, 5, 'Ratti Royale', 'Max'),
  rosterForm(hoodRattiBloodline, 6, 'Agua Ratti', 'Max'),
  rosterForm(hoodRattiBloodline, 7, 'Phantom Ratti', 'Max'),
];
