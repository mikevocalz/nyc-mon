import type { BloodlineId, MonSpeciesDef } from '@acme/core';
import { starterBloodlines } from './mons/index.ts';

export interface StarterEgg {
  readonly bloodlineId: BloodlineId;
  /** The Egg form's Dex record key (e.g. `dex-001`). */
  readonly speciesId: string;
  readonly dexId: number;
  /** Roster v11.1 egg name (DECISIONS.md #9). */
  readonly eggName: string;
  /** The Baby form this egg hatches into. Roster chains: Egg → Baby, one Baby per bloodline. */
  readonly hatchesIntoSpeciesId: string;
}

function formAt(forms: readonly MonSpeciesDef[], stage: 'Egg' | 'Baby'): MonSpeciesDef {
  const matches = forms.filter((form) => form.stage === stage);
  const [only] = matches;
  if (matches.length !== 1 || only === undefined) {
    throw new Error(`Expected exactly one ${stage} form, found ${matches.length}`);
  }
  return only;
}

function toStarterEgg(forms: readonly MonSpeciesDef[]): StarterEgg {
  const egg = formAt(forms, 'Egg');
  const baby = formAt(forms, 'Baby');
  if (egg.dexId === null || egg.formName === null) {
    throw new Error(`Egg ${egg.speciesId} is missing its roster Dex id or name`);
  }
  return {
    bloodlineId: egg.bloodlineId,
    speciesId: egg.speciesId,
    dexId: egg.dexId,
    eggName: egg.formName,
    hatchesIntoSpeciesId: baby.speciesId,
  };
}

/** The three eggs Santoro presents (DECISIONS.md #5), in starter slot order. */
export const eggs: readonly StarterEgg[] = starterBloodlines.map((starter) => toStarterEgg(starter.forms));
