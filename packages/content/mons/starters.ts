import type { Bloodline, MonSpeciesDef } from '@acme/core';
import { bodegaBaddieeCeeBloodline, bodegaBaddieeCeeForms } from './bodega-cee.ts';
import { hoodRattiBloodline, hoodRattiForms } from './hood-ratti.ts';
import { lanternFyeBloodline, lanternFyeForms } from './lanternfye.ts';
import { yoteBloodline, yoteForms } from './yotes.ts';

/**
 * The Phase 1 starters on their own, without the 115-form roster. Import this
 * entry (`@acme/content/starters`) from a bundle that only renders a starter
 * Mon, such as the Alexa Mon card; `@acme/content` re-exports all of it.
 */

export interface StarterBloodline {
  readonly slot: 1 | 2 | 3 | 4;
  readonly bloodline: Bloodline;
  readonly forms: readonly MonSpeciesDef[];
}

/** The four Phase 1 starters in slot order (DECISIONS.md #1, #38). */
export const starterBloodlines: readonly StarterBloodline[] = [
  { slot: 1, bloodline: hoodRattiBloodline, forms: hoodRattiForms },
  { slot: 2, bloodline: bodegaBaddieeCeeBloodline, forms: bodegaBaddieeCeeForms },
  { slot: 3, bloodline: yoteBloodline, forms: yoteForms },
  { slot: 4, bloodline: lanternFyeBloodline, forms: lanternFyeForms },
];

/** The 26 starter forms (7 each for F01, F02 and F12, 5 for F04), in slot order. */
export const starterSpecies: readonly MonSpeciesDef[] = starterBloodlines.flatMap(({ forms }) => forms);

/** UI label for a bloodline (DECISIONS.md #11): "Hood Ratti Bloodline". */
export function bloodlineLabel(bloodline: Pick<Bloodline, 'bloodlineName'>): string {
  return `${bloodline.bloodlineName} Bloodline`;
}
