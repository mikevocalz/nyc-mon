import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircularProgress } from './progress/CircularProgress';
import { colorControl, DistrictGrid, districtControl } from './progress/story-kit';
import { View } from './tw';

const meta = {
  title: 'Progress/Circular progress',
  component: CircularProgress,
  args: { value: 64, max: 100, size: 'lg', segments: 24, showValue: true, subLabel: 'blocks', glowIntensity: 'medium', district: 'midtown', indeterminate: false },
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    district: districtControl,
    color: colorControl,
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg', 'xl'] },
    segments: { control: { type: 'range', min: 8, max: 48, step: 1 } },
    strokeWidth: { control: { type: 'range', min: 3, max: 24, step: 1 } },
    glowIntensity: { control: 'inline-radio', options: ['none', 'low', 'medium', 'high'] },
  },
  render: (args) => (
    <View className="p-4">
      <CircularProgress {...args} />
    </View>
  ),
} satisfies Meta<typeof CircularProgress>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Indeterminate: Story = { args: { indeterminate: true, subLabel: undefined, centerLabel: 'NYC' } };

export const Districts: Story = {
  render: () => (
    <DistrictGrid>
      {(district) => (
        <View className="flex-row flex-wrap items-center gap-5">
          <CircularProgress district={district} size="sm" value={30} />
          <CircularProgress district={district} size="md" value={72} subLabel="done" />
          <CircularProgress district={district} size="lg" indeterminate centerLabel="NYC" />
        </View>
      )}
    </DistrictGrid>
  ),
};
