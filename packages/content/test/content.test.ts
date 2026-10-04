import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LIFECYCLE_STAGES, MonSpeciesDefSchema } from '@acme/core';
import { describe, expect, it } from 'vitest';
import { allSpecies, bloodlineLabel, eggs, speciesIdForDex, starterBloodlines } from '../index.ts';

const ROSTER_PATH = fileURLToPath(
  new URL('../../../docs/canon/source/NYC_MON_Egg_Baby_All_Forms_Roster_v11_1.md', import.meta.url),
);

interface RosterRow {
  readonly dexId: number;
  readonly bloodlineId: string;
  readonly bloodlineName: string;
  readonly formName: string;
  readonly stage: string;
}

/** Rows of the roster's "Complete #001–#115 registry" table: `| #002 | F01 · Hood Ratti | Squeaklet | Baby |`. */
function readRosterRegistry(): readonly RosterRow[] {
  const rowPattern = /^\| #(\d{3}) \| (F\d{2}) · (.+?) \| (.+?) \| (.+?) \|$/;
  return readFileSync(ROSTER_PATH, 'utf8')
    .split('\n')
    .flatMap((line) => {
      const match = rowPattern.exec(line);
      if (match === null) return [];
      const [, dex, bloodlineId, bloodlineName, formName, stage] = match;
      if (!dex || !bloodlineId || !bloodlineName || !formName || !stage) return [];
      return [{ dexId: Number(dex), bloodlineId, bloodlineName, formName, stage }];
    });
}

const roster = readRosterRegistry();

describe('roster v11.1 fixture', () => {
  it('reads all 115 registry rows', () => {
    expect(roster).toHaveLength(115);
  });
});

describe('content integrity (§8)', () => {
  it('every record parses through MonSpeciesDefSchema', () => {
    for (const species of allSpecies) {
      const result = MonSpeciesDefSchema.safeParse(species);
      expect(result.success, species.speciesId).toBe(true);
    }
  });

  it('Dex ids and species ids are unique', () => {
    const dexIds = allSpecies.map((species) => species.dexId);
    const speciesIds = allSpecies.map((species) => species.speciesId);
    expect(new Set(dexIds).size).toBe(allSpecies.length);
    expect(new Set(speciesIds).size).toBe(allSpecies.length);
  });

  it('every species id is derived from its Dex id', () => {
    for (const species of allSpecies) {
      expect(species.dexId).not.toBeNull();
      expect(species.speciesId).toBe(speciesIdForDex(species.dexId ?? -1));
    }
  });

  it('each starter bloodline matches the roster registry exactly, form for form', () => {
    for (const { bloodline, forms } of starterBloodlines) {
      const expected = roster.filter((row) => row.bloodlineId === bloodline.bloodlineId);
      const actual = forms.map((form) => ({
        dexId: form.dexId,
        bloodlineId: form.bloodlineId,
        bloodlineName: form.bloodlineName,
        formName: form.formName,
        stage: form.stage,
      }));
      expect(expected.length).toBeGreaterThan(0);
      expect(actual).toEqual(expected);
    }
  });

  it('every bloodline has one Egg, one Baby, one Small, one Mid and at least one Max', () => {
    for (const { bloodline, forms } of starterBloodlines) {
      for (const stage of LIFECYCLE_STAGES) {
        const count = forms.filter((form) => form.stage === stage).length;
        if (stage === 'Max') expect(count, `${bloodline.bloodlineId} ${stage}`).toBeGreaterThanOrEqual(1);
        else expect(count, `${bloodline.bloodlineId} ${stage}`).toBe(1);
      }
    }
  });

  it('every form in a bloodline file carries that bloodline', () => {
    for (const { bloodline, forms } of starterBloodlines) {
      for (const form of forms) {
        expect(form.bloodlineId).toBe(bloodline.bloodlineId);
        expect(form.bloodlineName).toBe(bloodline.bloodlineName);
      }
    }
  });

  it('starters are F01, F02, F12 in slots 1-3 (DECISIONS.md #1)', () => {
    expect(starterBloodlines.map((starter) => [starter.slot, starter.bloodline.bloodlineId])).toEqual([
      [1, 'F01'],
      [2, 'F02'],
      [3, 'F12'],
    ]);
  });

  it('labels read "<family name> Bloodline" (DECISIONS.md #11)', () => {
    expect(starterBloodlines.map((starter) => bloodlineLabel(starter.bloodline))).toEqual([
      'Hood Ratti Bloodline',
      'Bodega Baddiee Cee Bloodline',
      'Yote Bloodline',
    ]);
  });
});

describe('eggs', () => {
  it('lists the roster egg names, each hatching into its bloodline Baby', () => {
    expect(eggs).toEqual([
      { bloodlineId: 'F01', speciesId: 'dex-001', dexId: 1, eggName: 'Metro Egg', hatchesIntoSpeciesId: 'dex-002' },
      { bloodlineId: 'F02', speciesId: 'dex-008', dexId: 8, eggName: 'Corner Egg', hatchesIntoSpeciesId: 'dex-009' },
      { bloodlineId: 'F12', speciesId: 'dex-061', dexId: 61, eggName: 'Prism Egg', hatchesIntoSpeciesId: 'dex-062' },
    ]);
  });
});
