import { createRandom } from '../sim/random.ts';
import type { CareAction, IdleVignetteDef, MonInstance } from '../types/index.ts';
import { createInitialCareState } from '../sim/care.ts';
import type { SimState } from '../sim/state.ts';

/** Tiny seeded property harness: runs `property` for `runs` generated cases. */
export function forAll<T>(
  runs: number,
  generate: (random: () => number, run: number) => T,
  property: (value: T, run: number) => void,
  baseSeed = 0x5eed,
): void {
  for (let run = 0; run < runs; run++) {
    const random = createRandom(baseSeed + run);
    const value = generate(random, run);
    try {
      property(value, run);
    } catch (error) {
      throw new Error(`Property failed on run ${run} (seed ${baseSeed + run}): ${String(error)}`, { cause: error });
    }
  }
}

export const T0 = Date.UTC(2026, 9, 4, 12, 0, 0);
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

export function makeMon(overrides: Partial<MonInstance> = {}): MonInstance {
  return {
    monInstanceId: 'mon_test',
    speciesId: 'species-test',
    nickname: 'Testy',
    callerId: 'caller-1',
    hatchedAt: T0,
    bond: 0.3,
    stage: 'Baby',
    voiceLineageId: null,
    originBlock: null,
    habitatTags: [],
    activeHours: null,
    ...overrides,
  };
}

export function makeState(random?: () => number): SimState {
  const care = createInitialCareState('mon_test', T0);
  if (random === undefined) return { mon: makeMon(), care };
  return {
    mon: makeMon({ bond: random() }),
    care: { ...care, energy: random(), fullness: random(), social: random() },
  };
}

export function randomAction(random: () => number): CareAction {
  const pick = Math.floor(random() * 4);
  if (pick === 0) return { kind: 'feed', foodClassId: 'food-test', nutrition: random() };
  if (pick === 1) return { kind: 'rest' };
  if (pick === 2) return { kind: 'wake' };
  return { kind: 'play', quality: random() };
}

/** Test-only vignette ids; real tables come from content/. */
export const VIGNETTES: readonly IdleVignetteDef[] = [
  { vignetteId: 'v-awake-a', baseWeight: 2, bondWeight: 0, minBond: 0, activity: 'awake' },
  { vignetteId: 'v-awake-bonded', baseWeight: 0, bondWeight: 4, minBond: 0.5, activity: 'awake' },
  { vignetteId: 'v-asleep', baseWeight: 1, bondWeight: 0, minBond: 0, activity: 'asleep' },
  { vignetteId: 'v-any', baseWeight: 1, bondWeight: 1, minBond: 0, activity: 'any' },
];
