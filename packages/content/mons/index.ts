import type { MonSpeciesDef } from '@acme/core';
import { bodegaBaddieeCeeBloodline, bodegaBaddieeCeeForms } from './bodega-cee.ts';
import type { Bloodline } from './define.ts';
import { hoodRattiBloodline, hoodRattiForms } from './hood-ratti.ts';
import { yoteBloodline, yoteForms } from './yotes.ts';

export type { Bloodline } from './define.ts';
export { speciesIdForDex } from './define.ts';
export { hoodRattiBloodline, hoodRattiForms } from './hood-ratti.ts';
export { bodegaBaddieeCeeBloodline, bodegaBaddieeCeeForms } from './bodega-cee.ts';
export { yoteBloodline, yoteForms } from './yotes.ts';

export interface StarterBloodline {
  readonly slot: 1 | 2 | 3;
  readonly bloodline: Bloodline;
  readonly forms: readonly MonSpeciesDef[];
}

/** The three Phase 1 starters in slot order (DECISIONS.md #1). */
export const starterBloodlines: readonly StarterBloodline[] = [
  { slot: 1, bloodline: hoodRattiBloodline, forms: hoodRattiForms },
  { slot: 2, bloodline: bodegaBaddieeCeeBloodline, forms: bodegaBaddieeCeeForms },
  { slot: 3, bloodline: yoteBloodline, forms: yoteForms },
];

/** Every Dex record this package ships. */
export const allSpecies: readonly MonSpeciesDef[] = starterBloodlines.flatMap((starter) => starter.forms);

/** UI label for a bloodline (DECISIONS.md #11): "Hood Ratti Bloodline". */
export function bloodlineLabel(bloodline: Pick<Bloodline, 'bloodlineName'>): string {
  return `${bloodline.bloodlineName} Bloodline`;
}
