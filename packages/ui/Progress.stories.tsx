import type { Meta, StoryObj } from '@storybook/react-vite';
import { DISTRICT_NAME, type District } from './elements/tones';
import { Heading, Paragraph, Section } from './html';
import { ArrowLoader, CircularProgress, ProgressBar, RainLoader, TurbineLoader } from './progress';
import { districtControl } from './progress/story-kit';
import { View } from './tw';

interface AllArgs {
  district: District;
  value: number;
}

function AllProgress({ district, value }: AllArgs) {
  return (
    <View className="gap-6 bg-ink-950 p-4 md:p-8">
      <Section className="gap-1">
        <Heading level={2} className="my-0 font-display text-2xl text-ink-50">{DISTRICT_NAME[district]} progress</Heading>
        <Paragraph className="my-0 text-sm text-silver-300">Left column shows the value, right column the indeterminate loop.</Paragraph>
      </Section>
      {[
        ['Skyline bar', <ProgressBar key="v" district={district} value={value} showLabel label="Building the block" />, <ProgressBar key="i" district={district} indeterminate showLabel label="Loading" />],
        ['Window loader', <RainLoader key="v" district={district} value={value} size="lg" />, <RainLoader key="i" district={district} size="lg" />],
        ['Subway arrows', <ArrowLoader key="v" district={district} value={value} />, <ArrowLoader key="i" district={district} />],
        ['Token ring', <CircularProgress key="v" district={district} value={value} size="md" subLabel="done" />, <CircularProgress key="i" district={district} indeterminate size="md" centerLabel="NYC" />],
        ['Rooftop fan', <TurbineLoader key="v" district={district} value={value} size="md" />, <TurbineLoader key="i" district={district} size="md" />],
      ].map(([name, determinate, busy]) => (
        <Section key={name as string} className="gap-3 border-t-2 border-ink-800 pt-4">
          <Heading level={3} className="my-0 font-display text-base text-ink-50">{name}</Heading>
          <View className="gap-6 md:flex-row md:items-center">
            <View className="md:flex-1">{determinate}</View>
            <View className="md:flex-1">{busy}</View>
          </View>
        </Section>
      ))}
    </View>
  );
}

const meta = {
  title: 'Progress/All',
  component: AllProgress,
  parameters: { layout: 'fullscreen' },
  args: { district: 'midtown', value: 64 },
  argTypes: {
    district: districtControl,
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
  },
} satisfies Meta<typeof AllProgress>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
export const Downtown: Story = { args: { district: 'downtown', value: 30 } };
export const Harlem: Story = { args: { district: 'harlem', value: 80 } };
export const MegaCity: Story = { args: { district: 'megacity', value: 100 } };
