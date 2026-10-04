import type { Bloodline, BloodlineId } from '@acme/core';
import { bloodlines } from './mons/index.ts';

export interface StarterEgg {
  readonly bloodlineId: BloodlineId;
  /** The Egg form's Dex record key (e.g. `dex-001`). */
  readonly speciesId: string;
  readonly dexId: number;
  /** Roster v11.1 egg name (DECISIONS.md #9). */
  readonly eggName: string;
  /** The Baby form this egg hatches into: the chain root's only child. */
  readonly hatchesIntoSpeciesId: string;
}

function toStarterEgg(bloodline: Bloodline): StarterEgg {
  const egg = bloodline.chain;
  const [baby, ...extra] = egg.evolvesTo;
  if (egg.stage !== 'Egg' || baby === undefined || extra.length > 0) {
    throw new Error(`${bloodline.bloodlineId} chain must start Egg → one Baby`);
  }
  if (egg.dexId === null || egg.formName === null) {
    throw new Error(`Egg ${egg.speciesId} is missing its roster Dex id or name`);
  }
  return {
    bloodlineId: bloodline.bloodlineId,
    speciesId: egg.speciesId,
    dexId: egg.dexId,
    eggName: egg.formName,
    hatchesIntoSpeciesId: baby.speciesId,
  };
}

/** The three eggs Santoro presents (DECISIONS.md #5), in starter slot order. */
export const eggs: readonly StarterEgg[] = bloodlines.map(toStarterEgg);
