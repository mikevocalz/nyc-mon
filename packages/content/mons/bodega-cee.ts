import type { Bloodline, MonSpeciesDef } from '@acme/core';
import { type BloodlineRef, buildBloodline, rosterForm } from './define.ts';

/**
 * F02 · Bodega Baddiee Cee Bloodline. Starter slot 2 (DECISIONS.md #1, #11).
 * Source: roster v11.1, docs/canon/source/NYC_MON_Egg_Baby_All_Forms_Roster_v11_1.md L157-L163.
 * The file keeps its §2.2 name; "Bodega Cee" is the Mid form #011, not the bloodline.
 */
const ref: BloodlineRef = { bloodlineId: 'F02', bloodlineName: 'Bodega Baddiee Cee' };

export const bodegaBaddieeCeeForms: readonly MonSpeciesDef[] = [
  rosterForm(ref, 8, 'Corner Egg', 'Egg'),
  rosterForm(ref, 9, 'Kittee Cee', 'Baby'),
  rosterForm(ref, 10, 'Lil’ Cee', 'Small'),
  rosterForm(ref, 11, 'Bodega Cee', 'Mid'),
  rosterForm(ref, 12, 'Bodega Baddiee Cee', 'Max'),
  rosterForm(ref, 13, 'Knocka Cee', 'Max'),
  rosterForm(ref, 14, 'Midnight Cee', 'Max'),
];

/** Evolution chain, Egg-rooted; the Mid branches to each Max form (DECISIONS.md #12). */
export const bodegaBaddieeCeeBloodline: Bloodline = buildBloodline(ref, bodegaBaddieeCeeForms);
