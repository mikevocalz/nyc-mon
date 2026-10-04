import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgressBar } from './progress/ProgressBar';
import { colorControl, DistrictGrid, districtControl } from './progress/story-kit';
import { View } from './tw';

const meta = {
  title: 'Progress/Progress bar',
  component: ProgressBar,
  args: { value: 62, max: 100, indeterminate: false, district: 'midtown', variant: 'solid', size: 'md', blocks: 16, seed: 1, showLabel: true, label: 'Building Midtown', glow: true },
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    district: districtControl,
    color: colorControl,
    variant: { control: 'inline-radio', options: ['solid', 'segmented', 'striped', 'pulse'] },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg'] },
    blocks: { control: { type: 'range', min: 4, max: 40, step: 1 } },
  },
  render: (args) => (
    <View className="max-w-3xl p-4">
      <ProgressBar {...args} />
    </View>
  ),
} satisfies Meta<typeof ProgressBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Indeterminate: Story = { args: { indeterminate: true, label: 'Loading the block' } };

/** Each district's skyline at 40%, in every variant. */
export const Districts: Story = {
  render: () => (
    <DistrictGrid>
      {(district) => (
        <View className="gap-4">
          <ProgressBar district={district} value={40} variant="solid" showLabel label="Solid" />
          <ProgressBar district={district} value={55} variant="segmented" showLabel label="Segmented" size="sm" />
          <ProgressBar district={district} value={70} variant="striped" showLabel label="Striped" size="lg" />
          <ProgressBar district={district} value={85} variant="pulse" showLabel label="Pulse" />
          <ProgressBar district={district} indeterminate size="sm" accessibilityLabel="Loading" />
        </View>
      )}
    </DistrictGrid>
  ),
};
