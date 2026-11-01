import type { Bloodline, MonSpeciesDef } from '@acme/core';
import { type BloodlineRef, buildBloodline, rosterForm } from './define.ts';
import { starterDexDetails } from './inherited-v11-starters.ts';

/**
 * F04 · LanternFye Bloodline. Starter slot 4 (DECISIONS.md #1, amended by #38).
 * Source: roster v11.1, docs/canon/source/NYC_MON_Egg_Baby_All_Forms_Roster_v11_1.md L169-L173.
 * The Signal Egg hatches into Fye Dot (DECISIONS.md #30).
 */
const ref: BloodlineRef = { bloodlineId: 'F04', bloodlineName: 'LanternFye' };

export const lanternFyeForms: readonly MonSpeciesDef[] = [
  rosterForm(ref, 20, 'Signal Egg', 'Egg', starterDexDetails),
  rosterForm(ref, 21, 'Fye Dot', 'Baby', starterDexDetails),
  rosterForm(ref, 22, 'Flicker Fye', 'Small', starterDexDetails),
  rosterForm(ref, 23, 'Scarlet Skippa', 'Mid', starterDexDetails),
  rosterForm(ref, 24, 'LanternFye', 'Max', starterDexDetails),
];

/** Evolution chain, Egg-rooted; the line has one Max form. */
export const lanternFyeBloodline: Bloodline = buildBloodline(ref, lanternFyeForms);
