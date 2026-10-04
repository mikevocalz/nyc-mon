import type { Meta, StoryObj } from '@storybook/react-vite';
import { RainLoader } from './progress/RainLoader';
import { colorControl, DistrictGrid, districtControl } from './progress/story-kit';
import { View } from './tw';

const meta = {
  title: 'Progress/Window loader',
  component: RainLoader,
  args: { size: 'lg', duration: 1600, barCount: 5, barWidthRatio: 0.28, gap: 3, glowIntensity: 'low', district: 'midtown', indeterminate: true },
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    district: districtControl,
    color: colorControl,
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    barCount: { control: { type: 'range', min: 2, max: 8, step: 1 } },
    barWidthRatio: { control: { type: 'range', min: 0.1, max: 0.5, step: 0.02 } },
    duration: { control: { type: 'range', min: 400, max: 4000, step: 100 } },
    glowIntensity: { control: 'inline-radio', options: ['none', 'low', 'medium', 'high'] },
  },
  render: (args) => (
    <View className="p-4">
      <RainLoader {...args} />
    </View>
  ),
} satisfies Meta<typeof RainLoader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithValue: Story = { args: { indeterminate: false, value: 58 } };

export const Districts: Story = {
  render: () => (
    <DistrictGrid>
      {(district) => (
        <View className="flex-row flex-wrap items-end gap-6">
          <RainLoader district={district} size="sm" />
          <RainLoader district={district} size="lg" barCount={6} />
          <RainLoader district={district} size="xl" value={45} />
        </View>
      )}
    </DistrictGrid>
  ),
};
