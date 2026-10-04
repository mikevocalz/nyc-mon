import type { Bloodline, EvolutionNode, MonSpeciesDef } from '@acme/core';
import { bodegaBaddieeCeeBloodline, bodegaBaddieeCeeForms } from './bodega-cee.ts';
import { hoodRattiBloodline, hoodRattiForms } from './hood-ratti.ts';
import { yoteBloodline, yoteForms } from './yotes.ts';

export type { BloodlineRef } from './define.ts';
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

/**
 * Every bloodline this package ships, as evolution-chain resources in starter
 * slot order. The Dex screen (M17) and the web /mons pages (W02) render from this.
 */
export const bloodlines: readonly Bloodline[] = starterBloodlines.map((starter) => starter.bloodline);

/** Every Dex record this package ships. */
export const allSpecies: readonly MonSpeciesDef[] = starterBloodlines.flatMap((starter) => starter.forms);

/** UI label for a bloodline (DECISIONS.md #11): "Hood Ratti Bloodline". */
export function bloodlineLabel(bloodline: Pick<Bloodline, 'bloodlineName'>): string {
  return `${bloodline.bloodlineName} Bloodline`;
}

/** Visits every node of a chain, parent before children. */
export function walkChain(node: EvolutionNode): readonly EvolutionNode[] {
  return [node, ...node.evolvesTo.flatMap(walkChain)];
}

const speciesById = new Map(allSpecies.map((species) => [species.speciesId, species]));

/** child speciesId → parent speciesId, and parent → children, built once from the chains. */
const priorById = new Map<string, string>();
const nextById = new Map<string, readonly string[]>();
for (const bloodline of bloodlines) {
  for (const node of walkChain(bloodline.chain)) {
    nextById.set(
      node.speciesId,
      node.evolvesTo.map((child) => child.speciesId),
    );
    for (const child of node.evolvesTo) priorById.set(child.speciesId, node.speciesId);
  }
}

function lookup(speciesId: string): MonSpeciesDef {
  const species = speciesById.get(speciesId);
  if (species === undefined) throw new Error(`Unknown speciesId ${speciesId}`);
  return species;
}

/**
 * The form this one evolves from, as a list after the Digimon API's
 * `priorEvolutions` (https://digi-api.com/). Empty for an Egg. Throws on an
 * unknown id rather than rendering an empty list for a typo.
 */
export function priorEvolutions(speciesId: string): readonly MonSpeciesDef[] {
  lookup(speciesId);
  const prior = priorById.get(speciesId);
  return prior === undefined ? [] : [lookup(prior)];
}

/**
 * The forms this one can evolve into, after the Digimon API's `nextEvolutions`.
 * Three for a Mid (one is chosen, DECISIONS.md #12); empty for a Max.
 */
export function nextEvolutions(speciesId: string): readonly MonSpeciesDef[] {
  lookup(speciesId);
  return (nextById.get(speciesId) ?? []).map(lookup);
}
