import type { Bloodline, EvolutionNode, MonSpeciesDef } from '@acme/core';
import { type BloodlineRef, buildBloodline, rosterForm } from './define.ts';
import { rosterEntries, type RosterEntry } from './roster-v11-1.ts';
import { inheritedDexDetails } from './inherited-v11-details.ts';
import { starterBloodlines } from './starters.ts';

export type { BloodlineRef } from './define.ts';
export { speciesIdForDex } from './define.ts';
export { rosterEntries } from './roster-v11-1.ts';
export type { RosterEntry } from './roster-v11-1.ts';
export { inheritedDexDetails } from './inherited-v11-details.ts';
export { boroughEncounterProfiles } from './borough-encounters.ts';
export type { BoroughName, EncounterTier, BloodlineEncounterProfile } from './borough-encounters.ts';
export { hoodRattiBloodline, hoodRattiForms } from './hood-ratti.ts';
export { bodegaBaddieeCeeBloodline, bodegaBaddieeCeeForms } from './bodega-cee.ts';
export { yoteBloodline, yoteForms } from './yotes.ts';
export { bloodlineLabel, starterBloodlines, starterSpecies } from './starters.ts';
export type { StarterBloodline } from './starters.ts';

/**
 * All 115 registered forms are available via rosterEntries. F19 is intentionally
 * not promoted to a runnable Bloodline: #114 has no canon lifecycle stage and
 * #110 has no approved name. Never invent a stage/branch to satisfy a count.
 * The 18 fully staged F01–F18 Bloodlines are exposed to Dex/chain consumers.
 */
const starterIds = new Set(starterBloodlines.map(({ bloodline }) => bloodline.bloodlineId));
const additionalRefs: BloodlineRef[] = [];
for (const row of rosterEntries) {
  if (starterIds.has(row.bloodlineId) || row.bloodlineId === 'F19') continue;
  if (!additionalRefs.some(({ bloodlineId }) => bloodlineId === row.bloodlineId)) {
    additionalRefs.push({ bloodlineId: row.bloodlineId, bloodlineName: row.bloodlineName });
  }
}

function toResolvedSpecies(row: RosterEntry, ref: BloodlineRef): MonSpeciesDef {
  if (row.stage === null || row.formName === null) {
    throw new Error(`Unresolved canon in ${ref.bloodlineId} #${row.dexId}; do not fabricate an evolution`);
  }
  return rosterForm(ref, row.dexId, row.formName, row.stage, inheritedDexDetails);
}

const additionalBloodlines = additionalRefs.map((ref) => {
  const forms = rosterEntries
    .filter((row) => row.bloodlineId === ref.bloodlineId)
    .map((row) => toResolvedSpecies(row, ref));
  return { bloodline: buildBloodline(ref, forms), forms };
});

/** Three starters first, followed by the other 15 complete Bloodlines. */
export const bloodlines: readonly Bloodline[] = [
  ...starterBloodlines.map(({ bloodline }) => bloodline),
  ...additionalBloodlines.map(({ bloodline }) => bloodline),
];

/** 109 runtime-safe forms. The six F19 records remain in rosterEntries pending canon resolution. */
export const allSpecies: readonly MonSpeciesDef[] = [
  ...starterBloodlines.flatMap(({ forms }) => forms),
  ...additionalBloodlines.flatMap(({ forms }) => forms),
];

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
