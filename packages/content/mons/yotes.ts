import type { MonSpeciesDef } from '@acme/core';
import { type Bloodline, rosterForm } from './define.ts';

/**
 * F12 · Yote Bloodline. Starter slot 3 (DECISIONS.md #1, #11).
 * Source: roster v11.1, docs/canon/source/NYC_MON_Egg_Baby_All_Forms_Roster_v11_1.md L210-L216.
 * The file keeps its §2.2 name; the roster's family name is the singular "Yote".
 */
export const yoteBloodline: Bloodline = { bloodlineId: 'F12', bloodlineName: 'Yote' };

export const yoteForms: readonly MonSpeciesDef[] = [
  rosterForm(yoteBloodline, 61, 'Prism Egg', 'Egg'),
  rosterForm(yoteBloodline, 62, 'Yotito', 'Baby'),
  rosterForm(yoteBloodline, 63, 'Lil’ Yote', 'Small'),
  rosterForm(yoteBloodline, 64, 'Barrio-Yote', 'Mid'),
  rosterForm(yoteBloodline, 65, 'Fuego-Yote', 'Max'),
  rosterForm(yoteBloodline, 66, 'Yote del Eléctrico', 'Max'),
  rosterForm(yoteBloodline, 67, 'Agua-Yote', 'Max'),
];
