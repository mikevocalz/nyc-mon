// Story data for the chart stories (Charts/*). Not exported from the package.
import type { District } from './district-tones';

export const DISTRICTS = ['downtown', 'midtown', 'harlem', 'megacity'] as const satisfies readonly District[];
export const DISTRICT_NAMES: Record<District, string> = {
  downtown: 'Downtown',
  midtown: 'Midtown',
  harlem: 'Harlem',
  megacity: 'Mega City',
};

export const SIGHTINGS = [
  { name: 'Jan', sightings: 420, catches: 160 },
  { name: 'Feb', sightings: 380, catches: 190 },
  { name: 'Mar', sightings: 610, catches: 240 },
  { name: 'Apr', sightings: 540, catches: 310 },
  { name: 'May', sightings: 820, catches: 400 },
  { name: 'Jun', sightings: 940, catches: 470 },
  { name: 'Jul', sightings: 1180, catches: 520 },
  { name: 'Aug', sightings: 1090, catches: 610 },
  { name: 'Sep', sightings: 870, catches: 560 },
  { name: 'Oct', sightings: 990, catches: 640 },
  { name: 'Nov', sightings: 760, catches: 590 },
  { name: 'Dec', sightings: 1240, catches: 720 },
];

export const BOROUGHS = [
  { name: 'Manhattan', catches: 1240, legends: 38 },
  { name: 'Brooklyn', catches: 980, legends: 31 },
  { name: 'Queens', catches: 760, legends: 22 },
  { name: 'Bronx', catches: 540, legends: 19 },
  { name: 'Staten Is.', catches: 210, legends: 7 },
];

export const TYPES = [
  { name: 'Street', value: 42 },
  { name: 'Subway', value: 27 },
  { name: 'Rooftop', value: 18 },
  { name: 'Harbor', value: 9 },
  { name: 'Park', value: 4 },
];

export const SPARK = [12, 18, 14, 22, 19, 27, 25, 31, 29, 36, 34, 41].map((value) => ({ value }));
export const SPARK_DOWN = [41, 37, 39, 30, 32, 27, 24, 26, 20, 18, 21, 15].map((value) => ({ value }));

export const districtControl = { control: 'inline-radio', options: DISTRICTS } as const;
export const glowControl = { control: 'inline-radio', options: ['none', 'low', 'medium', 'high'] } as const;
export const curveControl = { control: 'inline-radio', options: ['smooth', 'linear', 'step', 'stepAfter', 'stepBefore'] } as const;
