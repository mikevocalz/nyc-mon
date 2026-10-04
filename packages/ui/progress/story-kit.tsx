// Shared bits for the progress and element stories.
import type { ReactNode } from 'react';
import { DISTRICTS, DISTRICT_NAME, type District } from '../elements/tones';
import { Heading, Section } from '../html';
import { View } from '../tw';

export const districtControl = { control: 'inline-radio', options: DISTRICTS } as const;
export const colorControl = {
  control: 'select',
  options: [undefined, 'orange', 'royal', 'carolina', 'leaf', 'apple', 'brick', 'white', 'cyan', 'pink', 'green'],
} as const;

/** One cell per district: stacked on phones, a 2x2 grid from md up. */
export function DistrictGrid({ children }: { children: (district: District) => ReactNode }) {
  return (
    <View className="gap-4 p-4 md:flex-row md:flex-wrap">
      {DISTRICTS.map((district) => (
        <Section key={district} className="gap-3 border-2 border-ink-800 bg-ink-950 p-4 md:w-[calc(50%-0.5rem)]">
          <Heading level={3} className="my-0 font-display text-base text-ink-50">{DISTRICT_NAME[district]}</Heading>
          {children(district)}
        </Section>
      ))}
    </View>
  );
}
