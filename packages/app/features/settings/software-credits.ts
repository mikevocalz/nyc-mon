// The "Software" group in Legal & credits (docs/COPY_DECK.md § Credits:
// Slop New York). Kept apart from the map-data credits: Slop supplies
// rendering techniques and no data, so its row must not read as a data
// credit. The line is fixed by docs/plans/slop-grade-city-prompt.md §5.8;
// the full licence text is docs/licenses/slop-newyork-mit.md.
export interface SoftwareCredit {
  readonly line: string;
  readonly linkLabel: string;
  readonly url: string;
}

export const SOFTWARE_CREDITS_GROUP = 'Software';

export const SOFTWARE_CREDITS: readonly SoftwareCredit[] = [
  {
    line: 'Rendering techniques adapted from Slop New York by Mr.doob (MIT)',
    linkLabel: 'View the Slop New York repository',
    url: 'https://github.com/mrdoob/slop-newyork',
  },
];
