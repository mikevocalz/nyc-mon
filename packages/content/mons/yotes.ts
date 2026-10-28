import type { Bloodline, MonSpeciesDef } from '@acme/core';
import { type BloodlineRef, buildBloodline, rosterForm } from './define.ts';
import { starterDexDetails } from './inherited-v11-starters.ts';

/**
 * F12 · Yote Bloodline. Starter slot 3 (DECISIONS.md #1, #11).
 * Source: roster v11.1, docs/canon/source/NYC_MON_Egg_Baby_All_Forms_Roster_v11_1.md L210-L216.
 * The file keeps its §2.2 name; the roster's family name is the singular "Yote".
 */
const ref: BloodlineRef = { bloodlineId: 'F12', bloodlineName: 'Yote' };

export const yoteForms: readonly MonSpeciesDef[] = [
  rosterForm(ref, 61, 'Prism Egg', 'Egg', starterDexDetails),
  rosterForm(ref, 62, 'Yotito', 'Baby', starterDexDetails),
  rosterForm(ref, 63, 'Lil’ Yote', 'Small', starterDexDetails),
  rosterForm(ref, 64, 'Barrio-Yote', 'Mid', starterDexDetails),
  rosterForm(ref, 65, 'Fuego-Yote', 'Max', starterDexDetails),
  rosterForm(ref, 66, 'Yote del Eléctrico', 'Max', starterDexDetails),
  rosterForm(ref, 67, 'Agua-Yote', 'Max', starterDexDetails),
];

/** Evolution chain, Egg-rooted; the Mid branches to each Max form (DECISIONS.md #12). */
export const yoteBloodline: Bloodline = buildBloodline(ref, yoteForms);
