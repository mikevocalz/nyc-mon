import { allSpecies, bloodlineLabel, bloodlines, eggs } from '@acme/content';
import { CREATURE_ART, type CreatureArt } from '@acme/assets/creatures';
import type { EggRecord, MonInstance } from '@acme/core/types';

/** What every Phase 1 screen shows about one Mon, read from `@acme/content` by `speciesId`. */
export interface MonIdentity {
  readonly monInstanceId: string;
  /** Nickname, else the Baby form name, else the Bloodline label (M17: never "Unknown"). */
  readonly name: string;
  /** The form name from content; null for an unpromoted record. */
  readonly formName: string | null;
  readonly dexId: number | null;
  readonly bloodlineName: string | null;
  /** "Hood Ratti Bloodline" (Decision #11), or null when content has no Bloodline for the species. */
  readonly bloodlineLabel: string | null;
  /** The 2D Baby still (stand-in for the model, PS-007), or undefined when no art ships for the form. */
  readonly art: CreatureArt | undefined;
}

const speciesById = new Map(allSpecies.map((s) => [s.speciesId, s]));
const bloodlineById = new Map(bloodlines.map((b) => [b.bloodlineId, b]));

/** Art for a form by Dex number and kind; undefined when the bundle has none. */
export function artFor(kind: 'baby' | 'egg', dexId: number | null): CreatureArt | undefined {
  if (dexId === null) return undefined;
  return CREATURE_ART.find((a) => a.kind === kind && a.dexId === dexId);
}

/** Identity of a hatched Mon. Pure; never throws for an unknown species. */
export function monIdentity(mon: MonInstance): MonIdentity {
  const species = speciesById.get(mon.speciesId);
  const bloodline = species === undefined ? undefined : bloodlineById.get(species.bloodlineId);
  const label = bloodline === undefined ? null : bloodlineLabel(bloodline);
  const formName = species?.formName ?? null;
  const dexId = species?.dexId ?? null;
  return {
    monInstanceId: mon.monInstanceId,
    name: mon.nickname ?? formName ?? label ?? '',
    formName,
    dexId,
    bloodlineName: bloodline?.bloodlineName ?? null,
    bloodlineLabel: label,
    art: artFor('baby', dexId),
  };
}

/** What M11/M12 show about the egg before the hatch: its name, Dex number and the Baby it hatches into. */
export interface EggIdentity {
  readonly eggName: string;
  readonly eggDexId: number | null;
  readonly eggArt: CreatureArt | undefined;
  /** The Baby form name the egg hatches into (M12 `{babyName}`). */
  readonly babyName: string;
  readonly babyArt: CreatureArt | undefined;
  readonly bloodlineLabel: string | null;
}

export function eggIdentity(egg: EggRecord): EggIdentity {
  const starter = eggs.find((e) => e.speciesId === egg.speciesId);
  const eggSpecies = speciesById.get(egg.speciesId);
  const baby = speciesById.get(egg.hatchesIntoSpeciesId);
  const bloodline = baby === undefined ? undefined : bloodlineById.get(baby.bloodlineId);
  const label = bloodline === undefined ? null : bloodlineLabel(bloodline);
  const eggDexId = starter?.dexId ?? eggSpecies?.dexId ?? null;
  return {
    eggName: starter?.eggName ?? eggSpecies?.formName ?? '',
    eggDexId,
    eggArt: artFor('egg', eggDexId),
    babyName: baby?.formName ?? label ?? '',
    babyArt: artFor('baby', baby?.dexId ?? null),
    bloodlineLabel: label,
  };
}

/** Zero-padded Dex number as the site prints it: 2 → "002". */
export function dexNumber(dexId: number): string {
  return String(dexId).padStart(3, '0');
}
