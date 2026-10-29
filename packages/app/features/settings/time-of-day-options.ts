// Strings and option order for the Graphics card's time-of-day row
// (docs/COPY_DECK.md § Time of day, `game.timeofday.*`). Pure, with a
// type-only import, so node tests pin the copy without loading the world.
import type { PhysicalPresetId } from '../game/world/physical-look.ts';
import type { SegmentedOption } from '@acme/ui';

export const TIME_OF_DAY_COPY = {
  label: 'Time of day',
  hint: 'Changes the light in the city. Your game is not affected.',
} as const;

const PRESET_LABEL = {
  twilight: 'Dusk',
  golden: 'Golden hour',
  midday: 'Midday',
  midnight: 'Night',
} as const satisfies Record<PhysicalPresetId, string>;

/** Dusk first because it is the default; then the day runs forward (COPY_DECK note). */
const ORDER = ['twilight', 'golden', 'midday', 'midnight'] as const satisfies readonly PhysicalPresetId[];

export const TIME_OF_DAY_OPTIONS: readonly SegmentedOption<PhysicalPresetId>[] = ORDER.map((value) => ({
  value,
  label: PRESET_LABEL[value],
}));
